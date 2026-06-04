// app/(dashboard)/field/FieldReportSheet.tsx
'use client'

import { useState } from 'react'
import { FileText, X, Loader2, Check } from 'lucide-react'

// Rapport de fin de journée mobile : un écran simple (travaux faits, avancement,
// météo, problèmes) → crée un rapport journalier (daily_reports).
const WEATHER: { key: string; label: string }[] = [
  { key: 'sunny', label: '☀️ Soleil' }, { key: 'cloudy', label: '☁️ Nuageux' },
  { key: 'rain', label: '🌧️ Pluie' }, { key: 'snow', label: '❄️ Neige' },
  { key: 'wind', label: '💨 Vent' }, { key: 'cold', label: '🥶 Froid' }, { key: 'hot', label: '🔥 Chaud' },
]

export default function FieldReportSheet({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({ work_performed: '', progress_percent: 50, weather: '', incidents: '', comments: '' })

  async function submit() {
    if (!f.work_performed.trim()) { setErr('Décrivez au moins les travaux effectués.'); return }
    setSaving(true); setErr(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/daily-reports`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_performed: f.work_performed, progress_percent: f.progress_percent,
          weather: f.weather || null, incidents: f.incidents || null, comments: f.comments || null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      setDone(true)
      setTimeout(() => { setOpen(false); setDone(false); setF({ work_performed: '', progress_percent: 50, weather: '', incidents: '', comments: '' }) }, 1400)
    } catch (e) { setErr((e as Error).message) } finally { setSaving(false) }
  }

  const input = 'w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900'

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900">
        <FileText className="h-4 w-4" />Rapport
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => !saving && setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-neutral-950 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Rapport de fin de journée</h3>
                <p className="truncate text-xs text-neutral-500">{projectTitle}</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"><X className="h-5 w-5" /></button>
            </div>

            {done ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Check className="h-6 w-6" /></div>
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Rapport soumis</p>
                <p className="mt-1 text-xs text-neutral-500">Visible par l’administration.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Travaux effectués aujourd’hui *</label>
                  <textarea value={f.work_performed} onChange={(e) => setF({ ...f, work_performed: e.target.value })} rows={3} placeholder="Ex. Préparation et 1re couche façade avant, calfeutrage des fenêtres." className={input} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Avancement : {f.progress_percent}%</label>
                  <input type="range" min={0} max={100} step={5} value={f.progress_percent} onChange={(e) => setF({ ...f, progress_percent: Number(e.target.value) })} className="w-full accent-neutral-900 dark:accent-neutral-100" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Météo</label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEATHER.map((w) => (
                      <button key={w.key} onClick={() => setF({ ...f, weather: f.weather === w.key ? '' : w.key })}
                        className={`rounded-full border px-2.5 py-1 text-xs ${f.weather === w.key ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900' : 'border-neutral-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'}`}>
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Problèmes / incidents</label>
                  <textarea value={f.incidents} onChange={(e) => setF({ ...f, incidents: e.target.value })} rows={2} placeholder="Retards, bris, manque de matériel… (laisser vide si aucun)" className={input} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Notes pour demain</label>
                  <textarea value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} rows={2} placeholder="Travaux restants, matériel à apporter…" className={input} />
                </div>
                {err && <p className="text-xs text-red-600">{err}</p>}
                <button onClick={submit} disabled={saving} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-neutral-900 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Soumettre le rapport
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
