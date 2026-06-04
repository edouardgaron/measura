// lib/profitability/compute.ts
// ============================================================
// Moteur de rentabilité temps réel (pur, sans I/O).
// Compare PRÉVU (estimation) vs RÉEL (pointages + matériaux
// consommés) et émet des alertes exploitables.
// ============================================================

export interface ProfitabilityInput {
  /** Prix vendu HT (sous-total de l'estimation acceptée). */
  revenue: number
  /** Extras approuvés (avenants) — ajoutés au revenu. */
  extras?: number
  // Coûts prévus (depuis l'estimation)
  plannedLaborCost: number
  plannedMaterialCost: number
  plannedEquipmentCost?: number
  plannedOverheadCost?: number
  plannedHours?: number | null
  // Coûts réels (depuis le chantier)
  realLaborCost: number
  realMaterialCost: number
  /** Dépenses directes réelles (module Dépenses : carburant, sous-traitant, permis, location, matériaux achetés…). */
  realExpenses?: number
  realHours: number
  // Seuils (optionnels)
  thresholds?: Partial<ProfitabilityThresholds>
}

export interface ProfitabilityThresholds {
  lowMarginPct: number      // marge réelle sous ce seuil → alerte
  costOverrunPct: number    // dépassement coût toléré avant alerte
  hoursOverrunPct: number   // dépassement heures toléré avant alerte
}

export const DEFAULT_THRESHOLDS: ProfitabilityThresholds = {
  lowMarginPct: 15,
  costOverrunPct: 5,
  hoursOverrunPct: 10,
}

export type AlertLevel = 'info' | 'warning' | 'danger'

export interface ProfitabilityAlert {
  id: string
  level: AlertLevel
  title: string
  detail: string
  suggestion: string
}

