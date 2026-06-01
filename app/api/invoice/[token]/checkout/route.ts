// app/api/invoice/[token]/checkout/route.ts
// Paiement public d'une facture via son token de partage (sans authentification).
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createInvoiceCheckout, type CheckoutKind } from '@/lib/stripe/checkout'

type RouteContext = { params: Promise<{ token: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params
  const admin = await createAdminClient()

  let body: { kind?: CheckoutKind } = {}
  try {
    body = await request.json()
  } catch {
    /* default */
  }
  const kind: CheckoutKind = body.kind === 'deposit' ? 'deposit' : 'balance'

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, project_id, invoice_number, currency, total, amount_paid, deposit_amount, client_email, share_token, status')
    .eq('share_token', token)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  if (invoice.status === 'draft' || invoice.status === 'cancelled') {
    return NextResponse.json({ error: 'Cette facture n’est pas payable.' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const result = await createInvoiceCheckout(invoice, kind, appUrl)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  await admin.from('invoices').update({ stripe_session_id: result.sessionId }).eq('id', invoice.id)
  return NextResponse.json({ url: result.url })
}
