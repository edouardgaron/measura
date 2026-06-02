// tests/sample-artifacts.test.ts
// ------------------------------------------------------------------
// Génère, avec le VRAI code de production, des artefacts d'exemple :
//   - sample-output/modele-3d.gltf      (buildBuildingBoxes + buildGltf)
//   - sample-output/rapport-mesures.pdf (ReportTemplate complet style Hover)
// à partir de surface_calculations représentatives (maison de St-Raymond).
// Lancer :  npx vitest run tests/sample-artifacts.test.ts
// ------------------------------------------------------------------
import { test, expect } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'

import { buildBuildingBoxes } from '@/lib/photogrammetry/reconstruct'
import { buildGltf } from '@/lib/photogrammetry/gltf'
import ReportTemplate from '@/components/report/ReportTemplate'
import type { ReportSurface, HouseModelLike } from '@/lib/report/buildReportData'
import type { Project, Measurement } from '@/lib/supabase/types'

const OUT = resolve(process.cwd(), 'sample-output')
const ft = (inches: number) => inches / 12 // pouces -> pieds

// ── surfaces calculées (ce que produit l'annotation/calibration) ──────────────
let _n = 0
const id = () => `s${++_n}`

function wall(side: ReportSurface['facade_side'], label: string, gross: number, opening: number): ReportSurface {
  return {
    id: id(), facade_side: side, surface_type: 'wall', label,
    gross_area: gross, opening_area: opening, net_area: Math.max(gross - opening, 0),
    perimeter: null, length: null, height: null, pitch: null, unit: 'ft', loss_factor: 0.1,
  }
}
function roof(label: string, area: number, pitch: number): ReportSurface {
  return {
    id: id(), facade_side: 'roof', surface_type: 'roof', label,
    gross_area: area, opening_area: 0, net_area: area,
    perimeter: null, length: null, height: null, pitch, unit: 'ft', loss_factor: 0.1,
  }
}
function trim(label: string, type: ReportSurface['surface_type'], length: number, area: number): ReportSurface {
  return {
    id: id(), facade_side: 'roof', surface_type: type, label,
    gross_area: area, opening_area: 0, net_area: area,
    perimeter: null, length, height: null, pitch: null, unit: 'ft', loss_factor: 0.1,
  }
}
type Side = ReportSurface['facade_side']
// posX = décalage horizontal (pi) depuis le bord gauche du mur ; sill = hauteur d'allège (pi).
function win(label: string, wIn: number, hIn: number, side: Side = 'front', posX?: number, sill?: number): ReportSurface {
  const w = ft(wIn), h = ft(hIn)
  return {
    id: id(), facade_side: side, surface_type: 'window', label,
    gross_area: w * h, opening_area: 0, net_area: w * h,
    perimeter: null, length: w, height: h, pitch: null, unit: 'ft', loss_factor: 0.1,
    position_x: posX ?? null, sill_height: sill ?? null, detected_by: posX != null ? 'ai' : null,
  }
}
function door(label: string, wIn: number, hIn: number, side: Side = 'front', posX?: number, sill?: number): ReportSurface {
  const w = ft(wIn), h = ft(hIn)
  return {
    id: id(), facade_side: side, surface_type: 'door', label,
    gross_area: w * h, opening_area: 0, net_area: w * h,
    perimeter: null, length: w, height: h, pitch: null, unit: 'ft', loss_factor: 0.1,
    position_x: posX ?? null, sill_height: sill ?? null, detected_by: posX != null ? 'ai' : null,
  }
}

