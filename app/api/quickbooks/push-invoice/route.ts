// app/api/quickbooks/push-invoice/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushInvoiceToQuickBooks } from '@/lib/quickbooks/api'
import type { InvoiceItem } from '@/lib/supabase/types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { invoiceId?: string } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }
  if (!body.invoiceId) return NextResponse.json({ error: 'invoiceId requis' }, { status: 422 })

  const { data: invoice } = await supabase
    .from('invoices')
    .select('invoice_number, client_name, client_email, items:invoice_items(description, total)')
    .eq('id', body.invoiceId)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const items = (invoice.items as Pick<InvoiceItem, 'description' | 'total'>[]) ?? []
  const lines = items.length > 0
    ? items.map((i) => ({ description: i.description, amount: i.total ?? 0 }))
    : [{ description: `Facture ${invoice.invoice_number}`, amount: 0 }]

  try {
    const { qbInvoiceId } = await pushInvoiceToQuickBooks(supabase, user.id, {
      customerName: invoice.client_name ?? 'Client',
      customerEmail: invoice.client_email,
      lines,
      docNumber: invoice.invoice_number,
    })
    await supabase.from('invoices')
      .update({ qb_invoice_id: qbInvoiceId, qb_synced_at: new Date().toISOString() })
      .eq('id', body.invoiceId)
    return NextResponse.json({ ok: true, qbInvoiceId })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur QuickBooks' }, { status: 502 })
  }
}
