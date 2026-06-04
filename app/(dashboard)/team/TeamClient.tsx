// app/(dashboard)/team/TeamClient.tsx
'use client'

import { useEffect, useState } from 'react'
import { Users, Users2, Plus, Trash2, Loader2, ChevronDown, ShieldCheck } from 'lucide-react'
import type { Employee, EmployeeCertification, CertCategory, Team } from '@/lib/supabase/types'

const TEAM_COLORS = ['#0f172a', '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777']

const INPUT = 'w-full rounded-xl border border-transparent bg-neutral-100 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100'
const CAT_LABELS: Record<CertCategory, string> = { safety: 'Sécurité (ASP)', trade: 'Métier', license: 'Licence (RBQ)', training: 'Formation', other: 'Autre' }

function certStatus(expiry: string | null): { label: string; cls: string } {
  if (!expiry) return { label: 'Sans expiration', cls: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' }
  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
  if (expiry < today) return { label: 'Expirée', cls: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400' }
  if (expiry <= in30) return { label: 'Expire bientôt', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' }
  return { label: 'Valide', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' }
}

export default function TeamClient({ initialEmployees }: { initialEmployees: Employee[] }) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [teams, setTeams] = useState<Team[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [cost, setCost] = useState('')
  const [adding, setAdding] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamColor, setTeamColor] = useState(TEAM_COLORS[0])
  const [addingTeam, setAddingTeam] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/teams').then((r) => r.json()).then((j) => { if (!cancelled) setTeams(j.teams ?? []) })
    return () => { cancelled = true }
  }, [])

  async function addEmployee() {
    if (!name.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/employees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, role, hourly_cost: Number(cost) || 0 }),
      })
      const json = await res.json()
      if (res.ok) { setEmployees((p) => [...p, json.employee]); setName(''); setRole(''); setCost('') }
    } finally { setAdding(false) }
  }

  async function removeEmployee(id: string) {
    if (!confirm('Désactiver cet employé ?')) return
    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    if (res.ok) setEmployees((p) => p.filter((e) => e.id !== id))
  }

  async function addTeam() {
    if (!teamName.trim()) return
    setAddingTeam(true)
    try {
      const res = await fetch('/api/teams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName, color: teamColor }),
      })
      const json = await res.json()
      if (res.ok) { setTeams((p) => [...p, json.team]); setTeamName('') }
    } finally { setAddingTeam(false) }
  }

  async function removeTeam(id: string) {
    if (!confirm('Supprimer cette équipe ? Les employés rattachés seront détachés.')) return
    const res = await fetch(`/api/teams/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTeams((p) => p.filter((t) => t.id !== id))
      setEmployees((p) => p.map((e) => (e.team_id === id ? { ...e, team_id: null } : e)))
    }
  }

  async function assignTeam(employeeId: string, teamId: string) {
    const team_id = teamId || null
    setEmployees((p) => p.map((e) => (e.id === employeeId ? { ...e, team_id } : e)))
    await fetch(`/api/employees/${employeeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id }),
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100"><Users className="h-6 w-6 text-neutral-900 dark:text-neutral-100" /> Équipe</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Employés, équipes, taux horaires et certifications (sécurité, licences, formations).</p>
      </div>

      {/* Équipes */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100"><Users2 className="h-4 w-4" /> Équipes</h2>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {teams.length === 0 && <span className="text-xs text-neutral-400 dark:text-neutral-500">Aucune équipe. Créez-en une pour suivre la rentabilité par équipe.</span>}
          {teams.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 py-1 pl-2 pr-1 text-xs font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              {t.name}
              <button onClick={() => removeTeam(t.id)} className="rounded-full p-0.5 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${INPUT} sm:w-48`} placeholder="Nom de l'équipe" value={teamName} onChange={(e) => setTeamName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTeam()} />
          <div className="flex items-center gap-1">
            {TEAM_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setTeamColor(c)} aria-label={c}
                className={`h-6 w-6 rounded-full transition ${teamColor === c ? 'ring-2 ring-offset-1 ring-neutral-900 dark:ring-neutral-100 dark:ring-offset-neutral-900' : ''}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <button onClick={addTeam} disabled={addingTeam} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200">
            {addingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="grid gap-3 sm:grid-cols-4">
          <input className={INPUT} placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={INPUT} placeholder="Rôle" value={role} onChange={(e) => setRole(e.target.value)} />
          <input type="number" className={INPUT} placeholder="Coût horaire $" value={cost} onChange={(e) => setCost(e.target.value)} />
          <button onClick={addEmployee} disabled={adding} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200">
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">Aucun employé.</div>
      ) : (
        <div className="space-y-2">
          {employees.map((e) => (
            <div key={e.id} className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">{e.full_name.charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{e.full_name}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{e.role ?? '—'} · {e.hourly_cost} $/h</p>
                </div>
                <select
                  value={e.team_id ?? ''}
                  onChange={(ev) => assignTeam(e.id, ev.target.value)}
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:focus:ring-neutral-100"
                >
                  <option value="">Sans équipe</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button onClick={() => setOpenId(openId === e.id ? null : e.id)} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1.5 text-xs text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700">
                  <ShieldCheck className="h-3.5 w-3.5" /> Certifications <ChevronDown className={`h-3.5 w-3.5 ${openId === e.id ? 'rotate-180' : ''}`} />
                </button>
                <button onClick={() => removeEmployee(e.id)} className="text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
              {openId === e.id && <Certifications employeeId={e.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Certifications({ employeeId }: { employeeId: string }) {
  const [certs, setCerts] = useState<EmployeeCertification[] | null>(null)
  const [form, setForm] = useState({ name: '', issuer: '', category: 'safety', expiry_date: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/employees/${employeeId}/certifications`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setCerts(j.certifications ?? []) })
    return () => { cancelled = true }
  }, [employeeId])

  async function add() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}/certifications`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const json = await res.json()
      if (res.ok) { setCerts((c) => [...(c ?? []), json.certification]); setForm({ name: '', issuer: '', category: 'safety', expiry_date: '' }) }
    } finally { setSaving(false) }
  }
  async function remove(id: string) {
    const res = await fetch(`/api/certifications/${id}`, { method: 'DELETE' })
    if (res.ok) setCerts((c) => (c ?? []).filter((x) => x.id !== id))
  }

  return (
    <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-3 space-y-2">
        {(certs ?? []).map((c) => {
          const st = certStatus(c.expiry_date)
          return (
            <div key={c.id} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-800 dark:text-neutral-200">{c.name} <span className="text-xs text-neutral-400 dark:text-neutral-500">· {CAT_LABELS[c.category]}</span></p>
                {c.expiry_date && <p className="text-xs text-neutral-500 dark:text-neutral-400">Expire le {new Date(c.expiry_date + 'T00:00:00').toLocaleDateString('fr-CA')}</p>}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
              <button onClick={() => remove(c.id)} className="text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          )
        })}
        {certs !== null && certs.length === 0 && <p className="text-xs text-neutral-400 dark:text-neutral-500">Aucune certification.</p>}
        {certs === null && <Loader2 className="h-4 w-4 animate-spin text-neutral-400 dark:text-neutral-500" />}
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        <input className={INPUT} placeholder="Nom (ex. ASP Construction)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={INPUT} placeholder="Émetteur" value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
        <select className={INPUT} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" className={INPUT} value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
        <button onClick={add} disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
        </button>
      </div>
    </div>
  )
}
