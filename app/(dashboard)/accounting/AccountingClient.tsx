// app/(dashboard)/accounting/AccountingClient.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calculator, FileDown, Loader2, Info, Link2, CheckCircle2 } from 'lucide-react'

interface Summary {
  invoiceCount: number
  subtotal: number
  tax_gst: number
  tax_qst: number
  total: number
  collected: number
  outstanding: number
}

const money = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n ?? 0)

export default function AccountingClient() {
  const now = new Date()
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`)
  const [to, setTo] = useState(now.toISOString().slice(0, 10))
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/accounting/summary?from=${from}&to=${to}`, { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) setSummary(json.summary)
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const [qb, setQb] = useState<{ connected: boolean; configured: boolean; realmId: string | null } | null>(null)
  useEffect(() => {
    fetch('/api/quickbooks/status').then((r) => r.json()).then(setQb).catch(() => {})
  }, [])
  async function disconnectQb() {
    await fetch('/api/quickbooks/disconnect', { method: 'POST' })
    setQb((q) => (q ? { ...q, connected: false } : q))
  }

  const qs = `from=${from}&to=${to}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Calculator className="h-6 w-6 text-blue-600" /> Comptabilité
        </h1>
        <p className="text-sm text-gray-500">Sommaire des taxes et exports compatibles QuickBooks / Acomba / Excel.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Du</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Au</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <div className="ml-auto flex gap-2">
          <a href={`/api/accounting/export?type=invoices&${qs}`} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <FileDown className="h-4 w-4" /> Factures (CSV)
          </a>
          <a href={`/api/accounting/export?type=payments&${qs}`} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
            <FileDown className="h-4 w-4" /> Paiements (CSV)
          </a>
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi label="Facturé (HT)" value={money(summary.subtotal)} sub={`${summary.invoiceCount} facture(s)`} />
          <Kpi label="TPS collectée" value={money(summary.tax_gst)} tone="blue" />
          <Kpi label="TVQ collectée" value={money(summary.tax_qst)} tone="blue" />
          <Kpi label="Total facturé" value={money(summary.total)} />
          <Kpi label="Encaissé" value={money(summary.collected)} tone="green" />
          <Kpi label="À recevoir" value={money(summary.outstanding)} tone={summary.outstanding > 0 ? 'amber' : 'green'} />
        </div>
      )}

      {/* Connexion QuickBooks */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-gray-900"><Link2 className="h-4 w-4 text-blue-600" /> QuickBooks Online</h3>
            <p className="mt-1 text-sm text-gray-500">Synchronisation directe de vos factures (OAuth Intuit).</p>
          </div>
          {qb?.connected ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> Connecté</span>
              <button onClick={disconnectQb} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Déconnecter</button>
            </div>
          ) : qb?.configured ? (
            <a href="/api/quickbooks/connect" className="inline-flex items-center gap-2 rounded-lg bg-[#2ca01c] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              <Link2 className="h-4 w-4" /> Connecter QuickBooks
            </a>
          ) : (
            <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500">Non configuré (clés Intuit requises)</span>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        <span>
          Les CSV s’importent dans QuickBooks, Acomba ou Excel. La connexion QuickBooks ci-dessus établit le lien OAuth ; l’envoi automatique des factures vers QuickBooks suivra. Le sommaire TPS/TVQ facilite vos remises de taxes.
        </span>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, tone = 'neutral' }: { label: string; value: string; sub?: string; tone?: 'neutral' | 'blue' | 'green' | 'amber' }) {
  const tones = {
    neutral: 'border-gray-200 bg-white text-gray-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  }
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-60">{sub}</p>}
    </div>
  )
}
