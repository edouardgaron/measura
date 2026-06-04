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
  const [{ data: estimates }, { data: timeEntries }, { data: materials }, { data: expenseRows }] = await Promise.all([
    supabase
      .from('estimates')
      .select('project_id, status, subtotal, labor_cost, material_cost, equipment_cost, overhead_cost, created_at')
      .in('project_id', ids)
      .order('created_at', { ascending: false }),
    supabase.from('time_entries').select('project_id, hours, labor_cost, employee_id, employee_name').in('project_id', ids),
    supabase.from('daily_report_materials').select('project_id, total_cost').in('project_id', ids),
    supabase.from('expenses').select('project_id, total').in('project_id', ids),
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

  const expByProject = new Map<string, number>()
  for (const e of expenseRows ?? []) {
    expByProject.set(e.project_id, (expByProject.get(e.project_id) ?? 0) + Number(e.total ?? 0))
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
      realExpenses: expByProject.get(p.id) ?? 0,
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

  // ── Rentabilité par employé (agrégée sur tous les chantiers) ──────────────
  // Contribution au profit = profit réel du chantier × (coût M.O. de l'employé
  // sur ce chantier / coût M.O. total du chantier).
  const realProfitByProject = new Map(rows.map((r) => [r.projectId, r.realProfit]))
  const empAgg = new Map<string, { name: string; hours: number; cost: number; profit: number }>()
  for (const t of timeEntries ?? []) {
    const key = t.employee_id ?? `name:${t.employee_name ?? 'Inconnu'}`
    const cur = empAgg.get(key) ?? { name: t.employee_name ?? 'Inconnu', hours: 0, cost: 0, profit: 0 }
    cur.hours += t.hours ?? 0
    cur.cost += t.labor_cost ?? 0
    const projLabor = laborByProject.get(t.project_id)?.cost ?? 0
    const projProfit = realProfitByProject.get(t.project_id) ?? 0
    if (projLabor > 0) cur.profit += projProfit * ((t.labor_cost ?? 0) / projLabor)
    empAgg.set(key, cur)
  }
  // Compléter les noms manquants + rattacher l'équipe via la table employees
  const empTeam = new Map<string, string | null>() // employee_id → team_id
  const empIds = [...empAgg.keys()].filter((k) => !k.startsWith('name:'))
  if (empIds.length) {
    const { data: emps } = await supabase.from('employees').select('id, full_name, team_id').in('id', empIds)
    for (const e of emps ?? []) {
      const cur = empAgg.get(e.id); if (cur) cur.name = e.full_name ?? cur.name
      empTeam.set(e.id, (e as { team_id: string | null }).team_id ?? null)
    }
  }
  const perEmployee = [...empAgg.entries()]
    .map(([key, v]) => ({
      key, name: v.name, hours: round2(v.hours), cost: round2(v.cost), profit: round2(v.profit),
      marginPct: v.cost > 0 ? round2((v.profit / (v.profit + v.cost)) * 100) : null,
    }))
    .sort((a, b) => b.profit - a.profit)
    .map(({ key, ...rest }) => { void key; return rest })

  // ── Rentabilité par équipe ────────────────────────────────────────────────
  // On regroupe la contribution de chaque employé selon son équipe (team_id).
  // Les pointages sans employé identifié (clé name:) tombent dans « Sans équipe ».
  const NO_TEAM = '__none__'
  const teamAgg = new Map<string, { hours: number; cost: number; profit: number }>()
  for (const [key, v] of empAgg.entries()) {
    const teamId = key.startsWith('name:') ? NO_TEAM : (empTeam.get(key) ?? NO_TEAM)
    const cur = teamAgg.get(teamId) ?? { hours: 0, cost: 0, profit: 0 }
    cur.hours += v.hours; cur.cost += v.cost; cur.profit += v.profit
    teamAgg.set(teamId, cur)
  }
  const teamMeta = new Map<string, { name: string; color: string }>()
  const realTeamIds = [...teamAgg.keys()].filter((k) => k !== NO_TEAM)
  if (realTeamIds.length) {
    const { data: teams } = await supabase.from('teams').select('id, name, color').in('id', realTeamIds)
    for (const t of teams ?? []) teamMeta.set(t.id, { name: t.name, color: t.color ?? '#0f172a' })
  }
  const perTeam = [...teamAgg.entries()]
    .map(([id, v]) => ({
      name: id === NO_TEAM ? 'Sans équipe' : (teamMeta.get(id)?.name ?? 'Équipe'),
      color: id === NO_TEAM ? '#9ca3af' : (teamMeta.get(id)?.color ?? '#0f172a'),
      hours: round2(v.hours), cost: round2(v.cost), profit: round2(v.profit),
      marginPct: v.cost > 0 ? round2((v.profit / (v.profit + v.cost)) * 100) : null,
    }))
    .sort((a, b) => b.profit - a.profit)

  return NextResponse.json({ rows, totals, perEmployee, perTeam })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function emptyTotals() {
  return { revenue: 0, realCost: 0, realProfit: 0, plannedProfit: 0, realHours: 0, atRisk: 0, projects: 0, realMarginPct: null }
}
