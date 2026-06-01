// app/api/projects/[projectId]/daily-reports/[reportId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { computeHours } from '@/lib/site/compute'
import { buildClientSummary, buildManagementSummary } from '@/lib/site/reportSummary'
import type { DailyReportMaterial, SiteIssue, TimeEntry } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ projectId: string; reportId: string }> }

const SELECT = `
  *,
  time_entries:time_entries(id, employee_id, employee_name, work_date, clock_in, clock_out,
    break_minutes, hours, hourly_cost, labor_cost, notes),
  materials:daily_report_materials(id, material_id, description, quantity, unit, unit_cost, total_cost),
  issues:site_issues(id, type, severity, title, description, status, resolved_at)
`

interface TimeEntryInput {
  employee_id?: string | null
  employee_name?: string | null
  clock_in?: string | null
  clock_out?: string | null
  break_minutes?: number
  hours?: number
  hourly_cost?: number
  notes?: string | null
}

interface MaterialInput {
  material_id?: string | null
  description: string
  quantity?: number | null
  unit?: string | null
  unit_cost?: number | null
}

const SCALAR_FIELDS = [
  'report_date', 'weather', 'temperature', 'crew_summary', 'work_performed',
  'progress_percent', 'incidents', 'comments', 'status',
  'generated_summary', 'client_summary', 'photo_ids',
] as const

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { projectId, reportId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await supabase
    .from('daily_reports')
    .select(SELECT)
    .eq('id', reportId)
    .eq('project_id', projectId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 })
  return NextResponse.json({ report: data })
}

// ── PATCH ───────────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { projectId, reportId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Record<string, unknown> & {
    time_entries?: TimeEntryInput[]
    materials?: MaterialInput[]
    regenerate?: boolean
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  // 1) Mise à jour des champs scalaires
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of SCALAR_FIELDS) {
    if (body[key] !== undefined) patch[key] = body[key]
  }
  await supabase.from('daily_reports').update(patch).eq('id', reportId).eq('project_id', projectId)

  // 2) Remplacement des pointages
  if (body.time_entries !== undefined) {
    await supabase.from('time_entries').delete().eq('daily_report_id', reportId)

    if (body.time_entries.length > 0) {
      // Récupère les coûts horaires des employés référencés
      const empIds = body.time_entries.map((t) => t.employee_id).filter(Boolean) as string[]
      const costMap = new Map<string, number>()
      if (empIds.length > 0) {
        const { data: emps } = await supabase
          .from('employees')
          .select('id, hourly_cost, full_name')
          .in('id', empIds)
        for (const e of emps ?? []) costMap.set(e.id, e.hourly_cost ?? 0)
      }

      const reportDate = (patch.report_date as string) ?? null
      const rows = body.time_entries.map((t) => {
        const hours =
          t.hours != null ? t.hours : computeHours(t.clock_in, t.clock_out, t.break_minutes ?? 0)
        const hourlyCost =
          t.hourly_cost != null
            ? t.hourly_cost
            : t.employee_id
            ? costMap.get(t.employee_id) ?? 0
            : 0
        return {
          project_id: projectId,
          daily_report_id: reportId,
          employee_id: t.employee_id ?? null,
          employee_name: t.employee_name ?? null,
          work_date: reportDate ?? new Date().toISOString().slice(0, 10),
          clock_in: t.clock_in ?? null,
          clock_out: t.clock_out ?? null,
          break_minutes: t.break_minutes ?? 0,
          hours,
          hourly_cost: hourlyCost,
          notes: t.notes ?? null,
          created_by: auth.user!.id,
        }
      })
      await supabase.from('time_entries').insert(rows)
    }
  }

  // 3) Remplacement des matériaux
  if (body.materials !== undefined) {
    await supabase.from('daily_report_materials').delete().eq('daily_report_id', reportId)

    if (body.materials.length > 0) {
      const rows = body.materials.map((m) => ({
        daily_report_id: reportId,
        project_id: projectId,
        material_id: m.material_id ?? null,
        description: m.description || '—',
        quantity: m.quantity ?? null,
        unit: m.unit ?? null,
        unit_cost: m.unit_cost ?? null,
      }))
      await supabase.from('daily_report_materials').insert(rows)
    }
  }

  // 4) Régénération des résumés (après mise à jour des enfants)
  if (body.regenerate) {
    const { data: fresh } = await supabase
      .from('daily_reports')
      .select(SELECT)
      .eq('id', reportId)
      .single()

    const { data: project } = await supabase
      .from('projects')
      .select('title')
      .eq('id', projectId)
      .single()

    if (fresh) {
      const summaryInput = {
        report: fresh as unknown as Parameters<typeof buildManagementSummary>[0]['report'],
        timeEntries: (fresh.time_entries as unknown as TimeEntry[]) ?? [],
        materials: (fresh.materials as unknown as DailyReportMaterial[]) ?? [],
        issues: (fresh.issues as unknown as SiteIssue[]) ?? [],
        projectTitle: project?.title,
      }
      await supabase
        .from('daily_reports')
        .update({
          generated_summary: buildManagementSummary(summaryInput),
          client_summary: buildClientSummary(summaryInput),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)
    }
  }

  // 5) Retourne l'état frais
  const { data: result } = await supabase
    .from('daily_reports')
    .select(SELECT)
    .eq('id', reportId)
    .eq('project_id', projectId)
    .single()

  return NextResponse.json({ report: result })
}

// ── DELETE ──────────────────────────────────────────────────────────────────
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { projectId, reportId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await supabase
    .from('daily_reports')
    .delete()
    .eq('id', reportId)
    .eq('project_id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
