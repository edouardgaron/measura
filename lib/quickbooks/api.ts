// lib/quickbooks/api.ts
// ============================================================
// Client QuickBooks Online minimal : rafraîchissement de jeton +
// find-or-create client + création de facture.
// ============================================================

import type { createClient } from '@/lib/supabase/server'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

function apiBase(): string {
  return process.env.QUICKBOOKS_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

interface Conn {
  access_token: string
  refresh_token: string | null
  realm_id: string | null
  token_expires_at: string | null
}

/** Renvoie un access_token valide (rafraîchi si expiré) ou null. */
async function getValidToken(supabase: SupabaseServer, userId: string): Promise<Conn | null> {
  const { data } = await supabase
    .from('accounting_connections')
    .select('access_token, refresh_token, realm_id, token_expires_at')
    .eq('owner_id', userId)
    .eq('provider', 'quickbooks')
    .maybeSingle()
  if (!data?.access_token) return null

  const conn = data as Conn
  const expired = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() < Date.now() + 60_000 : false
  if (!expired || !conn.refresh_token) return conn

  // Rafraîchissement
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
  if (!clientId || !clientSecret) return conn
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}`, Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token }).toString(),
  })
  if (!res.ok) return conn
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number }
  if (!json.access_token) return conn

  const updated: Conn = {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? conn.refresh_token,
    realm_id: conn.realm_id,
    token_expires_at: json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : conn.token_expires_at,
  }
  await supabase.from('accounting_connections').update({
    access_token: updated.access_token, refresh_token: updated.refresh_token, token_expires_at: updated.token_expires_at,
  }).eq('owner_id', userId).eq('provider', 'quickbooks')
  return updated
}

async function qb<T>(conn: Conn, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}/v3/company/${conn.realm_id}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${conn.access_token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`QuickBooks ${res.status}: ${txt.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

interface InvoiceLine { description: string; amount: number }

export interface PushInvoiceInput {
  customerName: string
  customerEmail?: string | null
  lines: InvoiceLine[]
  docNumber?: string
}

/** Pousse une facture vers QuickBooks (crée le client au besoin). Retourne l'id QB. */
export async function pushInvoiceToQuickBooks(
  supabase: SupabaseServer, userId: string, input: PushInvoiceInput
): Promise<{ qbInvoiceId: string }> {
  const conn = await getValidToken(supabase, userId)
  if (!conn || !conn.realm_id) throw new Error('QuickBooks non connecté.')

  // Find-or-create customer
  const safeName = input.customerName.replace(/'/g, "\\'")
  const query = `select * from Customer where DisplayName = '${safeName}'`
  const found = await qb<{ QueryResponse?: { Customer?: { Id: string }[] } }>(conn, 'GET', `query?query=${encodeURIComponent(query)}`)
  let customerId = found.QueryResponse?.Customer?.[0]?.Id
  if (!customerId) {
    const created = await qb<{ Customer?: { Id: string } }>(conn, 'POST', 'customer', {
      DisplayName: input.customerName,
      PrimaryEmailAddr: input.customerEmail ? { Address: input.customerEmail } : undefined,
    })
    customerId = created.Customer?.Id
  }
  if (!customerId) throw new Error('Impossible de créer le client QuickBooks.')

  const Line = input.lines.map((l) => ({
    DetailType: 'SalesItemLineDetail',
    Amount: Math.round(l.amount * 100) / 100,
    Description: l.description,
    SalesItemLineDetail: {},
  }))

  const invoice = await qb<{ Invoice?: { Id: string } }>(conn, 'POST', 'invoice', {
    CustomerRef: { value: customerId },
    DocNumber: input.docNumber,
    Line,
  })
  const qbInvoiceId = invoice.Invoice?.Id
  if (!qbInvoiceId) throw new Error('Création de la facture QuickBooks échouée.')
  return { qbInvoiceId }
}
