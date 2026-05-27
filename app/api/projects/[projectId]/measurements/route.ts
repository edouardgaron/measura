// app/api/projects/[projectId]/measurements/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Measurement, Photo } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ projectId: string }> }

/* ── GET /api/projects/[projectId]/measurements ─────────────────────────────
   Returns all measurements for the project with embedded photo info,
   plus computed totals for area and perimeter.
 ─────────────────────────────────────────────────────────────────────────── */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { projectId } = await params
  const supabase = await createClient()

  /* ── Auth ──────────────────────────────────────────────────────────── */
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  /* ── Membership check ───────────────────────────────────────────────── */
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  /* ── Fetch measurements ─────────────────────────────────────────────── */
  const { data: measurements, error: measError } = await supabase
    .from('measurements')
    .select('*')
    .eq('project_id', projectId)
    .order('facade_side', { ascending: true })
    .order('created_at', { ascending: true })

  if (measError) {
    return NextResponse.json({ error: measError.message }, { status: 500 })
  }

  /* ── Fetch related photos for signing ───────────────────────────────── */
  // Collect unique photo IDs referenced by measurements
  const photoIds = [...new Set((measurements ?? []).map((m) => m.photo_id).filter(Boolean))]

  let photoMap: Record<string, Photo> = {}

  if (photoIds.length > 0) {
    const { data: photos } = await supabase
      .from('photos')
      .select('*')
      .in('id', photoIds)

    if (photos) {
      // Generate signed URLs for each photo thumbnail
      const enriched = await Promise.all(
        photos.map(async (photo) => {
          const { data: signedData } = await supabase.storage
            .from('photos')
            .createSignedUrl(photo.storage_path, 3600)
          return { ...photo, url: signedData?.signedUrl ?? undefined }
        })
      )
      photoMap = Object.fromEntries(enriched.map((p) => [p.id, p]))
    }
  }

  /* ── Attach photo info to each measurement ──────────────────────────── */
  const enrichedMeasurements = (measurements ?? []).map((m) => ({
    ...m,
    photo: m.photo_id ? photoMap[m.photo_id] ?? null : null,
  }))

  /* ── Compute totals ─────────────────────────────────────────────────── */
  const totalArea = enrichedMeasurements
    .filter((m) => m.measurement_type === 'area' && m.real_value !== null)
    .reduce((sum, m) => sum + (m.real_value ?? 0), 0)

  const totalPerimeter = enrichedMeasurements
    .filter(
      (m) =>
        (m.measurement_type === 'perimeter' || m.measurement_type === 'line') &&
        m.real_value !== null
    )
    .reduce((sum, m) => sum + (m.real_value ?? 0), 0)

  return NextResponse.json({
    measurements: enrichedMeasurements,
    totals: {
      totalArea: Math.round(totalArea * 1000) / 1000,
      totalPerimeter: Math.round(totalPerimeter * 1000) / 1000,
    },
  })
}

/* ── PATCH /api/projects/[projectId]/measurements/[measurementId] is handled
   by a sub-route; this file only handles the collection endpoint. ───────── */
