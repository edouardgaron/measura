// app/api/projects/[projectId]/plans/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import PlanTemplate from '@/components/plans/PlanTemplate'
import { buildPlanData } from '@/lib/plans/geometry'
import type { HouseModel, Measurement, Project, SurfaceCalculation } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ projectId: string }> }

async function gather(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string) {
  const { data: project } = await supabase
    .from('projects')
    .select('id, title, unit_system, owner_id, address_line1, address_city, address_province')
    .eq('id', projectId)
    .single()

  const { data: houseModel } = await supabase
    .from('house_models')
    .select('footprint_json, wall_height')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: surfaces } = await supabase.from('surface_calculations').select('*').eq('project_id', projectId)
  const { data: measurements } = await supabase.from('measurements').select('*').eq('project_id', projectId)

  return { project, houseModel, surfaces: surfaces ?? [], measurements: measurements ?? [] }
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()
  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { project, houseModel, surfaces, measurements } = await gather(supabase, projectId)
  if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

  const { data: prof } = await supabase.from('profiles').select('company_name, full_name, avatar_url').eq('id', project.owner_id).single()
  const companyName = prof?.company_name ?? prof?.full_name ?? undefined
  const companyLogo = prof?.avatar_url ?? undefined

  const plan = buildPlanData(
    project as Pick<Project, 'unit_system'>,
    (houseModel as Pick<HouseModel, 'footprint_json' | 'wall_height'> | null) ?? null,
    (surfaces as SurfaceCalculation[]),
    (measurements as Measurement[])
  )

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      React.createElement(PlanTemplate, {
        project: project as unknown as Project,
        plan,
        companyName,
        companyLogo,
      }) as React.ReactElement<any>
    )
  } catch (e) {
    console.error('Plan PDF render error:', e)
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 })
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="plans-${projectId}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    },
  })
}
