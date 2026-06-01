import { describe, it, expect } from 'vitest'
import { buildPlanData } from '@/lib/plans/geometry'
import { buildPlanDxf } from '@/lib/plans/dxf'
import { buildPlanIfc } from '@/lib/plans/ifc'
import { buildGltf } from '@/lib/photogrammetry/gltf'
import { toCsv } from '@/lib/accounting/csv'
import { renderTemplate, leadVars } from '@/lib/messaging/render'

const plan = buildPlanData({ unit_system: 'metric' }, null, [], [])

describe('géométrie de plans', () => {
  it('produit des dimensions par défaut quand aucune donnée', () => {
    expect(plan.unit).toBe('m')
    expect(plan.width).toBeGreaterThan(0)
    expect(plan.depth).toBeGreaterThan(0)
    expect(plan.estimated).toBe(true)
    expect(plan.facades).toHaveLength(4)
  })
})

describe('export DXF', () => {
  it('génère un DXF ASCII valide', () => {
    const dxf = buildPlanDxf(plan)
    expect(dxf).toContain('SECTION')
    expect(dxf).toContain('ENTITIES')
    expect(dxf.trim().endsWith('EOF')).toBe(true)
  })
})

describe('export IFC', () => {
  it('génère un IFC4 STEP avec hiérarchie projet', () => {
    const ifc = buildPlanIfc(plan, 'Maison Test')
    expect(ifc.startsWith('ISO-10303-21;')).toBe(true)
    expect(ifc).toContain('FILE_SCHEMA((\'IFC4\'))')
    expect(ifc).toContain('IFCPROJECT')
    expect(ifc).toContain('IFCEXTRUDEDAREASOLID')
    expect(ifc.trim().endsWith('END-ISO-10303-21;')).toBe(true)
  })
})

describe('génération glTF (photogrammétrie paramétrique)', () => {
  it('produit un glTF 2.0 parseable', () => {
    const gltf = buildGltf([
      { center: [0, 1, 0], size: [4, 2, 4], color: '#ffffff' },
      { center: [0, 2.5, 0], size: [4, 1, 4], color: '#8b5e3c' },
    ])
    const json = JSON.parse(gltf)
    expect(json.asset.version).toBe('2.0')
    expect(json.meshes[0].primitives).toHaveLength(2)
    expect(json.accessors).toHaveLength(4) // 2 POSITION + 2 indices
    expect(json.buffers[0].uri.startsWith('data:application/octet-stream;base64,')).toBe(true)
  })
})

describe('export CSV comptable', () => {
  it('échappe les champs et préfixe un BOM', () => {
    const csv = toCsv(['A', 'B'], [['x', 'y, z'], ['1', 'a"b']])
    expect(csv.charCodeAt(0)).toBe(0xfeff) // BOM
    expect(csv).toContain('"y, z"')
    expect(csv).toContain('"a""b"')
  })
})

describe('modèles de messages', () => {
  it('substitue les variables {{...}}', () => {
    const vars = leadVars({ name: 'Toiture', contact_name: 'Jean Tremblay', estimated_value: 12000 }, 'ABC Construction')
    const out = renderTemplate('Bonjour {{contact_name}}, suivi pour {{name}} — {{company}}', vars)
    expect(out).toBe('Bonjour Jean Tremblay, suivi pour Toiture — ABC Construction')
  })
  it('vide les variables inconnues', () => {
    expect(renderTemplate('X {{inconnu}} Y', {})).toBe('X  Y')
  })
})
