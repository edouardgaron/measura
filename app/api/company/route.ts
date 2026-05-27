// app/api/company/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/company ─────────────────────────────────────────────────────────
// Returns the company owned by the authenticated user (or null if none yet)

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data: company, error } = await supabase
    .from('companies')
    .select(`
      *,
      members:company_members(
        id, role, is_active, joined_at,
        profile:profiles(id, full_name, avatar_url)
      )
    `)
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ company })
}

// ─── POST /api/company ────────────────────────────────────────────────────────
// Creates a new company for the authenticated user

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Prevent duplicate company creation
  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Une entreprise existe déjà pour ce compte' }, { status: 409 })
  }

  const body = await request.json()
  const { name, ...rest } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom de l\'entreprise est requis' }, { status: 400 })
  }

  const { data: company, error } = await supabase
    .from('companies')
    .insert({
      name: name.trim(),
      owner_id: user.id,
      address_country: 'CA',
      tax_gst: 5,
      tax_qst: 9.975,
      default_markup: 20,
      default_labor_rate: 60,
      unit_system: 'metric',
      locale: 'fr',
      subscription_tier: 'free',
      is_active: true,
      ...rest,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Add owner as a company_member with role 'owner'
  await supabase.from('company_members').insert({
    company_id: company.id,
    user_id: user.id,
    role: 'owner',
    is_active: true,
    joined_at: new Date().toISOString(),
  })

  return NextResponse.json({ company }, { status: 201 })
}
