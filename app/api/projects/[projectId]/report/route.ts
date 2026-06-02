// app/api/projects/[projectId]/report/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import ReportTemplate from '@/components/report/ReportTemplate'
import type { Measurement, Photo, Project, Profile } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ projectId: string }> }

export async function POST(
  request: NextRequest,
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

  /* ── Parse body ─────────────────────────────────────────────────────── */
  let body: {
    includePhotos?: boolean
    include3d?: boolean
    includeMeasurements?: boolean
    locale?: 'fr' | 'en'
  } = {}

  try {
    body = await request.json()
  } catch {
    // use defaults
  }

  const includePhotos       = body.includePhotos      ?? true
  const include3d           = body.include3d          ?? false
  const includeMeasurements = body.includeMeasurements ?? true
  const locale              = body.locale === 'en' ? 'en' : 'fr'

  /* ── Fetch project ─────────────────────────────────────────────────── */
  const { data: project, error: projError } = await supabase
    .from('projects')
    .select(
      `id, title, address_line1, address_city, address_province, address_postal,
       address_country, status, unit_system, notes, thumbnail_url, created_at,
       updated_at, owner_id`
    )
    .eq('id', projectId)
    .single()

  if (projError || !project) {
    return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
  }

  /* ── Fetch company info (profile of project owner) ─────────────────── */
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('full_name, company_name, avatar_url')
    .eq('id', project.owner_id)
    .single()

  const companyName = ownerProfile?.company_name ?? ownerProfile?.full_name ?? undefined
  const companyLogo = ownerProfile?.avatar_url ?? undefined

  /* ── Fetch measurements ─────────────────────────────────────────────── */
  let measurements: Measurement[] = []
  if (includeMeasurements) {
    const { data: mData } = await supabase
      .from('measurements')
      .select('*')
      .eq('project_id', projectId)
      .order('facade_side', { ascending: true })
      .order('created_at', { ascending: true })

    measurements = mData ?? []
  }

  /* ── Fetch photos with signed URLs ──────────────────────────────────── */
  let photos: Photo[] = []
  if (includePhotos) {
    const { data: photoData } = await supabase
      .from('photos')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })

    if (photoData && photoData.length > 0) {
      const signedResults = await Promise.all(
        photoData.map(async (photo) => {
          const { data: signedData } = await supabase.storage
            .from('photos')
            .createSignedUrl(photo.storage_path, 3600)
          return { ...photo, url: signedData?.signedUrl ?? undefined }
        })
      )
      photos = signedResults
    }
  }

  /* ── Fetch surface calculations + house model (rapport complet) ─────── */
  const { data: surfacesData } = await supabase
    .from('surface_calculations')
    .select('*')
    .eq('project_id', projectId)
    .order('facade_side', { ascending: true })

  const { data: houseModelRow } = await supabase
    .from('house_models')
    .select('footprint_json, roof_type, wall_height, geometry_json')
    .eq('project_id', projectId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Expose la pente (estimée par IA) stockée dans geometry_json pour le rapport.
  const houseModelData = houseModelRow
    ? {
        footprint_json: houseModelRow.footprint_json,
        roof_type: houseModelRow.roof_type,
        wall_height: houseModelRow.wall_height,
        roof_pitch: (houseModelRow.geometry_json as { roof_pitch?: number } | null)?.roof_pitch ?? null,
      }
    : null

  /* ── Determine report version ───────────────────────────────────────── */
  const { count: reportCount } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  const version = (reportCount ?? 0) + 1

  /* ── Render PDF ─────────────────────────────────────────────────────── */
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      React.createElement(ReportTemplate, {
        project: project as unknown as Project,
        measurements,
        photos,
        surfaces: (surfacesData ?? []) as never,
        houseModel: (houseModelData ?? null) as never,
        propertyId: String(project.id).replace(/-/g, '').slice(0, 8).toUpperCase(),
        companyName,
        companyLogo,
        locale,
      }) as React.ReactElement<any>
    )
  } catch (renderErr) {
    console.error('PDF render error:', renderErr)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF' },
      { status: 500 }
    )
  }

  /* ── Upload PDF to Supabase Storage ─────────────────────────────────── */
  const adminClient = await createAdminClient()
  const storageFileName = `${projectId}/rapport-v${version}-${Date.now()}.pdf`

  const { error: storageError } = await adminClient.storage
    .from('reports')
    .upload(storageFileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (storageError) {
    console.error('Storage upload error:', storageError.message)
    // Non-fatal: we still return the PDF even if storage failed
  }

  /* ── Save report record ─────────────────────────────────────────────── */
  await supabase.from('reports').insert({
    project_id:          projectId,
    generated_by:        user.id,
    storage_path:        storageError ? null : storageFileName,
    version,
    include_photos:      includePhotos,
    include_3d:          include3d,
    include_measurements: includeMeasurements,
    locale,
  })

  /* ── Return PDF ─────────────────────────────────────────────────────── */
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="rapport-${projectId}-v${version}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    },
  })
}
