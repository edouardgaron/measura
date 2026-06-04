// app/api/projects/[projectId]/profitability/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { computeProfitability } from '@/lib/profitability/compute'

type RouteContext = { params: Promise<{ projectId: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // ── Estimation de référence : acceptée en priorité, sinon la plus récente ──
  const { data: estimates } = await supabase
    .from('estimates')
    .select('id, status, subtotal, total, labor_cost, material_cost, equipment_cost, overhead_cost, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  const list = estimates ?? []
  const estimate = list.find((e) => e.status === 'accepted') ?? list[0] ?? null

  // ── Heures prévues : somme des lignes d'estimation en heures ──
  let plannedHours: number | null = null
  if (estimate) {
    const { data: items } = await supabase
      .from('estimate_items')
      .select('quantity, unit')
      .eq('estimate_id', estimate.id)
      .eq('unit', 'hour')
    if (items && items.length > 0) {
      plannedHours = Math.round(items.reduce((s, i) => s + (i.quantity ?? 0), 0) * 100) / 100
    }
  }

  // ── Coûts réels : pointages + matériaux consommés ──
  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select('hours, labor_cost, employee_id, employee_name')
    .eq('project_id', projectId)

  const { data: materials } = await supabase
    .from('daily_report_materials')
    .select('total_cost')
    .eq('project_id', projectId)

  // Dépenses directes du chantier (module Dépenses) → coût réel
  const { data: expenseRows } = await supabase
    .from('expenses')
    .select('total, category')
    .eq('project_id', projectId)

  const realLaborCost = (timeEntries ?? []).reduce((s, t) => s + (t.labor_cost ?? 0), 0)
  const realHours = (timeEntries ?? []).reduce((s, t) => s + (t.hours ?? 0), 0)
  const realMaterialCost = (materials ?? []).reduce((s, m) => s + (m.total_cost ?? 0), 0)
  const realExpenses = (expenseRows ?? []).reduce((s, e) => s + Number(e.total ?? 0), 0)

  // Ventilation des dépenses par catégorie (pour affichage)
  const expensesByCategory = Object.entries(
    (expenseRows ?? []).reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + Number(e.total ?? 0); return acc
    }, {})
  ).map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)

  // ── Répartition par employé ──
  const empMap = new Map<string, { name: string; hours: number; cost: number }>()
  for (const t of timeEntries ?? []) {
    const key = t.employee_id ?? `name:${t.employee_name ?? 'Inconnu'}`
    const cur = empMap.get(key) ?? { name: t.employee_name ?? 'Inconnu', hours: 0, cost: 0 }
    cur.hours += t.hours ?? 0
    cur.cost += t.labor_cost ?? 0
    empMap.set(key, cur)
  }
  // Compléter les noms manquants via la table employees
  const idsNeedingName = [...empMap.entries()]
    .filter(([k, v]) => k.startsWith('name:') === false && (!v.name || v.name === 'Inconnu'))
    .map(([k]) => k)
  if (idsNeedingName.length > 0) {
    const { data: emps } = await supabase.from('employees').select('id, full_name').in('id', idsNeedingName)
    for (const e of emps ?? []) {
      const cur = empMap.get(e.id)
      if (cur) cur.name = e.full_name
    }
  }
  const perEmployee = [...empMap.values()]
    .map((v) => ({ name: v.name, hours: Math.round(v.hours * 100) / 100, cost: Math.round(v.cost * 100) / 100 }))
    .sort((a, b) => b.cost - a.cost)

  const result = computeProfitability({
    revenue: estimate?.subtotal ?? 0,
    plannedLaborCost: estimate?.labor_cost ?? 0,
    plannedMaterialCost: estimate?.material_cost ?? 0,
    plannedEquipmentCost: estimate?.equipment_cost ?? 0,
    plannedOverheadCost: estimate?.overhead_cost ?? 0,
    plannedHours,
    realLaborCost,
    realMaterialCost,
    realExpenses,
    realHours,
  })

  return NextResponse.json({
    profitability: result,
    perEmployee,
    expensesByCategory,
    hasEstimate: !!estimate,
    estimateStatus: estimate?.status ?? null,
  })
}
