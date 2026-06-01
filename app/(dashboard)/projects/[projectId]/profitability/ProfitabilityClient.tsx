// app/(dashboard)/projects/[projectId]/profitability/ProfitabilityClient.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, AlertTriangle, AlertOctagon, CheckCircle2,
  Loader2, RefreshCw, Users, DollarSign, Clock, Package,
} from 'lucide-react'
import type { ProfitabilityAlert, ProfitabilityResult } from '@/lib/profitability/compute'

interface PerEmployee {
  name: string
  hours: number
  cost: number
}
interface ApiResponse {
  profitability: ProfitabilityResult
  perEmployee: PerEmployee[]
  hasEstimate: boolean
  estimateStatus: string | null
}

const money = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n)
const pct = (n: number | null) => (n == null ? '—' : `${n.toFixed(1)} %`)

export default function ProfitabilityClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/profitability`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  }

  if (!data) return null
  const p = data.profitability
  const profitPositive = p.realProfit >= 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Rentabilité temps réel
          </h2>
          <p className="text-sm text-gray-500">Prévu (estimation) comparé au réel (pointage + matériaux consommés).</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {!data.hasEstimate && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Aucune estimation : le revenu et le budget prévu sont à zéro. Créez une estimation pour activer la comparaison prévu/réel.
        </div>
      )}

      {/* KPIs principaux */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BigKpi label="Revenu (prix vendu)" value={money(p.revenue)} icon={<DollarSign className="h-5 w-5" />} tone="neutral" />
        <BigKpi
          label="Profit réel"
          value={money(p.realProfit)}
          icon={profitPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          tone={profitPositive ? 'good' : 'bad'}
          sub={`Prévu : ${money(p.plannedProfit)}`}
        />
        <BigKpi
          label="Marge réelle"
          value={pct(p.realMarginPct)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone={p.realMarginPct != null && p.realMarginPct >= 15 ? 'good' : p.realMarginPct != null && p.realMarginPct >= 0 ? 'warn' : 'bad'}
          sub={`Prévu : ${pct(p.plannedMarginPct)}`}
        />
        <BigKpi
          label="Budget consommé"
          value={p.budgetUsedPct != null ? `${p.budgetUsedPct.toFixed(0)} %` : '—'}
          icon={<Package className="h-5 w-5" />}
          tone={p.budgetUsedPct != null && p.budgetUsedPct > 100 ? 'bad' : p.budgetUsedPct != null && p.budgetUsedPct > 90 ? 'warn' : 'good'}
          sub={`Coût réel : ${money(p.realCost)}`}
        />
      </div>

      {/* Alertes IA */}
      <div className="space-y-2">
        {p.alerts.map((a) => (
          <AlertCard key={a.id} alert={a} />
        ))}
      </div>

      {/* Comparatif prévu vs réel */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">Prévu vs réel</h3>
        <CompareBar label="Main d'œuvre" planned={p.plannedLaborCost} real={p.realLaborCost} icon={<Users className="h-4 w-4" />} />
        <CompareBar label="Matériaux" planned={p.plannedMaterialCost} real={p.realMaterialCost} icon={<Package className="h-4 w-4" />} />
        <CompareBar label="Coût total" planned={p.plannedCost} real={p.realCost} icon={<DollarSign className="h-4 w-4" />} bold />
        {p.plannedHours != null && (
          <CompareBar label="Heures" planned={p.plannedHours} real={p.realHours} icon={<Clock className="h-4 w-4" />} unit="h" />
        )}
      </div>

      {/* Par employé */}
      {data.perEmployee.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900">
            <Users className="h-4 w-4 text-gray-400" /> Main d&apos;œuvre par employé
          </h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-400">
              <tr><th className="pb-2">Employé</th><th className="pb-2">Heures</th><th className="pb-2">Coût réel</th></tr>
            </thead>
            <tbody>
              {data.perEmployee.map((e, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-2 font-medium text-gray-900">{e.name}</td>
                  <td className="py-2 text-gray-700">{e.hours.toFixed(2)} h</td>
                  <td className="py-2 text-gray-700">{money(e.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function BigKpi({
  label, value, icon, tone, sub,
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone: 'good' | 'bad' | 'warn' | 'neutral'
  sub?: string
}) {
  const tones = {
    good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    bad: 'border-red-200 bg-red-50 text-red-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-700',
    neutral: 'border-gray-200 bg-white text-gray-900',
  }
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-70">{sub}</p>}
    </div>
  )
}

function AlertCard({ alert }: { alert: ProfitabilityAlert }) {
  const config = {
    danger: { cls: 'border-red-200 bg-red-50 text-red-800', icon: <AlertOctagon className="h-5 w-5 text-red-600" /> },
    warning: { cls: 'border-amber-200 bg-amber-50 text-amber-800', icon: <AlertTriangle className="h-5 w-5 text-amber-600" /> },
    info: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" /> },
  }[alert.level]
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${config.cls}`}>
      <div className="mt-0.5 shrink-0">{config.icon}</div>
      <div>
        <p className="text-sm font-semibold">{alert.title}</p>
        <p className="text-sm">{alert.detail}</p>
        <p className="mt-1 text-xs opacity-80">💡 {alert.suggestion}</p>
      </div>
    </div>
  )
}

function CompareBar({
  label, planned, real, icon, unit = '$', bold,
}: {
  label: string
  planned: number
  real: number
  icon: React.ReactNode
  unit?: string
  bold?: boolean
}) {
  const max = Math.max(planned, real, 1)
  const fmt = (n: number) => (unit === '$' ? money(n) : `${n.toFixed(1)} ${unit}`)
  const over = real > planned && planned > 0
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className={`flex items-center gap-1.5 ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
          {icon} {label}
        </span>
        <span className={over ? 'font-medium text-red-600' : 'text-gray-600'}>
          {fmt(real)} <span className="text-gray-400">/ {fmt(planned)}</span>
        </span>
      </div>
      <div className="space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-gray-400" style={{ width: `${(planned / max) * 100}%` }} title="Prévu" />
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${(real / max) * 100}%` }} title="Réel" />
        </div>
      </div>
    </div>
  )
}
