import { describe, it, expect } from 'vitest'
import { workingDaysNeeded, computeEndDate, isWeekend, addWorkingDays } from '@/lib/scheduling/plan'

describe('planification — jours ouvrables', () => {
  it('calcule la durée selon heures / (équipe × heures/jour)', () => {
    expect(workingDaysNeeded({ estimatedHours: 80, crewSize: 2, hoursPerDay: 8 })).toBe(5)
    expect(workingDaysNeeded({ estimatedHours: 8, crewSize: 1, hoursPerDay: 8 })).toBe(1)
    expect(workingDaysNeeded({ estimatedHours: 0, crewSize: 1 })).toBe(1) // minimum 1 jour
  })

  it('détecte les week-ends', () => {
    expect(isWeekend('2026-06-06')).toBe(true)  // samedi
    expect(isWeekend('2026-06-07')).toBe(true)  // dimanche
    expect(isWeekend('2026-06-08')).toBe(false) // lundi
  })

  it('saute les week-ends pour la date de fin', () => {
    // vendredi 2026-06-05 + 3 jours ouvrables → mardi 2026-06-09
    expect(addWorkingDays('2026-06-05', 3)).toBe('2026-06-09')
    const end = computeEndDate('2026-06-01', { estimatedHours: 40, crewSize: 1, hoursPerDay: 8 }) // 5 j ouvrables
    expect(end).toBe('2026-06-05') // lundi → vendredi
  })
})
