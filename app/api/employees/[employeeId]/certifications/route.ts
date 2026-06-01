// app/api/employees/[employeeId]/certifications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ employeeId: string }> }
const CATS = ['safety', 'trade', 'license', 'training', 'other']

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { employeeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('employee_certifications')
    .select('*')
    .eq('employee_id', employeeId)
    .order('expiry_date', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ certifications: data ?? [] })
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { employeeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { name?: string; issuer?: string; category?: string; issued_date?: string; expiry_date?: string; notes?: string } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }
  if (!body.name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 422 })

  const { data, error } = await supabase
    .from('employee_certifications')
    .insert({
      employee_id: employeeId,
      name: body.name.trim(),
      issuer: body.issuer ?? null,
      category: CATS.includes(body.category ?? '') ? (body.category as never) : 'other',
      issued_date: body.issued_date ?? null,
      expiry_date: body.expiry_date ?? null,
      document_url: null,
      notes: body.notes ?? null,
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ certification: data }, { status: 201 })
}
