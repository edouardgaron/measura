// app/(dashboard)/projects/[projectId]/estimate/page.tsx
'use client'

import { use, useState, useCallback, useEffect } from 'react'
import {
  Layers,
  Package,
  DollarSign,
  FileText,
  Calculator,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'
import {
  calcExteriorSummary,
  calcPaintGallons,
  SQ_FT_TO_SQ_M,
} from '@/lib/measurement/surfaceCalculator'

interface Props {
  params: Promise<{ projectId: string }>
}

// ─── Types ────────────────────────────────────────────────────────────────────

type RoofType = 'gable' | 'hip' | 'flat' | 'shed'
type WorkType = 'painting' | 'roofing' | 'siding'
type ItemCategory = 'travail' | 'matériau' | 'équipement' | 'autre'
type ItemUnit = 'pi²' | 'm²' | 'pi' | 'unité' | 'heure' | 'jour' | 'lot'

interface HouseDimensions {
  width: string
  depth: string
  wallHeight: string
  roofType: RoofType
  pitchRise: string
  overhang: string
  doors: string
  windows: string
  garages: string
}

type SurfaceResults = {
  walls: { front: number; back: number; left: number; right: number; total: number }
  gables: number
  roof: number
  soffit: number
  fascia: number
  openings: number
  netWalls: number
  totalPaintArea: number
} | null

interface LineItem {
  id: string
  category: ItemCategory
  description: string
  quantity: string
  unit: ItemUnit
  unitPrice: string
  optional: boolean
}

// ─── Tab component ────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(val: string, fallback = 0): number {
  const parsed = parseFloat(val)
  return isNaN(parsed) ? fallback : parsed
}

function fmt2(val: number): string {
  return val.toFixed(2)
}

function fmtM2(sqft: number): string {
  return (sqft * SQ_FT_TO_SQ_M).toFixed(2)
}

function newItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  travail: 'Travail',
  matériau: 'Matériau',
  équipement: 'Équipement',
  autre: 'Autre',
}

