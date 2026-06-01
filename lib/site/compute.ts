// lib/site/compute.ts
// ============================================================
// Calculs purs pour la gestion chantier : heures travaillées,
// coûts de main d'œuvre et matériaux. Aucune I/O.
// ============================================================

import type { DailyReportMaterial, TimeEntry } from '@/lib/supabase/types'

/** Convertit 'HH:MM' ou 'HH:MM:SS' en minutes depuis minuit. */
export function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (Number.isNaN(h) || Number.isNaN(min)) return null
  return h * 60 + min
}

/**
 * Heures nettes travaillées à partir des pointages d'entrée/sortie et de la
 * pause (en minutes). Gère le passage de minuit (sortie < entrée).
 * Retourne un nombre arrondi à 2 décimales, jamais négatif.
 */
export function computeHours(
  clockIn: string | null | undefined,
  clockOut: string | null | undefined,
  breakMinutes = 0
): number {
  const start = timeToMinutes(clockIn)
  const end = timeToMinutes(clockOut)
  if (start === null || end === null) return 0
  let span = end - start
  if (span < 0) span += 24 * 60 // shift de nuit
  const net = span - (breakMinutes || 0)
  if (net <= 0) return 0
  return Math.round((net / 60) * 100) / 100
}

export interface SiteCostTotals {
  totalHours: number
  laborCost: number
  materialCost: number
  totalCost: number
}

/** Agrège heures + coûts réels depuis les pointages et matériaux. */
export function sumSiteCosts(
  timeEntries: Pick<TimeEntry, 'hours' | 'labor_cost'>[],
  materials: Pick<DailyReportMaterial, 'total_cost'>[]
): SiteCostTotals {
  const totalHours = round2(timeEntries.reduce((s, t) => s + (t.hours ?? 0), 0))
  const laborCost = round2(timeEntries.reduce((s, t) => s + (t.labor_cost ?? 0), 0))
  const materialCost = round2(materials.reduce((s, m) => s + (m.total_cost ?? 0), 0))
  return {
    totalHours,
    laborCost,
    materialCost,
    totalCost: round2(laborCost + materialCost),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
