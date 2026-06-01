// app/api/projects/[projectId]/ai-estimate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { generateEstimateSuggestion } from '@/lib/ai/advanced'
import { isAiConfigured } from '@/lib/ai/client'
import type { SurfaceCalculation } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ projectId: string }> }
export const runtime = 'nodejs'
export const maxDuration = 45

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()
  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: { workType?: string } = {}
  try { body = await request.json() } catch { /* defaults */ }

  const { data: project } = await supabase.from('projects').select('unit_system').eq('id', projectId).single()
  const { data: surfaces } = await supabase.from('surface_calculations').select('*').eq('project_id', projectId)
  const { data: estimate } = await supabase.from('estimates').select('work_type').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle()

  const workType = body.workType ?? estimate?.work_type ?? 'painting'
  const unit = project?.unit_system === 'metric' ? 'm' : 'pi'

  const suggestion = await generateEstimateSuggestion({
    surfaces: (surfaces as SurfaceCalculation[]) ?? [],
    workType,
    unit,
  })

  return NextResponse.json({ ...suggestion, aiEnabled: isAiConfigured() })
}
