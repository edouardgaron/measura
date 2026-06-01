// app/api/leads/[leadId]/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { leadVars, renderTemplate } from '@/lib/messaging/render'
import { sendMessage } from '@/lib/messaging/send'
import type { Lead, MessageChannel } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ leadId: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { leadId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { channel?: string; templateId?: string; subject?: string; body?: string } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  const channel: MessageChannel = body.channel === 'sms' ? 'sms' : 'email'

  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single()
  if (!lead) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })

  const to = channel === 'email' ? (lead as Lead).contact_email : (lead as Lead).contact_phone
  if (!to) {
    return NextResponse.json(
      { error: channel === 'email' ? 'Aucun courriel pour ce lead.' : 'Aucun numéro pour ce lead.' },
      { status: 422 }
    )
  }

  // Nom de compagnie pour les variables
  const { data: profile } = await supabase.from('profiles').select('company_name, full_name').eq('id', user.id).single()
  const vars = leadVars(lead as Lead, profile?.company_name ?? profile?.full_name)

  let subject: string | null = null
  let text = ''

  if (body.templateId) {
    const { data: tpl } = await supabase.from('message_templates').select('*').eq('id', body.templateId).single()
    if (!tpl) return NextResponse.json({ error: 'Modèle introuvable' }, { status: 404 })
    subject = tpl.subject ? renderTemplate(tpl.subject, vars) : null
    text = renderTemplate(tpl.body, vars)
  } else {
    if (!body.body?.trim()) return NextResponse.json({ error: 'Contenu requis' }, { status: 422 })
    subject = body.subject ? renderTemplate(body.subject, vars) : null
    text = renderTemplate(body.body, vars)
  }

  const res = await sendMessage(supabase, {
    channel, to, subject, body: text,
    ownerId: lead.owner_id, leadId: lead.id, isAutomated: false,
  })

  // Journalise dans l'historique du lead
  await supabase.from('lead_activities').insert({
    lead_id: lead.id,
    author_id: user.id,
    type: channel,
    content: `${res.ok ? 'Envoyé' : 'Échec'} ${channel === 'email' ? 'courriel' : 'SMS'}${subject ? ` : ${subject}` : ''}`,
    metadata: { ok: res.ok, manual: true },
  })
  await supabase.from('leads').update({ last_activity_at: new Date().toISOString() }).eq('id', lead.id)

  if (!res.ok) return NextResponse.json({ error: res.error ?? 'Échec envoi' }, { status: 502 })
  return NextResponse.json({ ok: true })
}
