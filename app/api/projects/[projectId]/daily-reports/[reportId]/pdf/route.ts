// app/api/projects/[projectId]/daily-reports/[reportId]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import DailyReportTemplate from '@/components/site/DailyReportTemplate'
import type {
  DailyReport,
  DailyReportMaterial,
  Photo,
  Project,
  SiteIssue,
  TimeEntry,
} from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ projectId: string; reportId: string }> }

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { projectId, reportId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  /* Rapport + enfants */
  const { data: report, error: rErr } = await supabase
    .from('daily_reports')
    .select(
      `*,
       time_entries:time_entries(*, employee:employees(id, full_name, role)),
       materials:daily_report_materials(*),
       issues:site_issues(*)`
    )
    .eq('id', reportId)
    .eq('project_id', projectId)
    .single()

  if (rErr || !report) return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 })

  /* Projet */
  const { data: project } = await supabase
    .from('projects')
    .select('id, title, address_line1, address_city, address_province, address_postal, address_country, status, unit_system, notes, created_at, updated_at, owner_id')
    .eq('id', projectId)
    .single()

  if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

  /* Entête compagnie */
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('full_name, company_name, avatar_url')
    .eq('id', project.owner_id)
    .single()

  const companyName = ownerProfile?.company_name ?? ownerProfile?.full_name ?? undefined
  const companyLogo = ownerProfile?.avatar_url ?? undefined

  /* Photos signées */
  const photoIds = (report.photo_ids as string[] | null) ?? []
  let photos: Photo[] = []
  if (photoIds.length > 0) {
    const { data: photoData } = await supabase
      .from('photos')
      .select('*')
      .in('id', photoIds)
      .order('sort_order', { ascending: true })

    if (photoData && photoData.length > 0) {
      photos = await Promise.all(
        photoData.map(async (photo) => {
          const { data: signed } = await supabase.storage
            .from('photos')
            .createSignedUrl(photo.storage_path, 3600)
          return { ...photo, url: signed?.signedUrl ?? undefined }
        })
      )
    }
  }

  /* Rendu */
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      React.createElement(DailyReportTemplate, {
        report: report as unknown as DailyReport,
        timeEntries: (report.time_entries as unknown as TimeEntry[]) ?? [],
        materials: (report.materials as unknown as DailyReportMaterial[]) ?? [],
        issues: (report.issues as unknown as SiteIssue[]) ?? [],
        project: project as unknown as Project,
        photos,
        companyName,
        companyLogo,
      }) as React.ReactElement<any>
    )
  } catch (e) {
    console.error('Daily report PDF render error:', e)
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF' }, { status: 500 })
  }

  /* Upload bucket reports (préfixe daily-reports/) */
  const adminClient = await createAdminClient()
  const fileName = `daily-reports/${projectId}/${report.report_date}-${Date.now()}.pdf`
  const { error: storageError } = await adminClient.storage
    .from('reports')
    .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: false })

  if (!storageError) {
    await supabase
      .from('daily_reports')
      .update({ pdf_storage_path: fileName, updated_at: new Date().toISOString() })
      .eq('id', reportId)
  } else {
    console.error('Daily report storage error:', storageError.message)
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="rapport-journalier-${report.report_date}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    },
  })
}
