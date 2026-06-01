// lib/invoice/compute.ts
// ============================================================
// Calcul des totaux de facture avec taxes du Québec (TPS + TVQ).
// Pur, sans I/O.
// ============================================================

export const TPS_RATE = 0.05      // TPS / GST fédérale
export const TVQ_RATE = 0.09975   // TVQ / QST Québec

export interface InvoiceLineInput {
  quantity?: number | null
  unit_price?: number | null
}

export interface InvoiceTotalsInput {
  items: InvoiceLineInput[]
  discount_amount?: number
  tax_gst_rate?: number
  tax_qst_rate?: number
  amount_paid?: number
}

export interface InvoiceTotals {
  subtotal: number
  discount_amount: number
  taxableBase: number
  tax_gst: number
  tax_qst: number
  total: number
  amount_paid: number
  balance: number
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Calcule les totaux d'une facture.
 * Au Québec la TVQ se calcule sur le montant HORS TPS (depuis 2013),
 * donc TPS et TVQ s'appliquent toutes deux sur la base taxable (non cumulées).
 */
export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const subtotal = round2(
    input.items.reduce((s, it) => s + (it.quantity ?? 0) * (it.unit_price ?? 0), 0)
  )
  const discount = round2(Math.min(input.discount_amount ?? 0, subtotal))
  const taxableBase = round2(subtotal - discount)

  const gstRate = input.tax_gst_rate ?? TPS_RATE
  const qstRate = input.tax_qst_rate ?? TVQ_RATE

  const tax_gst = round2(taxableBase * gstRate)
  const tax_qst = round2(taxableBase * qstRate)
  const total = round2(taxableBase + tax_gst + tax_qst)
  const amount_paid = round2(input.amount_paid ?? 0)

  return {
    subtotal,
    discount_amount: discount,
    taxableBase,
    tax_gst,
    tax_qst,
    total,
    amount_paid,
    balance: round2(total - amount_paid),
  }
}
