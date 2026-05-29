// lib/measurements/formulas.ts
// Measurement formulas that complement lib/measurement/surfaceCalculator.ts.
// This file only contains what is NOT already in surfaceCalculator.ts.

// Pitch multipliers keyed by rise (inches per 12" run)
export const PITCH_MULTIPLIERS: Record<number, number> = {
  3: 1.031,
  4: 1.054,
  5: 1.083,
  6: 1.118,
  7: 1.158,
  8: 1.202,
  9: 1.25,
  10: 1.302,
  11: 1.357,
  12: 1.414,
}

export interface Opening {
  width: number
  height: number
}

export interface WallAreaResult {
  gross: number
  openingsArea: number
  net: number
}

/**
 * Calculate wall area for a single rectangular face, accounting for openings.
 * @param width - Wall width in feet
 * @param height - Wall height in feet
 * @param openings - Array of openings (doors, windows) with width and height in feet
 * @returns Gross area, total openings area, and net area (all in sq ft)
 */
export function calculateWallArea(
  width: number,
  height: number,
  openings: Opening[]
): WallAreaResult {
  const gross = width * height
  const openingsArea = openings.reduce(
    (sum, o) => sum + o.width * o.height,
    0
  )
  const net = Math.max(0, gross - openingsArea)
  return { gross, openingsArea, net }
}

/**
 * Calculate sloped roof area from projected (plan view) area and pitch.
 * Uses the pitch multiplier: sqrt(rise² + 144) / 12
 * @param projectedArea - Horizontal footprint area in sq ft
 * @param pitchRise - Inches of rise per 12" run
 * @returns Sloped roof area in sq ft
 */
export function calculateRoofArea(projectedArea: number, pitchRise: number): number {
  // Use lookup table if available, otherwise compute dynamically
  const multiplier =
    PITCH_MULTIPLIERS[pitchRise] ?? Math.sqrt(pitchRise * pitchRise + 144) / 12
  return projectedArea * multiplier
}

/**
 * Calculate gutter length (gutters run along the eaves = house perimeter).
 * @param perimeter - House perimeter in feet
 * @returns Gutter length in linear feet
 */
export function calculateGutterLength(perimeter: number): number {
  return perimeter
}

/**
 * Calculate soffit area (underside of roof overhang).
 * @param perimeter - House perimeter in feet
 * @param overhangWidth - Horizontal overhang depth in feet
 * @returns Soffit area in sq ft
 */
export function calculateSoffitArea(perimeter: number, overhangWidth: number): number {
  return perimeter * overhangWidth
}

// Conversion factors to feet
const TO_FEET: Record<string, number> = {
  ft: 1,
  m: 1 / 0.3048,
  in: 1 / 12,
  cm: 1 / 30.48,
}

// Conversion factors from feet
const FROM_FEET: Record<string, number> = {
  ft: 1,
  m: 0.3048,
  in: 12,
  cm: 30.48,
}

type LengthUnit = 'ft' | 'm' | 'in' | 'cm'

/**
 * Convert a length value between units.
 * Conversion chain: from → feet → to
 * @param value - Input value
 * @param from - Source unit
 * @param to - Target unit
 * @returns Converted value
 */
export function convertUnits(
  value: number,
  from: LengthUnit,
  to: LengthUnit
): number {
  if (from === to) return value
  const inFeet = value * TO_FEET[from]
  return inFeet * FROM_FEET[to]
}
