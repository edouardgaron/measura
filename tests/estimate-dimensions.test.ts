// tests/estimate-dimensions.test.ts
// ------------------------------------------------------------------
// Vérifie l'estimation des dimensions réelles d'une façade par objet de
// référence (estimateFacadeScale) et la réconciliation multi-façades
// (reconcileDimensions). Déterministe, sans appel réseau ni clé API.
// ------------------------------------------------------------------
import { test, expect } from 'vitest'
import {
  estimateFacadeScale,
  reconcileDimensions,
  pickReference,
  type FacadeScale,
} from '@/lib/ai/estimateDimensions'

test('échelle par porte standard (métrique)', () => {
  const raw = {
    wall: { x: 0.05, y: 0.1, w: 0.9, h: 0.8 },
    openings: [{ type: 'door', box: { x: 0.4, y: 0.5, w: 0.08, h: 0.4 }, confidence: 0.9 }],
  }
  const s = estimateFacadeScale(raw, 4 / 3, true)
  expect(s).not.toBeNull()
  // unitPerFracH = 2.03 / 0.4 = 5.075
  expect(s!.height).toBeCloseTo(4.06, 2)            // 0.8 × 5.075
  expect(s!.width).toBeCloseTo(6.09, 2)             // 0.9 × 1.3333 × 5.075
  expect(s!.reference).toBe('door')
  expect(s!.confidence).toBeCloseTo(0.9, 2)          // 1.0 × 0.9 × 1
})

test('préfère la porte à la fenêtre même si la fenêtre est plus grande', () => {
  const ref = pickReference([
    { type: 'window', box: { x: 0.1, y: 0.1, w: 0.2, h: 0.5 }, confidence: 0.9 },
    { type: 'door', box: { x: 0.4, y: 0.5, w: 0.08, h: 0.3 }, confidence: 0.7 },
  ])
  expect(ref?.kind).toBe('door')
})

test('aucun objet de référence → null', () => {
  const s = estimateFacadeScale({ wall: { x: 0, y: 0, w: 0.9, h: 0.8 }, openings: [] }, 1.33, true)
  expect(s).toBeNull()
})

test('mur absent → null', () => {
  const raw = { wall: null, openings: [{ type: 'door', box: { x: 0.4, y: 0.5, w: 0.08, h: 0.4 } }] }
  expect(estimateFacadeScale(raw, 1.33, true)).toBeNull()
})

test('résultat hors plage plausible → confiance abaissée', () => {
  // Porte minuscule (h=0.05) → mur démesurément haut → plausibilité 0.4.
  const raw = {
    wall: { x: 0, y: 0, w: 0.9, h: 0.9 },
    openings: [{ type: 'door', box: { x: 0.4, y: 0.85, w: 0.05, h: 0.05 }, confidence: 1 }],
  }
  const s = estimateFacadeScale(raw, 1.33, true)
  expect(s!.confidence).toBeLessThan(0.5)
})

test('réconciliation front/back→largeur, left/right→profondeur, hauteur pondérée', () => {
  const scales: Partial<Record<'front' | 'back' | 'left' | 'right', FacadeScale>> = {
    front: { width: 6, height: 4, reference: 'door', confidence: 0.9 },
    back: { width: 6.4, height: 4.2, reference: 'door', confidence: 0.6 },
    left: { width: 8, height: 4, reference: 'garage', confidence: 0.8 },
  }
  const r = reconcileDimensions(scales)
  expect(r.width).toBeCloseTo(6.16, 2)     // (6×0.9 + 6.4×0.6) / 1.5
  expect(r.depth).toBeCloseTo(8, 2)        // left seul
  expect(r.height).toBeCloseTo(4.05, 2)    // (4×0.9 + 4.2×0.6 + 4×0.8) / 2.3
  expect(r.confidence).toBeCloseTo(0.77, 2)
  expect(r.walls).toHaveLength(3)
  // front et back partagent la même largeur réconciliée.
  const front = r.walls.find((w) => w.facade_side === 'front')!
  const back = r.walls.find((w) => w.facade_side === 'back')!
  expect(front.length).toBeCloseTo(back.length, 5)
  expect(front.length).toBeCloseTo(6.16, 2)
  // left utilise la profondeur.
  expect(r.walls.find((w) => w.facade_side === 'left')!.length).toBeCloseTo(8, 2)
})

test('aucune façade → dimensions nulles, aucun mur', () => {
  const r = reconcileDimensions({})
  expect(r.width).toBeNull()
  expect(r.depth).toBeNull()
  expect(r.height).toBeNull()
  expect(r.walls).toHaveLength(0)
})
