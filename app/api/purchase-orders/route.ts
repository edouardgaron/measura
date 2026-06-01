// app/api/purchase-orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SELECT = `*, supplier:suppliers(id, name), items:purchase_order_items(id, inventory_item_id, description, quantity, unit, unit_cost, total)`

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { data, error } = await supabase.from('purchase_orders').select(SELECT).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data ?? [] })
}

interface POItem { description: string; quantity?: number; unit?: string; unit_cost?: number; inventory_item_id?: string }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { supplier_id?: string; project_id?: string; expected_date?: string; notes?: string; items?: POItem[] } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  const items = (body.items ?? []).filter((i) => i.description?.trim())
  const total = items.reduce((s, i) => s + (i.quantity ?? 0) * (i.unit_cost ?? 0), 0)

  const year = new Date().toISOString().slice(0, 4)
  const { count } = await supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('owner_id', user.id)
  const poNumber = `PO-${year}-${String((count ?? 0) + 1).padStart(3, '0')}`

  const { data: po, error } = await supabase.from('purchase_orders').insert({
    owner_id: user.id, company_id: null, supplier_id: body.supplier_id ?? null, project_id: body.project_id ?? null,
    po_number: poNumber, status: 'draft', order_date: new Date().toISOString().slice(0, 10),
    expected_date: body.expected_date ?? null, received_date: null, notes: body.notes ?? null,
    total: Math.round(total * 100) / 100,
  }).select('id').single()

  if (error || !po) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })

  if (items.length > 0) {
    await supabase.from('purchase_order_items').insert(items.map((i) => ({
      purchase_order_id: po.id, inventory_item_id: i.inventory_item_id ?? null,
      description: i.description, quantity: i.quantity ?? 1, unit: i.unit ?? null, unit_cost: i.unit_cost ?? 0,
    })))
  }

  const { data: full } = await supabase.from('purchase_orders').select(SELECT).eq('id', po.id).single()
  return NextResponse.json({ order: full }, { status: 201 })
}
