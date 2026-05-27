// app/api/company/[companyId]/settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ companyId: string }> }

async function resolveCompanyOwner(companyId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }), supabase, user: null }
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id, owner_id')
    .eq('id', companyId)
    .maybeSingle()

  if (!company) {
    return { error: NextResponse.json({ error: 'Entreprise introuvable' }, { status: 404 }), supabase, user: null }
  }

  if (company.owner_id !== user.id) {
    // Also allow company admins
    const { data: membership } = await supabase
      .from('company_members')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return { error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }), supabase, user: null }
    }
  }

  return { error: null, supabase, user }
}

// ─── GET /api/company/[companyId]/settings ────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { companyId } = await params
  const { error, supabase } = await resolveCompanyOwner(companyId)
  if (error) return error

  const { data: company, error: dbError } = await supabase
    .from('companies')
    .select(`
      *,
      members:company_members(
        id, role, is_active, joined_at,
        profile:profiles(id, full_name, avatar_url)
      )
    `)
    .eq('id', companyId)
    .single()

  if (dbError || !company) {
    return NextResponse.json({ error: 'Entreprise introuvable' }, { status: 404 })
  }

  return NextResponse.json({ company })
}

// ─── PATCH /api/company/[companyId]/settings ──────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const { companyId } = await params
  const { error, supabase } = await resolveCompanyOwner(companyId)
  if (error) return error

  const body = await request.json()

  // Strip relations, only update allowed columns
  const {
    id: _id,
    owner_id: _owner,
    created_at: _created,
    updated_at: _updated,
    members: _members,
    owner: _ownerProfile,
    ...updateData
  } = body

  const { data: updated, error: updateError } = await supabase
    .from('companies')
    .update(updateData)
    .eq('id', companyId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ company: updated })
}
