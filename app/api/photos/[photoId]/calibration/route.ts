// app/api/photos/[photoId]/calibration/route.ts
//
// POST /api/photos/[photoId]/calibration  — upsert calibration for a photo
//
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calibrationSchema } from '@/lib/validators/measurement.schema'

type RouteContext = { params: Promise<{ photoId: string }> }

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const { photoId } = await params
  const supabase = await createClient()

  // Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Fetch photo & verify membership
  const { data: photo, error: photoError } = await supabase
    .from('photos')
    .select('id, project_id')
    .eq('id', photoId)
    .single()

  if (photoError || !photo) {
    return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })
  }

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', photo.project_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  if (membership.role === 'client') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Validate body
  const body = await request.json()
  const parsed = calibrationSchema.safeParse({ ...body, photo_id: photoId })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  // Check for existing calibration (one per photo)
  const { data: existing } = await supabase
    .from('calibrations')
    .select('id')
    .eq('photo_id', photoId)
    .single()

  let calibration
  let isNew = false

  if (existing) {
    const { data, error: updateError } = await supabase
      .from('calibrations')
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
    calibration = data
  } else {
    isNew = true
    const { data, error: insertError } = await supabase
      .from('calibrations')
      .insert({
        ...parsed.data,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
    calibration = data
  }

  // Mark photo as calibrated
  await supabase
    .from('photos')
    .update({ is_calibrated: true })
    .eq('id', photoId)

  return NextResponse.json({ calibration }, { status: isNew ? 201 : 200 })
}

// GET /api/photos/[photoId]/calibration  — fetch current calibration
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { photoId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data: photo } = await supabase
    .from('photos')
    .select('id, project_id')
    .eq('id', photoId)
    .single()

  if (!photo) {
    return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })
  }

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', photo.project_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { data: calibration } = await supabase
    .from('calibrations')
    .select('*')
    .eq('photo_id', photoId)
    .single()

  return NextResponse.json({ calibration: calibration ?? null })
}
