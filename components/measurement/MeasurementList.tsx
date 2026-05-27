// components/measurement/MeasurementList.tsx
'use client'

import { useState } from 'react'
import { Trash2, Pencil, Check } from 'lucide-react'
import type { Calibration, FacadeLabel, Measurement } from '@/lib/supabase/types'
import {
  computeLineLength,
  computePolygonArea,
  pixelToReal,
} from '@/lib/measurement/calibration'
import { formatLength, formatArea } from '@/lib/utils/format'

interface MeasurementListProps {
  measurements: Measurement[]
  calibration: Calibration | null
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onLabelChange?: (id: string, label: string) => void
  unitSystem: 'metric' | 'imperial'
}

const FACADE_LABELS: Record<FacadeLabel, string> = {
  front: 'Façade avant',
  back: 'Façade arrière',
  left: 'Façade gauche',
  right: 'Façade droite',
  roof: 'Toit',
  other: 'Autre',
}

// Normalized coords — use 1×1 virtual canvas so calibration stores px_per_unit
// relative to real pixel dimensions which are already baked into px_per_unit.
// We pass imgWidth=1, imgHeight=1 and scale down: calibration already uses
// normalized points so we match units if we use the same normalization.
// Actually calibration.px_per_unit was computed from normalized distances;
// so we compute pixel distance in normalized space and divide by px_per_unit
// to get real value in calibration units.

function getMeasurementValue(
  m: Measurement,
  calibration: Calibration | null
): { value: number; label: string; isArea: boolean } {
  const isArea = m.measurement_type === 'area'

  if (isArea) {
    // pixel area in normalized space
    const pixelArea = computePolygonArea(m.points, 1, 1)
    if (calibration) {
      // px_per_unit is px/unit in normalized space
      const realArea = pixelArea / (calibration.px_per_unit * calibration.px_per_unit)
      // realArea is in calibration.unit²; convert to m² for formatting
      const areaM2 = toSquareMeters(realArea, calibration.unit)
      const formatted = formatArea(areaM2, 'metric')
      return { value: areaM2, label: formatted, isArea: true }
    }
    return { value: pixelArea, label: `${pixelArea.toFixed(0)} px²`, isArea: true }
  } else {
    const pixelLen = computeLineLength(m.points, 1, 1)
    if (calibration) {
      const realLen = pixelToReal(pixelLen, calibration.px_per_unit)
      const realM = toMeters(realLen, calibration.unit)
      const formatted = formatLength(realM, 'metric')
      return { value: realM, label: formatted, isArea: false }
    }
    return { value: pixelLen, label: `${pixelLen.toFixed(0)} px`, isArea: false }
  }
}

function toMeters(value: number, unit: string): number {
  switch (unit) {
    case 'cm': return value / 100
    case 'ft': return value * 0.3048
    case 'in': return value * 0.0254
    default: return value
  }
}

function toSquareMeters(value: number, unit: string): number {
  switch (unit) {
    case 'cm': return value / 10000
    case 'ft': return value * 0.092903
    case 'in': return value * 0.00064516
    default: return value
  }
}

function groupByFacade(measurements: Measurement[]): Map<string, Measurement[]> {
  const groups = new Map<string, Measurement[]>()
  for (const m of measurements) {
    const key = m.facade_side ?? 'other'
    const arr = groups.get(key) ?? []
    arr.push(m)
    groups.set(key, arr)
  }
  return groups
}

export function MeasurementList({
  measurements,
  calibration,
  selectedId,
  onSelect,
  onDelete,
  onLabelChange,
  unitSystem,
}: MeasurementListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const groups = groupByFacade(measurements)

  // Total area across all area measurements
  const totalAreaM2 = measurements
    .filter((m) => m.measurement_type === 'area')
    .reduce((sum, m) => {
      const { value } = getMeasurementValue(m, calibration)
      return sum + value
    }, 0)

  const hasCalibratedArea = calibration !== null && measurements.some((m) => m.measurement_type === 'area')

  function startEdit(m: Measurement) {
    setEditingId(m.id)
    setEditValue(m.label ?? '')
  }

  function commitEdit(id: string) {
    onLabelChange?.(id, editValue.trim())
    setEditingId(null)
  }

  if (measurements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
        <p className="text-sm text-gray-500">Aucune mesure pour cette photo.</p>
        <p className="mt-1 text-xs text-gray-400">
          Utilisez les outils pour dessiner des lignes ou des surfaces.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(groups.entries()).map(([facadeKey, items]) => (
        <div key={facadeKey}>
          <h4 className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {FACADE_LABELS[facadeKey as FacadeLabel] ?? facadeKey}
          </h4>

          <ul className="space-y-1">
            {items.map((m) => {
              const { label: valueLabel } = getMeasurementValue(m, calibration)
              const isSelected = m.id === selectedId
              const isEditing = editingId === m.id

              return (
                <li
                  key={m.id}
                  onClick={() => onSelect(m.id)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition-colors ${
                    isSelected
                      ? 'bg-blue-50 ring-1 ring-blue-300'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Color dot */}
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: m.color }}
                  />

                  {/* Label + value */}
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(m.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(m.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded border border-blue-400 px-1 py-0.5 text-xs focus:outline-none"
                      />
                    ) : (
                      <p className="truncate text-sm font-medium text-gray-800">
                        {m.label || (m.measurement_type === 'area' ? 'Surface' : 'Ligne')}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">{valueLabel}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {isEditing ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); commitEdit(m.id) }}
                        className="rounded p-1 text-green-600 hover:bg-green-50"
                        title="Confirmer"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(m) }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Renommer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(m.id) }}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      {/* Total area */}
      {hasCalibratedArea && (
        <div className="mt-2 rounded-lg bg-gray-100 px-3 py-2">
          <p className="text-xs text-gray-500">Surface totale</p>
          <p className="text-sm font-semibold text-gray-900">
            {formatArea(totalAreaM2, unitSystem)}
          </p>
        </div>
      )}
    </div>
  )
}
