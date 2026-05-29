// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createProjectSchema } from '@/lib/validators/project.schema'

/* ---- GET /api/projects ---- */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Get projects the user owns or is a member of
  const { data: memberRows, error: memberError } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', user.id)

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  const projectIds = (memberRows ?? []).map((r) => r.project_id)

  if (projectIds.length === 0) {
    return NextResponse.json({ projects: [] })
  }

  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select(
      `id, title, address_line1, address_city, address_province, status, unit_system, thumbnail_url, created_at, updated_at,
       members:project_members(id),
       photos(id)`
    )
    .in('id', projectIds)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })

  if (projError) {
    return NextResponse.json({ error: projError.message }, { status: 500 })
  }

  const enriched = (projects ?? []).map((p) => ({
    ...p,
    _count: {
      members: Array.isArray(p.members) ? p.members.length : 0,
      photos: Array.isArray(p.photos) ? p.photos.length : 0,
    },
    members: undefined,
    photos: undefined,
  }))

  return NextResponse.json({ projects: enriched })
}

/* ---- POST /api/projects ---- */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = createProjectSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const {
    title,
    unit_system,
    notes,
    address_line1,
    address_city,
    address_province,
    address_postal,
    address_country,
  } = parsed.data

  // Insert project
  const { data: project, error: insertError } = await supabase
    .from('projects')
    .insert({
      owner_id: user.id,
      title,
      unit_system,
      notes,
      address_line1,
      address_city,
      address_province,
      address_postal,
      address_country,
      status: 'draft',
    })
    .select()
    .single()

  if (insertError || !project) {
    return NextResponse.json({ error: insertError?.message ?? 'Erreur création' }, { status: 500 })
  }

  // Create owner membership
  const { error: memberError } = await supabase.from('project_members').insert({
    project_id: project.id,
    user_id: user.id,
    email: user.email ?? '',
    role: 'owner',
  })

  if (memberError) {
    // Non-fatal — project is created
    console.error('Failed to create owner member:', memberError.message)
  }

  return NextResponse.json({ id: project.id, project }, { status: 201 })
}
