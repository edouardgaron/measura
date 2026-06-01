// app/(dashboard)/team/TeamClient.tsx
'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, Trash2, Loader2, ChevronDown, ShieldCheck } from 'lucide-react'
import type { Employee, EmployeeCertification, CertCategory } from '@/lib/supabase/types'

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
const CAT_LABELS: Record<CertCategory, string> = { safety: 'Sécurité (ASP)', trade: 'Métier', license: 'Licence (RBQ)', training: 'Formation', other: 'Autre' }

function certStatus(expiry: string | null): { label: string; cls: string } {
  if (!expiry) return { label: 'Sans expiration', cls: 'bg-gray-100 text-gray-600' }
  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
  if (expiry < today) return { label: 'Expirée', cls: 'bg-red-100 text-red-700' }
  if (expiry <= in30) return { label: 'Expire bientôt', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'Valide', cls: 'bg-emerald-100 text-emerald-700' }
}

export default function TeamClient({ initialEmployees }: { initialEmployees: Employee[] }) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [openId, setOpenId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [cost, setCost] = useState('')
  const [adding, setAdding] = useState(false)

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Users className="h-6 w-6 text-blue-600" /> Équipe</h1>
        <p className="text-sm text-gray-500">Employés, taux horaires et certifications (sécurité, licences, formations).</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-4">
          <input className={INPUT} placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={INPUT} placeholder="Rôle" value={role} onChange={(e) => setRole(e.target.value)} />
          <input type="number" className={INPUT} placeholder="Coût horaire $" value={cost} onChange={(e) => setCost(e.target.value)} />
          <button onClick={addEmployee} disabled={adding} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">Aucun employé.</div>
      ) : (
        <div className="space-y-2">
          {employees.map((e) => (
            <div key={e.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{e.full_name.charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{e.full_name}</p>
                  <p className="text-xs text-gray-500">{e.role ?? '—'} · {e.hourly_cost} $/h</p>
                </div>
                <button onClick={() => setOpenId(openId === e.id ? null : e.id)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                  <ShieldCheck className="h-3.5 w-3.5" /> Certifications <ChevronDown className={`h-3.5 w-3.5 ${openId === e.id ? 'rotate-180' : ''}`} />
                </button>
                <button onClick={() => removeEmployee(e.id)} className="text-gray-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
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
    <div className="border-t border-gray-100 p-4">
      <div className="mb-3 space-y-2">
        {(certs ?? []).map((c) => {
          const st = certStatus(c.expiry_date)
          return (
            <div key={c.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800">{c.name} <span className="text-xs text-gray-400">· {CAT_LABELS[c.category]}</span></p>
                {c.expiry_date && <p className="text-xs text-gray-500">Expire le {new Date(c.expiry_date + 'T00:00:00').toLocaleDateString('fr-CA')}</p>}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
              <button onClick={() => remove(c.id)} className="text-gray-300 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          )
        })}
        {certs !== null && certs.length === 0 && <p className="text-xs text-gray-400">Aucune certification.</p>}
        {certs === null && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        <input className={INPUT} placeholder="Nom (ex. ASP Construction)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={INPUT} placeholder="Émetteur" value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
        <select className={INPUT} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" className={INPUT} value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
        <button onClick={add} disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
        </button>
      </div>
    </div>
  )
}