const surfaces: ReportSurface[] = [
  // Murs par élévation (revêtement)
  wall('front', 'SI-1', 215, 55),
  wall('right', 'SI-2', 196, 22),
  wall('back', 'SI-3', 205, 18),
  wall('left', 'SI-4', 196, 22),
  // Toiture (5 facettes, pentes variées)
  roof('RF-1', 37, 3), roof('RF-2', 37, 3), roof('RF-3', 627, 6), roof('RF-4', 627, 6), roof('RF-5', 208, 1),
  // Garnitures / soffite / fascia
  trim('Avant-toits (fascia)', 'fascia', ft(98 * 12 + 8), 0),
  trim('Rives (rakes)', 'fascia', ft(110 * 12 + 10), 0),
  trim('Soffite', 'soffit', 0, 429),
  // Fenêtres avant — positions RÉELLES (X depuis la gauche, allège), façade large de 29.58 pi
  win('W-105', 19, 55, 'front', 1.5, 3.2), win('W-106', 19, 55, 'front', 5.0, 3.2), win('W-107', 19, 55, 'front', 8.5, 3.2),
  win('W-108', 19, 55, 'front', 18.0, 3.2), win('W-109', 19, 55, 'front', 22.0, 3.2), win('W-110', 19, 55, 'front', 26.5, 3.2),
  // Autres élévations — sans position (repli répartition uniforme)
  win('W-111', 30, 44, 'right'), win('W-112', 30, 44, 'right'), win('W-113', 27, 36, 'right'),
  win('W-114', 30, 44, 'back'), win('W-115', 30, 44, 'back'), win('W-116', 27, 36, 'back'),
  win('W-117', 40, 36, 'left'), win('W-118', 27, 46, 'left'),
  win('W-001', 32, 21, 'back'), win('W-002', 32, 21, 'back'), win('W-003', 35, 17, 'right'), win('W-004', 37, 19, 'left'),
  // Portes — porte avant positionnée (allège au sol)
  door('D-1', 36, 80, 'front', 13.0, 0), door('SGD-1', 60, 80, 'back'),
]

// Empreinte en L (porche à l'avant) — pieds, y vers l'avant
const houseModel: HouseModelLike = {
  footprint_json: [
    [0, 2], [10.5, 2], [10.5, 0], [18.92, 0], [18.92, 2], [29.58, 2], [29.58, 35.08], [0, 35.08],
  ],
  roof_type: 'gable',
  wall_height: 9,
  stories: 1,
}

const measurements: Measurement[] = [
  m('Hauteur de mur (réf. porte 6‘08″)', 'line', 8.67, 'ft', 'front'),
  m('Périmètre au sol', 'perimeter', 143.75, 'ft', 'other'),
]
function m(label: string, type: Measurement['measurement_type'], value: number, unit: Measurement['unit'], facade: Measurement['facade_side']): Measurement {
  return {
    id: id(), photo_id: 'sample', project_id: 'sample', label, measurement_type: type, points: [],
    pixel_value: value * 100, real_value: value, unit, facade_side: facade, color: '#111', is_visible: true,
    created_by: null, created_at: '2026-06-01T12:00:00Z', updated_at: '2026-06-01T12:00:00Z',
  }
}

const project = {
  id: 'sample', title: '361 Avenue Godin', address_line1: '361 Avenue Godin', address_city: 'Saint-Raymond',
  address_province: 'QC', address_postal: 'G3L 3P7', address_country: 'CA', status: 'review', unit_system: 'imperial',
  notes: 'Estimation peinture extérieure — revêtement bois + stuc, 18 fenêtres.',
  created_at: '2026-06-01T12:00:00Z', updated_at: '2026-06-01T12:00:00Z',
} as unknown as Project

test('génère le modèle 3D glTF', () => {
  mkdirSync(OUT, { recursive: true })
  const boxes = buildBuildingBoxes(8, 10, 5.2, 'gable', { walls: '#e8d5b7', roof: '#8b5e3c', trim: '#ffffff' })
  const gltf = buildGltf(boxes)
  writeFileSync(resolve(OUT, 'modele-3d.gltf'), gltf, 'utf8')
  expect(JSON.parse(gltf).asset?.version).toBe('2.0')
})

test('génère le rapport PDF complet (style Hover)', async () => {
  mkdirSync(OUT, { recursive: true })
  const element = React.createElement(ReportTemplate, {
    project, measurements, photos: [], surfaces, houseModel,
    companyName: 'Innova Spray', locale: 'fr', propertyId: '21921408', modelId: '21955070',
  })
  const buffer = await renderToBuffer(element)
  writeFileSync(resolve(OUT, 'rapport-mesures-final.pdf'), buffer)
  expect(buffer.length).toBeGreaterThan(2000)
})
