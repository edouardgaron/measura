// app/api/employees/[employeeId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ employeeId: string }> }

const EDITABLE = ['full_name', 'role', 'email', 'phone', 'hourly_cost', 'hourly_rate', 'is_active', 'notes', 'company_id'] as const

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { employeeId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of EDITABLE) {
    if (body[key] !== undefined) patch[key] = body[key]
  }

  const { data, error } = await supabase
    .from('employees')
    .update(patch)
    .eq('id', employeeId)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erreur mise à jour' }, { status: 500 })
  }
  return NextResponse.json({ employee: data })
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { employeeId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Désactivation logique (préserve l'historique de pointage pour la rentabilité)
  const { error } = await supabase
    .from('employees')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', employeeId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
