// app/api/teams/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── GET — équipes de l'utilisateur (RLS filtre par owner/compagnie) ───────────
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ teams: data ?? [] })
}

// ── POST — créer une équipe ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { name?: string; color?: string; company_id?: string; notes?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "Le nom de l'équipe est requis" }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('teams')
    .insert({
      owner_id: user.id,
      company_id: body.company_id ?? null,
      name: body.name.trim(),
      color: body.color ?? '#0f172a',
      notes: body.notes ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erreur création équipe' }, { status: 500 })
  }

  return NextResponse.json({ team: data }, { status: 201 })
}
