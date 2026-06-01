// app/api/projects/[projectId]/invoices/[invoiceId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { computeInvoiceTotals } from '@/lib/invoice/compute'

type RouteContext = { params: Promise<{ projectId: string; invoiceId: string }> }

const SELECT = `*, items:invoice_items(id, sort_order, description, quantity, unit, unit_price, total), payments:payments(id, amount, method, status, is_deposit, paid_at)`

interface ItemInput {
  description: string
  quantity?: number | null
  unit?: string | null
  unit_price?: number | null
}

const SCALAR = [
  'invoice_number', 'status', 'client_name', 'client_email', 'client_address',
  'issue_date', 'due_date', 'discount_amount', 'tax_gst_rate', 'tax_qst_rate',
  'deposit_amount', 'notes', 'terms',
] as const

const STATUS = ['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled']

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { projectId, invoiceId } = await params
  const supabase = await createClient()
  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await supabase
    .from('invoices')
    .select(SELECT)
    .eq('id', invoiceId)
    .eq('project_id', projectId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  return NextResponse.json({ invoice: data })
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { projectId, invoiceId } = await params
  const supabase = await createClient()
  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Record<string, unknown> & { items?: ItemInput[] } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  if (typeof body.status === 'string' && !STATUS.includes(body.status)) {
    return NextResponse.json({ error: 'statut invalide' }, { status: 422 })
  }

  // Récupère l'état courant (taux, montant payé)
  const { data: current } = await supabase
    .from('invoices')
    .select('tax_gst_rate, tax_qst_rate, discount_amount, amount_paid')
    .eq('id', invoiceId)
    .eq('project_id', projectId)
    .single()
  if (!current) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of SCALAR) {
    if (body[key] !== undefined) patch[key] = body[key]
  }

  // Remplacement des lignes + recalcul des totaux
  if (body.items !== undefined) {
    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
    if (body.items.length > 0) {
      await supabase.from('invoice_items').insert(
        body.items.map((it, i) => ({
          invoice_id: invoiceId,
          sort_order: i,
          description: it.description || '—',
          quantity: it.quantity ?? 1,
          unit: it.unit ?? null,
          unit_price: it.unit_price ?? 0,
        }))
      )
    }

    const gstRate = (patch.tax_gst_rate as number) ?? current.tax_gst_rate
    const qstRate = (patch.tax_qst_rate as number) ?? current.tax_qst_rate
    const discount = (patch.discount_amount as number) ?? current.discount_amount
    const totals = computeInvoiceTotals({
      items: body.items.map((it) => ({ quantity: it.quantity, unit_price: it.unit_price })),
      discount_amount: discount,
      tax_gst_rate: gstRate,
      tax_qst_rate: qstRate,
      amount_paid: current.amount_paid,
    })
    patch.subtotal = totals.subtotal
    patch.tax_gst = totals.tax_gst
    patch.tax_qst = totals.tax_qst
    patch.total = totals.total
  } else if (body.discount_amount !== undefined || body.tax_gst_rate !== undefined || body.tax_qst_rate !== undefined) {
    // Recalcul taxes sans changer les lignes
    const { data: items } = await supabase.from('invoice_items').select('quantity, unit_price').eq('invoice_id', invoiceId)
    const totals = computeInvoiceTotals({
      items: items ?? [],
      discount_amount: (patch.discount_amount as number) ?? current.discount_amount,
      tax_gst_rate: (patch.tax_gst_rate as number) ?? current.tax_gst_rate,
      tax_qst_rate: (patch.tax_qst_rate as number) ?? current.tax_qst_rate,
      amount_paid: current.amount_paid,
    })
    patch.subtotal = totals.subtotal
    patch.tax_gst = totals.tax_gst
    patch.tax_qst = totals.tax_qst
    patch.total = totals.total
  }

  await supabase.from('invoices').update(patch).eq('id', invoiceId).eq('project_id', projectId)

  const { data: full } = await supabase.from('invoices').select(SELECT).eq('id', invoiceId).single()
  return NextResponse.json({ invoice: full })
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { projectId, invoiceId } = await params
  const supabase = await createClient()
  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId).eq('project_id', projectId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
