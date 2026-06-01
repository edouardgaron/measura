// app/(dashboard)/projects/[projectId]/invoices/InvoiceClient.tsx
'use client'

import { useMemo, useState } from 'react'
import {
  Receipt, Plus, Trash2, Loader2, Save, FileDown, ChevronRight, Link2, CreditCard, AlertCircle, Check,
} from 'lucide-react'
import { computeInvoiceTotals } from '@/lib/invoice/compute'
import type { Invoice, InvoiceItem, InvoiceStatus } from '@/lib/supabase/types'

export interface EstimateOption {
  id: string
  title: string
  total: number
  status: string
}

interface Props {
  projectId: string
  initialInvoices: Invoice[]
  estimates: EstimateOption[]
  stripeEnabled: boolean
}

const money = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n ?? 0)

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Brouillon', sent: 'Envoyée', partial: 'Partielle', paid: 'Payée', overdue: 'En retard', cancelled: 'Annulée',
}
const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-700', sent: 'bg-blue-100 text-blue-800', partial: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-800', overdue: 'bg-red-100 text-red-800', cancelled: 'bg-gray-100 text-gray-500',
}

export default function InvoiceClient({ projectId, initialInvoices, estimates, stripeEnabled }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [estimateId, setEstimateId] = useState<string>(estimates[0]?.id ?? '')
  const [creating, setCreating] = useState(false)
  const selected = invoices.find((i) => i.id === selectedId) ?? null

  async function create() {
    setCreating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimateId: estimateId || undefined }),
      })
      const json = await res.json()
      if (res.ok) {
        setInvoices((p) => [json.invoice, ...p])
        setSelectedId(json.invoice.id)
      } else alert(json.error ?? 'Erreur')
    } finally {
      setCreating(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cette facture ?')) return
    const res = await fetch(`/api/projects/${projectId}/invoices/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setInvoices((p) => p.filter((i) => i.id !== id))
      if (selectedId === id) setSelectedId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Receipt className="h-5 w-5 text-blue-600" /> Facturation
          </h2>
          <p className="text-sm text-gray-500">Factures avec taxes du Québec (TPS + TVQ) et paiement Stripe.</p>
        </div>
        <div className="flex items-center gap-2">
          {estimates.length > 0 && (
            <select value={estimateId} onChange={(e) => setEstimateId(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-2 text-sm">
              <option value="">Facture vierge</option>
              {estimates.map((e) => (
                <option key={e.id} value={e.id}>Depuis : {e.title} ({money(e.total)})</option>
              ))}
            </select>
          )}
          <button onClick={create} disabled={creating} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Nouvelle facture
          </button>
        </div>
      </div>

      {!stripeEnabled && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Stripe n’est pas configuré : la facturation et les PDF fonctionnent, mais le paiement en ligne est désactivé.
          Ajoutez <code className="rounded bg-amber-100 px-1">STRIPE_SECRET_KEY</code> pour l’activer.
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Receipt className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Aucune facture. Générez-en une depuis une estimation.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const balance = (inv.total ?? 0) - (inv.amount_paid ?? 0)
            return (
              <button
                key={inv.id}
                onClick={() => setSelectedId(inv.id === selectedId ? null : inv.id)}
                className={`flex w-full items-center gap-3 rounded-xl border bg-white p-4 text-left shadow-sm hover:border-blue-300 ${
                  selectedId === inv.id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Receipt className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{inv.invoice_number}</p>
                  <p className="text-xs text-gray-500">{inv.client_name ?? '—'} · {money(inv.total)}{balance > 0 && balance < inv.total ? ` · solde ${money(balance)}` : ''}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[inv.status]}`}>{STATUS_LABEL[inv.status]}</span>
                <ChevronRight className={`h-4 w-4 text-gray-400 ${selectedId === inv.id ? 'rotate-90' : ''}`} />
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <InvoiceEditor
          key={selected.id}
          projectId={projectId}
          invoice={selected}
          stripeEnabled={stripeEnabled}
          onChange={(u) => setInvoices((p) => p.map((i) => (i.id === u.id ? u : i)))}
          onDelete={() => remove(selected.id)}
        />
      )}
    </div>
  )
}

interface ItemRow {
  description: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
}

function InvoiceEditor({
  projectId, invoice, stripeEnabled, onChange, onDelete,
}: {
  projectId: string
  invoice: Invoice
  stripeEnabled: boolean
  onChange: (i: Invoice) => void
  onDelete: () => void
}) {
  const [form, setForm] = useState<Invoice>(invoice)
  const [items, setItems] = useState<ItemRow[]>(
    ((invoice.items as InvoiceItem[]) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((it) => ({ description: it.description, quantity: it.quantity, unit: it.unit, unit_price: it.unit_price }))
  )
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<'pdf' | 'pay' | null>(null)
  const [copied, setCopied] = useState(false)

  function set<K extends keyof Invoice>(k: K, v: Invoice[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const totals = useMemo(
    () =>
      computeInvoiceTotals({
        items,
        discount_amount: form.discount_amount,
        tax_gst_rate: form.tax_gst_rate,
        tax_qst_rate: form.tax_qst_rate,
        amount_paid: form.amount_paid,
      }),
    [items, form.discount_amount, form.tax_gst_rate, form.tax_qst_rate, form.amount_paid]
  )

  async function save(extra?: Partial<Invoice>) {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, ...extra,
          items: items.filter((i) => i.description.trim()),
        }),
      })
      const json = await res.json()
      if (res.ok && json.invoice) {
        setForm(json.invoice)
        onChange(json.invoice)
      }
      return json.invoice as Invoice | undefined
    } finally {
      setSaving(false)
    }
  }

  async function pdf() {
    setBusy('pdf')
    try {
      await save()
      const res = await fetch(`/api/projects/${projectId}/invoices/${invoice.id}/pdf`, { method: 'POST' })
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? 'Erreur PDF'); return }
      const blob = await res.blob()
      window.open(URL.createObjectURL(blob), '_blank')
    } finally {
      setBusy(null)
    }
  }

  async function pay(kind: 'deposit' | 'balance') {
    setBusy('pay')
    try {
      await save()
      const res = await fetch(`/api/projects/${projectId}/invoices/${invoice.id}/checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'Erreur'); return }
      if (json.url) window.open(json.url, '_blank')
    } finally {
      setBusy(null)
    }
  }

  function copyLink() {
    const url = `${window.location.origin}/invoice/${form.share_token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const [qbBusy, setQbBusy] = useState(false)
  async function pushQuickBooks() {
    setQbBusy(true)
    try {
      await save()
      const res = await fetch('/api/quickbooks/push-invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: invoice.id }) })
      const json = await res.json()
      alert(res.ok ? `Facture envoyée à QuickBooks (id ${json.qbInvoiceId}).` : (json.error ?? 'Erreur QuickBooks'))
    } finally { setQbBusy(false) }
  }

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <h3 className="text-base font-semibold text-gray-900">{form.invoice_number}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select value={form.status} onChange={(e) => set('status', e.target.value as InvoiceStatus)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={() => save()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
          </button>
          <button onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Link2 className="h-4 w-4" />} {copied ? 'Copié' : 'Lien de paiement'}
          </button>
          <button onClick={pdf} disabled={busy === 'pdf'} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
          </button>
          {stripeEnabled && (
            <button onClick={() => pay('balance')} disabled={busy === 'pay'} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
              {busy === 'pay' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Encaisser
            </button>
          )}
          <button onClick={pushQuickBooks} disabled={qbBusy} title="Envoyer vers QuickBooks" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            {qbBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} QuickBooks
          </button>
          <button onClick={onDelete} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Client + dates */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Labeled label="Client"><input className={INPUT} value={form.client_name ?? ''} onChange={(e) => set('client_name', e.target.value || null)} /></Labeled>
        <Labeled label="Courriel"><input className={INPUT} value={form.client_email ?? ''} onChange={(e) => set('client_email', e.target.value || null)} /></Labeled>
        <Labeled label="Adresse"><input className={INPUT} value={form.client_address ?? ''} onChange={(e) => set('client_address', e.target.value || null)} /></Labeled>
        <Labeled label="Date d'émission"><input type="date" className={INPUT} value={form.issue_date} onChange={(e) => set('issue_date', e.target.value)} /></Labeled>
        <Labeled label="Échéance"><input type="date" className={INPUT} value={form.due_date ?? ''} onChange={(e) => set('due_date', e.target.value || null)} /></Labeled>
        <Labeled label="Dépôt demandé ($)"><input type="number" className={INPUT} value={form.deposit_amount} onChange={(e) => set('deposit_amount', Number(e.target.value) || 0)} /></Labeled>
      </div>

      {/* Lignes */}
      <div className="border-t border-gray-100 pt-4">
        <h4 className="mb-3 text-sm font-semibold text-gray-900">Lignes</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-2">Description</th><th className="pb-2 pr-2">Qté</th><th className="pb-2 pr-2">Unité</th>
                <th className="pb-2 pr-2">Prix unit.</th><th className="pb-2 pr-2">Total</th><th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const upd = (patch: Partial<ItemRow>) => setItems((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
                return (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1 pr-2"><input className={CELL} value={it.description} onChange={(e) => upd({ description: e.target.value })} /></td>
                    <td className="py-1 pr-2"><input type="number" className={`${CELL} w-16`} value={it.quantity ?? ''} onChange={(e) => upd({ quantity: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                    <td className="py-1 pr-2"><input className={`${CELL} w-16`} value={it.unit ?? ''} onChange={(e) => upd({ unit: e.target.value || null })} /></td>
                    <td className="py-1 pr-2"><input type="number" className={`${CELL} w-24`} value={it.unit_price ?? ''} onChange={(e) => upd({ unit_price: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                    <td className="py-1 pr-2 text-gray-700">{money((it.quantity ?? 0) * (it.unit_price ?? 0))}</td>
                    <td className="py-1 text-right"><button onClick={() => setItems((arr) => arr.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button onClick={() => setItems((a) => [...a, { description: '', quantity: 1, unit: null, unit_price: null }])} className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
        </button>
      </div>

      {/* Totaux */}
      <div className="ml-auto w-full max-w-xs space-y-1.5 border-t border-gray-100 pt-4 text-sm">
        <Row label="Sous-total" value={money(totals.subtotal)} />
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Rabais ($)</span>
          <input type="number" className={`${CELL} w-24 text-right`} value={form.discount_amount} onChange={(e) => set('discount_amount', Number(e.target.value) || 0)} />
        </div>
        <Row label={`TPS (${(form.tax_gst_rate * 100).toFixed(2)}%)`} value={money(totals.tax_gst)} />
        <Row label={`TVQ (${(form.tax_qst_rate * 100).toFixed(3)}%)`} value={money(totals.tax_qst)} />
        <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
          <span>Total</span><span>{money(totals.total)}</span>
        </div>
        {form.amount_paid > 0 && <Row label="Déjà payé" value={`- ${money(form.amount_paid)}`} />}
        <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 font-semibold text-blue-800">
          <span>Solde dû</span><span>{money(totals.balance)}</span>
        </div>
      </div>

      <div className="grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
        <Labeled label="Notes"><textarea rows={2} className={`${INPUT} resize-y`} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} /></Labeled>
        <Labeled label="Conditions"><textarea rows={2} className={`${INPUT} resize-y`} value={form.terms ?? ''} onChange={(e) => set('terms', e.target.value || null)} /></Labeled>
      </div>
    </div>
  )
}

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
const CELL = 'rounded-md border border-gray-200 px-2 py-1 text-[13px] focus:border-blue-500 focus:outline-none'

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
      {children}
    </label>
  )
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}
