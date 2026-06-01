// app/api/profitability/route.ts
// Rollup de rentabilité sur tous les chantiers accessibles à l'utilisateur.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeProfitability } from '@/lib/profitability/compute'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Projets accessibles (RLS applique le filtre owner/membre/compagnie)
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, status, created_at')
    .order('created_at', { ascending: false })

  const projectList = projects ?? []
  const ids = projectList.map((p) => p.id)

  if (ids.length === 0) {
    return NextResponse.json({ rows: [], totals: emptyTotals() })
  }

  // Données liées (RLS filtre déjà par accès)
  const [{ data: estimates }, { data: timeEntries }, { data: materials }] = await Promise.all([
    supabase
      .from('estimates')
      .select('project_id, status, subtotal, labor_cost, material_cost, equipment_cost, overhead_cost, created_at')
      .in('project_id', ids)
      .order('created_at', { ascending: false }),
    supabase.from('time_entries').select('project_id, hours, labor_cost').in('project_id', ids),
    supabase.from('daily_report_materials').select('project_id, total_cost').in('project_id', ids),
  ])

  // Indexation par projet
  type EstimateRow = {
    project_id: string
    status: string
    subtotal: number | null
    labor_cost: number | null
    material_cost: number | null
    equipment_cost: number | null
    overhead_cost: number | null
    created_at: string
  }
  const estByProject = new Map<string, EstimateRow>()
  for (const e of estimates ?? []) {
    // garde l'acceptée en priorité, sinon la plus récente (déjà triée desc)
    const cur = estByProject.get(e.project_id)
    if (!cur || (e.status === 'accepted' && cur.status !== 'accepted')) {
      estByProject.set(e.project_id, e)
    } else if (!cur) {
      estByProject.set(e.project_id, e)
    }
  }

  const laborByProject = new Map<string, { hours: number; cost: number }>()
  for (const t of timeEntries ?? []) {
    const cur = laborByProject.get(t.project_id) ?? { hours: 0, cost: 0 }
    cur.hours += t.hours ?? 0
    cur.cost += t.labor_cost ?? 0
    laborByProject.set(t.project_id, cur)
  }

  const matByProject = new Map<string, number>()
  for (const m of materials ?? []) {
    matByProject.set(m.project_id, (matByProject.get(m.project_id) ?? 0) + (m.total_cost ?? 0))
  }

  const rows = projectList.map((p) => {
    const est = estByProject.get(p.id)
    const labor = laborByProject.get(p.id) ?? { hours: 0, cost: 0 }
    const matCost = matByProject.get(p.id) ?? 0

    const r = computeProfitability({
      revenue: est?.subtotal ?? 0,
      plannedLaborCost: est?.labor_cost ?? 0,
      plannedMaterialCost: est?.material_cost ?? 0,
      plannedEquipmentCost: est?.equipment_cost ?? 0,
      plannedOverheadCost: est?.overhead_cost ?? 0,
      realLaborCost: labor.cost,
      realMaterialCost: matCost,
      realHours: labor.hours,
    })

    const worstLevel = r.alerts.some((a) => a.level === 'danger')
      ? 'danger'
      : r.alerts.some((a) => a.level === 'warning')
      ? 'warning'
      : 'info'

    return {
      projectId: p.id,
      title: p.title,
      status: p.status,
      revenue: r.revenue,
      realCost: r.realCost,
      realProfit: r.realProfit,
      realMarginPct: r.realMarginPct,
      plannedProfit: r.plannedProfit,
      realHours: r.realHours,
      alertLevel: worstLevel,
    }
  })

  // Totaux compagnie
  const totals = rows.reduce(
    (acc, r) => {
      acc.revenue += r.revenue
      acc.realCost += r.realCost
      acc.realProfit += r.realProfit
      acc.plannedProfit += r.plannedProfit
      acc.realHours += r.realHours
      if (r.alertLevel === 'danger') acc.atRisk += 1
      return acc
    },
    { revenue: 0, realCost: 0, realProfit: 0, plannedProfit: 0, realHours: 0, atRisk: 0, projects: rows.length }
  )
  totals.revenue = round2(totals.revenue)
  totals.realCost = round2(totals.realCost)
  totals.realProfit = round2(totals.realProfit)
  totals.plannedProfit = round2(totals.plannedProfit)
  totals.realHours = round2(totals.realHours)
  ;(totals as { realMarginPct?: number | null }).realMarginPct =
    totals.revenue > 0 ? round2((totals.realProfit / totals.revenue) * 100) : null

  return NextResponse.json({ rows, totals })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function emptyTotals() {
  return { revenue: 0, realCost: 0, realProfit: 0, plannedProfit: 0, realHours: 0, atRisk: 0, projects: 0, realMarginPct: null }
}
