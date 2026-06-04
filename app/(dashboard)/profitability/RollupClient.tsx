// app/(dashboard)/profitability/RollupClient.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  DollarSign, TrendingUp, TrendingDown, AlertOctagon, Loader2, RefreshCw, Clock, Users, Users2,
} from 'lucide-react'

interface Row {
  projectId: string
  title: string
  status: string
  revenue: number
  realCost: number
  realProfit: number
  realMarginPct: number | null
  plannedProfit: number
  realHours: number
  alertLevel: 'info' | 'warning' | 'danger'
}
interface Totals {
  revenue: number
  realCost: number
  realProfit: number
  plannedProfit: number
  realHours: number
  atRisk: number
  projects: number
  realMarginPct: number | null
}

const money = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n)
const pct = (n: number | null) => (n == null ? '—' : `${n.toFixed(1)} %`)

const DOT: Record<string, string> = { danger: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-emerald-500' }

interface EmployeeRow { name: string; hours: number; cost: number; profit: number; marginPct: number | null }
interface TeamRow { name: string; color: string; hours: number; cost: number; profit: number; marginPct: number | null }

export default function RollupClient() {
  const [rows, setRows] = useState<Row[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [perEmployee, setPerEmployee] = useState<EmployeeRow[]>([])
  const [perTeam, setPerTeam] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/profitability', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setRows(json.rows)
      setTotals(json.totals)
      setPerEmployee(json.perEmployee ?? [])
      setPerTeam(json.perTeam ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            <DollarSign className="h-6 w-6 text-neutral-900 dark:text-neutral-100" />
            Rentabilité — tous les chantiers
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Vue d&apos;ensemble des profits réels par chantier.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-neutral-400 dark:text-neutral-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">{error}</div>
      ) : (
        <>
          {totals && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label="Revenu total" value={money(totals.revenue)} />
              <Kpi label="Coût réel" value={money(totals.realCost)} />
              <Kpi
                label="Profit réel"
                value={money(totals.realProfit)}
                tone={totals.realProfit >= 0 ? 'good' : 'bad'}
                icon={totals.realProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              />
              <Kpi label="Marge réelle" value={pct(totals.realMarginPct)} tone={totals.realMarginPct != null && totals.realMarginPct >= 15 ? 'good' : 'warn'} />
              <Kpi label="Chantiers à risque" value={String(totals.atRisk)} tone={totals.atRisk > 0 ? 'bad' : 'good'} icon={<AlertOctagon className="h-4 w-4" />} />
            </div>
          )}

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              Aucun chantier avec données financières pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
                  <tr>
                    <th className="p-3">Chantier</th>
                    <th className="p-3">Revenu</th>
                    <th className="p-3">Coût réel</th>
                    <th className="p-3">Profit réel</th>
                    <th className="p-3">Marge</th>
                    <th className="p-3">Heures</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.projectId} className="border-b border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50">
                      <td className="p-3">
                        <Link href={`/projects/${r.projectId}/profitability`} className="flex items-center gap-2 font-medium text-neutral-900 hover:underline dark:text-neutral-100">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[r.alertLevel]}`} />
                          {r.title}
                        </Link>
                      </td>
                      <td className="p-3 text-neutral-700 dark:text-neutral-300">{money(r.revenue)}</td>
                      <td className="p-3 text-neutral-700 dark:text-neutral-300">{money(r.realCost)}</td>
                      <td className={`p-3 font-medium ${r.realProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{money(r.realProfit)}</td>
                      <td className="p-3 text-neutral-700 dark:text-neutral-300">{pct(r.realMarginPct)}</td>
                      <td className="p-3 text-neutral-500 dark:text-neutral-400"><span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{r.realHours.toFixed(1)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rentabilité par équipe */}
          {perTeam.length > 0 && (
            <div>
              <h2 className="mb-2 mt-2 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                <Users2 className="h-4 w-4" /> Rentabilité par équipe
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                <table className="w-full text-sm">
                  <thead className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
                    <tr>
                      <th className="p-3">Équipe</th>
                      <th className="p-3">Heures</th>
                      <th className="p-3">Coût M.O.</th>
                      <th className="p-3">Contribution au profit</th>
                      <th className="p-3">Marge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perTeam.map((tm) => (
                      <tr key={tm.name} className="border-b border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50">
                        <td className="p-3 font-medium text-neutral-900 dark:text-neutral-100">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tm.color }} />
                            {tm.name}
                          </span>
                        </td>
                        <td className="p-3 text-neutral-500 dark:text-neutral-400"><span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{tm.hours.toFixed(1)}</span></td>
                        <td className="p-3 text-neutral-700 dark:text-neutral-300">{money(tm.cost)}</td>
                        <td className={`p-3 font-medium ${tm.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{money(tm.profit)}</td>
                        <td className="p-3 text-neutral-700 dark:text-neutral-300">{pct(tm.marginPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">Regroupe la contribution au profit des employés selon leur équipe. Configurez les équipes et l’affectation dans <Link href="/team" className="underline">Équipe</Link>.</p>
            </div>
          )}

          {/* Rentabilité par employé */}
          {perEmployee.length > 0 && (
            <div>
              <h2 className="mb-2 mt-2 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                <Users className="h-4 w-4" /> Rentabilité par employé
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                <table className="w-full text-sm">
                  <thead className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
                    <tr>
                      <th className="p-3">Employé</th>
                      <th className="p-3">Heures</th>
                      <th className="p-3">Coût M.O.</th>
                      <th className="p-3">Contribution au profit</th>
                      <th className="p-3">Marge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perEmployee.map((e) => (
                      <tr key={e.name} className="border-b border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50">
                        <td className="p-3 font-medium text-neutral-900 dark:text-neutral-100">{e.name}</td>
                        <td className="p-3 text-neutral-500 dark:text-neutral-400"><span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{e.hours.toFixed(1)}</span></td>
                        <td className="p-3 text-neutral-700 dark:text-neutral-300">{money(e.cost)}</td>
                        <td className={`p-3 font-medium ${e.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{money(e.profit)}</td>
                        <td className="p-3 text-neutral-700 dark:text-neutral-300">{pct(e.marginPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">Contribution = part de la marge réelle des chantiers où l’employé a pointé (au prorata de son coût de main-d’œuvre). Aide à repérer qui travaille sur les chantiers rentables.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Kpi({
  label, value, tone = 'neutral', icon,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad' | 'warn' | 'neutral'
  icon?: React.ReactNode
}) {
  const tones = {
    good: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400',
    bad: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400',
    warn: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400',
    neutral: 'border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100',
  }
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
        {icon}
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}
