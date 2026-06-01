// app/api/projects/[projectId]/invoices/[invoiceId]/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { createInvoiceCheckout, type CheckoutKind } from '@/lib/stripe/checkout'

type RouteContext = { params: Promise<{ projectId: string; invoiceId: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId, invoiceId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: { kind?: CheckoutKind } = {}
  try {
    body = await request.json()
  } catch {
    /* default */
  }
  const kind: CheckoutKind = body.kind === 'deposit' ? 'deposit' : 'balance'

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, project_id, invoice_number, currency, total, amount_paid, deposit_amount, client_email, share_token')
    .eq('id', invoiceId)
    .eq('project_id', projectId)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const result = await createInvoiceCheckout(invoice, kind, appUrl)

  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  await supabase
    .from('invoices')
    .update({ stripe_session_id: result.sessionId, status: 'sent', updated_at: new Date().toISOString() })
    .eq('id', invoiceId)

  return NextResponse.json({ url: result.url })
}
