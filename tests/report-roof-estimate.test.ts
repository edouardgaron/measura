// tests/report-roof-estimate.test.ts
// ------------------------------------------------------------------
// Vérifie les ajouts « mesures selon les photos » côté rapport :
//   - pente de toit propagée depuis le modèle (roof_pitch),
//   - aire de toiture ESTIMÉE depuis l'empreinte + pente quand aucune
//     surface de toit n'est mesurée (roofEstimated),
//   - intégration au sommaire des aires.
// Déterministe, sans réseau.
// ------------------------------------------------------------------
import { test, expect } from 'vitest'
import { buildReportData, type ReportSurface, type HouseModelLike } from '@/lib/report/buildReportData'

// Empreinte 25 × 36 = 900 pi², toit pignon estimé à 7/12.
const footprint: [number, number][] = [[0, 0], [25, 0], [25, 36], [0, 36]]
const house: HouseModelLike = { footprint_json: footprint, roof_type: 'gable', wall_height: 9, roof_pitch: 7 }

// Murs estimés (un par façade), AUCUNE surface de toit.
const walls: ReportSurface[] = (['front', 'back', 'left', 'right'] as const).map((side, i) => ({
  id: `w${i}`, facade_side: side, surface_type: 'wall', label: `Mur ${side}`,
  gross_area: (side === 'front' || side === 'back' ? 25 : 36) * 9,
  opening_area: 0, net_area: null, perimeter: null,
  length: side === 'front' || side === 'back' ? 25 : 36, height: 9, pitch: null,
  unit: 'ft', loss_factor: 0.1,
}))

test('toiture estimée depuis empreinte + pente quand aucune surface mesurée', () => {
  const d = buildReportData(walls, house)
  const slope = Math.sqrt(1 + (7 / 12) ** 2) // ≈ 1.1577
  expect(d.roofEstimated).toBe(true)
  expect(d.roofTotalArea).toBeCloseTo(900 * slope, 0) // ≈ 1042 pi²
  expect(d.roofFacets).toHaveLength(2)               // 2 versants pour un pignon
  expect(d.dims.pitch).toBe(7)                        // pente propagée
  expect(d.roofArea).toBeCloseTo(d.roofTotalArea, 3)  // intégrée au sommaire
})

test('toit plat : aire de toiture = aire au sol', () => {
  const d = buildReportData(walls, { ...house, roof_type: 'flat', roof_pitch: 0 })
  expect(d.roofEstimated).toBe(true)
  expect(d.roofTotalArea).toBeCloseTo(900, 0)
  expect(d.dims.pitch).toBe(0)
})

test('surfaces de toit mesurées présentes → pas d’estimation', () => {
  const withRoof: ReportSurface[] = [...walls, {
    id: 'r1', facade_side: 'roof', surface_type: 'roof', label: 'RF-1',
    gross_area: 600, opening_area: 0, net_area: 600, perimeter: null,
    length: null, height: null, pitch: 6, unit: 'ft', loss_factor: 0.1,
  }]
  const d = buildReportData(withRoof, house)
  expect(d.roofEstimated).toBe(false)
  expect(d.roofTotalArea).toBeCloseTo(600, 3) // valeur mesurée, pas estimée
  expect(d.dims.pitch).toBe(6)                // pente de la facette mesurée
})
