// app/api/projects/[projectId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateProjectSchema } from '@/lib/validators/project.schema'

type RouteContext = { params: Promise<{ projectId: string }> }

/* ---- GET /api/projects/[projectId] ---- */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { projectId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Verify membership
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select(
      `id, title, address_line1, address_city, address_province, address_postal, address_country,
       status, unit_system, notes, thumbnail_url, created_at, updated_at,
       members:project_members(id, email, role, invite_accepted_at, user_id),
       photos(id)`
    )
    .eq('id', projectId)
    .single()

  if (error || !project) {
    return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
  }

  const enriched = {
    ...project,
    _count: {
      photos: Array.isArray(project.photos) ? project.photos.length : 0,
    },
    photos: undefined,
  }

  return NextResponse.json({ project: enriched })
}

/* ---- PATCH /api/projects/[projectId] ---- */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const { projectId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Only owner or editor can update
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role === 'client') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateProjectSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const { data: updated, error: updateError } = await supabase
    .from('projects')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ project: updated })
}

/* ---- DELETE /api/projects/[projectId] — archives the project ---- */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { projectId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Only owner can archive
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Seul le propriétaire peut archiver ce projet' }, { status: 403 })
  }

  const { error: updateError } = await supabase
    .from('projects')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', projectId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
