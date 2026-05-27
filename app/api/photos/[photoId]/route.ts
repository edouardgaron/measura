// app/api/photos/[photoId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calibrationSchema } from '@/lib/validators/measurement.schema'

type RouteContext = { params: Promise<{ photoId: string }> }

// ---------------------------------------------------------------------------
// Auth + photo ownership guard  (shared logic)
// ---------------------------------------------------------------------------

async function resolvePhotoAccess(photoId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }),
      supabase,
      user: null,
      photo: null,
      membership: null,
    }
  }

  const { data: photo, error: photoError } = await supabase
    .from('photos')
    .select('id, project_id, storage_path, original_name, facade_label, is_calibrated, mime_type, sort_order, width_px, height_px, file_size_bytes, uploaded_by, created_at')
    .eq('id', photoId)
    .single()

  if (photoError || !photo) {
    return {
      error: NextResponse.json({ error: 'Photo introuvable' }, { status: 404 }),
      supabase,
      user,
      photo: null,
      membership: null,
    }
  }

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', photo.project_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return {
      error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }),
      supabase,
      user,
      photo: null,
      membership: null,
    }
  }

  return { error: null, supabase, user, photo, membership }
}

// ---------------------------------------------------------------------------
// GET /api/photos/[photoId]  — returns photo with signed URL
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { photoId } = await params
  const { error, supabase, photo } = await resolvePhotoAccess(photoId)

  if (error || !photo) return error ?? NextResponse.json({ error: 'Erreur' }, { status: 500 })

  const { data: signedData, error: signError } = await supabase.storage
    .from('photos')
    .createSignedUrl(photo.storage_path, 60 * 60) // 1 hour

  if (signError || !signedData) {
    return NextResponse.json({ error: 'Impossible de générer l\'URL signée' }, { status: 500 })
  }

  return NextResponse.json({
    photo: {
      ...photo,
      url: signedData.signedUrl,
    },
  })
}

// ---------------------------------------------------------------------------
// DELETE /api/photos/[photoId]  — deletes from storage & database
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { photoId } = await params
  const { error, supabase, photo, membership } = await resolvePhotoAccess(photoId)

  if (error || !photo) return error ?? NextResponse.json({ error: 'Erreur' }, { status: 500 })

  if (membership?.role === 'client') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Delete from Supabase Storage
  const { error: storageError } = await supabase.storage
    .from('photos')
    .remove([photo.storage_path])

  if (storageError) {
    // Non-fatal: log but continue with DB deletion so data isn't orphaned
    console.error('Storage delete error:', storageError.message)
  }

  // Delete database row (cascade should handle calibrations + measurements)
  const { error: dbError } = await supabase
    .from('photos')
    .delete()
    .eq('id', photoId)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// ---------------------------------------------------------------------------
// POST /api/photos/[photoId]/calibration  — upsert calibration
// This handler lives in the parent route file for convenience.
// The actual endpoint is at /api/photos/[photoId]/calibration/route.ts,
// but we export a named POST here that is re-used by that file.
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const { photoId } = await params
  const { error, supabase, user, photo, membership } = await resolvePhotoAccess(photoId)

  if (error || !photo || !user) return error ?? NextResponse.json({ error: 'Erreur' }, { status: 500 })

  if (membership?.role === 'client') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = calibrationSchema.safeParse({ ...body, photo_id: photoId })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  // Upsert — one calibration per photo
  const { data: existing } = await supabase
    .from('calibrations')
    .select('id')
    .eq('photo_id', photoId)
    .single()

  let calibration
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

  return NextResponse.json({ calibration }, { status: existing ? 200 : 201 })
}
