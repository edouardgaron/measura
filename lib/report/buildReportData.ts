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
  // Position 2D sur la façade (migration 015) — pour les élévations exactes.
  // position_x = décalage horizontal du bord gauche depuis le bord gauche du mur,
  // sill_height = hauteur de l'allège au-dessus du sol (même unité).
  position_x?: number | null
  sill_height?: number | null
  detected_by?: 'manual' | 'ai' | 'photogrammetry' | null
}

export interface HouseModelLike {
  footprint_json: [number, number][] | null
  roof_type: 'gable' | 'hip' | 'flat' | 'shed' | null
  wall_height: number | null
  stories?: number | null
  roof_pitch?: number | null // x/12 (estimé par IA si pas de facettes mesurées)
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
  roofEstimated: boolean // true si l'aire de toiture est dérivée de l'empreinte + pente (pas de surfaces mesurées)

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

  // Géométrie pour les schémas d'élévation
  dims: {
    width: number // façade avant/arrière
    depth: number // façades latérales
    wallHeight: number
    pitch: number // pente dominante (x/12)
  }

  // Ouvertures regroupées par élévation (pour les schémas)
  openingsBySide: Record<string, ReportSurface[]>
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
  let roofArea = sum(roofs.map(areaOf))
  const trimArea = sum(trims.map(areaOf))
  const openingArea = sum([...windows, ...doors].map(areaOf))
  let totalArea = wallArea + roofArea + trimArea

  // Aires par élévation
  const byElevation = SIDES.filter((s) => s !== 'roof' && s !== 'other')
    .map((side) => ({
      side,
      area: sum(walls.filter((w) => w.facade_side === side).map(netOf)),
    }))
    .filter((e) => e.area > 0)

  // Empreinte (calculée tôt — sert aussi à estimer la toiture)
  const fpPts = houseModel?.footprint_json ?? null
  const fpArea = fpPts && fpPts.length > 2 ? polygonArea(fpPts) : 0
  const roofType = houseModel?.roof_type ?? null
  const estPitch = houseModel?.roof_pitch ?? null

  // Toiture
  let roofFacets = roofs.map((r, i) => ({
    label: r.label ?? `RF-${i + 1}`,
    area: areaOf(r),
    pitch: r.pitch,
  }))
  let roofEstimated = false

  // Aucune surface de toit mesurée → estimer l'aire depuis l'empreinte + la pente.
  // Aire de versant = aire au sol × facteur de pente (√(1 + (pente/12)²)).
  if (roofFacets.length === 0 && fpArea > 0 && roofType && roofType !== 'flat') {
    const p = estPitch ?? 6
    const slope = Math.sqrt(1 + (p / 12) ** 2)
    const total = fpArea * slope
    roofFacets = [
      { label: 'Versant 1', area: total / 2, pitch: p },
      { label: 'Versant 2', area: total / 2, pitch: p },
    ]
    roofEstimated = true
  } else if (roofFacets.length === 0 && fpArea > 0 && roofType === 'flat') {
    roofFacets = [{ label: 'Toit plat', area: fpArea, pitch: 0 }]
    roofEstimated = true
  }

  const roofTotalArea = sum(roofFacets.map((f) => f.area))
  // Si la toiture est estimée (pas de surfaces mesurées), l'intégrer au sommaire.
  if (roofEstimated) {
    roofArea = roofTotalArea
    totalArea = wallArea + roofArea + trimArea
  }
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

  // Dimensions (depuis l'empreinte) pour les schémas d'élévation
  const xs2 = pts && pts.length ? pts.map((p) => p[0]) : []
  const ys2 = pts && pts.length ? pts.map((p) => p[1]) : []
  const width = xs2.length ? Math.max(...xs2) - Math.min(...xs2) : 0
  const depth = ys2.length ? Math.max(...ys2) - Math.min(...ys2) : 0
  const wallHeight = houseModel?.wall_height ?? (imperial ? 9 : 2.7)
  const pitch = roofPitchBreakdown[0]?.pitch ?? estPitch ?? (footprint.roofType === 'flat' ? 0 : 6)
  const dims = { width, depth, wallHeight, pitch }

  // Ouvertures par élévation, triées de gauche à droite quand la position
  // réelle est connue (sinon ordre d'origine — répartition uniforme au rendu).
  const openingsBySide: Record<string, ReportSurface[]> = {}
  for (const o of [...windows, ...doors]) {
    const k = o.facade_side ?? 'front'
    ;(openingsBySide[k] ??= []).push(o)
  }
  for (const k of Object.keys(openingsBySide)) {
    openingsBySide[k].sort((a, b) => {
      const ax = a.position_x, bx = b.position_x
      if (ax == null && bx == null) return 0
      if (ax == null) return 1
      if (bx == null) return -1
      return ax - bx
    })
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
    roofEstimated,
    trimSurfaces: trims,
    sidingWaste,
    roofWaste,
    footprint,
    dims,
    openingsBySide,
  }
}
