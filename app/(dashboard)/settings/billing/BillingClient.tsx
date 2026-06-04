'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, Sparkles, CreditCard, ArrowLeft, AlertCircle } from 'lucide-react'

type Tier = 'free' | 'pro' | 'enterprise'

interface PlanView {
  tier: Tier
  name: string
  priceMonthly: number
  features: string[]
  highlight: boolean
  available: boolean
}

const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, enterprise: 2 }
const money = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
const STATUS_LABEL: Record<string, string> = {
  trialing: 'Essai gratuit', active: 'Actif', past_due: 'Paiement en retard',
  canceled: 'Annulé', incomplete: 'Incomplet', unpaid: 'Impayé',
}

export default function BillingClient({
  plans, currentTier, status, periodEnd, trialEnd, hasCustomer, hasCompany, stripeConfigured,
}: {
  plans: PlanView[]
  currentTier: Tier
  status: string | null
  periodEnd: string | null
  trialEnd: string | null
  hasCustomer: boolean
  hasCompany: boolean
  stripeConfigured: boolean
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function upgrade(tier: Tier) {
    setBusy(tier); setError(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: tier }),
      })
      const json = await res.json()
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Erreur')
      window.location.href = json.url
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); setBusy(null) }
  }

  async function manage() {
    setBusy('portal'); setError(null)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Erreur')
      window.location.href = json.url
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); setBusy(null) }
  }

  const dateFmt = (s: string | null) => s ? new Date(s).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }) : null

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/settings" className="mb-2 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
          <ArrowLeft className="h-4 w-4" /> Paramètres
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Abonnement</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Choisissez le forfait qui correspond à votre entreprise.</p>
      </div>

      {/* Forfait actif */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Forfait actuel</p>
            <p className="mt-0.5 text-lg font-bold text-neutral-900 dark:text-neutral-100">
              {plans.find((p) => p.tier === currentTier)?.name ?? 'Gratuit'}
              {status && status !== 'active' && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">{STATUS_LABEL[status] ?? status}</span>
              )}
            </p>
            {trialEnd && status === 'trialing' && <p className="mt-1 text-xs text-neutral-500">Essai jusqu’au {dateFmt(trialEnd)}</p>}
            {periodEnd && status === 'active' && <p className="mt-1 text-xs text-neutral-500">Prochaine facturation le {dateFmt(periodEnd)}</p>}
          </div>
          {hasCustomer && (
            <button onClick={manage} disabled={busy === 'portal'} className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-200 disabled:opacity-60 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700">
              {busy === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Gérer l’abonnement
            </button>
          )}
        </div>
      </div>

      {!hasCompany && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> Configurez d’abord votre entreprise dans <Link href="/settings/company" className="underline">Paramètres → Entreprise</Link>.
        </div>
      )}
      {!stripeConfigured && (
        <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> Le paiement en ligne n’est pas encore activé (clé Stripe manquante). Les forfaits sont affichés à titre indicatif.
        </div>
      )}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">{error}</div>}

      {/* Forfaits */}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.tier === currentTier
          const isDowngrade = TIER_RANK[p.tier] < TIER_RANK[currentTier]
          return (
            <div key={p.tier} className={`relative flex flex-col rounded-2xl border p-5 ${p.highlight ? 'border-neutral-900 dark:border-neutral-100' : 'border-neutral-200 dark:border-neutral-800'} bg-white dark:bg-neutral-900`}>
              {p.highlight && (
                <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-0.5 text-[11px] font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
                  <Sparkles className="h-3 w-3" /> Populaire
                </span>
              )}
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">{p.name}</h3>
              <p className="mt-1"><span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{money(p.priceMonthly)}</span><span className="text-sm text-neutral-500">/mois</span></p>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {isCurrent ? (
                  <span className="block rounded-full bg-neutral-100 py-2 text-center text-sm font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">Forfait actuel</span>
                ) : p.tier === 'free' ? (
                  <span className="block rounded-full py-2 text-center text-sm text-neutral-400">{isDowngrade ? 'Via « Gérer l’abonnement »' : '—'}</span>
                ) : (
                  <button
                    onClick={() => upgrade(p.tier)}
                    disabled={!p.available || busy !== null}
                    className="block w-full rounded-full bg-neutral-900 py-2 text-center text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                  >
                    {busy === p.tier ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : isDowngrade ? 'Changer de forfait' : `Passer à ${p.name}`}
                  </button>
                )}
                {!p.available && p.tier !== 'free' && <p className="mt-1.5 text-center text-[11px] text-neutral-400">Bientôt disponible</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
