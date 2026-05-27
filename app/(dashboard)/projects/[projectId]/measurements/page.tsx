// app/(dashboard)/projects/[projectId]/measurements/page.tsx
'use client'

import { use, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  Ruler,
  Download,
  Pencil,
  Check,
  X,
  Loader2,
  TriangleAlert,
} from 'lucide-react'
import type { Measurement, FacadeLabel, MeasurementType, MeasurementUnit, Photo } from '@/lib/supabase/types'
import { formatMeasurement } from '@/lib/utils/format'

interface Props {
  params: Promise<{ projectId: string }>
}

interface EnrichedMeasurement extends Measurement {
  photo: (Photo & { url?: string }) | null
}

interface MeasurementsResponse {
  measurements: EnrichedMeasurement[]
  totals: {
    totalArea: number
    totalPerimeter: number
  }
}

/* ── Labels ─────────────────────────────────────────────────────────────── */
const FACADE_LABELS: Record<FacadeLabel, string> = {
  front: 'Façade avant',
  back: 'Façade arrière',
  left: 'Façade gauche',
  right: 'Façade droite',
  roof: 'Toit',
  other: 'Autre',
}

const TYPE_LABELS: Record<MeasurementType, string> = {
  line: 'Ligne',
  area: 'Aire',
  angle: 'Angle',
  perimeter: 'Périmètre',
}

const FACADE_ORDER: FacadeLabel[] = ['front', 'back', 'left', 'right', 'roof', 'other']

