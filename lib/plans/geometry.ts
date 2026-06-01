// lib/plans/geometry.ts
// ============================================================
// Dérive les dimensions du bâtiment pour la génération de plans,
// à partir du modèle 3D (footprint) ou des surfaces/mesures.
// ============================================================

import type { HouseModel, Measurement, Project, SurfaceCalculation } from '@/lib/supabase/types'

export interface FacadeInfo {
  side: 'front' | 'back' | 'left' | 'right'
  length: number | null
  height: number | null
  area: number | null
}

export interface PlanData {
  unit: string             // 'm' ou 'ft'
  width: number            // façade avant
  depth: number            // côté
  height: number           // hauteur de mur
  footprint: [number, number][] | null
  facades: FacadeInfo[]
  estimated: boolean       // true si des valeurs par défaut ont été utilisées
}

function maxLen(rows: { length: number | null }[]): number | null {
  const vals = rows.map((r) => r.length ?? 0).filter((v) => v > 0)
  return vals.length ? Math.max(...vals) : null
}

export function buildPlanData(
  project: Pick<Project, 'unit_system'>,
  houseModel: Pick<HouseModel, 'footprint_json' | 'wall_height'> | null,
  surfaces: SurfaceCalculation[],
  measurements: Measurement[]
): PlanData {
  const metric = project.unit_system === 'metric'
  const unit = metric ? 'm' : 'ft'
  let estimated = false

  const bySide = (side: string) => surfaces.filter((s) => s.facade_side === side)

  function facadeLength(side: string): number | null {
    const fromSurface = maxLen(bySide(side))
    if (fromSurface) return fromSurface
    // depuis les mesures (lignes/périmètres de cette façade)
    const m = measurements
      .filter((x) => x.facade_side === side && x.real_value && (x.measurement_type === 'line' || x.measurement_type === 'perimeter'))
      .map((x) => x.real_value as number)
    return m.length ? Math.max(...m) : null
  }
  function facadeArea(side: string): number | null {
    const rows = bySide(side)
    const area = rows.reduce((s, r) => s + (r.net_area ?? r.gross_area ?? 0), 0)
    return area > 0 ? area : null
  }
  function facadeHeight(side: string): number | null {
    const h = bySide(side).map((s) => s.height ?? 0).filter((v) => v > 0)
    return h.length ? Math.max(...h) : null
  }

  const defaultWidth = metric ? 10 : 32
  const defaultDepth = metric ? 8 : 26
  const defaultHeight = metric ? 2.7 : 9

  let width = facadeLength('front') ?? facadeLength('back')
  let depth = facadeLength('left') ?? facadeLength('right')
  let height = houseModel?.wall_height ?? facadeHeight('front') ?? facadeHeight('left')

  if (!width) { width = defaultWidth; estimated = true }
  if (!depth) { depth = defaultDepth; estimated = true }
  if (!height) { height = defaultHeight; estimated = true }

  const footprint =
    houseModel?.footprint_json && houseModel.footprint_json.length >= 3
      ? houseModel.footprint_json
      : null

  const facades: FacadeInfo[] = (['front', 'back', 'left', 'right'] as const).map((side) => ({
    side,
    length: side === 'front' || side === 'back' ? width : depth,
    height,
    area: facadeArea(side),
  }))

  return { unit, width, depth, height, footprint, facades, estimated }
}

/** Bounding box d'un polygone. */
export function bbox(poly: [number, number][]) {
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}
