// lib/measurement/surfaceCalculator.ts

/**
 * Surface Calculation Engine for Measura
 * All measurements use imperial units (feet) as the base.
 * 1 square foot = 0.0929 m²
 */

export const SQ_FT_TO_SQ_M = 0.092903

// ─────────────────────────────────────────────────────────────────────────────
// STANDARD OPENING SIZES (feet)
// ─────────────────────────────────────────────────────────────────────────────

/** Standard opening dimensions in feet (width × height) */
export const STANDARD_OPENINGS = {
  door_standard:      { width: 3,    height: 6.83 },
  door_french:        { width: 5.5,  height: 6.83 },
  door_garage_single: { width: 9,    height: 7    },
  door_garage_double: { width: 16,   height: 7    },
  window_small:       { width: 2,    height: 2    },
  window_medium:      { width: 3,    height: 4    },
  window_large:       { width: 4,    height: 5    },
  window_picture:     { width: 6,    height: 4    },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// CORE GEOMETRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate gross wall area for a rectangular facade.
 * @param width - Wall width in feet
 * @param height - Wall height in feet
 * @returns Gross area in square feet
 */
export function calcWallArea(width: number, height: number): number {
  return width * height
}

/**
 * Calculate pitch multiplier — converts horizontal (plan) area to sloped area.
 * Formula: sqrt(rise² + 12²) / 12
 * @param pitchRise - Rise in inches per 12" run (e.g. 5 for a 5/12 pitch)
 * @returns Dimensionless multiplier (always >= 1.0)
 */
export function pitchMultiplier(pitchRise: number): number {
  return Math.sqrt(pitchRise * pitchRise + 144) / 12
}

/**
 * Calculate the area of a single gable triangle.
 * @param span - Total width of the house (feet)
 * @param pitchRise - Inches of rise per 12" run
 * @returns Gable triangle area in square feet
 */
export function calcGableArea(span: number, pitchRise: number): number {
  // height of gable = (span / 2) * (pitchRise / 12)
  const riseHeight = (span / 2) * (pitchRise / 12)
  return 0.5 * span * riseHeight
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOF AREA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate gross roof area from footprint dimensions and pitch.
 * Supported types: gable, hip, flat, shed.
 *
 * @param params.ridgeLength  - Length of the ridge / depth of house (feet)
 * @param params.span         - Total span / width of house (feet)
 * @param params.pitchRise    - Inches of rise per 12" run (e.g. 5 for 5/12)
 * @param params.roofType     - One of 'gable' | 'hip' | 'flat' | 'shed'
 * @returns Gross sloped roof area in square feet
 */
export function calcRoofArea(params: {
  ridgeLength: number
  span: number
  pitchRise: number
  roofType: 'gable' | 'hip' | 'flat' | 'shed'
}): number {
  const { ridgeLength, span, pitchRise, roofType } = params
  const mult = pitchMultiplier(pitchRise)
  const horizontalFootprint = span * ridgeLength

  switch (roofType) {
    case 'flat':
      // No pitch multiplier for flat roofs
      return horizontalFootprint

    case 'gable':
      // Two rectangular sloped planes
      return horizontalFootprint * mult

    case 'shed':
      // Single sloped plane — same math as half a gable roof but full footprint
      return horizontalFootprint * mult

    case 'hip': {
      /**
       * Hip roof — four sloped planes.
       * The two end planes are triangles; the two long planes are trapezoids.
       * Using the standard approximation: area ≈ footprint × pitch multiplier.
       * This is accurate when ridge is shorter than span (normal hip).
       */
      return horizontalFootprint * mult
    }

    default:
      return horizontalFootprint * mult
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OPENINGS / NET AREA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate net wall area after subtracting openings and adding waste factor.
 *
 * @param params.grossArea  - Gross wall area in square feet
 * @param params.openings   - Array of openings with width, height, and optional count
 * @param params.lossFactor - Waste/overlap factor (default 0.10 = 10%)
 * @returns Object with gross, openings total, net, and net-with-loss areas
 */
export function calcNetWallArea(params: {
  grossArea: number
  openings: Array<{ width: number; height: number; count?: number }>
  lossFactor?: number
}): { gross: number; openings: number; net: number; withLoss: number } {
  const { grossArea, openings, lossFactor = 0.10 } = params

  const openingArea = openings.reduce((sum, o) => {
    const count = o.count ?? 1
    return sum + o.width * o.height * count
  }, 0)

  const net = Math.max(0, grossArea - openingArea)
  const withLoss = net * (1 + lossFactor)

  return {
    gross: grossArea,
    openings: openingArea,
    net,
    withLoss,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFFIT & FASCIA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate soffit area (underside of roof overhang).
 * @param params.perimeter - Total perimeter of the house (feet)
 * @param params.overhang  - Horizontal overhang depth (feet)
 * @returns Soffit area in square feet
 */
export function calcSoffitArea(params: {
  perimeter: number
  overhang: number
}): number {
  return params.perimeter * params.overhang
}

/**
 * Calculate fascia linear feet (equals house perimeter).
 * @param perimeter - House perimeter in feet
 * @returns Fascia length in linear feet
 */
export function calcFasciaLength(perimeter: number): number {
  return perimeter
}

// ─────────────────────────────────────────────────────────────────────────────
// PAINT QUANTITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the number of gallons of paint required.
 * @param params.area              - Net paintable area in square feet
 * @param params.coats             - Number of coats (default 2)
 * @param params.coveragePerGallon - Square feet covered per gallon (default 400)
 * @returns Gallons needed, rounded up to the nearest 0.5 gallon
 */
export function calcPaintGallons(params: {
  area: number
  coats?: number
  coveragePerGallon?: number
}): number {
  const { area, coats = 2, coveragePerGallon = 400 } = params
  const raw = (area * coats) / coveragePerGallon
  // Round up to nearest half gallon
  return Math.ceil(raw * 2) / 2
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL EXTERIOR SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full exterior surface summary computed from basic house dimensions.
 *
 * Wall openings assumed per opening count:
 *  - doors:   1× door_standard per door
 *  - windows: 1× window_medium per window
 *  - garages: 1× door_garage_double per garage door
 *
 * @param params.width      - House width in feet (front/back faces)
 * @param params.depth      - House depth in feet (left/right faces)
 * @param params.wallHeight - Wall height in feet (eave height)
 * @param params.roofType   - Type of roof structure
 * @param params.pitchRise  - Roof pitch rise (inches per 12"), default 5
 * @param params.overhang   - Roof overhang depth in feet, default 1
 * @param params.openings   - Counts of doors, windows, and garage doors
 *
 * @returns Detailed surface breakdown in square feet (walls, gables, roof, etc.)
 */
export function calcExteriorSummary(params: {
  width: number
  depth: number
  wallHeight: number
  roofType: 'gable' | 'hip' | 'flat' | 'shed'
  pitchRise?: number
  overhang?: number
  openings: {
    doors: number
    windows: number
    garages: number
  }
}): {
  walls: { front: number; back: number; left: number; right: number; total: number }
  gables: number
  roof: number
  soffit: number
  fascia: number
  openings: number
  netWalls: number
  totalPaintArea: number
} {
  const {
    width,
    depth,
    wallHeight,
    roofType,
    pitchRise = 5,
    overhang = 1,
    openings,
  } = params

  // ── Wall faces ──────────────────────────────────────────────────────────
  const front  = calcWallArea(width, wallHeight)
  const back   = calcWallArea(width, wallHeight)
  const left   = calcWallArea(depth, wallHeight)
  const right  = calcWallArea(depth, wallHeight)
  const totalWalls = front + back + left + right

  // ── Gables (only for gable and shed roofs) ───────────────────────────────
  let gables = 0
  if (roofType === 'gable') {
    // Two gable triangles, one on each end (left & right faces)
    gables = calcGableArea(width, pitchRise) * 2
  } else if (roofType === 'shed') {
    // Single gable on one end
    gables = calcGableArea(width, pitchRise)
  }

  // ── Roof ────────────────────────────────────────────────────────────────
  const roof = calcRoofArea({
    ridgeLength: depth,
    span: width,
    pitchRise,
    roofType,
  })

  // ── Perimeter and overhang elements ─────────────────────────────────────
  const perimeter = 2 * (width + depth)
  const soffit    = calcSoffitArea({ perimeter, overhang })
  const fascia    = calcFasciaLength(perimeter)

  // ── Openings ─────────────────────────────────────────────────────────────
  const openingsList: Array<{ width: number; height: number; count?: number }> = []

  if (openings.doors > 0) {
    openingsList.push({
      ...STANDARD_OPENINGS.door_standard,
      count: openings.doors,
    })
  }
  if (openings.windows > 0) {
    openingsList.push({
      ...STANDARD_OPENINGS.window_medium,
      count: openings.windows,
    })
  }
  if (openings.garages > 0) {
    openingsList.push({
      ...STANDARD_OPENINGS.door_garage_double,
      count: openings.garages,
    })
  }

  const openingArea = openingsList.reduce((sum, o) => {
    const count = o.count ?? 1
    return sum + o.width * o.height * count
  }, 0)

  // ── Net walls (walls + gables − openings) ────────────────────────────────
  const netWalls = Math.max(0, totalWalls + gables - openingArea)

  // ── Total paintable area (walls, gables, soffit) ─────────────────────────
  const totalPaintArea = netWalls + soffit

  return {
    walls: {
      front,
      back,
      left,
      right,
      total: totalWalls,
    },
    gables,
    roof,
    soffit,
    fascia,
    openings: openingArea,
    netWalls,
    totalPaintArea,
  }
}
