// app/api/accounting/export/route.ts
// Export CSV des factures ou paiements (compatible QuickBooks/Acomba/Excel).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toCsv } from '@/lib/accounting/csv'
import type { Invoice } from '@/lib/supabase/types'

function inRange(date: string | null, from: string | null, to: string | null): boolean {
  if (!date) return false
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const type = request.nextUrl.searchParams.get('type') === 'payments' ? 'payments' : 'invoices'
  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')

  let csv: string
  let filename: string

  if (type === 'invoices') {
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number, issue_date, due_date, client_name, client_email, status, subtotal, discount_amount, tax_gst, tax_qst, total, amount_paid')
      .order('issue_date', { ascending: true })

    const rows = ((data as Partial<Invoice>[]) ?? [])
      .filter((i) => inRange(i.issue_date ?? null, from, to))
      .map((i) => [
        i.invoice_number ?? '',
        i.issue_date ?? '',
        i.due_date ?? '',
        i.client_name ?? '',
        i.client_email ?? '',
        i.status ?? '',
        (i.subtotal ?? 0).toFixed(2),
        (i.discount_amount ?? 0).toFixed(2),
        (i.tax_gst ?? 0).toFixed(2),
        (i.tax_qst ?? 0).toFixed(2),
        (i.total ?? 0).toFixed(2),
        (i.amount_paid ?? 0).toFixed(2),
        ((i.total ?? 0) - (i.amount_paid ?? 0)).toFixed(2),
      ])

    csv = toCsv(
      ['Numero', 'Date', 'Echeance', 'Client', 'Courriel', 'Statut', 'Sous-total', 'Rabais', 'TPS', 'TVQ', 'Total', 'Paye', 'Solde'],
      rows
    )
    filename = 'factures.csv'
  } else {
    const { data } = await supabase
      .from('payments')
      .select('paid_at, created_at, amount, method, status, is_deposit, invoice:invoices(invoice_number, client_name)')
      .order('created_at', { ascending: true })

    type PaymentRow = {
      paid_at: string | null; created_at: string; amount: number; method: string; status: string; is_deposit: boolean
      invoice: { invoice_number: string | null; client_name: string | null } | null
    }
    const rows = ((data as unknown as PaymentRow[]) ?? [])
      .filter((p) => inRange((p.paid_at ?? p.created_at).slice(0, 10), from, to))
      .map((p) => [
        (p.paid_at ?? p.created_at).slice(0, 10),
        p.invoice?.invoice_number ?? '',
        p.invoice?.client_name ?? '',
        (p.amount ?? 0).toFixed(2),
        p.method,
        p.status,
        p.is_deposit ? 'depot' : 'paiement',
      ])

    csv = toCsv(['Date', 'Facture', 'Client', 'Montant', 'Methode', 'Statut', 'Type'], rows)
    filename = 'paiements.csv'
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
