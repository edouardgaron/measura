// app/api/suppliers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { data, error } = await supabase.from('suppliers').select('*').eq('is_active', true).order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ suppliers: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { name?: string; contact_name?: string; email?: string; phone?: string; address?: string; notes?: string } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }
  if (!body.name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 422 })

  const { data, error } = await supabase.from('suppliers').insert({
    owner_id: user.id, company_id: null, name: body.name.trim(),
    contact_name: body.contact_name ?? null, email: body.email ?? null,
    phone: body.phone ?? null, address: body.address ?? null, notes: body.notes ?? null, is_active: true,
  }).select('*').single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ supplier: data }, { status: 201 })
}
