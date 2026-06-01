// app/api/projects/[projectId]/plans/ifc/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { buildPlanData } from '@/lib/plans/geometry'
import { buildPlanIfc } from '@/lib/plans/ifc'
import type { HouseModel, Measurement, Project, SurfaceCalculation } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ projectId: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()
  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data: project } = await supabase.from('projects').select('id, title, unit_system').eq('id', projectId).single()
  if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

  const { data: houseModel } = await supabase
    .from('house_models').select('footprint_json, wall_height').eq('project_id', projectId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  const { data: surfaces } = await supabase.from('surface_calculations').select('*').eq('project_id', projectId)
  const { data: measurements } = await supabase.from('measurements').select('*').eq('project_id', projectId)

  const plan = buildPlanData(
    project as Pick<Project, 'unit_system'>,
    (houseModel as Pick<HouseModel, 'footprint_json' | 'wall_height'> | null) ?? null,
    (surfaces as SurfaceCalculation[]) ?? [],
    (measurements as Measurement[]) ?? []
  )
  const ifc = buildPlanIfc(plan, project.title)

  return new NextResponse(ifc, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-step',
      'Content-Disposition': `attachment; filename="plans-${projectId}.ifc"`,
    },
  })
}
