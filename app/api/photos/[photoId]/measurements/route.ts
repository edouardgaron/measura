// app/api/photos/[photoId]/measurements/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { measurementSchema } from '@/lib/validators/measurement.schema'
import { z } from 'zod'

type RouteContext = { params: Promise<{ photoId: string }> }

// ---------------------------------------------------------------------------
// Auth + photo ownership guard
// ---------------------------------------------------------------------------

async function resolvePhotoAccess(photoId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }), supabase, user: null, photo: null }
  }

  const { data: photo, error: photoError } = await supabase
    .from('photos')
    .select('id, project_id')
    .eq('id', photoId)
    .single()

  if (photoError || !photo) {
    return { error: NextResponse.json({ error: 'Photo introuvable' }, { status: 404 }), supabase, user, photo: null }
  }

  // Verify project membership
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', photo.project_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return { error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }), supabase, user, photo: null }
  }

  return { error: null, supabase, user, photo, membership }
}

// ---------------------------------------------------------------------------
// GET /api/photos/[photoId]/measurements
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { photoId } = await params
  const { error, supabase, photo } = await resolvePhotoAccess(photoId)
  if (error || !photo) return error ?? NextResponse.json({ error: 'Erreur' }, { status: 500 })

  const { data: measurements, error: fetchError } = await supabase
    .from('measurements')
    .select('*')
    .eq('photo_id', photoId)
    .order('created_at', { ascending: true })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  // Also return calibration
  const { data: calibration } = await supabase
    .from('calibrations')
    .select('*')
    .eq('photo_id', photoId)
    .single()

  return NextResponse.json({ measurements: measurements ?? [], calibration: calibration ?? null })
}

// ---------------------------------------------------------------------------
// POST /api/photos/[photoId]/measurements
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const { photoId } = await params
  const { error, supabase, user, photo, membership } = await resolvePhotoAccess(photoId) as Awaited<ReturnType<typeof resolvePhotoAccess>> & { membership?: { role: string } }

  if (error || !photo || !user) return error ?? NextResponse.json({ error: 'Erreur' }, { status: 500 })

  if (membership?.role === 'client') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = measurementSchema.safeParse({ ...body, photo_id: photoId, project_id: photo.project_id })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const { data: measurement, error: insertError } = await supabase
    .from('measurements')
    .insert({
      ...parsed.data,
      created_by: user.id,
    })
    .select()
    .single()

  if (insertError || !measurement) {
    return NextResponse.json({ error: insertError?.message ?? 'Erreur création' }, { status: 500 })
  }

  return NextResponse.json({ measurement }, { status: 201 })
}

// ---------------------------------------------------------------------------
// PUT /api/photos/[photoId]/measurements  — update by id in body
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().max(100).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  is_visible: z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: RouteContext
) {
  const { photoId } = await params
  const { error, supabase, membership } = await resolvePhotoAccess(photoId) as Awaited<ReturnType<typeof resolvePhotoAccess>> & { membership?: { role: string } }

  if (error) return error

  if (membership?.role === 'client') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const { id, ...updates } = parsed.data

  const { data: measurement, error: updateError } = await supabase
    .from('measurements')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('photo_id', photoId)
    .select()
    .single()

  if (updateError || !measurement) {
    return NextResponse.json({ error: updateError?.message ?? 'Mesure introuvable' }, { status: 404 })
  }

  return NextResponse.json({ measurement })
}

// ---------------------------------------------------------------------------
// DELETE /api/photos/[photoId]/measurements?id=<uuid>
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  const { photoId } = await params
  const { error, supabase, membership } = await resolvePhotoAccess(photoId) as Awaited<ReturnType<typeof resolvePhotoAccess>> & { membership?: { role: string } }

  if (error) return error

  if (membership?.role === 'client') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Accept id from query param or body
  const idFromQuery = request.nextUrl.searchParams.get('id')
  let measurementId = idFromQuery

  if (!measurementId) {
    try {
      const body = await request.json()
      measurementId = body.id ?? null
    } catch {
      // no body
    }
  }

  if (!measurementId) {
    return NextResponse.json({ error: 'Paramètre id requis' }, { status: 400 })
  }

  const { error: deleteError } = await supabase
    .from('measurements')
    .delete()
    .eq('id', measurementId)
    .eq('photo_id', photoId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
