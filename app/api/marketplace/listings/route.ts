// app/api/marketplace/listings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')
  const category = request.nextUrl.searchParams.get('category')
  const mine = request.nextUrl.searchParams.get('mine') === '1'

  let query = supabase.from('marketplace_listings').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(100)
  if (mine) query = query.eq('owner_id', user.id)
  if (category) query = query.eq('category', category)
  if (q) query = query.ilike('title', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ listings: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { title?: string; category?: string; description?: string; unit?: string; price?: number; region?: string; contact_email?: string; contact_phone?: string } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }
  if (!body.title?.trim()) return NextResponse.json({ error: 'Titre requis' }, { status: 422 })

  const { data, error } = await supabase.from('marketplace_listings').insert({
    owner_id: user.id, company_id: null, title: body.title.trim(), category: body.category ?? null,
    description: body.description ?? null, unit: body.unit ?? 'unité', price: body.price ?? null,
    region: body.region ?? null, contact_email: body.contact_email ?? null, contact_phone: body.contact_phone ?? null, is_active: true,
  }).select('*').single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ listing: data }, { status: 201 })
}
