// app/(dashboard)/reports/page.tsx
// ============================================================
// Rapports financiers — ChantierPro 360.
// Revenus encaissés, facturé, taxes collectées, dépenses, profit brut,
// impayés, et ventilation mensuelle (6 derniers mois). Owner-scopé.
// ============================================================
import * as React from 'react'
import { redirect } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const CAD = (n: number) => (n || 0).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

async function ReportsContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: projects } = await supabase.from('projects').select('id').eq('owner_id', user.id)
  const ids = (projects ?? []).map((p) => p.id)

  const empty = { data: [] as Record<string, unknown>[] }
  const [invRes, payRes, expRes, estRes] = ids.length
    ? await Promise.all([
        supabase.from('invoices').select('status, total, amount_paid, tax_gst, tax_qst, issue_date').in('project_id', ids),
        supabase.from('payments').select('amount, paid_at, status').in('project_id', ids),
        supabase.from('expenses').select('total, tax_gst, tax_qst, expense_date').in('project_id', ids),
        supabase.from('estimates').select('status, total, accepted_at').in('project_id', ids),
      ])
    : [empty, empty, empty, empty]

  const invoices = (invRes.data ?? []) as { status: string; total: number; amount_paid: number; tax_gst: number; tax_qst: number; issue_date: string }[]
  const payments = (payRes.data ?? []) as { amount: number; paid_at: string | null; status: string }[]
  const expenses = (expRes.data ?? []) as { total: number; tax_gst: number; tax_qst: number; expense_date: string }[]
  const estimates = (estRes.data ?? []) as { status: string; total: number; accepted_at: string | null }[]

  const okPay = (p: { status: string }) => !['failed', 'cancelled', 'refunded'].includes(p.status)
  const collected = payments.filter((p) => p.paid_at && okPay(p)).reduce((s, p) => s + Number(p.amount || 0), 0)
  const invoiced = invoices.filter((i) => i.status !== 'draft' && i.status !== 'cancelled').reduce((s, i) => s + Number(i.total || 0), 0)
  const taxesCollected = invoices.filter((i) => ['sent', 'partial', 'paid', 'overdue'].includes(i.status)).reduce((s, i) => s + Number(i.tax_gst || 0) + Number(i.tax_qst || 0), 0)
  const taxesPaid = expenses.reduce((s, e) => s + Number(e.tax_gst || 0) + Number(e.tax_qst || 0), 0)
  const expensesTotal = expenses.reduce((s, e) => s + Number(e.total || 0), 0)
  const unpaid = invoices.filter((i) => !['paid', 'draft', 'cancelled'].includes(i.status)).reduce((s, i) => s + Math.max(Number(i.total || 0) - Number(i.amount_paid || 0), 0), 0)
  const grossProfit = collected - expensesTotal
  const signed = estimates.filter((e) => e.status === 'accepted').reduce((s, e) => s + Number(e.total || 0), 0)

  // Ventilation mensuelle (6 derniers mois)
  const now = new Date()
  const months: { key: string; label: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` })
  }
  const monthRev: Record<string, number> = {}, monthExp: Record<string, number> = {}
  for (const p of payments) if (p.paid_at && okPay(p)) { const k = p.paid_at.slice(0, 7); monthRev[k] = (monthRev[k] ?? 0) + Number(p.amount || 0) }
  for (const e of expenses) { const k = (e.expense_date ?? '').slice(0, 7); monthExp[k] = (monthExp[k] ?? 0) + Number(e.total || 0) }
  const maxMonth = Math.max(1, ...months.map((m) => Math.max(monthRev[m.key] ?? 0, monthExp[m.key] ?? 0)))

  const kpis = [
    { label: 'Revenus encaissés', value: collected, tone: 'emerald' },
    { label: 'Dépenses', value: expensesTotal, tone: 'red' },
    { label: 'Profit brut', value: grossProfit, tone: grossProfit >= 0 ? 'emerald' : 'red' },
    { label: 'Facturé', value: invoiced, tone: 'neutral' },
    { label: 'Impayé', value: unpaid, tone: 'amber' },
    { label: 'Valeur signée', value: signed, tone: 'neutral' },
    { label: 'TPS+TVQ collectées', value: taxesCollected, tone: 'neutral' },
    { label: 'TPS+TVQ payées', value: taxesPaid, tone: 'neutral' },
  ]
  const toneCls: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400', red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400', neutral: 'text-neutral-900 dark:text-neutral-100',
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Rapports financiers</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{k.label}</p>
            <p className={`mt-1 text-xl font-bold ${toneCls[k.tone]}`}>{CAD(k.value)}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Revenus vs dépenses — 6 derniers mois</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {months.map((m) => {
              const rev = monthRev[m.key] ?? 0, exp = monthExp[m.key] ?? 0
              return (
                <div key={m.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="w-16">{m.label}</span>
                    <span className="tabular-nums">{CAD(rev)} <span className="text-neutral-300 dark:text-neutral-600">·</span> <span className="text-red-500">-{CAD(exp)}</span></span>
                  </div>
                  <div className="flex gap-1">
                    <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${(rev / maxMonth) * 100}%` }} />
                  </div>
                  <div className="flex gap-1">
                    <div className="h-2.5 rounded-full bg-red-400" style={{ width: `${(exp / maxMonth) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-[11px] text-neutral-400">Revenus = paiements encaissés. Dépenses = total avec taxes. Profit brut = revenus − dépenses (hors main-d&apos;œuvre interne ; voir Rentabilité par chantier pour le détail complet).</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ReportsPage() {
  return <React.Suspense fallback={<div className="py-16 text-center text-sm text-neutral-400">Chargement…</div>}><ReportsContent /></React.Suspense>
}
