// lib/messaging/send.ts
// ============================================================
// Envoi d'un message (courriel ou SMS) + journalisation dans `messages`.
// ============================================================

import type { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/messaging/email'
import { sendSms } from '@/lib/messaging/sms'
import type { MessageChannel } from '@/lib/supabase/types'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

export interface SendMessageInput {
  channel: MessageChannel
  to: string
  subject?: string | null
  body: string
  ownerId?: string | null
  leadId?: string | null
  projectId?: string | null
  isAutomated?: boolean
}

export interface SendMessageResult {
  ok: boolean
  error?: string
  messageId?: string
}

export async function sendMessage(
  supabase: SupabaseServer,
  input: SendMessageInput
): Promise<SendMessageResult> {
  const result =
    input.channel === 'email'
      ? await sendEmail({ to: input.to, subject: input.subject ?? '(sans objet)', body: input.body })
      : await sendSms({ to: input.to, body: input.body })

  const { data: logged } = await supabase
    .from('messages')
    .insert({
      owner_id: input.ownerId ?? null,
      lead_id: input.leadId ?? null,
      project_id: input.projectId ?? null,
      channel: input.channel,
      direction: 'outbound',
      to_address: input.to,
      subject: input.subject ?? null,
      body: input.body,
      status: result.ok ? 'sent' : 'failed',
      provider_id: result.providerId ?? null,
      error: result.error ?? null,
      is_automated: input.isAutomated ?? false,
      sent_at: result.ok ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  return { ok: result.ok, error: result.error, messageId: logged?.id }
}