export interface ProfitabilityResult {
  revenue: number
  plannedCost: number
  realCost: number
  plannedProfit: number
  realProfit: number
  plannedMarginPct: number | null
  realMarginPct: number | null
  // Détails
  laborVariance: number       // prévu - réel (positif = sous budget)
  materialVariance: number
  costVariance: number
  hoursVariance: number | null
  realLaborCost: number
  realMaterialCost: number
  realExpenses: number
  realHours: number
  plannedLaborCost: number
  plannedMaterialCost: number
  plannedHours: number | null
  // % du budget consommé
  budgetUsedPct: number | null
  alerts: ProfitabilityAlert[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function marginPct(profit: number, revenue: number): number | null {
  if (revenue <= 0) return null
  return round2((profit / revenue) * 100)
}

export function computeProfitability(input: ProfitabilityInput): ProfitabilityResult {
  const t = { ...DEFAULT_THRESHOLDS, ...(input.thresholds ?? {}) }

  const revenue = round2((input.revenue ?? 0) + (input.extras ?? 0))

  const plannedCost = round2(
    (input.plannedLaborCost ?? 0) +
      (input.plannedMaterialCost ?? 0) +
      (input.plannedEquipmentCost ?? 0) +
      (input.plannedOverheadCost ?? 0)
  )
  const realExpenses = round2(input.realExpenses ?? 0)
  const realCost = round2((input.realLaborCost ?? 0) + (input.realMaterialCost ?? 0) + realExpenses)

  const plannedProfit = round2(revenue - plannedCost)
  const realProfit = round2(revenue - realCost)

  const laborVariance = round2((input.plannedLaborCost ?? 0) - input.realLaborCost)
  const materialVariance = round2((input.plannedMaterialCost ?? 0) - input.realMaterialCost)
  const costVariance = round2(plannedCost - realCost)
  const hoursVariance =
    input.plannedHours != null ? round2(input.plannedHours - input.realHours) : null

  const budgetUsedPct = plannedCost > 0 ? round2((realCost / plannedCost) * 100) : null

  const result: ProfitabilityResult = {
    revenue,
    plannedCost,
    realCost,
    plannedProfit,
    realProfit,
    plannedMarginPct: marginPct(plannedProfit, revenue),
    realMarginPct: marginPct(realProfit, revenue),
    laborVariance,
    materialVariance,
    costVariance,
    hoursVariance,
    realLaborCost: round2(input.realLaborCost),
    realMaterialCost: round2(input.realMaterialCost),
    realExpenses,
    realHours: round2(input.realHours),
    plannedLaborCost: round2(input.plannedLaborCost ?? 0),
    plannedMaterialCost: round2(input.plannedMaterialCost ?? 0),
    plannedHours: input.plannedHours ?? null,
    budgetUsedPct,
    alerts: [],
  }

  result.alerts = buildAlerts(result, t)
  return result
}

function buildAlerts(r: ProfitabilityResult, t: ProfitabilityThresholds): ProfitabilityAlert[] {
  const alerts: ProfitabilityAlert[] = []

  // Risque de perte
  if (r.revenue > 0 && r.realProfit < 0) {
    alerts.push({
      id: 'loss-risk',
      level: 'danger',
      title: 'Risque de perte',
      detail: `Le coût réel (${money(r.realCost)}) dépasse le revenu (${money(r.revenue)}). Profit réel : ${money(r.realProfit)}.`,
      suggestion: 'Stopper les heures non essentielles, valider un avenant client, ou réviser la portée des travaux.',
    })
  }

  // Dépassement de budget global
  if (r.plannedCost > 0 && r.realCost > r.plannedCost * (1 + t.costOverrunPct / 100)) {
    const over = r.realCost - r.plannedCost
    alerts.push({
      id: 'cost-overrun',
      level: 'danger',
      title: 'Dépassement de budget',
      detail: `Coût réel ${money(r.realCost)} vs budget ${money(r.plannedCost)} (dépassement de ${money(over)}, ${r.budgetUsedPct}% du budget).`,
      suggestion: 'Analyser le poste en cause (main d’œuvre vs matériaux) et ajuster la planification restante.',
    })
  } else if (r.budgetUsedPct != null && r.budgetUsedPct >= 90 && r.budgetUsedPct <= 100 + t.costOverrunPct) {
    alerts.push({
      id: 'budget-near',
      level: 'warning',
      title: 'Budget presque atteint',
      detail: `${r.budgetUsedPct}% du budget consommé.`,
      suggestion: 'Surveiller de près les dépenses restantes du chantier.',
    })
  }

  // Dépassement d'heures
  if (r.plannedHours != null && r.plannedHours > 0 && r.realHours > r.plannedHours * (1 + t.hoursOverrunPct / 100)) {
    const over = round2(r.realHours - r.plannedHours)
    alerts.push({
      id: 'hours-overrun',
      level: 'warning',
      title: 'Dépassement d’heures',
      detail: `${r.realHours} h réelles vs ${r.plannedHours} h prévues (+${over} h).`,
      suggestion: 'Vérifier la productivité de l’équipe et la précision de l’estimation initiale.',
    })
  }

  // Faible rentabilité
  if (r.realMarginPct != null && r.realProfit >= 0 && r.realMarginPct < t.lowMarginPct) {
    alerts.push({
      id: 'low-margin',
      level: 'warning',
      title: 'Faible rentabilité',
      detail: `Marge réelle de ${r.realMarginPct}% (cible ≥ ${t.lowMarginPct}%).`,
      suggestion: 'Optimiser les coûts ou réviser la tarification pour les prochains projets similaires.',
    })
  }

  // Tout va bien
  if (alerts.length === 0 && r.revenue > 0) {
    alerts.push({
      id: 'healthy',
      level: 'info',
      title: 'Chantier rentable',
      detail: `Marge réelle de ${r.realMarginPct ?? 0}% — dans les objectifs.`,
      suggestion: 'Maintenir le suivi du pointage et des matériaux pour conserver la précision.',
    })
  }

  return alerts
}

function money(n: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n)
}
