// app/(dashboard)/projects/[projectId]/elevations/page.tsx
// ============================================================
// Éditeur d'élévations : positionne chaque ouverture (fenêtre/porte/garage)
// à sa VRAIE place sur le mur de sa façade → élévations exactes du rapport.
//  • Détection par vision IA (Claude) en un clic, par façade ou globale.
//  • Correction manuelle : glisser une ouverture sur le mur, ou saisir
//    X (depuis la gauche), allège, largeur, hauteur.
// Persistance directe dans surface_calculations (position_x, sill_height).
// ============================================================
'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import { Building2, Loader2, Sparkles, Plus, Trash2, TriangleAlert, Info, Box, Calculator } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { buildReportData, type ReportSurface, type HouseModelLike } from '@/lib/report/buildReportData'

interface Props { params: Promise<{ projectId: string }> }

type Side = 'front' | 'right' | 'back' | 'left'
type OpeningType = 'window' | 'door' | 'garage'

const SIDES: { side: Side; label: string }[] = [
  { side: 'front', label: 'Avant' },
  { side: 'right', label: 'Droite' },
  { side: 'back', label: 'Arrière' },
  { side: 'left', label: 'Gauche' },
]
const TYPE_LABELS: Record<OpeningType, string> = { window: 'Fenêtre', door: 'Porte', garage: 'Garage' }
const ROOF_LABELS: Record<string, string> = { gable: 'pignon', hip: 'croupe', flat: 'plat', shed: 'appentis' }

interface Opening {
  id: string
  facade_side: Side
  surface_type: OpeningType
  label: string | null
  length: number   // largeur (unité réelle)
  height: number   // hauteur
  position_x: number | null
  sill_height: number | null
  detected_by: 'manual' | 'ai' | 'photogrammetry' | null
  unit: string
}

