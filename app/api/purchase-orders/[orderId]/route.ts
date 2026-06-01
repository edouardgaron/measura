// app/api/purchase-orders/[orderId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ orderId: string }> }
const SELECT = `*, supplier:suppliers(id, name), items:purchase_order_items(id, inventory_item_id, description, quantity, unit, unit_cost, total)`
const STATUS = ['draft', 'ordered', 'received', 'cancelled']

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { orderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { status?: string; expected_date?: string; notes?: string } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.expected_date !== undefined) patch.expected_date = body.expected_date
  if (body.notes !== undefined) patch.notes = body.notes
  if (body.status && STATUS.includes(body.status)) patch.status = body.status

  // Réception : incrémente le stock des articles liés
  if (body.status === 'received') {
    patch.received_date = new Date().toISOString().slice(0, 10)
    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('inventory_item_id, quantity')
      .eq('purchase_order_id', orderId)
    for (const it of items ?? []) {
      if (!it.inventory_item_id) continue
      const { data: inv } = await supabase.from('inventory_items').select('quantity_on_hand').eq('id', it.inventory_item_id).single()
      if (inv) {
        await supabase.from('inventory_items')
          .update({ quantity_on_hand: (inv.quantity_on_hand ?? 0) + (it.quantity ?? 0), updated_at: new Date().toISOString() })
          .eq('id', it.inventory_item_id)
        await supabase.from('stock_movements').insert({
          inventory_item_id: it.inventory_item_id, owner_id: user.id, type: 'in',
          quantity: it.quantity ?? 0, reason: `Réception ${orderId.slice(0, 8)}`,
        })
      }
    }
  }

  const { error } = await supabase.from('purchase_orders').update(patch).eq('id', orderId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: full } = await supabase.from('purchase_orders').select(SELECT).eq('id', orderId).single()
  return NextResponse.json({ order: full })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { orderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { error } = await supabase.from('purchase_orders').delete().eq('id', orderId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
