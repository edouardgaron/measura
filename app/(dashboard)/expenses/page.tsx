// app/(dashboard)/expenses/page.tsx
// ============================================================
// Module Dépenses — liste, ajout, sommaire par catégorie, export CSV.
// Les dépenses liées à un projet alimentent la rentabilité.
// ============================================================
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Receipt, Plus, Trash2, Download, Loader2, TriangleAlert, X, Paperclip } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Ouvre le reçu (URL signée du bucket photos) dans un nouvel onglet.
async function openReceipt(path: string) {
  const supabase = createClient()
  const { data } = await supabase.storage.from('photos').createSignedUrl(path, 3600)
  if (data?.signedUrl) window.open(data.signedUrl, '_blank')
}

interface Expense {
  id: string
  project_id: string | null
  supplier: string | null
  category: string
  description: string | null
  expense_date: string
  amount: number
  tax_gst: number
  tax_qst: number
  total: number
  payment_method: string
  billable: boolean
  notes: string | null
  receipt_storage_path: string | null
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'material', label: 'Matériaux' }, { key: 'labor', label: 'Main-d’œuvre' },
  { key: 'equipment', label: 'Équipement' }, { key: 'subcontractor', label: 'Sous-traitant' },
  { key: 'permit', label: 'Permis' }, { key: 'fuel', label: 'Carburant' },
  { key: 'rental', label: 'Location' }, { key: 'insurance', label: 'Assurance' },
  { key: 'office', label: 'Bureau' }, { key: 'other', label: 'Autre' },
]
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]))
const METHODS: { key: string; label: string }[] = [
  { key: 'card', label: 'Carte' }, { key: 'cash', label: 'Comptant' }, { key: 'cheque', label: 'Chèque' },
  { key: 'transfer', label: 'Virement' }, { key: 'other', label: 'Autre' },
]
const CAD = (n: number) => (n || 0).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/expenses')
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Erreur')
      setExpenses(body.expenses ?? [])
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('projects').select('id, title').eq('owner_id', user.id).order('updated_at', { ascending: false }).limit(200)
        setProjects(data ?? [])
      }
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const remove = async (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' })
  }

  const projectName = (id: string | null) => (id ? projects.find((p) => p.id === id)?.title ?? '—' : '—')

  const { total, monthTotal, byCat } = useMemo(() => {
    const monthIso = (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 10) })()
    let total = 0, monthTotal = 0
    const byCat: Record<string, number> = {}
    for (const e of expenses) {
      total += Number(e.total || 0)
      if (e.expense_date >= monthIso) monthTotal += Number(e.total || 0)
      byCat[e.category] = (byCat[e.category] ?? 0) + Number(e.total || 0)
    }
    return { total, monthTotal, byCat }
  }, [expenses])

  const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3)

  const exportCsv = () => {
    const head = 'Date,Fournisseur,Catégorie,Projet,Description,Montant,TPS,TVQ,Total,Méthode\n'
    const rows = expenses.map((e) => [
      e.expense_date, `"${(e.supplier ?? '').replace(/"/g, '""')}"`, CAT_LABEL[e.category] ?? e.category,
      `"${projectName(e.project_id).replace(/"/g, '""')}"`, `"${(e.description ?? '').replace(/"/g, '""')}"`,
      e.amount, e.tax_gst, e.tax_qst, e.total, e.payment_method,
    ].join(',')).join('\n')
    const blob = new Blob([head + rows], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `depenses-${Date.now()}.csv`; a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Dépenses</h1>
          <span className="text-sm text-neutral-400">({expenses.length})</span>
        </div>
        <div className="flex gap-2">
          {expenses.length > 0 && (
            <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900">
              <Download className="h-4 w-4" />CSV
            </button>
          )}
          <button onClick={() => setShowForm((s) => !s)} className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{showForm ? 'Fermer' : 'Ajouter une dépense'}
          </button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><TriangleAlert className="h-4 w-4" />{error}</div>}

      {/* Sommaire */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Total dépenses" value={CAD(total)} />
        <SummaryCard label="Ce mois-ci" value={CAD(monthTotal)} />
        {topCats.map(([k, v]) => <SummaryCard key={k} label={CAT_LABEL[k] ?? k} value={CAD(v)} />)}
      </div>

      {showForm && <ExpenseForm projects={projects} onSaved={(e) => { setExpenses((prev) => [e, ...prev]); setShowForm(false) }} />}

      {/* Tableau */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-16 text-center dark:border-neutral-800">
          <Receipt className="mb-3 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
          <p className="text-sm text-neutral-500">Aucune dépense enregistrée.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <table className="min-w-full divide-y divide-neutral-100 dark:divide-neutral-800">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Fournisseur</th><th className="px-4 py-2.5">Catégorie</th>
                <th className="px-4 py-2.5">Projet</th><th className="px-4 py-2.5 text-right">Montant</th><th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5">Méthode</th><th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800/60">
              {expenses.map((e) => (
                <tr key={e.id} className="text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900/40">
                  <td className="whitespace-nowrap px-4 py-2.5 text-neutral-500">{e.expense_date}</td>
                  <td className="px-4 py-2.5 text-neutral-900 dark:text-neutral-100">{e.supplier ?? '—'}</td>
                  <td className="px-4 py-2.5"><span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{CAT_LABEL[e.category] ?? e.category}</span></td>
                  <td className="px-4 py-2.5 text-neutral-500">{projectName(e.project_id)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">{CAD(e.amount)}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums text-neutral-900 dark:text-neutral-100">{CAD(e.total)}</td>
                  <td className="px-4 py-2.5 text-neutral-500">{METHODS.find((m) => m.key === e.payment_method)?.label ?? e.payment_method}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      {e.receipt_storage_path && (
                        <button onClick={() => openReceipt(e.receipt_storage_path!)} title="Voir le reçu" className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"><Paperclip className="h-4 w-4" /></button>
                      )}
                      <button onClick={() => remove(e.id)} className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
    </div>
  )
}

function ExpenseForm({ projects, onSaved }: { projects: { id: string; title: string }[]; onSaved: (e: Expense) => void }) {
  const [f, setF] = useState({ supplier: '', category: 'material', description: '', project_id: '', expense_date: new Date().toISOString().slice(0, 10), amount: '', payment_method: 'card', billable: true })
  const [receipt, setReceipt] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const amount = parseFloat(f.amount) || 0
  const gst = +(amount * 0.05).toFixed(2), qst = +(amount * 0.09975).toFixed(2)
  const total = +(amount + gst + qst).toFixed(2)

  const submit = async () => {
    if (amount <= 0) { setErr('Entrez un montant.'); return }
    setSaving(true); setErr(null)
    try {
      // Téléverse le reçu (bucket photos, préfixe receipts/) si fourni.
      let receipt_storage_path: string | null = null
      if (receipt) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const ext = receipt.name.split('.').pop() || 'jpg'
        const path = `receipts/${user?.id ?? 'anon'}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('photos').upload(path, receipt, { contentType: receipt.type || 'image/jpeg', upsert: false })
        if (upErr) throw new Error(`Reçu : ${upErr.message}`)
        receipt_storage_path = path
      }
      const res = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, project_id: f.project_id || null, amount, receipt_storage_path }) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Erreur')
      onSaved(body.expense)
    } catch (e) { setErr((e as Error).message) } finally { setSaving(false) }
  }

  const input = 'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900'
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Nouvelle dépense</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Fournisseur"><input className={input} value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} placeholder="Ex. RONA" /></Field>
        <Field label="Catégorie"><select className={input} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
        <Field label="Projet (optionnel)"><select className={input} value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}><option value="">— Aucun —</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
        <Field label="Date"><input type="date" className={input} value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} /></Field>
        <Field label="Montant avant taxes ($)"><input inputMode="decimal" className={input} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0.00" /></Field>
        <Field label="Méthode de paiement"><select className={input} value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value })}>{METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></Field>
        <Field label="Description"><input className={input} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Détail" /></Field>
        <Field label="Photo du reçu (optionnel)"><input type="file" accept="image/*" capture="environment" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} className="block w-full text-xs text-neutral-500 file:mr-3 file:rounded-full file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-neutral-700 dark:file:bg-neutral-800 dark:file:text-neutral-200" /></Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">TPS {CAD(gst)} · TVQ {CAD(qst)} · <span className="font-semibold text-neutral-900 dark:text-neutral-100">Total {CAD(total)}</span></p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300"><input type="checkbox" checked={f.billable} onChange={(e) => setF({ ...f, billable: e.target.checked })} />Refacturable au client</label>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Enregistrer
          </button>
        </div>
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</span>{children}</label>
}
