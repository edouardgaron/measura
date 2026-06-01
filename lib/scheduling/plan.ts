// lib/scheduling/plan.ts
// ============================================================
// Calculs purs de planification : durée d'un chantier en jours
// ouvrables à partir des heures estimées et de la taille d'équipe.
// ============================================================

/** Vrai si la date (ISO yyyy-mm-dd) tombe un week-end. */
export function isWeekend(iso: string): boolean {
  const d = new Date(iso + 'T00:00:00')
  const day = d.getUTCDay()
  return day === 0 || day === 6
}

/** Ajoute `n` jours calendaires à une date ISO (yyyy-mm-dd). */
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Avance de `workingDays` jours ouvrables (sauter samedi/dimanche),
 * en comptant le jour de départ s'il est ouvrable.
 * Retourne la date de fin (inclusive).
 */
export function addWorkingDays(startIso: string, workingDays: number): string {
  const days = Math.max(1, Math.ceil(workingDays))
  let cursor = startIso
  // si le départ est un week-end, avancer au prochain jour ouvrable
  while (isWeekend(cursor)) cursor = addDays(cursor, 1)
  let counted = 1
  while (counted < days) {
    cursor = addDays(cursor, 1)
    if (!isWeekend(cursor)) counted++
  }
  return cursor
}

export interface DurationInput {
  estimatedHours: number
  crewSize: number
  hoursPerDay?: number
}

/** Nombre de jours ouvrables nécessaires (>= 1). */
export function workingDaysNeeded({ estimatedHours, crewSize, hoursPerDay = 8 }: DurationInput): number {
  const capacity = Math.max(1, crewSize) * Math.max(1, hoursPerDay)
  if (!estimatedHours || estimatedHours <= 0) return 1
  return Math.max(1, Math.ceil(estimatedHours / capacity))
}

/** Calcule la date de fin d'un chantier planifié. */
export function computeEndDate(startIso: string, input: DurationInput): string {
  return addWorkingDays(startIso, workingDaysNeeded(input))
}