export default function ElevationsPage({ params }: Props) {
  const { projectId } = use(params)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openings, setOpenings] = useState<Opening[]>([])
  const [dims, setDims] = useState({ width: 0, depth: 0, wallHeight: 9, imperial: true })
  const [roofType, setRoofType] = useState<string | null>('gable')
  const [roofPitch, setRoofPitch] = useState<number>(6)
  const [estimate, setEstimate] = useState<{ pitch?: number; confidence?: number; photosUsed?: number } | null>(null)
  const [facadeConf, setFacadeConf] = useState<Record<string, number>>({})
  const [summary, setSummary] = useState<SurfaceSummaryData | null>(null)
  const [detecting, setDetecting] = useState<Side | 'all' | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [building3d, setBuilding3d] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const [{ data: surfaces }, { data: house }, { data: project }] = await Promise.all([
        supabase.from('surface_calculations').select('*').eq('project_id', projectId),
        supabase.from('house_models').select('footprint_json, roof_type, wall_height, geometry_json')
          .eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('projects').select('unit_system').eq('id', projectId).single(),
      ])

      const geo = (house?.geometry_json ?? null) as { method?: string; roof_pitch?: number; confidence?: number; photos_used?: number; facade_confidence?: Record<string, number> } | null
      const houseModel = house
        ? ({ footprint_json: house.footprint_json, roof_type: house.roof_type, wall_height: house.wall_height, roof_pitch: geo?.roof_pitch ?? null } as HouseModelLike)
        : null

      const data = buildReportData((surfaces as ReportSurface[]) ?? [], houseModel)
      const imperial = project?.unit_system !== 'metric'
      setDims({ width: data.dims.width, depth: data.dims.depth, wallHeight: data.dims.wallHeight, imperial })
      setRoofType(data.footprint.roofType)
      setRoofPitch(data.dims.pitch)
      setEstimate(geo?.method === 'ai-photo-estimate'
        ? { pitch: geo.roof_pitch ?? data.dims.pitch, confidence: geo.confidence, photosUsed: geo.photos_used }
        : null)
      setFacadeConf(geo?.facade_confidence ?? {})
      setSummary({
        wallArea: data.wallArea, roofArea: data.roofTotalArea, trimArea: data.trimArea,
        windowCount: data.windowCount, doorCount: data.doorCount,
        areaUnit: data.areaUnit, roofEstimated: data.roofEstimated,
      })

      const ops: Opening[] = ((surfaces as ReportSurface[]) ?? [])
        .filter((s) => ['window', 'door', 'garage'].includes(s.surface_type ?? '') &&
          ['front', 'right', 'back', 'left'].includes(s.facade_side ?? ''))
        .map((s) => ({
          id: s.id,
          facade_side: s.facade_side as Side,
          surface_type: (s.surface_type ?? 'window') as OpeningType,
          label: s.label,
          length: s.length ?? 3,
          height: s.height ?? 4,
          position_x: s.position_x ?? null,
          sill_height: s.sill_height ?? null,
          detected_by: s.detected_by ?? null,
          unit: s.unit ?? 'ft',
        }))
      setOpenings(ops)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  // ── Persistance d'une ouverture (update champs position/dimensions) ─────────
  const persist = useCallback(async (op: Opening) => {
    const supabase = createClient()
    // Toute édition/déplacement promeut l'ouverture en « manuel » → elle est
    // préservée lors d'une ré-estimation par IA (qui ne remplace que les 'ai').
    await supabase.from('surface_calculations').update({
      position_x: op.position_x,
      sill_height: op.sill_height,
      length: op.length,
      height: op.height,
      gross_area: +(op.length * op.height).toFixed(3),
      detected_by: 'manual',
      updated_at: new Date().toISOString(),
    }).eq('id', op.id)
  }, [])

  const updateLocal = (id: string, patch: Partial<Opening>) =>
    setOpenings((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))

  const commitField = (id: string, patch: Partial<Opening>) => {
    setOpenings((prev) => {
      const next = prev.map((o) => (o.id === id ? { ...o, ...patch } : o))
      const op = next.find((o) => o.id === id)
      if (op) void persist(op)
      return next
    })
  }

  const addOpening = async (side: Side, type: OpeningType) => {
    const supabase = createClient()
    const sideWidth = side === 'front' || side === 'back' ? dims.width : dims.depth
    const defaults = type === 'garage'
      ? { length: 9, height: 7, sill_height: 0 }
      : type === 'door'
        ? { length: 3, height: 6.7, sill_height: 0 }
        : { length: 3, height: 4, sill_height: 3 }
    const count = openings.filter((o) => o.surface_type === type).length + 1
    const label = `${type === 'window' ? 'W' : type === 'door' ? 'D' : 'G'}${count}`
    const { data, error: insErr } = await supabase.from('surface_calculations').insert({
      project_id: projectId,
      facade_side: side,
      surface_type: type,
      label,
      length: defaults.length,
      height: defaults.height,
      gross_area: +(defaults.length * defaults.height).toFixed(3),
      opening_area: 0,
      position_x: Math.max(0, sideWidth / 2 - defaults.length / 2),
      sill_height: defaults.sill_height,
      detected_by: 'manual',
      unit: dims.imperial ? 'ft' : 'm',
    }).select().single()
    if (insErr || !data) { flash(`Erreur: ${insErr?.message ?? 'ajout impossible'}`); return }
    const s = data as ReportSurface
    setOpenings((prev) => [...prev, {
      id: s.id, facade_side: side, surface_type: type, label: s.label,
      length: s.length ?? defaults.length, height: s.height ?? defaults.height,
      position_x: s.position_x ?? null, sill_height: s.sill_height ?? null,
      detected_by: 'manual', unit: s.unit ?? 'ft',
    }])
  }

  const deleteOpening = async (id: string) => {
    const supabase = createClient()
    await supabase.from('surface_calculations').delete().eq('id', id)
    setOpenings((prev) => prev.filter((o) => o.id !== id))
  }

  const detect = async (side: Side | 'all') => {
    setDetecting(side)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/detect-openings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(side === 'all' ? {} : { facade: side }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      if (body.error) { flash(body.error); return }
      const warn = (body.warnings ?? []).length ? ` (${body.warnings.length} avertissement(s))` : ''
      flash(`${body.detected ?? 0} ouverture(s) détectée(s)${warn}`)
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDetecting(null)
    }
  }

  // Estimation complète du bâtiment (dimensions + toit + murs + ouvertures) depuis les photos.
  const estimateFromPhotos = async () => {
    setEstimating(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/estimate-from-photos`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      if (body.error) { flash(body.error); return }
      const kept = body.manualKept ? ` · ${body.manualKept} manuelle(s) conservée(s)` : ''
      flash(`Bâtiment estimé : ${fmt(body.dimensions?.width ?? 0, dims.imperial)} × ${fmt(body.dimensions?.depth ?? 0, dims.imperial)} · ${body.openings ?? 0} ouverture(s)${kept}`)
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEstimating(false)
    }
  }

  // Génère le modèle 3D paramétrique à partir des dimensions estimées.
  const generate3D = async () => {
    setBuilding3d(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/reconstruct`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'parametric' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      flash('Modèle 3D généré depuis les dimensions estimées — voir l’onglet Modèle 3D.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBuilding3d(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>
  }

  const noDims = dims.width <= 0 && dims.depth <= 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Élévations</h2>
          <span className="text-sm text-neutral-400">({openings.length} ouverture{openings.length > 1 ? 's' : ''})</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={estimateFromPhotos}
            disabled={estimating || detecting !== null || building3d}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {estimating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {estimate ? 'Ré-estimer depuis les photos' : 'Estimer le bâtiment depuis les photos'}
          </button>
          {estimate && (
            <button
              onClick={generate3D}
              disabled={building3d || estimating || detecting !== null}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              {building3d ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />}
              Générer le modèle 3D
            </button>
          )}
          <button
            onClick={() => detect('all')}
            disabled={estimating || detecting !== null || building3d}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            {detecting === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Ouvertures seulement
          </button>
        </div>
      </div>

      {toast && (
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          <Info className="h-4 w-4 shrink-0" />{toast}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <TriangleAlert className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="space-y-2">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          Dimensions estimées : largeur {fmt(dims.width, dims.imperial)} · profondeur {fmt(dims.depth, dims.imperial)} ·
          hauteur de mur {fmt(dims.wallHeight, dims.imperial)} · toit {ROOF_LABELS[roofType ?? 'gable'] ?? roofType}
          {roofType !== 'flat' && ` ${Math.round(roofPitch)}/12`}.
          {noDims && ' ⚠ Aucune dimension : utilisez « Estimer le bâtiment depuis les photos » ou ajoutez des surfaces de mur.'}
          {' '}La détection IA requiert une photo étiquetée par façade.
        </div>
        {estimate && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 font-medium text-white dark:bg-neutral-100 dark:text-neutral-900">
              <Sparkles className="h-3 w-3" /> Estimé par IA depuis les photos
            </span>
            {typeof estimate.photosUsed === 'number' && (
              <span className="text-neutral-500 dark:text-neutral-400">{estimate.photosUsed} photo(s) analysée(s)</span>
            )}
            {typeof estimate.confidence === 'number' && (
              <span className={`rounded-full px-2 py-0.5 font-medium ${
                estimate.confidence >= 0.75 ? 'bg-green-100 text-green-700'
                : estimate.confidence >= 0.5 ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'}`}>
                confiance {(estimate.confidence * 100).toFixed(0)} %
              </span>
            )}
            <span className="text-neutral-400">— vérifiez et ajustez les mesures au besoin</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {SIDES.map(({ side, label }) => (
          <FacadePanel
            key={side}
            side={side}
            label={label}
            widthFt={side === 'front' || side === 'back' ? dims.width : dims.depth}
            wallHeightFt={dims.wallHeight}
            imperial={dims.imperial}
            roofType={roofType}
            isGableEnd={side === 'front' || side === 'back'}
            confidence={facadeConf[side]}
            openings={openings.filter((o) => o.facade_side === side)}
            detecting={detecting === side}
            disabledDetect={detecting !== null}
            onDetect={() => detect(side)}
            onAdd={(t) => addOpening(side, t)}
            onDragLocal={updateLocal}
            onDragCommit={(id, patch) => commitField(id, patch)}
            onFieldCommit={commitField}
            onDelete={deleteOpening}
          />
        ))}
      </div>

      {summary && <SurfaceSummary data={summary} />}
    </div>
  )
}

// ── Récapitulatif des surfaces estimées + coûts ───────────────────────────────
interface SurfaceSummaryData {
  wallArea: number
  roofArea: number
  trimArea: number
  windowCount: number
  doorCount: number
  areaUnit: string
  roofEstimated: boolean
}

const CAD = (n: number) =>
  n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
const rndArea = (n: number) => Math.round(n).toLocaleString('fr-CA')
const squares = (n: number) => (Math.round((n / 100) * 10) / 10).toLocaleString('fr-CA')

function SurfaceSummary({ data }: { data: SurfaceSummaryData }) {
  // Tarifs unitaires par défaut (Québec, ordre de grandeur) — éditables.
  const [rates, setRates] = useState({ siding: 9, roof: 6, trim: 7, opening: 650 })
  const [waste, setWaste] = useState(10)

  const lines = [
    { key: 'siding', label: 'Revêtement extérieur (murs nets)', qty: data.wallArea, unit: data.areaUnit, rate: rates.siding },
    { key: 'roof', label: 'Toiture', qty: data.roofArea, unit: data.areaUnit, rate: rates.roof },
    { key: 'trim', label: 'Garnitures / soffite / fascia', qty: data.trimArea, unit: data.areaUnit, rate: rates.trim },
    { key: 'opening', label: 'Ouvertures (fenêtres + portes)', qty: data.windowCount + data.doorCount, unit: 'unité', rate: rates.opening },
  ] as const

  const subtotal = lines.reduce((s, l) => s + l.qty * l.rate, 0)
  const total = subtotal * (1 + waste / 100)

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3 flex items-center gap-2">
        <Calculator className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Surfaces estimées & coût indicatif</h3>
        {data.roofEstimated && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">toiture estimée</span>
        )}
      </div>

      {/* Cartes de surfaces */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat value={`${rndArea(data.wallArea)} ${data.areaUnit}`} sub={`${squares(data.wallArea)} carrés`} label="Revêtement (murs)" />
        <SummaryStat value={`${rndArea(data.roofArea)} ${data.areaUnit}`} sub={`${squares(data.roofArea)} carrés`} label="Toiture" />
        <SummaryStat value={`${rndArea(data.trimArea)} ${data.areaUnit}`} sub={`${squares(data.trimArea)} carrés`} label="Garnitures" />
        <SummaryStat value={String(data.windowCount + data.doorCount)} sub={`${data.windowCount} fen. · ${data.doorCount} portes`} label="Ouvertures" />
      </div>

      {/* Estimation de coût (tarifs éditables) */}
      <div className="overflow-hidden rounded-lg border border-neutral-100 dark:border-neutral-800">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 bg-neutral-50 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-neutral-400 dark:bg-neutral-900">
          <span>Poste</span><span className="text-right">Quantité</span><span className="text-right">Prix unit.</span><span className="text-right">Total</span>
        </div>
        {lines.map((l) => (
          <div key={l.key} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-t border-neutral-100 px-3 py-2 text-xs dark:border-neutral-800">
            <span className="text-neutral-700 dark:text-neutral-300">{l.label}</span>
            <span className="text-right tabular-nums text-neutral-500">{rndArea(l.qty)} {l.unit}</span>
            <span className="flex items-center justify-end gap-1">
              <input
                value={String(rates[l.key])}
                inputMode="decimal"
                onChange={(e) => setRates((r) => ({ ...r, [l.key]: parseFloat(e.target.value) || 0 }))}
                className="w-14 rounded border border-neutral-200 px-1.5 py-0.5 text-right text-xs focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              />
              <span className="text-neutral-400">$</span>
            </span>
            <span className="text-right font-medium tabular-nums text-neutral-900 dark:text-neutral-100">{CAD(l.qty * l.rate)}</span>
          </div>
        ))}
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-neutral-100 px-3 py-2 text-xs dark:border-neutral-800">
          <span className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
            Facteur de perte / installation
            <input
              value={String(waste)}
              inputMode="decimal"
              onChange={(e) => setWaste(parseFloat(e.target.value) || 0)}
              className="w-12 rounded border border-neutral-200 px-1.5 py-0.5 text-right text-xs focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
            />
            <span className="text-neutral-400">%</span>
          </span>
          <span className="text-right tabular-nums text-neutral-500">sous-total {CAD(subtotal)}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-t-2 border-neutral-900 bg-neutral-50 px-3 py-2.5 dark:border-neutral-100 dark:bg-neutral-900">
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Total indicatif</span>
          <span className="text-right text-base font-bold tabular-nums text-neutral-900 dark:text-neutral-100">{CAD(total)}</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-neutral-400">
        Estimation rapide à partir des surfaces mesurées/estimées — ajustez les tarifs. Pour un devis détaillé (matériaux, taxes, main-d&apos;œuvre), utilisez l&apos;onglet Estimation.
      </p>
    </div>
  )
}

function SummaryStat({ value, sub, label }: { value: string; sub: string; label: string }) {
  return (
    <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
      <p className="text-base font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
      <p className="text-[10px] text-neutral-400">{sub}</p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
    </div>
  )
}

// ── Formatage longueur ────────────────────────────────────────────────────────
function fmt(ft: number, imperial: boolean): string {
  if (ft <= 0) return '—'
  if (!imperial) return `${ft.toFixed(2)} m`
  const f = Math.floor(ft)
  let inch = Math.round((ft - f) * 12)
  let feet = f
  if (inch === 12) { feet += 1; inch = 0 }
  return `${feet}' ${inch}"`
}

// ── Panneau d'une façade ───────────────────────────────────────────────────────
function FacadePanel({
  side, label, widthFt, wallHeightFt, imperial, roofType, isGableEnd, confidence, openings,
  detecting, disabledDetect, onDetect, onAdd, onDragLocal, onDragCommit, onFieldCommit, onDelete,
}: {
  side: Side
  label: string
  widthFt: number
  wallHeightFt: number
  imperial: boolean
  roofType: string | null
  isGableEnd: boolean
  confidence?: number
  openings: Opening[]
  detecting: boolean
  disabledDetect: boolean
  onDetect: () => void
  onAdd: (t: OpeningType) => void
  onDragLocal: (id: string, patch: Partial<Opening>) => void
  onDragCommit: (id: string, patch: Partial<Opening>) => void
  onFieldCommit: (id: string, patch: Partial<Opening>) => void
  onDelete: (id: string) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: string; offX: number; offY: number } | null>(null)

  // Géométrie du dessin
  const W = 460, mX = 30, mTop = 14, mBot = 26
  const drawW = W - mX * 2
  const sw = widthFt > 0 ? widthFt : 32
  const wh = wallHeightFt > 0 ? wallHeightFt : 9
  const scale = drawW / sw
  const wallPx = Math.max(wh * scale, 60)
  const gableFt = (sw / 2) * 0.5
  let gablePx: number
  if (roofType === 'flat') gablePx = 8
  else if (roofType === 'shed') gablePx = Math.min(gableFt * scale, 80)
  else if (roofType === 'hip') gablePx = Math.min(gableFt * scale * 0.7, 80)
  else gablePx = isGableEnd ? Math.min(gableFt * scale, 90) : 14 // gable
  const H = mTop + gablePx + wallPx + mBot
  const xL = mX, xR = mX + drawW
  const yWallTop = mTop + gablePx
  const yWallBot = yWallTop + wallPx

  const toSvg = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: (clientX - r.left) * (W / r.width), y: (clientY - r.top) * (H / r.height) }
  }

  const geom = (o: Opening) => {
    const w = Math.max((o.length || 1) * scale, 6)
    const h = Math.min((o.height || 1) * scale, wallPx * 0.95)
    const placed = o.position_x != null && o.sill_height != null
    const x = placed ? clampN(xL + (o.position_x ?? 0) * scale, xL, xR - w) : xL + (drawW - w) / 2
    const y = placed ? clampN(yWallBot - (o.sill_height ?? 0) * scale - h, yWallTop + 2, yWallBot - h) : yWallBot - h - wallPx * 0.12
    return { x, y, w, h, placed }
  }

  const onPointerDown = (e: React.PointerEvent, o: Opening) => {
    const { x, y } = toSvg(e.clientX, e.clientY)
    const g = geom(o)
    drag.current = { id: o.id, offX: x - g.x, offY: y - g.y }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const o = openings.find((op) => op.id === drag.current!.id)
    if (!o) return
    const { x, y } = toSvg(e.clientX, e.clientY)
    const w = Math.max((o.length || 1) * scale, 6)
    const h = Math.min((o.height || 1) * scale, wallPx * 0.95)
    const newX = x - drag.current.offX
    const newTop = y - drag.current.offY
    const position_x = clampN((newX - xL) / scale, 0, Math.max(0, sw - (o.length || 1)))
    const sill_height = clampN((yWallBot - (newTop + h)) / scale, 0, Math.max(0, wh - (o.height || 1)))
    onDragLocal(o.id, { position_x: +position_x.toFixed(2), sill_height: +sill_height.toFixed(2) })
  }
  const onPointerUp = () => {
    if (!drag.current) return
    const o = openings.find((op) => op.id === drag.current!.id)
    drag.current = null
    if (o) onDragCommit(o.id, { position_x: o.position_x, sill_height: o.sill_height, detected_by: 'manual' })
  }

  const placedCount = openings.filter((o) => o.position_x != null && o.sill_height != null).length

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{label}</h3>
            {typeof confidence === 'number' && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                confidence >= 0.75 ? 'bg-green-100 text-green-700'
                : confidence >= 0.5 ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'}`}>
                IA {(confidence * 100).toFixed(0)} %
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400">
            {openings.length === 0 ? 'Aucune ouverture' :
              placedCount === openings.length ? 'positions réelles' : `${placedCount}/${openings.length} positionnée(s)`}
          </p>
        </div>
        <button
          onClick={onDetect}
          disabled={disabledDetect}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
        >
          {detecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Détecter IA
        </button>
      </div>

      {/* Schéma interactif */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none rounded-lg bg-neutral-50 dark:bg-neutral-900"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Toit : pignon (triangle) sur avant/arrière, profil d'avant-toit sur les côtés */}
        {roofType === 'flat' ? (
          <rect x={xL - 4} y={yWallTop - 8} width={drawW + 8} height={8} fill="#d9d9d9" stroke="#111" strokeWidth={1} />
        ) : roofType === 'hip' ? (
          <polygon points={`${xL},${yWallTop} ${xL + drawW * 0.24},${mTop} ${xR - drawW * 0.24},${mTop} ${xR},${yWallTop}`} fill="#ededed" stroke="#111" strokeWidth={1} />
        ) : roofType === 'shed' ? (
          <polygon points={`${xL},${mTop} ${xR},${yWallTop} ${xL},${yWallTop}`} fill="#ededed" stroke="#111" strokeWidth={1} />
        ) : isGableEnd ? (
          <polygon points={`${xL},${yWallTop} ${(xL + xR) / 2},${mTop} ${xR},${yWallTop}`} fill="#ededed" stroke="#111" strokeWidth={1} />
        ) : (
          <rect x={xL - 6} y={yWallTop - gablePx} width={drawW + 12} height={gablePx} fill="#f0f0f0" stroke="#111" strokeWidth={1} />
        )}
        {/* Mur */}
        <rect x={xL} y={yWallTop} width={drawW} height={wallPx} fill="#f4f4f4" stroke="#111" strokeWidth={1} />
        {/* Sol */}
        <line x1={xL - 6} y1={yWallBot} x2={xR + 6} y2={yWallBot} stroke="#111" strokeWidth={1.4} />
        {/* Ouvertures */}
        {openings.map((o, i) => {
          const g = geom(o)
          const fill = o.surface_type === 'window' ? '#ffffff' : o.surface_type === 'door' ? '#e9e2d4' : '#dde7ef'
          return (
            <g key={o.id} onPointerDown={(e) => onPointerDown(e, o)} style={{ cursor: 'grab' }}>
              <rect x={g.x} y={g.y} width={g.w} height={g.h} fill={fill} stroke="#111" strokeWidth={1}
                strokeDasharray={g.placed ? undefined : '3 2'} rx={1} />
              {/* pastille numérotée */}
              <circle cx={g.x} cy={g.y} r={7} fill="#111" stroke="#fff" strokeWidth={1} />
              <text x={g.x} y={g.y + 2.5} fontSize={7.5} fontWeight="bold" textAnchor="middle" fill="#fff">{i + 1}</text>
              <text x={g.x + g.w / 2} y={g.y - 4} fontSize={6.5} textAnchor="middle" fill="#6b7280">{o.label ?? ''}</text>
            </g>
          )
        })}
        {/* Cote largeur */}
        <text x={(xL + xR) / 2} y={yWallBot + 18} fontSize={8} textAnchor="middle" fill="#111">{fmt(sw, imperial)}</text>
      </svg>

      {/* Ajouter */}
      <div className="mt-3 flex flex-wrap gap-2">
        {(['window', 'door', 'garage'] as OpeningType[]).map((t) => (
          <button
            key={t}
            onClick={() => onAdd(t)}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            <Plus className="h-3 w-3" />{TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Liste éditable */}
      {openings.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-2 px-1 text-[10px] uppercase tracking-wide text-neutral-400">
            <span>Ouverture</span><span>X</span><span>Allège</span><span>Larg.</span><span>Haut.</span><span></span>
          </div>
          {openings.map((o) => (
            <div key={o.id} className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-2 rounded-lg border border-neutral-100 px-2 py-1.5 dark:border-neutral-800">
              <span className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                <span className="font-medium">{o.label ?? TYPE_LABELS[o.surface_type]}</span>
                {o.detected_by === 'ai' && <span className="rounded bg-neutral-900 px-1 py-0.5 text-[9px] text-white dark:bg-neutral-100 dark:text-neutral-900">IA</span>}
              </span>
              <NumCell value={o.position_x} onCommit={(v) => onFieldCommit(o.id, { position_x: v, detected_by: 'manual' })} />
              <NumCell value={o.sill_height} onCommit={(v) => onFieldCommit(o.id, { sill_height: v, detected_by: 'manual' })} />
              <NumCell value={o.length} onCommit={(v) => onFieldCommit(o.id, { length: v ?? o.length, detected_by: 'manual' })} />
              <NumCell value={o.height} onCommit={(v) => onFieldCommit(o.id, { height: v ?? o.height, detected_by: 'manual' })} />
              <button onClick={() => onDelete(o.id)} className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NumCell({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const [v, setV] = useState(value == null ? '' : String(value))
  useEffect(() => { setV(value == null ? '' : String(value)) }, [value])
  return (
    <input
      value={v}
      inputMode="decimal"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = parseFloat(v)
        onCommit(Number.isFinite(n) ? n : null)
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className="w-12 rounded border border-neutral-200 px-1.5 py-0.5 text-right text-xs focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
    />
  )
}

function clampN(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