/* ── CSV Export ──────────────────────────────────────────────────────────── */
function exportCsv(measurements: EnrichedMeasurement[], projectId: string) {
  const header = 'ID,Description,Façade,Type,Valeur,Unité,Photo,Créé le\n'
  const rows = measurements
    .map((m) =>
      [
        m.id,
        `"${(m.label ?? '').replace(/"/g, '""')}"`,
        m.facade_side ? (FACADE_LABELS[m.facade_side] ?? m.facade_side) : '',
        TYPE_LABELS[m.measurement_type] ?? m.measurement_type,
        m.real_value !== null ? m.real_value.toFixed(3) : '',
        m.unit,
        m.photo?.original_name ?? '',
        new Date(m.created_at).toLocaleDateString('fr-CA'),
      ].join(',')
    )
    .join('\n')

  const csv = header + rows
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mesures-${projectId}-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── Inline label editor ─────────────────────────────────────────────────── */
function LabelEditor({
  measurementId,
  projectId,
  initialLabel,
  onSaved,
}: {
  measurementId: string
  projectId: string
  initialLabel: string | null
  onSaved: (newLabel: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialLabel ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setValue(initialLabel ?? '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function save() {
    setSaving(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase
        .from('measurements')
        .update({ label: value || null, updated_at: new Date().toISOString() })
        .eq('id', measurementId)
      onSaved(value)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setValue(initialLabel ?? '')
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        onClick={startEdit}
        className="group flex items-center gap-1 text-left text-sm text-gray-700 hover:text-blue-600"
        title="Modifier le label"
      >
        <span>{initialLabel || <span className="text-gray-400 italic">Sans label</span>}</span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') cancel()
        }}
        className="w-36 rounded border border-blue-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        disabled={saving}
      />
      <button
        onClick={save}
        disabled={saving}
        className="rounded p-0.5 text-green-600 hover:bg-green-50 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={cancel}
        disabled={saving}
        className="rounded p-0.5 text-gray-400 hover:bg-gray-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function MeasurementsPage({ params }: Props) {
  const { projectId } = use(params)

  const [measurements, setMeasurements] = useState<EnrichedMeasurement[]>([])
  const [totals, setTotals] = useState({ totalArea: 0, totalPerimeter: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* ── Load ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/projects/${projectId}/measurements`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }
        const data: MeasurementsResponse = await res.json()
        setMeasurements(data.measurements ?? [])
        setTotals(data.totals)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  /* ── Label update callback ──────────────────────────────────────────── */
  function handleLabelSaved(id: string, newLabel: string) {
    setMeasurements((prev) =>
      prev.map((m) => (m.id === id ? { ...m, label: newLabel || null } : m))
    )
  }

  /* ── Group by facade ────────────────────────────────────────────────── */
  const grouped: Record<string, EnrichedMeasurement[]> = {}
  for (const side of FACADE_ORDER) {
    const items = measurements.filter((m) => m.facade_side === side)
    if (items.length > 0) grouped[side] = items
  }
  const noFacade = measurements.filter((m) => !m.facade_side)
  if (noFacade.length > 0) {
    grouped['other'] = [...(grouped['other'] ?? []), ...noFacade]
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ruler className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Mesures</h2>
          {measurements.length > 0 && (
            <span className="ml-1 text-sm font-normal text-gray-400">
              ({measurements.length})
            </span>
          )}
        </div>
        {measurements.length > 0 && (
          <button
            onClick={() => exportCsv(measurements, projectId)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Exporter CSV
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary cards */}
      {measurements.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Nombre de mesures"
            value={String(measurements.length)}
            color="purple"
          />
          <SummaryCard
            label="Surface totale (murs)"
            value={`${totals.totalArea.toFixed(2)} m²`}
            color="blue"
          />
          <SummaryCard
            label="Périmètre total"
            value={`${totals.totalPerimeter.toFixed(2)} m`}
            color="green"
          />
        </div>
      )}

      {/* Measurements table */}
      {measurements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-20 text-center">
          <Ruler className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">Aucune mesure pour ce projet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Ouvrez une photo pour commencer à mesurer.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {Object.entries(grouped).map(([facadeKey, items]) => (
            <div key={facadeKey}>
              {/* Facade group header */}
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {FACADE_LABELS[facadeKey as FacadeLabel] ?? facadeKey}
                </span>
                <span className="ml-2 text-xs text-gray-400">
                  ({items.length} mesure{items.length > 1 ? 's' : ''})
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead>
                    <tr className="bg-white">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Photo</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Label</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Type</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Valeur</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Unité</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Façade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        {/* Photo thumbnail */}
                        <td className="px-4 py-2.5">
                          {m.photo?.url ? (
                            <div className="relative h-10 w-14 overflow-hidden rounded border border-gray-100 bg-gray-100">
                              <Image
                                src={m.photo.url}
                                alt={m.photo.original_name ?? ''}
                                fill
                                className="object-cover"
                                sizes="56px"
                              />
                            </div>
                          ) : (
                            <div className="h-10 w-14 rounded border border-dashed border-gray-200 bg-gray-50" />
                          )}
                        </td>

                        {/* Label (inline editable) */}
                        <td className="px-4 py-2.5">
                          <LabelEditor
                            measurementId={m.id}
                            projectId={projectId}
                            initialLabel={m.label}
                            onSaved={(newLabel) => handleLabelSaved(m.id, newLabel)}
                          />
                        </td>

                        {/* Type */}
                        <td className="px-4 py-2.5">
                          <TypeBadge type={m.measurement_type} />
                        </td>

                        {/* Value */}
                        <td className="px-4 py-2.5 text-right font-mono text-sm font-medium text-gray-900">
                          {m.real_value !== null
                            ? formatMeasurement(m.real_value, m.unit as MeasurementUnit)
                            : <span className="text-gray-300">—</span>}
                        </td>

                        {/* Unit */}
                        <td className="px-4 py-2.5 text-xs text-gray-500">{m.unit}</td>

                        {/* Facade */}
                        <td className="px-4 py-2.5">
                          {m.facade_side ? (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                              {FACADE_LABELS[m.facade_side] ?? m.facade_side}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: 'purple' | 'blue' | 'green'
}) {
  const colorMap = {
    purple: 'bg-purple-50 border-purple-100',
    blue:   'bg-blue-50 border-blue-100',
    green:  'bg-green-50 border-green-100',
  }
  const textMap = {
    purple: 'text-purple-700',
    blue:   'text-blue-700',
    green:  'text-green-700',
  }

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${textMap[color]}`}>{value}</p>
    </div>
  )
}

function TypeBadge({ type }: { type: MeasurementType }) {
  const styles: Record<MeasurementType, string> = {
    line:       'bg-gray-100 text-gray-700',
    area:       'bg-amber-50 text-amber-700',
    angle:      'bg-violet-50 text-violet-700',
    perimeter:  'bg-cyan-50 text-cyan-700',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[type]}`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  )
}
