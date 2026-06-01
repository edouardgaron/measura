// app/(dashboard)/projects/[projectId]/site/SiteClient.tsx
'use client'

import { useMemo, useState } from 'react'
import {
  HardHat, FileText, AlertTriangle, Truck, Users, Plus, Trash2, Loader2,
  Save, FileDown, Sparkles, ChevronRight, CheckCircle2, Clock,
} from 'lucide-react'
import { computeHours } from '@/lib/site/compute'
import type {
  DailyReport, DailyReportMaterial, Delivery, Employee, SiteIssue,
  SiteIssueSeverity, SiteIssueType, TimeEntry,
} from '@/lib/supabase/types'

export interface SitePhoto {
  id: string
  url: string
  facade_label: string | null
}

interface Props {
  projectId: string
  initialReports: DailyReport[]
  initialIssues: SiteIssue[]
  initialDeliveries: Delivery[]
  employees: Employee[]
  photos: SitePhoto[]
}

type Tab = 'reports' | 'issues' | 'deliveries' | 'employees'

const money = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n)

export default function SiteClient({
  projectId, initialReports, initialIssues, initialDeliveries, employees: initialEmployees, photos,
}: Props) {
  const [tab, setTab] = useState<Tab>('reports')
  const [reports, setReports] = useState<DailyReport[]>(initialReports)
  const [issues, setIssues] = useState<SiteIssue[]>(initialIssues)
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries)
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'reports', label: 'Rapports journaliers', icon: <FileText className="h-4 w-4" />, count: reports.length },
    { key: 'issues', label: 'Problèmes & risques', icon: <AlertTriangle className="h-4 w-4" />, count: issues.filter((i) => i.status !== 'resolved').length },
    { key: 'deliveries', label: 'Livraisons', icon: <Truck className="h-4 w-4" />, count: deliveries.filter((d) => d.status === 'pending').length },
    { key: 'employees', label: 'Employés', icon: <Users className="h-4 w-4" />, count: employees.length },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <HardHat className="h-5 w-5 text-teal-600" />
        <h2 className="text-lg font-semibold text-gray-900">Gestion de chantier</h2>
      </div>

      {/* Sous-navigation */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'reports' && (
        <ReportsTab projectId={projectId} reports={reports} setReports={setReports} employees={employees} photos={photos} />
      )}
      {tab === 'issues' && <IssuesTab projectId={projectId} issues={issues} setIssues={setIssues} />}
      {tab === 'deliveries' && <DeliveriesTab projectId={projectId} deliveries={deliveries} setDeliveries={setDeliveries} />}
      {tab === 'employees' && <EmployeesTab employees={employees} setEmployees={setEmployees} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// RAPPORTS JOURNALIERS
// ════════════════════════════════════════════════════════════════════════════

function ReportsTab({
  projectId, reports, setReports, employees, photos,
}: {
  projectId: string
  reports: DailyReport[]
  setReports: React.Dispatch<React.SetStateAction<DailyReport[]>>
  employees: Employee[]
  photos: SitePhoto[]
}) {
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = reports.find((r) => r.id === selectedId) ?? null

  async function create() {
    setCreating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/daily-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_date: new Date().toISOString().slice(0, 10) }),
      })
      const json = await res.json()
      if (res.ok) {
        setReports((p) => [json.report, ...p])
        setSelectedId(json.report.id)
      }
    } finally {
      setCreating(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce rapport ?')) return
    const res = await fetch(`/api/projects/${projectId}/daily-reports/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setReports((p) => p.filter((r) => r.id !== id))
      if (selectedId === id) setSelectedId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={create}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Nouveau rapport
        </button>
      </div>

      {reports.length === 0 ? (
        <Empty icon={<FileText className="h-10 w-10" />} text="Aucun rapport journalier." />
      ) : (
        <div className="space-y-2">
          {reports.map((r) => {
            const hours = (r.time_entries ?? []).reduce((s, t) => s + (t.hours ?? 0), 0)
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                className={`flex w-full items-center gap-3 rounded-xl border bg-white p-4 text-left shadow-sm hover:border-teal-300 ${
                  selectedId === r.id ? 'border-teal-400 ring-1 ring-teal-200' : 'border-gray-200'
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(r.report_date + 'T00:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(r.time_entries ?? []).length} travailleur(s) · {hours.toFixed(1)} h
                    {r.progress_percent != null ? ` · ${r.progress_percent}% avancement` : ''}
                  </p>
                </div>
                <StatusPill status={r.status} />
                <ChevronRight className={`h-4 w-4 text-gray-400 ${selectedId === r.id ? 'rotate-90' : ''}`} />
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <DailyReportEditor
          key={selected.id}
          projectId={projectId}
          report={selected}
          employees={employees}
          photos={photos}
          onChange={(updated) => setReports((p) => p.map((r) => (r.id === updated.id ? updated : r)))}
          onDelete={() => remove(selected.id)}
        />
      )}
    </div>
  )
}

function StatusPill({ status }: { status: DailyReport['status'] }) {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    submitted: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
  }
  const labels: Record<string, string> = { draft: 'Brouillon', submitted: 'Soumis', approved: 'Approuvé' }
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status]}`}>{labels[status]}</span>
}

interface EditableTimeEntry {
  employee_id: string | null
  employee_name: string | null
  clock_in: string | null
  clock_out: string | null
  break_minutes: number
  notes: string | null
}
interface EditableMaterial {
  description: string
  quantity: number | null
  unit: string | null
  unit_cost: number | null
}

function DailyReportEditor({
  projectId, report, employees, photos, onChange, onDelete,
}: {
  projectId: string
  report: DailyReport
  employees: Employee[]
  photos: SitePhoto[]
  onChange: (r: DailyReport) => void
  onDelete: () => void
}) {
  const [form, setForm] = useState<DailyReport>(report)
  const [entries, setEntries] = useState<EditableTimeEntry[]>(
    (report.time_entries ?? []).map((t) => ({
      employee_id: t.employee_id,
      employee_name: t.employee_name,
      clock_in: t.clock_in,
      clock_out: t.clock_out,
      break_minutes: t.break_minutes ?? 0,
      notes: t.notes,
    }))
  )
  const [materials, setMaterials] = useState<EditableMaterial[]>(
    (report.materials ?? []).map((m) => ({
      description: m.description,
      quantity: m.quantity,
      unit: m.unit,
      unit_cost: m.unit_cost,
    }))
  )
  const [photoIds, setPhotoIds] = useState<string[]>(report.photo_ids ?? [])
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<'pdf' | 'gen' | null>(null)

  const empCostMap = useMemo(() => {
    const m = new Map<string, number>()
    employees.forEach((e) => m.set(e.id, e.hourly_cost ?? 0))
    return m
  }, [employees])

  function set<K extends keyof DailyReport>(k: K, v: DailyReport[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const totals = useMemo(() => {
    const laborCost = entries.reduce((s, e) => {
      const h = computeHours(e.clock_in, e.clock_out, e.break_minutes)
      const c = e.employee_id ? empCostMap.get(e.employee_id) ?? 0 : 0
      return s + h * c
    }, 0)
    const hours = entries.reduce((s, e) => s + computeHours(e.clock_in, e.clock_out, e.break_minutes), 0)
    const materialCost = materials.reduce((s, m) => s + (m.quantity ?? 0) * (m.unit_cost ?? 0), 0)
    return { hours, laborCost, materialCost, total: laborCost + materialCost }
  }, [entries, materials, empCostMap])

  function buildPayload(extra?: Record<string, unknown>) {
    return {
      report_date: form.report_date,
      weather: form.weather,
      temperature: form.temperature,
      work_performed: form.work_performed,
      progress_percent: form.progress_percent,
      incidents: form.incidents,
      comments: form.comments,
      status: form.status,
      photo_ids: photoIds,
      time_entries: entries,
      materials: materials.filter((m) => m.description.trim()),
      ...extra,
    }
  }

  async function save(extra?: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/daily-reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(extra)),
      })
      const json = await res.json()
      if (res.ok && json.report) {
        setForm(json.report)
        onChange(json.report)
      }
      return json.report as DailyReport | undefined
    } finally {
      setSaving(false)
    }
  }

  async function generate() {
    setBusy('gen')
    try {
      await save({ regenerate: true })
    } finally {
      setBusy(null)
    }
  }

  async function pdf() {
    setBusy('pdf')
    try {
      await save()
      const res = await fetch(`/api/projects/${projectId}/daily-reports/${report.id}/pdf`, { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? 'Erreur PDF')
        return
      }
      const blob = await res.blob()
      window.open(URL.createObjectURL(blob), '_blank')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* Barre d'actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <h3 className="text-base font-semibold text-gray-900">
          Rapport du {new Date(form.report_date + 'T00:00:00').toLocaleDateString('fr-CA')}
        </h3>
        <div className="flex items-center gap-2">
          <select value={form.status} onChange={(e) => set('status', e.target.value as DailyReport['status'])} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
            <option value="draft">Brouillon</option>
            <option value="submitted">Soumis</option>
            <option value="approved">Approuvé</option>
          </select>
          <button onClick={() => save()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
          </button>
          <button onClick={generate} disabled={busy === 'gen'} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60">
            {busy === 'gen' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Générer résumé
          </button>
          <button onClick={pdf} disabled={busy === 'pdf'} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
            {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
          </button>
          <button onClick={onDelete} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Heures" value={`${totals.hours.toFixed(1)} h`} />
        <Kpi label="Coût main d'œuvre" value={money(totals.laborCost)} />
        <Kpi label="Coût matériaux" value={money(totals.materialCost)} />
        <Kpi label="Coût total" value={money(totals.total)} highlight />
      </div>

      {/* Méta */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Labeled label="Date"><input type="date" className={INPUT} value={form.report_date} onChange={(e) => set('report_date', e.target.value)} /></Labeled>
        <Labeled label="Météo">
          <select className={INPUT} value={form.weather ?? ''} onChange={(e) => set('weather', e.target.value || null)}>
            <option value="">—</option>
            <option value="sunny">Ensoleillé</option>
            <option value="cloudy">Nuageux</option>
            <option value="rain">Pluie</option>
            <option value="snow">Neige</option>
            <option value="wind">Vent</option>
            <option value="cold">Froid</option>
            <option value="hot">Chaud</option>
          </select>
        </Labeled>
        <Labeled label="Température (°C)"><input type="number" className={INPUT} value={form.temperature ?? ''} onChange={(e) => set('temperature', e.target.value === '' ? null : Number(e.target.value))} /></Labeled>
        <Labeled label="Avancement (%)"><input type="number" min={0} max={100} className={INPUT} value={form.progress_percent ?? ''} onChange={(e) => set('progress_percent', e.target.value === '' ? null : Number(e.target.value))} /></Labeled>
      </div>

      <Labeled label="Travaux effectués"><textarea rows={3} className={`${INPUT} resize-y`} value={form.work_performed ?? ''} onChange={(e) => set('work_performed', e.target.value || null)} /></Labeled>

      {/* Pointage */}
      <Block title="Pointage — main d'œuvre">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-2">Employé</th><th className="pb-2 pr-2">Entrée</th><th className="pb-2 pr-2">Sortie</th>
                <th className="pb-2 pr-2">Pause (min)</th><th className="pb-2 pr-2">Heures</th><th className="pb-2 pr-2">Coût</th><th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const h = computeHours(e.clock_in, e.clock_out, e.break_minutes)
                const cost = (e.employee_id ? empCostMap.get(e.employee_id) ?? 0 : 0) * h
                const upd = (patch: Partial<EditableTimeEntry>) => setEntries((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
                return (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1 pr-2">
                      {employees.length > 0 ? (
                        <select className={CELL} value={e.employee_id ?? ''} onChange={(ev) => {
                          const id = ev.target.value || null
                          const emp = employees.find((x) => x.id === id)
                          upd({ employee_id: id, employee_name: emp?.full_name ?? null })
                        }}>
                          <option value="">— libre —</option>
                          {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                        </select>
                      ) : (
                        <input className={CELL} placeholder="Nom" value={e.employee_name ?? ''} onChange={(ev) => upd({ employee_name: ev.target.value || null })} />
                      )}
                      {!e.employee_id && employees.length > 0 && (
                        <input className={`${CELL} mt-1`} placeholder="ou nom libre" value={e.employee_name ?? ''} onChange={(ev) => upd({ employee_name: ev.target.value || null })} />
                      )}
                    </td>
                    <td className="py-1 pr-2"><input type="time" className={CELL} value={e.clock_in ?? ''} onChange={(ev) => upd({ clock_in: ev.target.value || null })} /></td>
                    <td className="py-1 pr-2"><input type="time" className={CELL} value={e.clock_out ?? ''} onChange={(ev) => upd({ clock_out: ev.target.value || null })} /></td>
                    <td className="py-1 pr-2"><input type="number" className={`${CELL} w-16`} value={e.break_minutes} onChange={(ev) => upd({ break_minutes: Number(ev.target.value) || 0 })} /></td>
                    <td className="py-1 pr-2 text-gray-700">{h.toFixed(2)}</td>
                    <td className="py-1 pr-2 text-gray-700">{money(cost)}</td>
                    <td className="py-1 text-right"><button onClick={() => setEntries((arr) => arr.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button onClick={() => setEntries((a) => [...a, { employee_id: null, employee_name: null, clock_in: '08:00', clock_out: '16:00', break_minutes: 30, notes: null }])} className="mt-2 inline-flex items-center gap-1 text-sm text-teal-600 hover:underline">
          <Plus className="h-3.5 w-3.5" /> Ajouter un pointage
        </button>
      </Block>

      {/* Matériaux */}
      <Block title="Matériaux consommés">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-2">Description</th><th className="pb-2 pr-2">Qté</th><th className="pb-2 pr-2">Unité</th>
                <th className="pb-2 pr-2">Coût unit.</th><th className="pb-2 pr-2">Total</th><th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m, i) => {
                const upd = (patch: Partial<EditableMaterial>) => setMaterials((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
                return (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1 pr-2"><input className={CELL} value={m.description} onChange={(e) => upd({ description: e.target.value })} /></td>
                    <td className="py-1 pr-2"><input type="number" className={`${CELL} w-16`} value={m.quantity ?? ''} onChange={(e) => upd({ quantity: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                    <td className="py-1 pr-2"><input className={`${CELL} w-16`} value={m.unit ?? ''} onChange={(e) => upd({ unit: e.target.value || null })} /></td>
                    <td className="py-1 pr-2"><input type="number" className={`${CELL} w-20`} value={m.unit_cost ?? ''} onChange={(e) => upd({ unit_cost: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                    <td className="py-1 pr-2 text-gray-700">{money((m.quantity ?? 0) * (m.unit_cost ?? 0))}</td>
                    <td className="py-1 text-right"><button onClick={() => setMaterials((arr) => arr.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button onClick={() => setMaterials((a) => [...a, { description: '', quantity: null, unit: null, unit_cost: null }])} className="mt-2 inline-flex items-center gap-1 text-sm text-teal-600 hover:underline">
          <Plus className="h-3.5 w-3.5" /> Ajouter un matériau
        </button>
      </Block>

      {/* Photos */}
      {photos.length > 0 && (
        <Block title="Photos du rapport">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {photos.map((p) => {
              const on = photoIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => setPhotoIds((ids) => (on ? ids.filter((x) => x !== p.id) : [...ids, p.id]))}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 ${on ? 'border-teal-500' : 'border-transparent'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.facade_label ?? ''} className="h-full w-full object-cover" />
                  {on && <CheckCircle2 className="absolute right-1 top-1 h-5 w-5 rounded-full bg-white text-teal-600" />}
                </button>
              )
            })}
          </div>
        </Block>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Labeled label="Incidents"><textarea rows={2} className={`${INPUT} resize-y`} value={form.incidents ?? ''} onChange={(e) => set('incidents', e.target.value || null)} /></Labeled>
        <Labeled label="Commentaires (visibles client)"><textarea rows={2} className={`${INPUT} resize-y`} value={form.comments ?? ''} onChange={(e) => set('comments', e.target.value || null)} /></Labeled>
      </div>

      {/* Résumés générés */}
      {(form.generated_summary || form.client_summary) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {form.generated_summary && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
              <p className="mb-1 text-xs font-semibold uppercase text-violet-700">Synthèse direction</p>
              <p className="whitespace-pre-wrap text-sm text-violet-900">{form.generated_summary}</p>
            </div>
          )}
          {form.client_summary && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
              <p className="mb-1 text-xs font-semibold uppercase text-teal-700">Résumé client</p>
              <p className="whitespace-pre-wrap text-sm text-teal-900">{form.client_summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PROBLÈMES & RISQUES
// ════════════════════════════════════════════════════════════════════════════

function IssuesTab({
  projectId, issues, setIssues,
}: {
  projectId: string
  issues: SiteIssue[]
  setIssues: React.Dispatch<React.SetStateAction<SiteIssue[]>>
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<SiteIssueType>('issue')
  const [severity, setSeverity] = useState<SiteIssueSeverity>('medium')
  const [description, setDescription] = useState('')
  const [adding, setAdding] = useState(false)

  const TYPE_LABELS: Record<SiteIssueType, string> = { delay: 'Retard', issue: 'Problème', risk: 'Risque', safety: 'Sécurité', quality: 'Qualité' }
  const SEV_COLOR: Record<SiteIssueSeverity, string> = { low: 'bg-gray-100 text-gray-700', medium: 'bg-amber-100 text-amber-800', high: 'bg-orange-100 text-orange-800', critical: 'bg-red-100 text-red-800' }

  async function add() {
    if (!title.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/site-issues`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type, severity, description }),
      })
      const json = await res.json()
      if (res.ok) { setIssues((p) => [json.issue, ...p]); setTitle(''); setDescription('') }
    } finally { setAdding(false) }
  }

  async function setStatus(id: string, status: SiteIssue['status']) {
    const res = await fetch(`/api/projects/${projectId}/site-issues/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    const json = await res.json()
    if (res.ok) setIssues((p) => p.map((i) => (i.id === id ? json.issue : i)))
  }
  async function remove(id: string) {
    const res = await fetch(`/api/projects/${projectId}/site-issues/${id}`, { method: 'DELETE' })
    if (res.ok) setIssues((p) => p.filter((i) => i.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-4">
          <input className={INPUT} placeholder="Titre du problème" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className={INPUT} value={type} onChange={(e) => setType(e.target.value as SiteIssueType)}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className={INPUT} value={severity} onChange={(e) => setSeverity(e.target.value as SiteIssueSeverity)}>
            <option value="low">Faible</option><option value="medium">Moyen</option><option value="high">Élevé</option><option value="critical">Critique</option>
          </select>
          <button onClick={add} disabled={adding} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
        <input className={`${INPUT} mt-3`} placeholder="Description (optionnelle)" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {issues.length === 0 ? (
        <Empty icon={<AlertTriangle className="h-10 w-10" />} text="Aucun problème signalé." />
      ) : (
        <div className="space-y-2">
          {issues.map((i) => (
            <div key={i.id} className={`flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm ${i.status === 'resolved' ? 'opacity-60' : 'border-gray-200'}`}>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEV_COLOR[i.severity]}`}>{i.severity}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  <span className="text-gray-500">{TYPE_LABELS[i.type]} · </span>{i.title}
                </p>
                {i.description && <p className="text-xs text-gray-500">{i.description}</p>}
              </div>
              <select value={i.status} onChange={(e) => setStatus(i.id, e.target.value as SiteIssue['status'])} className="rounded-lg border border-gray-300 px-2 py-1 text-xs">
                <option value="open">Ouvert</option><option value="in_progress">En cours</option><option value="resolved">Résolu</option>
              </select>
              <button onClick={() => remove(i.id)} className="text-gray-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// LIVRAISONS
// ════════════════════════════════════════════════════════════════════════════

function DeliveriesTab({
  projectId, deliveries, setDeliveries,
}: {
  projectId: string
  deliveries: Delivery[]
  setDeliveries: React.Dispatch<React.SetStateAction<Delivery[]>>
}) {
  const [description, setDescription] = useState('')
  const [supplier, setSupplier] = useState('')
  const [expected, setExpected] = useState('')
  const [adding, setAdding] = useState(false)

  const STATUS: Record<Delivery['status'], string> = { pending: 'En attente', received: 'Reçu', delayed: 'En retard', cancelled: 'Annulé' }
  const COLOR: Record<Delivery['status'], string> = { pending: 'bg-blue-100 text-blue-800', received: 'bg-green-100 text-green-800', delayed: 'bg-orange-100 text-orange-800', cancelled: 'bg-gray-100 text-gray-600' }

  async function add() {
    if (!description.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/deliveries`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, supplier, expected_date: expected || null }),
      })
      const json = await res.json()
      if (res.ok) { setDeliveries((p) => [...p, json.delivery]); setDescription(''); setSupplier(''); setExpected('') }
    } finally { setAdding(false) }
  }
  async function setStatus(id: string, status: Delivery['status']) {
    const res = await fetch(`/api/projects/${projectId}/deliveries/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    const json = await res.json()
    if (res.ok) setDeliveries((p) => p.map((d) => (d.id === id ? json.delivery : d)))
  }
  async function remove(id: string) {
    const res = await fetch(`/api/projects/${projectId}/deliveries/${id}`, { method: 'DELETE' })
    if (res.ok) setDeliveries((p) => p.filter((d) => d.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-4">
          <input className={INPUT} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className={INPUT} placeholder="Fournisseur" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          <input type="date" className={INPUT} value={expected} onChange={(e) => setExpected(e.target.value)} />
          <button onClick={add} disabled={adding} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
      </div>

      {deliveries.length === 0 ? (
        <Empty icon={<Truck className="h-10 w-10" />} text="Aucune livraison planifiée." />
      ) : (
        <div className="space-y-2">
          {deliveries.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <Truck className="h-5 w-5 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{d.description}</p>
                <p className="text-xs text-gray-500">
                  {d.supplier ?? 'Fournisseur ?'}{d.expected_date ? ` · prévu le ${new Date(d.expected_date + 'T00:00:00').toLocaleDateString('fr-CA')}` : ''}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLOR[d.status]}`}>{STATUS[d.status]}</span>
              <select value={d.status} onChange={(e) => setStatus(d.id, e.target.value as Delivery['status'])} className="rounded-lg border border-gray-300 px-2 py-1 text-xs">
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={() => remove(d.id)} className="text-gray-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// EMPLOYÉS
// ════════════════════════════════════════════════════════════════════════════

function EmployeesTab({
  employees, setEmployees,
}: {
  employees: Employee[]
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>
}) {
  const [full_name, setName] = useState('')
  const [role, setRole] = useState('')
  const [hourly_cost, setCost] = useState('')
  const [hourly_rate, setRate] = useState('')
  const [adding, setAdding] = useState(false)

  async function add() {
    if (!full_name.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/employees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name, role, hourly_cost: Number(hourly_cost) || 0, hourly_rate: Number(hourly_rate) || 0 }),
      })
      const json = await res.json()
      if (res.ok) { setEmployees((p) => [...p, json.employee]); setName(''); setRole(''); setCost(''); setRate('') }
    } finally { setAdding(false) }
  }
  async function updateCost(id: string, field: 'hourly_cost' | 'hourly_rate', value: number) {
    const res = await fetch(`/api/employees/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }),
    })
    const json = await res.json()
    if (res.ok) setEmployees((p) => p.map((e) => (e.id === id ? json.employee : e)))
  }
  async function remove(id: string) {
    if (!confirm('Désactiver cet employé ?')) return
    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    if (res.ok) setEmployees((p) => p.filter((e) => e.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm text-gray-600">
          Le <strong>coût horaire chargé</strong> sert au calcul de rentabilité (coût réel de main d&apos;œuvre).
        </p>
        <div className="grid gap-3 sm:grid-cols-5">
          <input className={INPUT} placeholder="Nom complet" value={full_name} onChange={(e) => setName(e.target.value)} />
          <input className={INPUT} placeholder="Rôle (ex. peintre)" value={role} onChange={(e) => setRole(e.target.value)} />
          <input type="number" className={INPUT} placeholder="Coût horaire $" value={hourly_cost} onChange={(e) => setCost(e.target.value)} />
          <input type="number" className={INPUT} placeholder="Taux facturable $" value={hourly_rate} onChange={(e) => setRate(e.target.value)} />
          <button onClick={add} disabled={adding} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
      </div>

      {employees.length === 0 ? (
        <Empty icon={<Users className="h-10 w-10" />} text="Aucun employé. Ajoutez votre équipe ci-dessus." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <tr><th className="p-3">Nom</th><th className="p-3">Rôle</th><th className="p-3">Coût horaire</th><th className="p-3">Taux facturable</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-b border-gray-50">
                  <td className="p-3 font-medium text-gray-900">{e.full_name}</td>
                  <td className="p-3 text-gray-600">{e.role ?? '—'}</td>
                  <td className="p-3"><input type="number" defaultValue={e.hourly_cost} onBlur={(ev) => updateCost(e.id, 'hourly_cost', Number(ev.target.value) || 0)} className={`${CELL} w-24`} /></td>
                  <td className="p-3"><input type="number" defaultValue={e.hourly_rate} onBlur={(ev) => updateCost(e.id, 'hourly_rate', Number(ev.target.value) || 0)} className={`${CELL} w-24`} /></td>
                  <td className="p-3 text-right"><button onClick={() => remove(e.id)} className="text-gray-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Primitives partagées
// ════════════════════════════════════════════════════════════════════════════

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'
const CELL = 'w-full rounded-md border border-gray-200 px-2 py-1 text-[13px] focus:border-teal-500 focus:outline-none'

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
      {children}
    </label>
  )
}
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-4">
      <h4 className="mb-3 text-sm font-semibold text-gray-900">{title}</h4>
      {children}
    </div>
  )
}
function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-teal-200 bg-teal-50' : 'border-gray-200 bg-white'}`}>
      <p className={`text-lg font-bold ${highlight ? 'text-teal-700' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-300">
      <div className="mx-auto flex justify-center">{icon}</div>
      <p className="mt-3 text-sm text-gray-500">{text}</p>
    </div>
  )
}
