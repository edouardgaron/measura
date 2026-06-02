// lib/report/buildReportData.ts
// ============================================================
// Agrège les surface_calculations + mesures + modèle 3D d'un projet
// en une structure prête à rendre pour le rapport de mesures complet
// (style Hover). Fonction PURE — testable, sans dépendance Supabase.
// ============================================================

export interface ReportSurface {
  id: string
  facade_side: 'front' | 'back' | 'left' | 'right' | 'roof' | 'other' | null
  surface_type:
    | 'wall' | 'roof' | 'gable' | 'soffit' | 'fascia' | 'trim'
    | 'door' | 'window' | 'garage' | null
  label: string | null
  gross_area: number | null
  opening_area: number | null
  net_area: number | null
  perimeter: number | null
  length: number | null
  height: number | null
  pitch: number | null
  unit: string | null
  loss_factor: number | null
}

export interface HouseModelLike {
  footprint_json: [number, number][] | null
  roof_type: 'gable' | 'hip' | 'flat' | 'shed' | null
  wall_height: number | null
  stories?: number | null
}

export interface WasteRow {
  label: string
  area: number
  squares: number
}

export interface ReportData {
  imperial: boolean
  areaUnit: string // ft² | m²
  lenUnit: string // ft | m

  // Sommaire des aires
  wallArea: number
  roofArea: number
  trimArea: number // soffit + fascia + trim
  openingArea: number
  totalArea: number

  // Comptes
  openingCount: number
  windowCount: number
  doorCount: number

  // Aires par élévation (murs nets)
  byElevation: { side: string; area: number }[]

  // Détail des surfaces de mur (revêtement)
  wallSurfaces: ReportSurface[]

  // Ouvertures
  windows: ReportSurface[]
  doors: ReportSurface[]

  // Toiture
  roofFacets: { label: string; area: number; pitch: number | null }[]
  roofTotalArea: number
  roofPitchBreakdown: { pitch: number; area: number; pct: number }[]
  roofLines: { label: string; length: number }[] // faîtes/avant-toits/rives via fascia+trim

  // Soffite / fascia / garnitures
  trimSurfaces: ReportSurface[]

  // Facteurs de perte (carrés = aire / 100)
  sidingWaste: WasteRow[] // 0 / +10 / +18
  roofWaste: WasteRow[] // 0 / +5 / +10 / +15 / +20

  // Empreinte
  footprint: {
    points: [number, number][] | null
    perimeter: number
    area: number
    stories: number
    roofType: string | null
  }
}

const SIDES: Array<NonNullable<ReportSurface['facade_side']>> = [
  'front', 'right', 'back', 'left', 'roof', 'other',
]

function sum(list: number[]): number {
  return list.reduce((a, b) => a + b, 0)
}

function polygonArea(pts: [number, number][]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}

function polygonPerimeter(pts: [number, number][]): number {
  let p = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    p += Math.hypot(x2 - x1, y2 - y1)
  }
  return p
}

function wasteRows(base: number, factors: number[], labelFor: (f: number) => string): WasteRow[] {
  return factors.map((f) => {
    const area = base * (1 + f)
    return { label: labelFor(f), area, squares: area / 100 }
  })
}

export function buildReportData(
  surfaces: ReportSurface[],
  houseModel: HouseModelLike | null,
): ReportData {
  const imperial =
    surfaces.length === 0 || surfaces[0].unit == null || surfaces[0].unit === 'ft'
  const areaUnit = imperial ? 'ft²' : 'm²'
  const lenUnit = imperial ? 'ft' : 'm'

  const walls = surfaces.filter((s) => s.surface_type === 'wall' || s.surface_type === 'gable')
  const roofs = surfaces.filter((s) => s.surface_type === 'roof')
  const trims = surfaces.filter(
    (s) => s.surface_type === 'soffit' || s.surface_type === 'fascia' || s.surface_type === 'trim',
  )
  const windows = surfaces.filter((s) => s.surface_type === 'window')
  const doors = surfaces.filter((s) => s.surface_type === 'door' || s.surface_type === 'garage')

  const netOf = (s: ReportSurface) => s.net_area ?? Math.max((s.gross_area ?? 0) - (s.opening_area ?? 0), 0)
  const areaOf = (s: ReportSurface) => s.gross_area ?? s.net_area ?? 0

  const wallArea = sum(walls.map(netOf))
  const roofArea = sum(roofs.map(areaOf))
  const trimArea = sum(trims.map(areaOf))
  const openingArea = sum([...windows, ...doors].map(areaOf))
  const totalArea = wallArea + roofArea + trimArea

  // Aires par élévation
  const byElevation = SIDES.filter((s) => s !== 'roof' && s !== 'other')
    .map((side) => ({
      side,
      area: sum(walls.filter((w) => w.facade_side === side).map(netOf)),
    }))
    .filter((e) => e.area > 0)

  // Toiture
  const roofFacets = roofs.map((r, i) => ({
    label: r.label ?? `RF-${i + 1}`,
    area: areaOf(r),
    pitch: r.pitch,
  }))
  const roofTotalArea = sum(roofFacets.map((f) => f.area))
  const pitchMap = new Map<number, number>()
  for (const f of roofFacets) {
    const p = f.pitch ?? 0
    pitchMap.set(p, (pitchMap.get(p) ?? 0) + f.area)
  }
  const roofPitchBreakdown = [...pitchMap.entries()]
    .map(([pitch, area]) => ({ pitch, area, pct: roofTotalArea > 0 ? (area / roofTotalArea) * 100 : 0 }))
    .sort((a, b) => b.area - a.area)

  const roofLines = trims
    .filter((t) => (t.length ?? 0) > 0)
    .map((t) => ({ label: t.label ?? (t.surface_type ?? 'ligne'), length: t.length ?? 0 }))

  // Facteurs de perte
  const sidingWaste = wasteRows(wallArea, [0, 0.1, 0.18], (f) =>
    f === 0 ? 'Zéro perte' : `+${Math.round(f * 100)}%`,
  )
  const roofWaste = wasteRows(roofTotalArea, [0, 0.05, 0.1, 0.15, 0.2], (f) =>
    f === 0 ? 'Zéro perte' : `+${Math.round(f * 100)}%`,
  )

  // Empreinte
  const pts = houseModel?.footprint_json ?? null
  const footprint = {
    points: pts,
    perimeter: pts && pts.length > 2 ? polygonPerimeter(pts) : 0,
    area: pts && pts.length > 2 ? polygonArea(pts) : 0,
    stories: houseModel?.stories ?? 1,
    roofType: houseModel?.roof_type ?? null,
  }

  return {
    imperial,
    areaUnit,
    lenUnit,
    wallArea,
    roofArea,
    trimArea,
    openingArea,
    totalArea,
    openingCount: windows.length + doors.length,
    windowCount: windows.length,
    doorCount: doors.length,
    byElevation,
    wallSurfaces: walls,
    windows,
    doors,
    roofFacets,
    roofTotalArea,
    roofPitchBreakdown,
    roofLines,
    trimSurfaces: trims,
    sidingWaste,
    roofWaste,
    footprint,
  }
}
