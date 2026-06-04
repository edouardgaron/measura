// app/api/expenses/route.ts
// ============================================================
// Module Dépenses — CRUD global (RLS isole par entreprise/projet).
// GET    : liste (optionnel ?projectId=…)
// POST   : crée une dépense (calcule total si absent)
// DELETE : ?id=…
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_CATEGORIES = ['material', 'labor', 'equipment', 'subcontractor', 'permit', 'fuel', 'rental', 'insurance', 'office', 'other']
const VALID_METHODS = ['cash', 'card', 'cheque', 'transfer', 'other']

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const projectId = request.nextUrl.searchParams.get('projectId')
  let q = supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(500)
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expenses: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }

  const amount = Number(body.amount ?? 0)
  if (!(amount >= 0)) return NextResponse.json({ error: 'Montant invalide' }, { status: 422 })
  const category = String(body.category ?? 'material')
  if (!VALID_CATEGORIES.includes(category)) return NextResponse.json({ error: 'Catégorie invalide' }, { status: 422 })
  const method = String(body.payment_method ?? 'card')
  if (!VALID_METHODS.includes(method)) return NextResponse.json({ error: 'Méthode invalide' }, { status: 422 })

  // Taxes : fournies, sinon calculées (TPS 5 %, TVQ 9,975 %).
  const taxGst = body.tax_gst != null ? Number(body.tax_gst) : +(amount * 0.05).toFixed(2)
  const taxQst = body.tax_qst != null ? Number(body.tax_qst) : +(amount * 0.09975).toFixed(2)
  const total = body.total != null ? Number(body.total) : +(amount + taxGst + taxQst).toFixed(2)

  // company_id : depuis l'appartenance d'entreprise de l'utilisateur (best-effort).
  let companyId: string | null = (body.company_id as string) ?? null
  if (!companyId) {
    const { data: m } = await supabase.from('company_members').select('company_id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle()
    companyId = m?.company_id ?? null
  }

  const payload = {
    company_id: companyId,
    project_id: (body.project_id as string) || null,
    created_by: user.id,
    supplier: (body.supplier as string) || null,
    category,
    description: (body.description as string) || null,
    expense_date: (body.expense_date as string) || new Date().toISOString().slice(0, 10),
    amount,
    tax_gst: taxGst,
    tax_qst: taxQst,
    total,
    payment_method: method,
    billable: body.billable === false ? false : true,
    receipt_storage_path: (body.receipt_storage_path as string) || null,
    notes: (body.notes as string) || null,
  }

  const { data, error } = await supabase.from('expenses').insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense: data }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 422 })
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
