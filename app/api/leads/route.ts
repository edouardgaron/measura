// app/api/leads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { STAGE_KEYS } from '@/lib/crm/stages'

// ── GET — tous les leads accessibles (RLS) ────────────────────────────────────
export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('position', { ascending: true })
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leads: data ?? [] })
}

// ── POST — créer un lead ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: Partial<{
    name: string
    contact_name: string
    contact_email: string
    contact_phone: string
    address_line1: string
    address_city: string
    address_province: string
    address_postal: string
    source: string
    stage: string
    work_type: string
    estimated_value: number
    priority: string
    notes: string
    company_id: string
    expected_close_date: string
  }> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: 'Le nom du lead est requis' }, { status: 422 })
  }

  const stage = STAGE_KEYS.includes(body.stage as never) ? body.stage : 'new'

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      owner_id: user.id,
      company_id: body.company_id ?? null,
      name: body.name.trim(),
      contact_name: body.contact_name ?? null,
      contact_email: body.contact_email ?? null,
      contact_phone: body.contact_phone ?? null,
      address_line1: body.address_line1 ?? null,
      address_city: body.address_city ?? null,
      address_province: body.address_province ?? null,
      address_postal: body.address_postal ?? null,
      address_country: 'CA',
      source: body.source ?? 'other',
      stage: stage as never,
      work_type: (body.work_type as never) ?? null,
      estimated_value: body.estimated_value ?? 0,
      priority: body.priority ?? 'medium',
      notes: body.notes ?? null,
      project_id: null,
      expected_close_date: body.expected_close_date ?? null,
      lost_reason: null,
      position: 0,
      last_activity_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error || !lead) {
    return NextResponse.json({ error: error?.message ?? 'Erreur création lead' }, { status: 500 })
  }

  // Journalise la création
  await supabase.from('lead_activities').insert({
    lead_id: lead.id,
    author_id: user.id,
    type: 'created',
    content: 'Lead créé',
    metadata: {},
  })

  return NextResponse.json({ lead }, { status: 201 })
}
