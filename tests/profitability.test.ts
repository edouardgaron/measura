import { describe, it, expect } from 'vitest'
import { computeProfitability } from '@/lib/profitability/compute'

describe('rentabilité temps réel', () => {
  it('calcule marges prévues et réelles', () => {
    const r = computeProfitability({
      revenue: 10000,
      plannedLaborCost: 4000, plannedMaterialCost: 2000,
      realLaborCost: 4500, realMaterialCost: 2200, realHours: 100,
    })
    expect(r.plannedCost).toBe(6000)
    expect(r.realCost).toBe(6700)
    expect(r.plannedProfit).toBe(4000)
    expect(r.realProfit).toBe(3300)
    expect(r.realMarginPct).toBeCloseTo(33, 0)
  })

  it('déclenche une alerte de risque de perte', () => {
    const r = computeProfitability({
      revenue: 5000,
      plannedLaborCost: 2000, plannedMaterialCost: 1000,
      realLaborCost: 4000, realMaterialCost: 2000, realHours: 120,
    })
    expect(r.realProfit).toBeLessThan(0)
    expect(r.alerts.some((a) => a.id === 'loss-risk' && a.level === 'danger')).toBe(true)
  })

  it('signale un dépassement de budget', () => {
    const r = computeProfitability({
      revenue: 20000,
      plannedLaborCost: 5000, plannedMaterialCost: 3000,
      realLaborCost: 7000, realMaterialCost: 4000, realHours: 150,
    })
    expect(r.alerts.some((a) => a.id === 'cost-overrun')).toBe(true)
  })

  it('chantier sain (coût < budget, bonne marge) → alerte info', () => {
    const r = computeProfitability({
      revenue: 10000,
      plannedLaborCost: 3000, plannedMaterialCost: 2000, // budget 5000
      realLaborCost: 2400, realMaterialCost: 1600, realHours: 70, // réel 4000 (80%)
    })
    expect(r.realProfit).toBe(6000)
    expect(r.alerts.some((a) => a.level === 'info' && a.id === 'healthy')).toBe(true)
  })

  it('signale « budget presque atteint » à ~100% sans dépassement', () => {
    const r = computeProfitability({
      revenue: 10000,
      plannedLaborCost: 3000, plannedMaterialCost: 2000,
      realLaborCost: 3000, realMaterialCost: 2000, realHours: 80, // 100% du budget
    })
    expect(r.alerts.some((a) => a.id === 'budget-near')).toBe(true)
  })
})
