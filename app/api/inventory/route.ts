// app/api/inventory/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*, supplier:suppliers(id, name)')
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: {
    name?: string; sku?: string; category?: string; unit?: string; unit_cost?: number
    quantity_on_hand?: number; reorder_threshold?: number; supplier_id?: string; location?: string
  } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }
  if (!body.name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 422 })

  const { data, error } = await supabase.from('inventory_items').insert({
    owner_id: user.id, company_id: null, supplier_id: body.supplier_id ?? null,
    sku: body.sku ?? null, name: body.name.trim(), category: body.category ?? null,
    unit: body.unit ?? 'unité', unit_cost: body.unit_cost ?? 0,
    quantity_on_hand: body.quantity_on_hand ?? 0, reorder_threshold: body.reorder_threshold ?? 0,
    location: body.location ?? null, notes: null, is_active: true,
  }).select('*, supplier:suppliers(id, name)').single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}
