// lib/messaging/automations.ts
// ============================================================
// Orchestration des automatisations CRM :
//  - runStageAutomations : déclenché au changement d'étape d'un lead
//  - processScheduledMessages : traite les relances planifiées dues
// ============================================================

import type { createClient } from '@/lib/supabase/server'
import { leadVars, renderTemplate } from '@/lib/messaging/render'
import { sendMessage } from '@/lib/messaging/send'
import type { AutomationRule, Lead, MessageChannel, MessageTemplate } from '@/lib/supabase/types'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

function recipientFor(channel: MessageChannel, lead: Pick<Lead, 'contact_email' | 'contact_phone'>): string | null {
  return channel === 'email' ? lead.contact_email ?? null : lead.contact_phone ?? null
}

/**
 * Évalue les règles actives pour l'étape atteinte et exécute/planifie les envois.
 * Ne lève jamais : toute erreur est avalée (ne doit pas bloquer la mise à jour du lead).
 */
export async function runStageAutomations(
  supabase: SupabaseServer,
  args: { lead: Lead; stage: string; companyName?: string | null }
): Promise<{ sent: number; scheduled: number }> {
  let sent = 0
  let scheduled = 0
  try {
    const { data: rules } = await supabase
      .from('automation_rules')
      .select('*, template:message_templates(*)')
      .eq('owner_id', args.lead.owner_id)
      .eq('trigger_stage', args.stage)
      .eq('is_active', true)

    if (!rules || rules.length === 0) return { sent, scheduled }

    const vars = leadVars(args.lead, args.companyName)

    for (const r of rules as (AutomationRule & { template: MessageTemplate | null })[]) {
      const template = r.template
      if (!template) continue
      const to = recipientFor(r.channel, args.lead)
      if (!to) continue // pas de coordonnée pour ce canal

      const subject = template.subject ? renderTemplate(template.subject, vars) : null
      const body = renderTemplate(template.body, vars)

      if ((r.delay_minutes ?? 0) <= 0) {
        const res = await sendMessage(supabase, {
          channel: r.channel, to, subject, body,
          ownerId: args.lead.owner_id, leadId: args.lead.id, isAutomated: true,
        })
        if (res.ok) sent++
        await supabase.from('lead_activities').insert({
          lead_id: args.lead.id,
          author_id: args.lead.owner_id,
          type: r.channel,
          content: `${res.ok ? 'Envoi automatique' : 'Échec envoi auto'} (${r.name})${subject ? ` : ${subject}` : ''}`,
          metadata: { automated: true, rule_id: r.id, ok: res.ok },
        })
      } else {
        const runAt = new Date(Date.now() + r.delay_minutes * 60_000).toISOString()
        await supabase.from('scheduled_messages').insert({
          owner_id: args.lead.owner_id,
          rule_id: r.id,
          lead_id: args.lead.id,
          channel: r.channel,
          to_address: to,
          subject,
          body,
          run_at: runAt,
          status: 'pending',
        })
        scheduled++
      }
    }
  } catch (e) {
    console.error('runStageAutomations error:', e)
  }
  return { sent, scheduled }
}

/**
 * Traite les messages planifiés dont l'échéance est passée.
 * Utilisé par l'endpoint cron (client admin).
 */
export async function processScheduledMessages(
  supabase: SupabaseServer,
  limit = 50
): Promise<{ processed: number; sent: number; failed: number }> {
  const nowIso = new Date().toISOString()
  const { data: due } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('status', 'pending')
    .lte('run_at', nowIso)
    .order('run_at', { ascending: true })
    .limit(limit)

  let sent = 0
  let failed = 0
  for (const m of due ?? []) {
    const res = await sendMessage(supabase, {
      channel: m.channel,
      to: m.to_address,
      subject: m.subject,
      body: m.body,
      ownerId: m.owner_id,
      leadId: m.lead_id,
      isAutomated: true,
    })
    await supabase
      .from('scheduled_messages')
      .update({
        status: res.ok ? 'sent' : 'failed',
        error: res.error ?? null,
        sent_at: res.ok ? new Date().toISOString() : null,
      })
      .eq('id', m.id)

    if (m.lead_id) {
      await supabase.from('lead_activities').insert({
        lead_id: m.lead_id,
        author_id: m.owner_id,
        type: m.channel,
        content: `${res.ok ? 'Relance automatique envoyée' : 'Échec relance'}${m.subject ? ` : ${m.subject}` : ''}`,
        metadata: { automated: true, scheduled: true, ok: res.ok },
      })
    }

    if (res.ok) sent++
    else failed++
  }

  return { processed: (due ?? []).length, sent, failed }
}
