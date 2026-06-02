// app/api/projects/[projectId]/surfaces/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ projectId: string }> }

// ── Valid enum values matching the DB CHECK constraints ───────────────────────

const VALID_FACADE_SIDES = ['front', 'back', 'left', 'right', 'roof', 'other'] as const
const VALID_SURFACE_TYPES = [
  'wall', 'roof', 'gable', 'soffit', 'fascia', 'trim',
  'door', 'window', 'garage',
] as const
type FacadeSide = typeof VALID_FACADE_SIDES[number]
type SurfaceType = typeof VALID_SURFACE_TYPES[number]

// ── Auth + membership helper ──────────────────────────────────────────────────

async function requireProjectAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  requireWrite = false
) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { user: null, error: 'Non authentifié', status: 401 } as const
  }

  // Check project membership first
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    // Fall back to checking if the user is the project owner
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single()

    if (!project || project.owner_id !== user.id) {
      return { user: null, error: 'Accès refusé', status: 403 } as const
    }
  }

  // Clients cannot write surface calculations
  if (requireWrite && membership?.role === 'client') {
    return { user: null, error: 'Accès refusé', status: 403 } as const
  }

  // Also enforce entrepreneur / admin profile role for writes
  if (requireWrite) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile && profile.role === 'client') {
      return { user: null, error: 'Accès refusé', status: 403 } as const
    }
  }

  return { user, error: null, status: 200 } as const
}

// ── GET /api/projects/[projectId]/surfaces ────────────────────────────────────
// Returns all surface_calculations rows for the project ordered by created_at.

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: surfaces, error } = await supabase
    .from('surface_calculations')
    .select(
      `id, facade_side, surface_type, label,
       gross_area, opening_area, net_area,
       perimeter, length, height, pitch,
       position_x, sill_height, detected_by,
       unit, loss_factor, notes,
       created_at, updated_at`
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ surfaces: surfaces ?? [] })
}

// ── POST /api/projects/[projectId]/surfaces ───────────────────────────────────
// Creates a new surface calculation row for the project.
// If a row with the same project_id + surface_type + label already exists,
// it is updated (upsert-style) rather than duplicated.
//
// Body shape:
// {
//   facade_side?:  'front' | 'back' | 'left' | 'right' | 'roof' | 'other'
//   surface_type:  'wall' | 'roof' | 'gable' | 'soffit' | 'fascia' | 'trim' | 'door' | 'window' | 'garage'
//   label?:        string
//   gross_area:    number   (square feet)
//   opening_area?: number   (square feet)
//   perimeter?:    number   (linear feet)
//   length?:       number   (feet)
//   height?:       number   (feet)
//   pitch?:        number   (rise / 12, e.g. 5 for 5/12)
//   unit?:         string   (default 'ft')
//   loss_factor?:  number   (0–1, default 0.10)
//   notes?:        string
// }

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const user = auth.user!

  let body: {
    facade_side?: string
    surface_type?: string
    label?: string
    gross_area?: number
    opening_area?: number
    perimeter?: number
    length?: number
    height?: number
    pitch?: number
    position_x?: number
    sill_height?: number
    detected_by?: string
    unit?: string
    loss_factor?: number
    notes?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide' }, { status: 400 })
  }

  // Validate required field
  if (body.gross_area === undefined || body.gross_area === null) {
    return NextResponse.json({ error: 'gross_area est requis' }, { status: 422 })
  }

  if (!body.surface_type) {
    return NextResponse.json({ error: 'surface_type est requis' }, { status: 422 })
  }

  // Validate enum values
  if (
    body.facade_side &&
    !VALID_FACADE_SIDES.includes(body.facade_side as FacadeSide)
  ) {
    return NextResponse.json(
      { error: `facade_side invalide. Valeurs acceptées: ${VALID_FACADE_SIDES.join(', ')}` },
      { status: 422 }
    )
  }

  if (!VALID_SURFACE_TYPES.includes(body.surface_type as SurfaceType)) {
    return NextResponse.json(
      { error: `surface_type invalide. Valeurs acceptées: ${VALID_SURFACE_TYPES.join(', ')}` },
      { status: 422 }
    )
  }

  // Validate numeric ranges
  if (body.loss_factor !== undefined && (body.loss_factor < 0 || body.loss_factor > 1)) {
    return NextResponse.json(
      { error: 'loss_factor doit être entre 0 et 1' },
      { status: 422 }
    )
  }

  // Check whether an identical row already exists (same project + type + label)
  // and update it rather than inserting a duplicate.
  const label = body.label ?? null

  const { data: existing } = await supabase
    .from('surface_calculations')
    .select('id')
    .eq('project_id', projectId)
    .eq('surface_type', body.surface_type)
    .is(label === null ? 'label' : 'id', label === null ? null : '__never__')
    .eq(label !== null ? 'label' : 'project_id', label !== null ? label : projectId)
    .limit(1)
    .maybeSingle()

  const payload = {
    project_id:   projectId,
    created_by:   user.id,
    facade_side:  (body.facade_side as FacadeSide) ?? null,
    surface_type: body.surface_type as SurfaceType,
    label,
    gross_area:   body.gross_area,
    opening_area: body.opening_area ?? 0,
    perimeter:    body.perimeter ?? null,
    length:       body.length ?? null,
    height:       body.height ?? null,
    pitch:        body.pitch ?? null,
    position_x:   body.position_x ?? null,
    sill_height:  body.sill_height ?? null,
    detected_by:  body.detected_by ?? null,
    unit:         body.unit ?? 'ft',
    loss_factor:  body.loss_factor ?? 0.10,
    notes:        body.notes ?? null,
  }

  if (existing?.id) {
    // Update existing record
    const { data: updated, error: updateError } = await supabase
      .from('surface_calculations')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? 'Erreur mise à jour surface' },
        { status: 500 }
      )
    }

    return NextResponse.json({ surface: updated, action: 'updated' })
  }

  // Insert new record
  const { data: inserted, error: insertError } = await supabase
    .from('surface_calculations')
    .insert(payload)
    .select()
    .single()

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Erreur création surface' },
      { status: 500 }
    )
  }

  return NextResponse.json({ surface: inserted, action: 'created' }, { status: 201 })
}
