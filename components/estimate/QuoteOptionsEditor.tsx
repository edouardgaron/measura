// components/estimate/QuoteOptionsEditor.tsx
// ============================================================
// Éditeur d'options de soumission : 3 paliers Économique / Standard /
// Premium. Le client en choisit un (augmente le panier moyen).
// S'attache à la soumission la plus récente du projet.
// ============================================================
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, Check, Star, Plus, TriangleAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Tier = 'economy' | 'standard' | 'premium'
interface OptionDraft { tier: Tier; name: string; total: string; features: string; is_recommended: boolean }

const TIER_DEFAULTS: { tier: Tier; name: string; hint: string }[] = [
  { tier: 'economy', name: 'Économique', hint: 'L’essentiel, prix serré' },
  { tier: 'standard', name: 'Standard', hint: 'Le meilleur rapport qualité-prix' },
  { tier: 'premium', name: 'Premium', hint: 'Haut de gamme, garanties étendues' },
]
const CAD = (n: number) => (n || 0).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })

export default function QuoteOptionsEditor({ projectId }: { projectId: string }) {
  const [estimate, setEstimate] = useState<{ id: string; title: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [opts, setOpts] = useState<Record<Tier, OptionDraft>>({
    economy: { tier: 'economy', name: 'Économique', total: '', features: '', is_recommended: false },
    standard: { tier: 'standard', name: 'Standard', total: '', features: '', is_recommended: true },
    premium: { tier: 'premium', name: 'Premium', total: '', features: '', is_recommended: false },
  })

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const supabase = createClient()
      const { data: est } = await supabase.from('estimates').select('id, title')
        .eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!est) { setEstimate(null); return }
      setEstimate(est)
      const res = await fetch(`/api/projects/${projectId}/estimates/${est.id}/options`)
      const body = await res.json()
      if (res.ok && Array.isArray(body.options) && body.options.length > 0) {
        const next = { ...opts }
        for (const o of body.options) {
          const tier = o.tier as Tier
          if (next[tier]) next[tier] = { tier, name: o.name ?? next[tier].name, total: String(o.total ?? ''), features: (o.features ?? []).join('\n'), is_recommended: !!o.is_recommended }
        }
        setOpts(next)
      }
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])
  useEffect(() => { load() }, [load])

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000) }
  const setRecommended = (tier: Tier) =>
    setOpts((p) => ({ economy: { ...p.economy, is_recommended: tier === 'economy' }, standard: { ...p.standard, is_recommended: tier === 'standard' }, premium: { ...p.premium, is_recommended: tier === 'premium' } }))
  const update = (tier: Tier, patch: Partial<OptionDraft>) => setOpts((p) => ({ ...p, [tier]: { ...p[tier], ...patch } }))

  const save = async () => {
    if (!estimate) return
    setSaving(true); setError(null)
    try {
      const payload = (['economy', 'standard', 'premium'] as Tier[]).map((t, i) => ({
        tier: t, name: opts[t].name, total: parseFloat(opts[t].total) || 0,
        features: opts[t].features.split('\n').map((s) => s.trim()).filter(Boolean),
        is_recommended: opts[t].is_recommended, sort_order: i,
      }))
      const res = await fetch(`/api/projects/${projectId}/estimates/${estimate.id}/options`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ options: payload }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Erreur')
      flash('Options enregistrées.')
    } catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>

  if (!estimate) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-16 text-center dark:border-neutral-800">
        <TriangleAlert className="mb-3 h-8 w-8 text-amber-500" />
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Aucune soumission enregistrée</p>
        <p className="mt-1 text-xs text-neutral-500">Allez à l&apos;onglet <b>Prix</b> et cliquez « Sauvegarder l&apos;estimation » avant de définir les options.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Options de soumission</h3>
          <p className="text-xs text-neutral-500">Proposez 3 paliers — le client choisit. Marquez le palier recommandé.</p>
        </div>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Enregistrer les options
        </button>
      </div>

      {toast && <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"><Check className="h-4 w-4" />{toast}</div>}
      {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"><TriangleAlert className="h-4 w-4" />{error}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        {TIER_DEFAULTS.map(({ tier, hint }) => {
          const o = opts[tier]
          const reco = o.is_recommended
          return (
            <div key={tier} className={`rounded-xl border p-4 ${reco ? 'border-neutral-900 ring-1 ring-neutral-900 dark:border-neutral-100 dark:ring-neutral-100' : 'border-neutral-200 dark:border-neutral-800'} bg-white dark:bg-neutral-950`}>
              <div className="mb-2 flex items-center justify-between">
                <input value={o.name} onChange={(e) => update(tier, { name: e.target.value })} className="w-full bg-transparent text-sm font-semibold text-neutral-900 focus:outline-none dark:text-neutral-100" />
                <button onClick={() => setRecommended(tier)} title="Marquer comme recommandé" className={`shrink-0 rounded-full p-1 ${reco ? 'text-amber-500' : 'text-neutral-300 hover:text-amber-400'}`}><Star className={`h-4 w-4 ${reco ? 'fill-amber-400' : ''}`} /></button>
              </div>
              <p className="mb-3 text-[11px] text-neutral-400">{hint}{reco && ' · Recommandé'}</p>
              <label className="mb-1 block text-xs font-medium text-neutral-500">Prix ($ HT)</label>
              <input inputMode="decimal" value={o.total} onChange={(e) => update(tier, { total: e.target.value })} placeholder="0" className="mb-3 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900" />
              <label className="mb-1 block text-xs font-medium text-neutral-500">Inclusions (une par ligne)</label>
              <textarea value={o.features} onChange={(e) => update(tier, { features: e.target.value })} rows={5} placeholder={'Ex.\nPréparation des surfaces\n2 couches de peinture\nGarantie 2 ans'} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900" />
            </div>
          )
        })}
      </div>

      {/* Aperçu client */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Aperçu client</h4>
        <div className="grid gap-4 lg:grid-cols-3">
          {TIER_DEFAULTS.map(({ tier }) => {
            const o = opts[tier]
            const feats = o.features.split('\n').map((s) => s.trim()).filter(Boolean)
            const price = parseFloat(o.total) || 0
            return (
              <div key={tier} className={`relative rounded-2xl border p-5 ${o.is_recommended ? 'border-neutral-900 shadow-md dark:border-neutral-100' : 'border-neutral-200 dark:border-neutral-800'} bg-white dark:bg-neutral-950`}>
                {o.is_recommended && <span className="absolute -top-2.5 left-5 rounded-full bg-neutral-900 px-2.5 py-0.5 text-[10px] font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">RECOMMANDÉ</span>}
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{o.name}</p>
                <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">{price > 0 ? CAD(price) : '—'}</p>
                <ul className="mt-3 space-y-1.5">
                  {feats.length === 0 ? <li className="text-xs text-neutral-400">Aucune inclusion.</li> : feats.map((ft, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-neutral-600 dark:text-neutral-300"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{ft}</li>
                  ))}
                </ul>
                <button disabled className="mt-4 w-full rounded-full border border-neutral-200 py-2 text-xs font-medium text-neutral-400 dark:border-neutral-800">Choisir (côté client)</button>
              </div>
            )
          })}
        </div>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-neutral-400"><Plus className="h-3 w-3" />Le choix du client et la signature se font sur la page publique de la soumission.</p>
      </div>
    </div>
  )
}
