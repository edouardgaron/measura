// lib/messaging/sms.ts
// ============================================================
// Envoi de SMS via l'API REST Twilio (pas de SDK, fetch + Basic auth).
// ============================================================

import type { SendResult } from '@/lib/messaging/email'

export function isSmsConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER)
}

export async function sendSms(params: { to: string; body: string }): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) {
    return { ok: false, error: 'Twilio non configuré (TWILIO_ACCOUNT_SID / AUTH_TOKEN / FROM_NUMBER).' }
  }
  if (!params.to) return { ok: false, error: 'Numéro de destinataire manquant.' }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64')
  const form = new URLSearchParams({ To: params.to, From: from, Body: params.body })

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}` },
      body: form.toString(),
    })
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string }
    if (!res.ok) return { ok: false, error: json.message ?? `Twilio HTTP ${res.status}` }
    return { ok: true, providerId: json.sid }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur envoi SMS' }
  }
}
