import { describe, it, expect } from 'vitest'
import { computeInvoiceTotals, TPS_RATE, TVQ_RATE } from '@/lib/invoice/compute'

describe('computeInvoiceTotals — taxes Québec', () => {
  it('calcule TPS (5%) et TVQ (9,975%) sur la base hors taxes', () => {
    const t = computeInvoiceTotals({ items: [{ quantity: 2, unit_price: 100 }] })
    expect(t.subtotal).toBe(200)
    expect(t.tax_gst).toBeCloseTo(200 * TPS_RATE, 2) // 10.00
    expect(t.tax_qst).toBeCloseTo(200 * TVQ_RATE, 2) // 19.95
    expect(t.total).toBeCloseTo(229.95, 2)
    expect(t.balance).toBeCloseTo(229.95, 2)
  })

  it('applique le rabais avant les taxes', () => {
    const t = computeInvoiceTotals({ items: [{ quantity: 1, unit_price: 1000 }], discount_amount: 100 })
    expect(t.taxableBase).toBe(900)
    expect(t.total).toBeCloseTo(900 * (1 + TPS_RATE + TVQ_RATE), 2)
  })

  it('déduit le montant déjà payé du solde', () => {
    const t = computeInvoiceTotals({ items: [{ quantity: 1, unit_price: 100 }], amount_paid: 50 })
    expect(t.balance).toBeCloseTo(t.total - 50, 2)
  })

  it('ne laisse pas le rabais dépasser le sous-total', () => {
    const t = computeInvoiceTotals({ items: [{ quantity: 1, unit_price: 100 }], discount_amount: 500 })
    expect(t.taxableBase).toBe(0)
    expect(t.total).toBe(0)
  })
})
