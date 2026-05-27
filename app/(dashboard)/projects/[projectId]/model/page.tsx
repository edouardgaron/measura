// app/(dashboard)/projects/[projectId]/model/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import { Loader2, Save, Box } from 'lucide-react'
import type { RoofType, Measurement, HouseModel } from '@/lib/supabase/types'
import dynamic from 'next/dynamic'

// Dynamically import the canvas component to avoid SSR issues with WebGL
const ModelViewer = dynamic(() => import('@/components/model3d/ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded-xl border border-gray-200 bg-gray-900">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  ),
})

interface Props {
  params: Promise<{ projectId: string }>
}

interface MeasurementTotals {
  totalArea: number
  totalPerimeter: number
}

interface MeasurementsResponse {
  measurements: Measurement[]
  totals: MeasurementTotals
}

const ROOF_OPTIONS: { value: RoofType; label: string }[] = [
  { value: 'gable', label: 'Toit à pignon (2 versants)' },
  { value: 'hip',   label: 'Toit en croupe (4 versants)' },
  { value: 'flat',  label: 'Toit plat' },
  { value: 'shed',  label: 'Toit monopente' },
]

function deriveHouseDimensions(measurements: Measurement[]) {
  // Attempt to infer width/depth from facade measurements
  // Look at front/back perimeter or area measurements
  const frontBack = measurements.filter(
    (m) => m.facade_side === 'front' || m.facade_side === 'back'
  )
  const leftRight = measurements.filter(
    (m) => m.facade_side === 'left' || m.facade_side === 'right'
  )

  function avgRealValue(items: Measurement[], type: string): number | undefined {
    const filtered = items
      .filter((m) => m.measurement_type === type && m.real_value !== null)
      .map((m) => m.real_value as number)
    if (filtered.length === 0) return undefined
    return filtered.reduce((a, b) => a + b, 0) / filtered.length
  }

  // Use perimeter of front/back as a proxy for width
  const width =
    avgRealValue(frontBack, 'line') ??
    avgRealValue(frontBack, 'perimeter')

  const depth =
    avgRealValue(leftRight, 'line') ??
    avgRealValue(leftRight, 'perimeter')

  return { width, depth }
}

export default function ModelPage({ params }: Props) {
  const { projectId } = use(params)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [houseModel, setHouseModel] = useState<HouseModel | null>(null)

  const [roofType, setRoofType] = useState<RoofType>('gable')
  const [wallHeight, setWallHeight] = useState<number>(3)
  const [colors, setColors] = useState({
    walls: '#e8d5b7',
    roof: '#8b5e3c',
    trim: '#ffffff',
  })

  // Derived dimensions from measurements
  const [manualWidth, setManualWidth] = useState<number>(8)
  const [manualDepth, setManualDepth] = useState<number>(10)

  /* ── Load data ──────────────────────────────────────────────────────── */
  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      try {
        // Fetch measurements
        const mRes = await fetch(`/api/projects/${projectId}/measurements`)
        if (mRes.ok) {
          const data: MeasurementsResponse = await mRes.json()
          setMeasurements(data.measurements ?? [])

          const { width, depth } = deriveHouseDimensions(data.measurements ?? [])
          if (width) setManualWidth(Math.round(width * 10) / 10)
          if (depth) setManualDepth(Math.round(depth * 10) / 10)
        }

        // Fetch house model settings (directly via Supabase client)
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: model } = await supabase
          .from('house_models')
          .select('*')
          .eq('project_id', projectId)
          .maybeSingle()

        if (model) {
          setHouseModel(model)
          setRoofType(model.roof_type)
          if (model.wall_height) setWallHeight(model.wall_height)
          if (model.geometry_json) {
            const geo = model.geometry_json as Record<string, unknown>
            if (typeof geo.wallColor === 'string') setColors((c) => ({ ...c, walls: geo.wallColor as string }))
            if (typeof geo.roofColor === 'string') setColors((c) => ({ ...c, roof: geo.roofColor as string }))
            if (typeof geo.trimColor === 'string') setColors((c) => ({ ...c, trim: geo.trimColor as string }))
            if (typeof geo.width === 'number') setManualWidth(geo.width as number)
            if (typeof geo.depth === 'number') setManualDepth(geo.depth as number)
          }
        }
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  /* ── Save model ─────────────────────────────────────────────────────── */
  async function saveModel() {
    setSaving(true)
    setSaveSuccess(false)

    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    const payload = {
      project_id: projectId,
      roof_type: roofType,
      wall_height: wallHeight,
      generated_at: new Date().toISOString(),
      geometry_json: {
        width: manualWidth,
        depth: manualDepth,
        wallHeight,
        wallColor: colors.walls,
        roofColor: colors.roof,
        trimColor: colors.trim,
      },
    }

    if (houseModel) {
      await supabase
        .from('house_models')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', houseModel.id)
    } else {
      const { data: newModel } = await supabase
        .from('house_models')
        .insert(payload)
        .select()
        .single()
      if (newModel) setHouseModel(newModel)
    }

    setSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  const hasMeasuredDimensions = measurements.some((m) => m.real_value !== null)

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
          <Box className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Modèle 3D</h2>
        </div>
        <button
          onClick={saveModel}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Sauvegarder le modèle
        </button>
      </div>

      {saveSuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Modèle sauvegardé avec succès.
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Paramètres du bâtiment</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Roof type */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Type de toit
            </label>
            <select
              value={roofType}
              onChange={(e) => setRoofType(e.target.value as RoofType)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ROOF_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Wall height */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Hauteur des murs (m)
            </label>
            <input
              type="number"
              value={wallHeight}
              min={1.5}
              max={20}
              step={0.1}
              onChange={(e) => setWallHeight(parseFloat(e.target.value) || 3)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Width */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Largeur (m){hasMeasuredDimensions && <span className="ml-1 text-blue-500">auto</span>}
            </label>
            <input
              type="number"
              value={manualWidth}
              min={1}
              max={100}
              step={0.1}
              onChange={(e) => setManualWidth(parseFloat(e.target.value) || 8)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Depth */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Profondeur (m){hasMeasuredDimensions && <span className="ml-1 text-blue-500">auto</span>}
            </label>
            <input
              type="number"
              value={manualDepth}
              min={1}
              max={100}
              step={0.1}
              onChange={(e) => setManualDepth(parseFloat(e.target.value) || 10)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 3D Viewer */}
      <ModelViewer
        measurements={{ width: manualWidth, depth: manualDepth, height: wallHeight }}
        roofType={roofType}
        colors={colors}
        onColorsChange={setColors}
      />
    </div>
  )
}
