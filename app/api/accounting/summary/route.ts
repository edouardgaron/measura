// app/api/accounting/summary/route.ts
// Sommaire comptable : facturation, encaissements, taxes collectées (TPS/TVQ).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')

  let invQ = supabase.from('invoices').select('issue_date, subtotal, tax_gst, tax_qst, total, amount_paid, status').neq('status', 'cancelled')
  if (from) invQ = invQ.gte('issue_date', from)
  if (to) invQ = invQ.lte('issue_date', to)
  const { data: invoices } = await invQ

  const rows = invoices ?? []
  const sum = (f: (r: typeof rows[number]) => number) => Math.round(rows.reduce((s, r) => s + f(r), 0) * 100) / 100

  const summary = {
    invoiceCount: rows.length,
    subtotal: sum((r) => r.subtotal ?? 0),
    tax_gst: sum((r) => r.tax_gst ?? 0),
    tax_qst: sum((r) => r.tax_qst ?? 0),
    total: sum((r) => r.total ?? 0),
    collected: sum((r) => r.amount_paid ?? 0),
    outstanding: sum((r) => (r.total ?? 0) - (r.amount_paid ?? 0)),
  }

  return NextResponse.json({ summary })
}
