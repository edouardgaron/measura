// app/api/projects/[projectId]/daily-reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'

type RouteContext = { params: Promise<{ projectId: string }> }

const SELECT = `
  *,
  time_entries:time_entries(id, employee_id, employee_name, work_date, clock_in, clock_out,
    break_minutes, hours, hourly_cost, labor_cost, notes),
  materials:daily_report_materials(id, material_id, description, quantity, unit, unit_cost, total_cost),
  issues:site_issues(id, type, severity, title, description, status, resolved_at)
`

// ── GET — liste des rapports journaliers du projet ────────────────────────────
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await supabase
    .from('daily_reports')
    .select(SELECT)
    .eq('project_id', projectId)
    .order('report_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}

// ── POST — créer un rapport journalier ────────────────────────────────────────
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: {
    report_date?: string
    weather?: string
    temperature?: number
    work_performed?: string
    progress_percent?: number
    incidents?: string
    comments?: string
  } = {}
  try {
    body = await request.json()
  } catch {
    /* defaults */
  }

  const { data: project } = await supabase
    .from('projects')
    .select('company_id')
    .eq('id', projectId)
    .single()

  const { data, error } = await supabase
    .from('daily_reports')
    .insert({
      project_id: projectId,
      company_id: project?.company_id ?? null,
      created_by: auth.user!.id,
      report_date: body.report_date ?? new Date().toISOString().slice(0, 10),
      weather: body.weather ?? null,
      temperature: body.temperature ?? null,
      crew_summary: null,
      work_performed: body.work_performed ?? null,
      progress_percent: body.progress_percent ?? null,
      incidents: body.incidents ?? null,
      comments: body.comments ?? null,
      status: 'draft',
      generated_summary: null,
      client_summary: null,
      photo_ids: [],
    })
    .select(SELECT)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erreur création rapport' }, { status: 500 })
  }

  return NextResponse.json({ report: data }, { status: 201 })
}
