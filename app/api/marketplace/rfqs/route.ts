// app/api/marketplace/rfqs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const scope = request.nextUrl.searchParams.get('scope') // 'mine' | 'open'
  let query = supabase
    .from('rfqs')
    .select('*, responses:rfq_responses(id, supplier_name, price, lead_time_days, message, contact_email, created_at)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (scope === 'mine') query = query.eq('owner_id', user.id)
  else query = query.eq('status', 'open')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rfqs: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { title?: string; description?: string; category?: string; region?: string; needed_by?: string; project_id?: string } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }
  if (!body.title?.trim()) return NextResponse.json({ error: 'Titre requis' }, { status: 422 })

  const { data, error } = await supabase.from('rfqs').insert({
    owner_id: user.id, company_id: null, project_id: body.project_id ?? null,
    title: body.title.trim(), description: body.description ?? null, category: body.category ?? null,
    region: body.region ?? null, status: 'open', needed_by: body.needed_by ?? null,
  }).select('*').single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ rfq: data }, { status: 201 })
}
