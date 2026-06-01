// app/api/inventory/[itemId]/movement/route.ts
// Mouvement de stock (entrée / sortie / ajustement) + maj de la quantité.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ itemId: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { itemId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { type?: 'in' | 'out' | 'adjust'; quantity?: number; reason?: string; project_id?: string } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }
  const type = body.type ?? 'adjust'
  const qty = Number(body.quantity)
  if (!qty || Number.isNaN(qty)) return NextResponse.json({ error: 'Quantité requise' }, { status: 422 })

  const { data: item } = await supabase.from('inventory_items').select('quantity_on_hand').eq('id', itemId).single()
  if (!item) return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })

  const current = item.quantity_on_hand ?? 0
  const newQty = type === 'in' ? current + Math.abs(qty) : type === 'out' ? current - Math.abs(qty) : qty

  await supabase.from('stock_movements').insert({
    inventory_item_id: itemId, owner_id: user.id, project_id: body.project_id ?? null,
    type, quantity: type === 'adjust' ? qty : Math.abs(qty), reason: body.reason ?? null,
  })

  const { data, error } = await supabase
    .from('inventory_items')
    .update({ quantity_on_hand: Math.max(0, newQty), updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select('*, supplier:suppliers(id, name)')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ item: data })
}
