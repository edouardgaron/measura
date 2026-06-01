// app/api/projects/[projectId]/invoices/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { computeInvoiceTotals, TPS_RATE, TVQ_RATE } from '@/lib/invoice/compute'

type RouteContext = { params: Promise<{ projectId: string }> }

const SELECT = `*, items:invoice_items(id, sort_order, description, quantity, unit, unit_price, total), payments:payments(id, amount, method, status, is_deposit, paid_at)`

// ── GET — liste des factures ──────────────────────────────────────────────────
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await supabase
    .from('invoices')
    .select(SELECT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoices: data ?? [] })
}

// ── POST — créer une facture (vierge ou depuis une estimation) ────────────────
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const userId = auth.user!.id

  let body: { estimateId?: string; depositPercent?: number } = {}
  try {
    body = await request.json()
  } catch {
    /* defaults */
  }

  // Projet + compagnie (pour taxes & snapshot client)
  const { data: project } = await supabase
    .from('projects')
    .select('id, company_id, address_line1, address_city, address_province, address_postal')
    .eq('id', projectId)
    .single()
  if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

  // Taux de taxes : compagnie si dispo, sinon défauts Québec
  let gstRate = TPS_RATE
  let qstRate = TVQ_RATE
  if (project.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('tax_gst, tax_qst')
      .eq('id', project.company_id)
      .single()
    if (company) {
      gstRate = company.tax_gst ?? TPS_RATE
      qstRate = company.tax_qst ?? TVQ_RATE
    }
  }

  // Snapshot client (proposition récente sinon membre client)
  const { data: proposal } = await supabase
    .from('proposals')
    .select('client_name')
    .eq('project_id', projectId)
    .not('client_name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data: clientMember } = await supabase
    .from('project_members')
    .select('email')
    .eq('project_id', projectId)
    .eq('role', 'client')
    .limit(1)
    .maybeSingle()

  const clientAddress =
    [project.address_line1, project.address_city, project.address_province, project.address_postal]
      .filter(Boolean)
      .join(', ') || null

  // Lignes depuis l'estimation (si fournie)
  let lineRows: { description: string; quantity: number; unit: string | null; unit_price: number; sort_order: number }[] = []
  let estimateId: string | null = null
  if (body.estimateId) {
    const { data: est } = await supabase
      .from('estimates')
      .select('id, items:estimate_items(description, quantity, unit, unit_price, sort_order)')
      .eq('id', body.estimateId)
      .eq('project_id', projectId)
      .single()
    if (est) {
      estimateId = est.id
      lineRows = ((est.items as { description: string; quantity: number | null; unit: string | null; unit_price: number | null; sort_order: number | null }[]) ?? []).map((it, i) => ({
        description: it.description || '—',
        quantity: it.quantity ?? 1,
        unit: it.unit ?? null,
        unit_price: it.unit_price ?? 0,
        sort_order: it.sort_order ?? i,
      }))
    }
  }

  const totals = computeInvoiceTotals({
    items: lineRows,
    tax_gst_rate: gstRate,
    tax_qst_rate: qstRate,
  })

  const depositPercent = body.depositPercent ?? 0
  const depositAmount = depositPercent > 0 ? Math.round(totals.total * (depositPercent / 100) * 100) / 100 : 0

  // Numéro de facture séquentiel (par compagnie sinon par créateur)
  const year = new Date().toISOString().slice(0, 4)
  let countQuery = supabase.from('invoices').select('id', { count: 'exact', head: true })
  countQuery = project.company_id
    ? countQuery.eq('company_id', project.company_id)
    : countQuery.eq('created_by', userId)
  const { count } = await countQuery
  const invoiceNumber = `F-${year}-${String((count ?? 0) + 1).padStart(3, '0')}`

  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .insert({
      project_id: projectId,
      company_id: project.company_id ?? null,
      estimate_id: estimateId,
      created_by: userId,
      invoice_number: invoiceNumber,
      status: 'draft',
      client_name: proposal?.client_name ?? clientMember?.email ?? null,
      client_email: clientMember?.email ?? null,
      client_address: clientAddress,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: null,
      currency: 'CAD',
      subtotal: totals.subtotal,
      discount_amount: 0,
      tax_gst_rate: gstRate,
      tax_qst_rate: qstRate,
      tax_gst: totals.tax_gst,
      tax_qst: totals.tax_qst,
      total: totals.total,
      deposit_amount: depositAmount,
      amount_paid: 0,
      notes: null,
      terms: 'Paiement dû à la réception. Merci de votre confiance.',
      locale: 'fr',
    })
    .select('*')
    .single()

  if (invError || !invoice) {
    return NextResponse.json({ error: invError?.message ?? 'Erreur création facture' }, { status: 500 })
  }

  if (lineRows.length > 0) {
    await supabase.from('invoice_items').insert(lineRows.map((r) => ({ ...r, invoice_id: invoice.id })))
  }

  const { data: full } = await supabase.from('invoices').select(SELECT).eq('id', invoice.id).single()
  return NextResponse.json({ invoice: full ?? invoice }, { status: 201 })
}
