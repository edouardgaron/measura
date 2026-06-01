// app/(dashboard)/projects/[projectId]/work-orders/WorkOrderClient.tsx
'use client'

import { useState } from 'react'
import {
  ClipboardList,
  Plus,
  FileDown,
  Trash2,
  Loader2,
  Save,
  PenLine,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import SignaturePad from '@/components/workorder/SignaturePad'
import type {
  WorkOrder,
  WorkOrderChecklist,
  WorkOrderChecklistItem,
  WorkOrderProduct,
  WorkOrderStatus,
} from '@/lib/supabase/types'

interface Props {
  projectId: string
  initialWorkOrders: WorkOrder[]
  hasEstimate: boolean
}

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  draft: 'Brouillon',
  issued: 'Émis',
  in_progress: 'En cours',
  completed: 'Terminé',
  signed: 'Signé',
  cancelled: 'Annulé',
}

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  issued: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  signed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function WorkOrderClient({ projectId, initialWorkOrders, hasEstimate }: Props) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = workOrders.find((w) => w.id === selectedId) ?? null

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/work-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setWorkOrders((prev) => [json.workOrder, ...prev])
      setSelectedId(json.workOrder.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de génération')
    } finally {
      setGenerating(false)
    }
  }

  function patchLocal(id: string, patch: Partial<WorkOrder>) {
    setWorkOrders((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce bon de travail ?')) return
    const res = await fetch(`/api/projects/${projectId}/work-orders/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setWorkOrders((prev) => prev.filter((w) => w.id !== id))
      if (selectedId === id) setSelectedId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            Bons de travail
          </h2>
          <p className="text-sm text-gray-500">
            Génération automatique depuis les mesures, l’estimation et les photos.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Générer un bon de travail
        </button>
      </div>

      {!hasEstimate && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Aucune estimation pour ce projet : le bon de travail sera généré à partir des mesures
          seulement. Créez une estimation pour pré-remplir les produits et matériaux.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Liste */}
      {workOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Aucun bon de travail pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {workOrders.map((wo) => (
            <button
              key={wo.id}
              onClick={() => setSelectedId(wo.id === selectedId ? null : wo.id)}
              className={`flex w-full items-center gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-300 ${
                selectedId === wo.id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-600">
                {wo.wo_number}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {wo.title ?? `Bon de travail n° ${wo.wo_number}`}
                </p>
                <p className="text-xs text-gray-500">
                  {wo.client_name ?? '—'} ·{' '}
                  {new Date(wo.created_at).toLocaleDateString('fr-CA')}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[wo.status]}`}
              >
                {STATUS_LABELS[wo.status]}
              </span>
              <ChevronRight
                className={`h-4 w-4 text-gray-400 transition-transform ${
                  selectedId === wo.id ? 'rotate-90' : ''
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {/* Éditeur */}
      {selected && (
        <WorkOrderEditor
          key={selected.id}
          projectId={projectId}
          workOrder={selected}
          onPatch={(p) => patchLocal(selected.id, p)}
          onDelete={() => remove(selected.id)}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Éditeur d'un bon de travail
// ════════════════════════════════════════════════════════════════════════════

function WorkOrderEditor({
  projectId,
  workOrder,
  onPatch,
  onDelete,
}: {
  projectId: string
  workOrder: WorkOrder
  onPatch: (patch: Partial<WorkOrder>) => void
  onDelete: () => void
}) {
  const [form, setForm] = useState<WorkOrder>(workOrder)
  const [saving, setSaving] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  function set<K extends keyof WorkOrder>(key: K, val: WorkOrder[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  // ── Produits ──
  function updateProduct(i: number, patch: Partial<WorkOrderProduct>) {
    set('products', form.products.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }
  function addProduct() {
    set('products', [
      ...form.products,
      { name: '', brand: null, color: null, color_code: null, quantity: null, unit: null, category: 'material' },
    ])
  }
  function removeProduct(i: number) {
    set('products', form.products.filter((_, idx) => idx !== i))
  }

  // ── Checklist ──
  function updateCheckItem(
    section: keyof WorkOrderChecklist,
    i: number,
    patch: Partial<WorkOrderChecklistItem>
  ) {
    const items = form.checklist[section] ?? []
    set('checklist', {
      ...form.checklist,
      [section]: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    })
  }
  function addCheckItem(section: keyof WorkOrderChecklist) {
    const items = form.checklist[section] ?? []
    set('checklist', { ...form.checklist, [section]: [...items, { label: '', checked: false }] })
  }
  function removeCheckItem(section: keyof WorkOrderChecklist, i: number) {
    const items = form.checklist[section] ?? []
    set('checklist', { ...form.checklist, [section]: items.filter((_, idx) => idx !== i) })
  }

  async function save(extra?: Partial<WorkOrder>) {
    setSaving(true)
    const payload = { ...form, ...extra }
    try {
      const res = await fetch(`/api/projects/${projectId}/work-orders/${workOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (res.ok) {
        setForm(json.workOrder)
        onPatch(json.workOrder)
        setSavedAt(new Date().toLocaleTimeString('fr-CA'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function generatePdf() {
    setPdfLoading(true)
    try {
      // S'assurer que les dernières modifications sont enregistrées avant rendu
      await save()
      const res = await fetch(`/api/projects/${projectId}/work-orders/${workOrder.id}/pdf`, {
        method: 'POST',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? 'Erreur lors de la génération du PDF')
        return
      }
      const blob = await res.blob()
      window.open(URL.createObjectURL(blob), '_blank')
    } finally {
      setPdfLoading(false)
    }
  }

  const sections: { key: keyof WorkOrderChecklist; label: string }[] = [
    { key: 'before', label: 'Avant travaux' },
    { key: 'during', label: 'Pendant travaux' },
    { key: 'after', label: 'Après travaux' },
  ]

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <h3 className="text-base font-semibold text-gray-900">
          Bon de travail n° {workOrder.wo_number}
        </h3>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-xs text-gray-400">Enregistré à {savedAt}</span>}
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value as WorkOrderStatus)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button
            onClick={() => save()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          <button
            onClick={generatePdf}
            disabled={pdfLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            PDF
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Infos générales */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titre">
          <input
            className="input"
            value={form.title ?? ''}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
        <Field label="Date prévue">
          <input
            type="date"
            className="input"
            value={form.scheduled_date ?? ''}
            onChange={(e) => set('scheduled_date', e.target.value || null)}
          />
        </Field>
        <Field label="Client">
          <input
            className="input"
            value={form.client_name ?? ''}
            onChange={(e) => set('client_name', e.target.value || null)}
          />
        </Field>
        <Field label="Téléphone client">
          <input
            className="input"
            value={form.client_phone ?? ''}
            onChange={(e) => set('client_phone', e.target.value || null)}
          />
        </Field>
        <Field label="Adresse du chantier">
          <input
            className="input"
            value={form.site_address ?? ''}
            onChange={(e) => set('site_address', e.target.value || null)}
          />
        </Field>
        <Field label="Courriel client">
          <input
            className="input"
            value={form.client_email ?? ''}
            onChange={(e) => set('client_email', e.target.value || null)}
          />
        </Field>
        <Field label="Chef d’équipe">
          <input
            className="input"
            value={form.crew_lead ?? ''}
            onChange={(e) => set('crew_lead', e.target.value || null)}
          />
        </Field>
        <Field label="Équipe">
          <input
            className="input"
            value={form.crew_members ?? ''}
            onChange={(e) => set('crew_members', e.target.value || null)}
          />
        </Field>
        <Field label="Heures estimées">
          <input
            type="number"
            step="0.5"
            className="input"
            value={form.estimated_hours ?? ''}
            onChange={(e) =>
              set('estimated_hours', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </Field>
      </div>

      {/* Produits */}
      <Section title="Produits & matériaux">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-2">Produit</th>
                <th className="pb-2 pr-2">Marque</th>
                <th className="pb-2 pr-2">Couleur</th>
                <th className="pb-2 pr-2">Code</th>
                <th className="pb-2 pr-2">Qté</th>
                <th className="pb-2 pr-2">Unité</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {form.products.map((p, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-1 pr-2"><input className="cell" value={p.name} onChange={(e) => updateProduct(i, { name: e.target.value })} /></td>
                  <td className="py-1 pr-2"><input className="cell" value={p.brand ?? ''} onChange={(e) => updateProduct(i, { brand: e.target.value || null })} /></td>
                  <td className="py-1 pr-2"><input className="cell" value={p.color ?? ''} onChange={(e) => updateProduct(i, { color: e.target.value || null })} /></td>
                  <td className="py-1 pr-2"><input className="cell" value={p.color_code ?? ''} onChange={(e) => updateProduct(i, { color_code: e.target.value || null })} /></td>
                  <td className="py-1 pr-2"><input className="cell w-16" value={p.quantity ?? ''} onChange={(e) => updateProduct(i, { quantity: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                  <td className="py-1 pr-2"><input className="cell w-16" value={p.unit ?? ''} onChange={(e) => updateProduct(i, { unit: e.target.value || null })} /></td>
                  <td className="py-1 text-right">
                    <button onClick={() => removeProduct(i)} className="text-gray-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addProduct} className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <Plus className="h-3.5 w-3.5" /> Ajouter un produit
        </button>
      </Section>

      {/* Instructions */}
      <Section title="Instructions">
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ['preparation', 'Préparation'],
            ['application', 'Application'],
            ['cleanup', 'Nettoyage'],
            ['quality_control', 'Contrôle qualité'],
          ] as const).map(([key, label]) => (
            <Field key={key} label={label}>
              <textarea
                rows={3}
                className="input resize-y"
                value={form.instructions?.[key] ?? ''}
                onChange={(e) =>
                  set('instructions', { ...form.instructions, [key]: e.target.value })
                }
              />
            </Field>
          ))}
        </div>
      </Section>

      {/* Checklist */}
      <Section title="Checklist de chantier">
        <div className="grid gap-4 sm:grid-cols-3">
          {sections.map(({ key, label }) => (
            <div key={key}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">{label}</p>
              <div className="space-y-1.5">
                {(form.checklist[key] ?? []).map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={it.checked}
                      onChange={(e) => updateCheckItem(key, i, { checked: e.target.checked })}
                      className="h-4 w-4 shrink-0 rounded border-gray-300"
                    />
                    <input
                      className="cell flex-1"
                      value={it.label}
                      onChange={(e) => updateCheckItem(key, i, { label: e.target.value })}
                    />
                    <button onClick={() => removeCheckItem(key, i)} className="text-gray-300 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => addCheckItem(key)} className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <Plus className="h-3 w-3" /> Ajouter
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* Notes */}
      <Section title="Notes">
        <textarea
          rows={3}
          className="input w-full resize-y"
          value={form.notes ?? ''}
          onChange={(e) => set('notes', e.target.value || null)}
          placeholder="Notes additionnelles pour l’équipe…"
        />
      </Section>

      {/* Signatures */}
      <Section title="Validation & signatures">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <SignaturePad
              label="Signature chef d’équipe"
              value={form.crew_signature}
              onChange={(v) => set('crew_signature', v)}
            />
            <input
              className="input"
              placeholder="Nom du chef d’équipe"
              value={form.crew_signed_name ?? ''}
              onChange={(e) => set('crew_signed_name', e.target.value || null)}
            />
          </div>
          <div className="space-y-2">
            <SignaturePad
              label="Signature client"
              value={form.client_signature}
              onChange={(v) => set('client_signature', v)}
            />
            <input
              className="input"
              placeholder="Nom du client"
              value={form.client_signed_name ?? ''}
              onChange={(e) => set('client_signed_name', e.target.value || null)}
            />
          </div>
        </div>
        <button
          onClick={() => save({ status: 'signed' })}
          disabled={saving}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          <PenLine className="h-4 w-4" />
          Enregistrer les signatures & marquer signé
        </button>
      </Section>

      {/* Styles utilitaires locaux */}
      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #d1d5db;
          padding: 0.5rem 0.625rem;
          font-size: 0.875rem;
          color: #111827;
        }
        :global(.input:focus) {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 1px #2563eb;
        }
        :global(.cell) {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid #e5e7eb;
          padding: 0.25rem 0.4rem;
          font-size: 0.8125rem;
        }
        :global(.cell:focus) {
          outline: none;
          border-color: #2563eb;
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
      {children}
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-4">
      <h4 className="mb-3 text-sm font-semibold text-gray-900">{title}</h4>
      {children}
    </div>
  )
}
