import { describe, it, expect } from 'vitest'
import { computeHours, timeToMinutes, sumSiteCosts } from '@/lib/site/compute'

describe('pointage — calcul des heures', () => {
  it('convertit HH:MM en minutes', () => {
    expect(timeToMinutes('08:30')).toBe(510)
    expect(timeToMinutes(null)).toBe(null)
  })

  it('calcule les heures nettes avec pause', () => {
    expect(computeHours('08:00', '16:00', 30)).toBe(7.5)
    expect(computeHours('08:00', '12:00', 0)).toBe(4)
  })

  it('gère le passage de minuit (quart de nuit)', () => {
    expect(computeHours('22:00', '06:00', 0)).toBe(8)
  })

  it('retourne 0 si entrée/sortie manquante ou pause excessive', () => {
    expect(computeHours(null, '16:00', 0)).toBe(0)
    expect(computeHours('08:00', '08:30', 60)).toBe(0)
  })

  it('agrège heures et coûts réels', () => {
    const totals = sumSiteCosts(
      [{ hours: 8, labor_cost: 320 }, { hours: 4, labor_cost: 160 }],
      [{ total_cost: 250 }]
    )
    expect(totals.totalHours).toBe(12)
    expect(totals.laborCost).toBe(480)
    expect(totals.materialCost).toBe(250)
    expect(totals.totalCost).toBe(730)
  })
})
