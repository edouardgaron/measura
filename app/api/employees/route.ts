// app/api/employees/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── GET — roster de l'utilisateur (RLS filtre par owner/compagnie) ────────────
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const includeInactive = request.nextUrl.searchParams.get('all') === '1'

  let query = supabase.from('employees').select('*').order('full_name', { ascending: true })
  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ employees: data ?? [] })
}

// ── POST — créer un employé ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: {
    full_name?: string
    role?: string
    email?: string
    phone?: string
    hourly_cost?: number
    hourly_rate?: number
    company_id?: string
    notes?: string
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  if (!body.full_name || !body.full_name.trim()) {
    return NextResponse.json({ error: 'Le nom est requis' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('employees')
    .insert({
      owner_id: user.id,
      company_id: body.company_id ?? null,
      user_id: null,
      full_name: body.full_name.trim(),
      role: body.role ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      hourly_cost: body.hourly_cost ?? 0,
      hourly_rate: body.hourly_rate ?? 0,
      is_active: true,
      notes: body.notes ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erreur création employé' }, { status: 500 })
  }

  return NextResponse.json({ employee: data }, { status: 201 })
}
