// app/api/inventory/[itemId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ itemId: string }> }
const EDITABLE = ['name', 'sku', 'category', 'unit', 'unit_cost', 'quantity_on_hand', 'reorder_threshold', 'supplier_id', 'location', 'notes', 'is_active'] as const

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { itemId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of EDITABLE) if (body[k] !== undefined) patch[k] = body[k]
  const { data, error } = await supabase.from('inventory_items').update(patch).eq('id', itemId).select('*, supplier:suppliers(id, name)').single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { itemId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { error } = await supabase.from('inventory_items').update({ is_active: false }).eq('id', itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
