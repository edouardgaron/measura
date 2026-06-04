// app/api/teams/[teamId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ teamId: string }> }

const EDITABLE = ['name', 'color', 'notes'] as const

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { teamId } = await params
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
    .from('teams')
    .update(patch)
    .eq('id', teamId)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erreur mise à jour' }, { status: 500 })
  }
  return NextResponse.json({ team: data })
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { teamId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Les employés rattachés sont détachés automatiquement (ON DELETE SET NULL)
  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