const UNIT_OPTIONS: ItemUnit[] = ['pi²', 'm²', 'pi', 'unité', 'heure', 'jour', 'lot']

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EstimatePage({ params }: Props) {
  const { projectId } = use(params)
  const [activeTab, setActiveTab] = useState<'surfaces' | 'materiaux' | 'prix' | 'resume'>(
    'surfaces'
  )

  // ── Surfaces state ──────────────────────────────────────────────────────────
  const [dims, setDims] = useState<HouseDimensions>({
    width: '',
    depth: '',
    wallHeight: '9',
    roofType: 'gable',
    pitchRise: '5',
    overhang: '1',
    doors: '2',
    windows: '8',
    garages: '1',
  })
  const [surfaceResults, setSurfaceResults] = useState<SurfaceResults>(null)
  const [savingSurfaces, setSavingSurfaces] = useState(false)
  const [surfacesSaved, setSurfacesSaved] = useState(false)

  // ── Materials state ─────────────────────────────────────────────────────────
  const [workType, setWorkType] = useState<WorkType>('painting')
  const [coats, setCoats] = useState(2)
  const [wasteFactor, setWasteFactor] = useState(10) // percent

  // ── Prix state ──────────────────────────────────────────────────────────────
  const [items, setItems] = useState<LineItem[]>([
    {
      id: newItemId(),
      category: 'travail',
      description: '',
      quantity: '1',
      unit: 'heure',
      unitPrice: '0',
      optional: false,
    },
  ])
  const [markupPct, setMarkupPct] = useState('20')
  const [applyGST, setApplyGST] = useState(true)
  const [applyQST, setApplyQST] = useState(true)
  const [discount, setDiscount] = useState('0')
  const [savingEstimate, setSavingEstimate] = useState(false)
  const [estimateSaved, setEstimateSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Pré-remplissage depuis l'onglet Élévations (« Créer l'estimation ») :
  // dimensions + ouvertures issues des photos → calcul des surfaces au montage.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    if (p.get('fromPhotos') !== '1') return
    const rt = p.get('roofType') ?? 'gable'
    const next: HouseDimensions = {
      width: p.get('width') ?? '',
      depth: p.get('depth') ?? '',
      wallHeight: p.get('wallHeight') ?? '9',
      roofType: (['gable', 'hip', 'flat', 'shed'].includes(rt) ? rt : 'gable') as HouseDimensions['roofType'],
      pitchRise: p.get('pitch') ?? '5',
      overhang: '1',
      doors: p.get('doors') ?? '0',
      windows: p.get('windows') ?? '0',
      garages: p.get('garages') ?? '0',
    }
    setDims(next)
    const w = n(next.width), d = n(next.depth), h = n(next.wallHeight, 9)
    if (w > 0 && d > 0) {
      setSurfaceResults(calcExteriorSummary({
        width: w, depth: d, wallHeight: h, roofType: next.roofType,
        pitchRise: n(next.pitchRise, 5), overhang: 1,
        openings: { doors: n(next.doors), windows: n(next.windows), garages: n(next.garages) },
      }))
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // SURFACES TAB
  // ─────────────────────────────────────────────────────────────────────────

  function handleCalcSurfaces() {
    const w = n(dims.width)
    const d = n(dims.depth)
    const h = n(dims.wallHeight, 9)
    if (w <= 0 || d <= 0 || h <= 0) return

    const results = calcExteriorSummary({
      width: w,
      depth: d,
      wallHeight: h,
      roofType: dims.roofType,
      pitchRise: n(dims.pitchRise, 5),
      overhang: n(dims.overhang, 1),
      openings: {
        doors: n(dims.doors, 0),
        windows: n(dims.windows, 0),
        garages: n(dims.garages, 0),
      },
    })

    setSurfaceResults(results)
    setSurfacesSaved(false)
  }

  async function handleSaveSurfaces() {
    if (!surfaceResults) return
    setSavingSurfaces(true)
    try {
      const entries: Array<{
        facade_side?: string
        surface_type: string
        label: string
        gross_area: number
        opening_area?: number
        unit: string
        notes?: string
      }> = [
        { facade_side: 'front', surface_type: 'wall', label: 'Mur avant', gross_area: surfaceResults.walls.front, unit: 'ft' },
        { facade_side: 'back', surface_type: 'wall', label: 'Mur arrière', gross_area: surfaceResults.walls.back, unit: 'ft' },
        { facade_side: 'left', surface_type: 'wall', label: 'Mur gauche', gross_area: surfaceResults.walls.left, unit: 'ft' },
        { facade_side: 'right', surface_type: 'wall', label: 'Mur droit', gross_area: surfaceResults.walls.right, unit: 'ft' },
        { surface_type: 'gable', label: 'Pignons', gross_area: surfaceResults.gables, unit: 'ft' },
        { facade_side: 'roof', surface_type: 'roof', label: 'Toit', gross_area: surfaceResults.roof, unit: 'ft' },
        { surface_type: 'soffit', label: 'Soffite', gross_area: surfaceResults.soffit, unit: 'ft' },
        { surface_type: 'fascia', label: 'Fascia', gross_area: surfaceResults.fascia, unit: 'ft' },
        { surface_type: 'wall', label: 'Murs nets (sans ouvertures)', gross_area: surfaceResults.netWalls, opening_area: surfaceResults.openings, unit: 'ft' },
      ]

      for (const entry of entries) {
        await fetch(`/api/projects/${projectId}/surfaces`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        })
      }
      setSurfacesSaved(true)
    } catch {
      // non-fatal
    } finally {
      setSavingSurfaces(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MATERIALS DERIVED VALUES
  // ─────────────────────────────────────────────────────────────────────────

  const paintArea = surfaceResults
    ? surfaceResults.totalPaintArea * (1 + wasteFactor / 100)
    : 0
  const paintGallons = calcPaintGallons({ area: paintArea, coats, coveragePerGallon: 400 })
  const primerGallons = calcPaintGallons({ area: paintArea, coats: 1, coveragePerGallon: 300 })

  const roofArea = surfaceResults ? surfaceResults.roof * (1 + wasteFactor / 100) : 0
  const shingleBundles = Math.ceil(roofArea / 33)

  const sidingArea = surfaceResults
    ? surfaceResults.netWalls * (1 + wasteFactor / 100)
    : 0
  const sidingSquares = Math.ceil(sidingArea / 100)

  const perimeter = surfaceResults
    ? 2 * (n(dims.width) + n(dims.depth))
    : 0
  const caulkTubes = Math.ceil(perimeter / 50)

  // ─────────────────────────────────────────────────────────────────────────
  // PRIX (ESTIMATE ITEMS)
  // ─────────────────────────────────────────────────────────────────────────

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        id: newItemId(),
        category: 'travail',
        description: '',
        quantity: '1',
        unit: 'heure',
        unitPrice: '0',
        optional: false,
      },
    ])
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const updateItem = useCallback(
    (id: string, field: keyof LineItem, value: string | boolean) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      )
    },
    []
  )

  // Totals
  const subtotal = items
    .filter((i) => !i.optional)
    .reduce((sum, i) => sum + n(i.quantity) * n(i.unitPrice), 0)

  const markupAmount = subtotal * (n(markupPct) / 100)
  const afterMarkup = subtotal + markupAmount
  const discountAmount = n(discount)
  const afterDiscount = Math.max(0, afterMarkup - discountAmount)

  const laborCost = items
    .filter((i) => i.category === 'travail' && !i.optional)
    .reduce((sum, i) => sum + n(i.quantity) * n(i.unitPrice), 0)
  const materialCost = items
    .filter((i) => i.category === 'matériau' && !i.optional)
    .reduce((sum, i) => sum + n(i.quantity) * n(i.unitPrice), 0)
  const equipCost = items
    .filter((i) => i.category === 'équipement' && !i.optional)
    .reduce((sum, i) => sum + n(i.quantity) * n(i.unitPrice), 0)

  const gstAmt = applyGST ? afterDiscount * 0.05 : 0
  const qstAmt = applyQST ? afterDiscount * 0.09975 : 0
  const grandTotal = afterDiscount + gstAmt + qstAmt

  // ─────────────────────────────────────────────────────────────────────────
  // SAVE ESTIMATE
  // ─────────────────────────────────────────────────────────────────────────

  async function handleSaveEstimate() {
    setSavingEstimate(true)
    setSaveError(null)
    try {
      const body = {
        work_type: workType,
        items: items.map((i, idx) => ({
          sort_order: idx,
          category: i.category === 'travail' ? 'labor'
            : i.category === 'matériau' ? 'material'
            : i.category === 'équipement' ? 'equipment'
            : 'other',
          description: i.description || '—',
          quantity: n(i.quantity),
          unit: i.unit === 'pi²' ? 'sqft'
            : i.unit === 'm²' ? 'sqm'
            : i.unit === 'pi' ? 'lf'
            : i.unit === 'heure' ? 'hour'
            : i.unit === 'jour' ? 'day'
            : i.unit === 'lot' ? 'lot'
            : 'each',
          unit_price: n(i.unitPrice),
          is_optional: i.optional,
        })),
        subtotal,
        tax_gst: gstAmt,
        tax_qst: qstAmt,
        total: grandTotal,
        markup_percent: n(markupPct),
        labor_cost: laborCost,
        material_cost: materialCost,
      }

      const res = await fetch(`/api/projects/${projectId}/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        setSaveError(err.error ?? 'Erreur lors de la sauvegarde')
      } else {
        setEstimateSaved(true)
      }
    } catch {
      setSaveError('Erreur réseau')
    } finally {
      setSavingEstimate(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Tab bar */}
        <div className="flex gap-0 overflow-x-auto border-b border-gray-200 px-4">
          <TabButton
            active={activeTab === 'surfaces'}
            onClick={() => setActiveTab('surfaces')}
            icon={<Layers className="h-4 w-4" />}
            label="Surfaces"
          />
          <TabButton
            active={activeTab === 'materiaux'}
            onClick={() => setActiveTab('materiaux')}
            icon={<Package className="h-4 w-4" />}
            label="Matériaux"
          />
          <TabButton
            active={activeTab === 'prix'}
            onClick={() => setActiveTab('prix')}
            icon={<DollarSign className="h-4 w-4" />}
            label="Prix"
          />
          <TabButton
            active={activeTab === 'resume'}
            onClick={() => setActiveTab('resume')}
            icon={<FileText className="h-4 w-4" />}
            label="Résumé"
          />
        </div>

        {/* ── TAB: SURFACES ─────────────────────────────────────────────────── */}
        {activeTab === 'surfaces' && (
          <div className="p-6 space-y-6">
            <h2 className="text-base font-semibold text-gray-900">Dimensions de la maison</h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Largeur — façade (pi)">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="ex. 40"
                  value={dims.width}
                  onChange={(e) => setDims((d) => ({ ...d, width: e.target.value }))}
                  className="input-base"
                />
              </Field>

              <Field label="Profondeur — flanc (pi)">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="ex. 28"
                  value={dims.depth}
                  onChange={(e) => setDims((d) => ({ ...d, depth: e.target.value }))}
                  className="input-base"
                />
              </Field>

              <Field label="Hauteur de mur (pi)">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={dims.wallHeight}
                  onChange={(e) => setDims((d) => ({ ...d, wallHeight: e.target.value }))}
                  className="input-base"
                />
              </Field>

              <Field label="Type de toit">
                <select
                  value={dims.roofType}
                  onChange={(e) => setDims((d) => ({ ...d, roofType: e.target.value as RoofType }))}
                  className="input-base"
                >
                  <option value="gable">Pignon (2 versants)</option>
                  <option value="hip">Croupe (4 versants)</option>
                  <option value="flat">Plat</option>
                  <option value="shed">Appentis (1 versant)</option>
                </select>
              </Field>

              <Field label="Pente (po/12)">
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="1"
                  value={dims.pitchRise}
                  onChange={(e) => setDims((d) => ({ ...d, pitchRise: e.target.value }))}
                  className="input-base"
                />
              </Field>

              <Field label="Débord de toit (pi)">
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={dims.overhang}
                  onChange={(e) => setDims((d) => ({ ...d, overhang: e.target.value }))}
                  className="input-base"
                />
              </Field>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Ouvertures</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Portes (standard 3×6'10&quot;)">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={dims.doors}
                    onChange={(e) => setDims((d) => ({ ...d, doors: e.target.value }))}
                    className="input-base"
                  />
                </Field>
                <Field label="Fenêtres (moyenne 3×4 pi)">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={dims.windows}
                    onChange={(e) => setDims((d) => ({ ...d, windows: e.target.value }))}
                    className="input-base"
                  />
                </Field>
                <Field label="Portes de garage (double 16×7 pi)">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={dims.garages}
                    onChange={(e) => setDims((d) => ({ ...d, garages: e.target.value }))}
                    className="input-base"
                  />
                </Field>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCalcSurfaces}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Calculator className="h-4 w-4" />
              Calculer
            </button>

            {/* Results table */}
            {surfaceResults && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Résultats</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-2 text-left">Surface</th>
                        <th className="px-4 py-2 text-right">pi²</th>
                        <th className="px-4 py-2 text-right">m²</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <SurfaceRow label="Mur avant" sqft={surfaceResults.walls.front} />
                      <SurfaceRow label="Mur arrière" sqft={surfaceResults.walls.back} />
                      <SurfaceRow label="Mur gauche" sqft={surfaceResults.walls.left} />
                      <SurfaceRow label="Mur droit" sqft={surfaceResults.walls.right} />
                      <SurfaceRow label="Total murs bruts" sqft={surfaceResults.walls.total} bold />
                      {surfaceResults.gables > 0 && (
                        <SurfaceRow label="Pignons" sqft={surfaceResults.gables} />
                      )}
                      <SurfaceRow label="Toit" sqft={surfaceResults.roof} />
                      <SurfaceRow label="Soffite" sqft={surfaceResults.soffit} />
                      <SurfaceRow
                        label="Fascia (pi linéaires)"
                        sqft={surfaceResults.fascia}
                        note="pi lin."
                      />
                      <SurfaceRow
                        label="Ouvertures (à déduire)"
                        sqft={surfaceResults.openings}
                        negative
                      />
                      <SurfaceRow label="Murs nets" sqft={surfaceResults.netWalls} bold />
                      <SurfaceRow
                        label="Total peinture (murs + soffite)"
                        sqft={surfaceResults.totalPaintArea}
                        bold
                        highlight
                      />
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={handleSaveSurfaces}
                  disabled={savingSurfaces || surfacesSaved}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                >
                  {savingSurfaces ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {surfacesSaved ? 'Sauvegardé' : 'Sauvegarder les surfaces'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: MATÉRIAUX ────────────────────────────────────────────────── */}
        {activeTab === 'materiaux' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Type de travail</label>
                <div className="mt-1 flex gap-2">
                  {(['painting', 'roofing', 'siding'] as WorkType[]).map((wt) => (
                    <button
                      key={wt}
                      type="button"
                      onClick={() => setWorkType(wt)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        workType === wt
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {wt === 'painting' ? 'Peinture' : wt === 'roofing' ? 'Toiture' : 'Revêtement'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Facteur de gaspillage</label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="range"
                    min={5}
                    max={20}
                    step={1}
                    value={wasteFactor}
                    onChange={(e) => setWasteFactor(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-sm font-semibold text-gray-700">{wasteFactor}%</span>
                </div>
              </div>

              {workType === 'painting' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Nombre de couches</label>
                  <select
                    value={coats}
                    onChange={(e) => setCoats(Number(e.target.value))}
                    className="mt-1 block rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={1}>1 couche</option>
                    <option value={2}>2 couches</option>
                    <option value={3}>3 couches</option>
                  </select>
                </div>
              )}
            </div>

            {!surfaceResults && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Calculez d&apos;abord les surfaces dans l&apos;onglet Surfaces pour voir les quantités.
              </p>
            )}

            {surfaceResults && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Matériau</th>
                      <th className="px-4 py-2 text-right">Quantité</th>
                      <th className="px-4 py-2 text-left">Unité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {workType === 'painting' && (
                      <>
                        <MatRow label="Peinture (finition)" qty={paintGallons} unit={`gallon${paintGallons !== 1 ? 's' : ''}`} />
                        <MatRow label="Apprêt (primer)" qty={primerGallons} unit={`gallon${primerGallons !== 1 ? 's' : ''}`} />
                        <MatRow label="Ruban de masquage" qty={Math.ceil(perimeter / 10)} unit="rouleaux" />
                        <MatRow label="Calfeutrant (1 tube / 50 pi)" qty={caulkTubes} unit="tubes" />
                      </>
                    )}
                    {workType === 'roofing' && (
                      <>
                        <MatRow label="Bardeaux d'asphalte" qty={shingleBundles} unit="paquets (bundle 33 pi²)" />
                        <MatRow label="Clous à toiture" qty={Math.ceil(roofArea / 100)} unit="boîtes (1 lb / 100 pi²)" />
                        <MatRow label="Sous-couche (ice & water)" qty={Math.ceil(roofArea / 200)} unit="rouleaux (200 pi² / rouleau)" />
                      </>
                    )}
                    {workType === 'siding' && (
                      <>
                        <MatRow label="Revêtement extérieur" qty={sidingSquares} unit="carrés (100 pi²)" />
                        <MatRow label="Calfeutrant" qty={caulkTubes} unit="tubes" />
                        <MatRow label="Garnitures (trim)" qty={Math.ceil(perimeter / 8)} unit="baguettes 8 pi" />
                      </>
                    )}
                    <tr className="bg-gray-50">
                      <td className="px-4 py-2 font-semibold text-gray-700">Surface de référence</td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-700">
                        {workType === 'painting'
                          ? fmt2(paintArea)
                          : workType === 'roofing'
                          ? fmt2(roofArea)
                          : fmt2(sidingArea)}
                      </td>
                      <td className="px-4 py-2 text-gray-500">pi² (avec {wasteFactor}% gaspillage)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: PRIX ─────────────────────────────────────────────────────── */}
        {activeTab === 'prix' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Postes de l&apos;estimation</h2>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                  canRemove={items.length > 1}
                />
              ))}
            </div>

            {/* Totals */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Totaux</h3>

              <div className="space-y-2 text-sm">
                <TotalRow label="Sous-total" value={subtotal} />
                <div className="flex items-center gap-2">
                  <label className="text-gray-600 flex-1">Majoration (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={markupPct}
                    onChange={(e) => setMarkupPct(e.target.value)}
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <span className="w-24 text-right text-gray-700 font-medium">
                    + {fmt2(markupAmount)} $
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-gray-600 flex-1">Escompte ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <span className="w-24 text-right text-gray-700 font-medium">
                    - {fmt2(discountAmount)} $
                  </span>
                </div>

                <div className="border-t border-gray-200 pt-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      id="gst"
                      type="checkbox"
                      checked={applyGST}
                      onChange={(e) => setApplyGST(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <label htmlFor="gst" className="text-gray-600 flex-1 cursor-pointer">
                      TPS (5%)
                    </label>
                    <span className="w-24 text-right text-gray-700">{fmt2(gstAmt)} $</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="qst"
                      type="checkbox"
                      checked={applyQST}
                      onChange={(e) => setApplyQST(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <label htmlFor="qst" className="text-gray-600 flex-1 cursor-pointer">
                      TVQ (9.975%)
                    </label>
                    <span className="w-24 text-right text-gray-700">{fmt2(qstAmt)} $</span>
                  </div>
                </div>

                <div className="border-t-2 border-gray-300 pt-2">
                  <div className="flex justify-between font-semibold text-base text-gray-900">
                    <span>TOTAL</span>
                    <span>{fmt2(grandTotal)} $</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-2 grid grid-cols-3 gap-2 text-xs text-gray-500">
                  <div>Main-d&apos;œuvre: <strong className="text-gray-700">{fmt2(laborCost)} $</strong></div>
                  <div>Matériaux: <strong className="text-gray-700">{fmt2(materialCost)} $</strong></div>
                  <div>Équipement: <strong className="text-gray-700">{fmt2(equipCost)} $</strong></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: RÉSUMÉ ───────────────────────────────────────────────────── */}
        {activeTab === 'resume' && (
          <div className="p-6 space-y-6">
            <h2 className="text-base font-semibold text-gray-900">Résumé de l&apos;estimation</h2>

            {/* Surface summary */}
            {surfaceResults ? (
              <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Surfaces</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-gray-500">Murs nets</span>
                  <span className="text-right font-medium">{fmt2(surfaceResults.netWalls)} pi² ({fmtM2(surfaceResults.netWalls)} m²)</span>
                  <span className="text-gray-500">Toit</span>
                  <span className="text-right font-medium">{fmt2(surfaceResults.roof)} pi² ({fmtM2(surfaceResults.roof)} m²)</span>
                  <span className="text-gray-500">Surface peinture totale</span>
                  <span className="text-right font-medium">{fmt2(surfaceResults.totalPaintArea)} pi² ({fmtM2(surfaceResults.totalPaintArea)} m²)</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Aucun calcul de surface disponible.</p>
            )}

            {/* Price summary */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Prix</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-gray-500">Sous-total</span>
                <span className="text-right font-medium">{fmt2(subtotal)} $</span>
                <span className="text-gray-500">Majoration ({markupPct}%)</span>
                <span className="text-right font-medium">+ {fmt2(markupAmount)} $</span>
                {discountAmount > 0 && (
                  <>
                    <span className="text-gray-500">Escompte</span>
                    <span className="text-right font-medium text-red-600">- {fmt2(discountAmount)} $</span>
                  </>
                )}
                {applyGST && (
                  <>
                    <span className="text-gray-500">TPS (5%)</span>
                    <span className="text-right">{fmt2(gstAmt)} $</span>
                  </>
                )}
                {applyQST && (
                  <>
                    <span className="text-gray-500">TVQ (9.975%)</span>
                    <span className="text-right">{fmt2(qstAmt)} $</span>
                  </>
                )}
                <span className="font-bold text-gray-900 pt-2 border-t border-gray-200 mt-1">TOTAL</span>
                <span className="text-right font-bold text-gray-900 pt-2 border-t border-gray-200 mt-1">{fmt2(grandTotal)} $</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveEstimate}
                disabled={savingEstimate || estimateSaved}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {savingEstimate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {estimateSaved ? 'Estimation sauvegardée' : 'Sauvegarder l\'estimation'}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FileText className="h-4 w-4" />
                Générer PDF
              </button>
            </div>

            {saveError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {saveError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Inline styles for input-base utility */}
      <style>{`
        .input-base {
          display: block;
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid #d1d5db;
          background-color: #fff;
          padding: 0.375rem 0.75rem;
          font-size: 0.875rem;
          color: #111827;
          box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
        }
        .input-base:focus {
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
        }
      `}</style>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  )
}

function SurfaceRow({
  label,
  sqft,
  bold,
  highlight,
  negative,
  note,
}: {
  label: string
  sqft: number
  bold?: boolean
  highlight?: boolean
  negative?: boolean
  note?: string
}) {
  const rowClass = highlight
    ? 'bg-blue-50'
    : bold
    ? 'bg-gray-50'
    : ''
  const textClass = bold ? 'font-semibold text-gray-900' : 'text-gray-700'

  return (
    <tr className={rowClass}>
      <td className={`px-4 py-2 ${textClass}`}>{label}</td>
      <td className={`px-4 py-2 text-right ${textClass} ${negative ? 'text-red-600' : ''}`}>
        {negative ? '-' : ''}{sqft.toFixed(1)} {note ?? ''}
      </td>
      <td className={`px-4 py-2 text-right text-gray-500`}>
        {note ? '—' : `${(sqft * SQ_FT_TO_SQ_M).toFixed(2)}`}
      </td>
    </tr>
  )
}

function MatRow({ label, qty, unit }: { label: string; qty: number; unit: string }) {
  return (
    <tr>
      <td className="px-4 py-2 text-gray-700">{label}</td>
      <td className="px-4 py-2 text-right font-semibold text-gray-900">{qty}</td>
      <td className="px-4 py-2 text-gray-500">{unit}</td>
    </tr>
  )
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-gray-700">
      <span>{label}</span>
      <span className="font-medium">{value.toFixed(2)} $</span>
    </div>
  )
}

function LineItemRow({
  item,
  onUpdate,
  onRemove,
  canRemove,
}: {
  item: LineItem
  onUpdate: (id: string, field: keyof LineItem, value: string | boolean) => void
  onRemove: (id: string) => void
  canRemove: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Category */}
        <select
          value={item.category}
          onChange={(e) => onUpdate(item.id, 'category', e.target.value)}
          className="w-28 shrink-0 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
        >
          {(Object.keys(CATEGORY_LABELS) as ItemCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>

        {/* Description */}
        <input
          type="text"
          placeholder="Description"
          value={item.description}
          onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
        />

        {/* Qty */}
        <input
          type="number"
          min="0"
          step="any"
          value={item.quantity}
          onChange={(e) => onUpdate(item.id, 'quantity', e.target.value)}
          className="w-16 shrink-0 rounded border border-gray-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
        />

        {/* Unit */}
        <select
          value={item.unit}
          onChange={(e) => onUpdate(item.id, 'unit', e.target.value)}
          className="w-16 shrink-0 rounded border border-gray-300 bg-white px-1 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
        >
          {UNIT_OPTIONS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>

        {/* Unit price */}
        <input
          type="number"
          min="0"
          step="0.01"
          value={item.unitPrice}
          onChange={(e) => onUpdate(item.id, 'unitPrice', e.target.value)}
          className="w-20 shrink-0 rounded border border-gray-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
        />

        {/* Total */}
        <span className="w-20 shrink-0 text-right text-sm font-semibold text-gray-900">
          {total.toFixed(2)} $
        </span>

        {/* Optional toggle */}
        <label className="flex shrink-0 items-center gap-1 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={item.optional}
            onChange={(e) => onUpdate(item.id, 'optional', e.target.checked)}
            className="rounded border-gray-300 text-blue-600"
          />
          Opt.
        </label>

        {/* Expand / remove */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-600"
          aria-label="Développer"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="shrink-0 rounded p-1 text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
