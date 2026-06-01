// lib/messaging/email.ts
// ============================================================
// Envoi de courriel via Resend (API REST, pas de SDK).
// Renvoie un résultat même si non configuré (graceful).
// ============================================================

export interface SendResult {
  ok: boolean
  providerId?: string
  error?: string
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

export async function sendEmail(params: {
  to: string
  subject: string
  body: string      // texte simple ; converti en HTML basique
  html?: string
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'Resend non configuré (RESEND_API_KEY manquante).' }

  const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@measura.app'
  const html =
    params.html ??
    `<div style="font-family: sans-serif; max-width: 560px; margin: auto; color:#1f2937; line-height:1.5;">
       ${params.body
         .split('\n')
         .map((line) => (line.trim() ? `<p style="margin:0 0 10px;">${escapeHtml(line)}</p>` : '<br/>'))
         .join('')}
     </div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to: params.to, subject: params.subject, html }),
    })
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok) return { ok: false, error: json.message ?? `Resend HTTP ${res.status}` }
    return { ok: true, providerId: json.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur envoi courriel' }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
