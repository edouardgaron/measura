// app/api/projects/[projectId]/work-orders/[workOrderId]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import WorkOrderTemplate from '@/components/workorder/WorkOrderTemplate'
import type { Photo, Project, WorkOrder } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ projectId: string; workOrderId: string }> }

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { projectId, workOrderId } = await params
  const supabase = await createClient()

  /* ── Auth ── */
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  /* ── Accès projet (membre ou propriétaire) ── */
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    const { data: proj } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single()
    if (!proj || proj.owner_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
  }

  /* ── Bon de travail ── */
  const { data: workOrder, error: woError } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .eq('project_id', projectId)
    .single()

  if (woError || !workOrder) {
    return NextResponse.json({ error: 'Bon de travail introuvable' }, { status: 404 })
  }

  /* ── Projet ── */
  const { data: project } = await supabase
    .from('projects')
    .select(
      `id, title, address_line1, address_city, address_province, address_postal,
       address_country, status, unit_system, notes, created_at, updated_at, owner_id`
    )
    .eq('id', projectId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
  }

  /* ── Compagnie / entête (profil du propriétaire) ── */
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('full_name, company_name, avatar_url, phone')
    .eq('id', project.owner_id)
    .single()

  const companyName = ownerProfile?.company_name ?? ownerProfile?.full_name ?? undefined
  const companyLogo = ownerProfile?.avatar_url ?? undefined
  const companyPhone = ownerProfile?.phone ?? undefined

  /* ── Photos de référence (URLs signées) ── */
  const photoIds = (workOrder.photo_ids as string[] | null) ?? []
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

  /* ── Rendu PDF ── */
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      React.createElement(WorkOrderTemplate, {
        workOrder: workOrder as unknown as WorkOrder,
        project: project as unknown as Project,
        photos,
        companyName,
        companyLogo,
        companyPhone,
        locale: workOrder.locale === 'en' ? 'en' : 'fr',
      }) as React.ReactElement<any>
    )
  } catch (renderErr) {
    console.error('Work order PDF render error:', renderErr)
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF' }, { status: 500 })
  }

  /* ── Upload (bucket reports, préfixe work-orders/) ── */
  const adminClient = await createAdminClient()
  const fileName = `work-orders/${projectId}/bon-${workOrder.wo_number}-${Date.now()}.pdf`

  const { error: storageError } = await adminClient.storage
    .from('reports')
    .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: false })

  if (!storageError) {
    await supabase
      .from('work_orders')
      .update({ pdf_storage_path: fileName, updated_at: new Date().toISOString() })
      .eq('id', workOrderId)
  } else {
    console.error('Work order storage upload error:', storageError.message)
  }

  /* ── Retour PDF inline ── */
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="bon-de-travail-${workOrder.wo_number}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    },
  })
}
