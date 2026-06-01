// app/(dashboard)/schedule/ScheduleClient.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calendar, ChevronLeft, ChevronRight, Plus, X, Loader2, Trash2, Wand2, Users,
} from 'lucide-react'
import type { Employee, ScheduleEvent, ScheduleEventType, ScheduleStatus } from '@/lib/supabase/types'

export interface ProjectOption { id: string; title: string }

interface Props {
  employees: Employee[]
  projects: ProjectOption[]
}

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const TYPE_LABELS: Record<ScheduleEventType, string> = { job: 'Chantier', appointment: 'Rendez-vous', meeting: 'Réunion', delivery: 'Livraison', other: 'Autre' }

function pad(n: number) { return String(n).padStart(2, '0') }
function toIso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export default function ScheduleClient({ employees, projects }: Props) {
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<null | { mode: 'create' | 'edit' | 'auto'; date?: string; event?: ScheduleEvent }>(null)

  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor])
  const todayIso = toIso(today)

  const load = useCallback(async () => {
    setLoading(true)
    const from = toIso(grid[0])
    const to = toIso(grid[grid.length - 1])
    try {
      const res = await fetch(`/api/schedule?from=${from}&to=${to}`, { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) setEvents(json.events ?? [])
    } finally {
      setLoading(false)
    }
  }, [grid])

  useEffect(() => { load() }, [load])

  function move(delta: number) {
    setCursor((c) => {
      const m = c.m + delta
      return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
    })
  }

  function eventsForDay(iso: string) {
    return events.filter((e) => e.start_date <= iso && e.end_date >= iso)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Calendar className="h-6 w-6 text-blue-600" /> Calendrier
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setModal({ mode: 'auto' })} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100">
            <Wand2 className="h-4 w-4" /> Auto-planifier
          </button>
          <button onClick={() => setModal({ mode: 'create', date: todayIso })} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Événement
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} className="rounded-lg border border-gray-300 p-1.5 hover:bg-gray-50"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => move(1)} className="rounded-lg border border-gray-300 p-1.5 hover:bg-gray-50"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })} className="ml-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs hover:bg-gray-50">Aujourd&apos;hui</button>
        </div>
        <h2 className="text-lg font-semibold capitalize text-gray-800">{MONTHS[cursor.m]} {cursor.y}</h2>
        <div className="w-24 text-right">{loading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-gray-400" />}</div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-medium text-gray-500">
          {DOW.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((d, i) => {
            const iso = toIso(d)
            const inMonth = d.getMonth() === cursor.m
            const dayEvents = eventsForDay(iso)
            return (
              <div
                key={i}
                onClick={() => setModal({ mode: 'create', date: iso })}
                className={`min-h-[92px] cursor-pointer border-b border-r border-gray-100 p-1.5 ${inMonth ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/40`}
              >
                <div className={`mb-1 text-right text-xs ${iso === todayIso ? 'mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 font-bold text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'}`}>
                  {d.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      onClick={(ev) => { ev.stopPropagation(); setModal({ mode: 'edit', event: e }) }}
                      className="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-medium text-white"
                      style={{ backgroundColor: e.color }}
                      title={e.title}
                    >
                      {e.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && <span className="text-[10px] text-gray-400">+{dayEvents.length - 3}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {modal?.mode === 'auto' && (
        <AutoPlanModal employees={employees} projects={projects} onClose={() => setModal(null)} onCreated={() => { setModal(null); load() }} />
      )}
      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <EventModal
          employees={employees}
          projects={projects}
          date={modal.date}
          event={modal.event}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}

// ── Modale événement (création / édition) ────────────────────────────────────

function EventModal({
  employees, projects, date, event, onClose, onSaved,
}: {
  employees: Employee[]
  projects: ProjectOption[]
  date?: string
  event?: ScheduleEvent
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [type, setType] = useState<ScheduleEventType>(event?.event_type ?? 'job')
  const [start, setStart] = useState(event?.start_date ?? date ?? '')
  const [end, setEnd] = useState(event?.end_date ?? date ?? '')
  const [projectId, setProjectId] = useState(event?.project_id ?? '')
  const [status, setStatus] = useState<ScheduleStatus>(event?.status ?? 'planned')
  const [color, setColor] = useState(event?.color ?? '#2563eb')
  const [empIds, setEmpIds] = useState<string[]>(
    (event?.assignments ?? []).map((a) => a.employee_id)
  )
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!title.trim() || !start) { setError('Titre et date requis'); return }
    setSaving(true); setError(null)
    const payload = {
      title, event_type: type, start_date: start, end_date: end || start,
      project_id: projectId || null, status, color, notes: notes || null, employee_ids: empIds,
    }
    try {
      const res = event
        ? await fetch(`/api/schedule/${event.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erreur'); return }
      onSaved()
    } finally { setSaving(false) }
  }

  async function remove() {
    if (!event || !confirm('Supprimer cet événement ?')) return
    const res = await fetch(`/api/schedule/${event.id}`, { method: 'DELETE' })
    if (res.ok) onSaved()
  }

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{event ? 'Modifier' : 'Nouvel événement'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </div>
        {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Lbl label="Titre" full><input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} /></Lbl>
          <Lbl label="Type"><select className={INPUT} value={type} onChange={(e) => setType(e.target.value as ScheduleEventType)}>{Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Lbl>
          <Lbl label="Statut"><select className={INPUT} value={status} onChange={(e) => setStatus(e.target.value as ScheduleStatus)}>
            <option value="planned">Planifié</option><option value="confirmed">Confirmé</option><option value="in_progress">En cours</option><option value="done">Terminé</option><option value="cancelled">Annulé</option>
          </select></Lbl>
          <Lbl label="Début"><input type="date" className={INPUT} value={start} onChange={(e) => setStart(e.target.value)} /></Lbl>
          <Lbl label="Fin"><input type="date" className={INPUT} value={end} onChange={(e) => setEnd(e.target.value)} /></Lbl>
          <Lbl label="Projet"><select className={INPUT} value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Lbl>
          <Lbl label="Couleur"><input type="color" className="h-10 w-full rounded-lg border border-gray-300" value={color} onChange={(e) => setColor(e.target.value)} /></Lbl>
          <Lbl label="Équipe assignée" full>
            <EmployeePicker employees={employees} selected={empIds} onChange={setEmpIds} />
          </Lbl>
          <Lbl label="Notes" full><textarea rows={2} className={`${INPUT} resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} /></Lbl>
        </div>
        <div className="mt-5 flex items-center justify-between">
          {event ? <button onClick={remove} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Supprimer</button> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  )
}

// ── Modale auto-planification ────────────────────────────────────────────────

function AutoPlanModal({
  employees, projects, onClose, onCreated,
}: {
  employees: Employee[]
  projects: ProjectOption[]
  onClose: () => void
  onCreated: () => void
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [start, setStart] = useState('')
  const [empIds, setEmpIds] = useState<string[]>([])
  const [hoursPerDay, setHoursPerDay] = useState('8')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function run() {
    if (!projectId || !start) { setError('Projet et date requis'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/schedule/auto-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId, start_date: start, employee_ids: empIds,
          hours_per_day: Number(hoursPerDay) || 8,
          estimated_hours: estimatedHours ? Number(estimatedHours) : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erreur'); return }
      const c = json.computed
      setResult(`Planifié : ${c.days} jour(s) ouvrable(s), fin le ${c.endDate} (${c.estimatedHours} h, ${c.crewSize} pers.)`)
      setTimeout(onCreated, 1200)
    } finally { setSaving(false) }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><Wand2 className="h-5 w-5 text-teal-600" /> Auto-planifier un chantier</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-sm text-gray-500">La durée est calculée depuis les heures estimées de l’estimation et la taille de l’équipe.</p>
        {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        {result && <p className="mb-3 rounded-lg bg-green-50 p-2 text-sm text-green-700">{result}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Lbl label="Projet" full><select className={INPUT} value={projectId} onChange={(e) => setProjectId(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Lbl>
          <Lbl label="Date de début"><input type="date" className={INPUT} value={start} onChange={(e) => setStart(e.target.value)} /></Lbl>
          <Lbl label="Heures / jour"><input type="number" className={INPUT} value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} /></Lbl>
          <Lbl label="Heures estimées (sinon depuis l'estimation)" full><input type="number" className={INPUT} placeholder="auto" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} /></Lbl>
          <Lbl label="Équipe" full><EmployeePicker employees={employees} selected={empIds} onChange={setEmpIds} /></Lbl>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
          <button onClick={run} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Planifier
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ── Primitives ───────────────────────────────────────────────────────────────

function EmployeePicker({ employees, selected, onChange }: { employees: Employee[]; selected: string[]; onChange: (ids: string[]) => void }) {
  if (employees.length === 0) return <p className="text-xs text-gray-400">Aucun employé. Ajoutez votre équipe dans Chantier → Employés.</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {employees.map((e) => {
        const on = selected.includes(e.id)
        return (
          <button key={e.id} type="button"
            onClick={() => onChange(on ? selected.filter((x) => x !== e.id) : [...selected, e.id])}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${on ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <Users className="h-3 w-3" /> {e.full_name}
          </button>
        )
      })}
    </div>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>{children}</div>
}
function Lbl({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`block ${full ? 'sm:col-span-2' : ''}`}><span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>{children}</label>
}
