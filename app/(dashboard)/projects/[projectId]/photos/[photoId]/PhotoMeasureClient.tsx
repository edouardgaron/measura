// app/(dashboard)/projects/[projectId]/photos/[photoId]/PhotoMeasureClient.tsx
'use client'

import { useCallback, useState } from 'react'
import type { Calibration, Measurement, Photo, UnitSystem } from '@/lib/supabase/types'
import { MeasurementCanvas } from '@/components/measurement/MeasurementCanvas'
import { MeasurementList } from '@/components/measurement/MeasurementList'

interface PhotoMeasureClientProps {
  photo: Photo
  initialCalibration: Calibration | null
  initialMeasurements: Measurement[]
  projectId: string
  photoId: string
  unitSystem: UnitSystem
  readOnly?: boolean
}

export function PhotoMeasureClient({
  photo,
  initialCalibration,
  initialMeasurements,
  projectId,
  photoId,
  unitSystem,
  readOnly = false,
}: PhotoMeasureClientProps) {
  const [calibration, setCalibration] = useState<Calibration | null>(initialCalibration)
  const [measurements, setMeasurements] = useState<Measurement[]>(initialMeasurements)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Save calibration
  // ---------------------------------------------------------------------------
  const handleSaveCalibration = useCallback(
    async (data: Omit<Calibration, 'id' | 'created_at' | 'updated_at'>) => {
      setSaving(true)
      setError(null)
      try {
        const res = await fetch(`/api/photos/${photoId}/calibration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? 'Échec de la sauvegarde de la calibration')
        }
        const { calibration: saved } = await res.json()
        setCalibration(saved)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setSaving(false)
      }
    },
    [photoId]
  )

  // ---------------------------------------------------------------------------
  // Save measurement
  // ---------------------------------------------------------------------------
  const handleSaveMeasurement = useCallback(
    async (data: Omit<Measurement, 'id' | 'created_at' | 'updated_at'>) => {
      setSaving(true)
      setError(null)
      try {
        const res = await fetch(`/api/photos/${photoId}/measurements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? 'Échec de la sauvegarde de la mesure')
        }
        const { measurement: saved } = await res.json()
        setMeasurements((prev) => [...prev, saved])
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setSaving(false)
      }
    },
    [photoId]
  )

  // ---------------------------------------------------------------------------
  // Delete measurement
  // ---------------------------------------------------------------------------
  const handleDeleteMeasurement = useCallback(
    async (id: string) => {
      setSaving(true)
      setError(null)
      try {
        const res = await fetch(`/api/photos/${photoId}/measurements?id=${id}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? 'Échec de la suppression')
        }
        setMeasurements((prev) => prev.filter((m) => m.id !== id))
        if (selectedId === id) setSelectedId(null)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setSaving(false)
      }
    },
    [photoId, selectedId]
  )

  // ---------------------------------------------------------------------------
  // Rename measurement label (optimistic)
  // ---------------------------------------------------------------------------
  const handleLabelChange = useCallback(
    async (id: string, label: string) => {
      setMeasurements((prev) =>
        prev.map((m) => (m.id === id ? { ...m, label } : m))
      )
      try {
        await fetch(`/api/photos/${photoId}/measurements`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, label }),
        })
      } catch {
        // Silently ignore — the optimistic update remains
      }
    },
    [photoId]
  )

  return (
    <div className="flex gap-4 min-h-0">
      {/* Main canvas — takes all available width */}
      <div className="min-w-0 flex-1">
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {saving && (
          <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Enregistrement...
          </div>
        )}
        <MeasurementCanvas
          photo={photo}
          calibration={calibration}
          measurements={measurements}
          onSaveMeasurement={handleSaveMeasurement}
          onDeleteMeasurement={handleDeleteMeasurement}
          onSaveCalibration={handleSaveCalibration}
          projectId={projectId}
          readOnly={readOnly}
        />
      </div>

      {/* Sidebar list */}
      <aside className="w-64 shrink-0 rounded-xl border border-gray-200 bg-white p-3 overflow-y-auto">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Mesures</h3>
        <MeasurementList
          measurements={measurements}
          calibration={calibration}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={handleDeleteMeasurement}
          onLabelChange={handleLabelChange}
          unitSystem={unitSystem}
        />
      </aside>
    </div>
  )
}
