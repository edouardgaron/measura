// tests/detect-openings.test.ts
// ------------------------------------------------------------------
// Vérifie le remappage des boîtes normalisées (réponse vision) vers les
// coordonnées RÉELLES du mur (position_x, sill_height, width, height).
// Déterministe, sans appel réseau ni clé API.
// ------------------------------------------------------------------
import { test, expect } from 'vitest'
import { mapDetections } from '@/lib/ai/detectOpenings'

test('mur absent → wallFound=false, aucune ouverture', () => {
  const r = mapDetections({ wall: null, openings: [] }, 32, 10)
  expect(r.configured).toBe(true)
  expect(r.wallFound).toBe(false)
  expect(r.openings).toHaveLength(0)
})

test('remappe une fenêtre dans le repère du mur', () => {
  const raw = {
    wall: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    openings: [{ type: 'window', box: { x: 0.3, y: 0.2, w: 0.1, h: 0.2 }, confidence: 0.9 }],
  }
  const r = mapDetections(raw, 32, 10)
  expect(r.wallFound).toBe(true)
  expect(r.openings).toHaveLength(1)
  const o = r.openings[0]
  expect(o.type).toBe('window')
  expect(o.position_x).toBeCloseTo(8, 3)    // (0.3-0.1)/0.8 * 32
  expect(o.width).toBeCloseTo(4, 3)         // 0.1/0.8 * 32
  expect(o.height).toBeCloseTo(2.5, 3)      // 0.2/0.8 * 10
  expect(o.sill_height).toBeCloseTo(6.25, 3) // (1 - (0.2+0.2-0.1)/0.8) * 10
  expect(o.confidence).toBeCloseTo(0.9, 3)
})

test('porte au sol → allège ≈ 0 ; tri gauche→droite', () => {
  const raw = {
    wall: { x: 0, y: 0, w: 1, h: 1 },
    openings: [
      { type: 'window', box: { x: 0.7, y: 0.3, w: 0.1, h: 0.2 } },
      { type: 'door', box: { x: 0.2, y: 0.5, w: 0.1, h: 0.5 } },
    ],
  }
  const r = mapDetections(raw, 20, 10)
  expect(r.openings.map((o) => o.type)).toEqual(['door', 'window']) // trié par position_x
  expect(r.openings[0].sill_height).toBeCloseTo(0, 3) // porte descend jusqu'au sol
})

test('boîtes invalides ou type inconnu ignorés', () => {
  const raw = {
    wall: { x: 0, y: 0, w: 1, h: 1 },
    openings: [
      { type: 'chimney', box: { x: 0.4, y: 0.1, w: 0.1, h: 0.1 } }, // type inconnu
      { type: 'window', box: { x: 0.4, y: 0.1, w: 0, h: 0.1 } },    // largeur nulle
    ],
  }
  const r = mapDetections(raw, 20, 10)
  expect(r.openings).toHaveLength(0)
})
