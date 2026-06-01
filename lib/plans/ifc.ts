// lib/plans/ifc.ts
// ============================================================
// Génère un fichier IFC4 (STEP/SPF) schématique : projet → site →
// bâtiment → étage, avec un volume bâti extrudé du footprint.
// Minimal mais ouvrable dans les visionneuses IFC (BIMvision, usBIM, etc.).
// ============================================================

import type { PlanData } from '@/lib/plans/geometry'
import { bbox } from '@/lib/plans/geometry'

export function buildPlanIfc(plan: PlanData, projectName: string): string {
  // Footprint (en mètres). Convertit pieds → m si nécessaire.
  const toM = plan.unit === 'm' ? 1 : 0.3048
  let poly: [number, number][]
  if (plan.footprint && plan.footprint.length >= 3) {
    const b = bbox(plan.footprint)
    poly = plan.footprint.map(([x, y]) => [(x - b.minX) * toM, (y - b.minY) * toM])
  } else {
    const w = plan.width * toM
    const d = plan.depth * toM
    poly = [[0, 0], [w, 0], [w, d], [0, d]]
  }
  const height = plan.height * toM

  const lines: string[] = []
  let id = 0
  const ref = () => `#${id}`
  const add = (s: string) => { id++; lines.push(`#${id}=${s}`); return id }

  // Contexte / unités
  const dimExp = add('IFCDIMENSIONALEXPONENTS(0,0,0,0,0,0,0)')
  const lenUnit = add('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)')
  const areaUnit = add('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)')
  const volUnit = add('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)')
  const unitAsg = add(`IFCUNITASSIGNMENT((#${lenUnit},#${areaUnit},#${volUnit}))`)

  const origin = add('IFCCARTESIANPOINT((0.,0.,0.))')
  const dirZ = add('IFCDIRECTION((0.,0.,1.))')
  const dirX = add('IFCDIRECTION((1.,0.,0.))')
  const axisPlacement = add(`IFCAXIS2PLACEMENT3D(#${origin},#${dirZ},#${dirX})`)
  const geomCtx = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,#${axisPlacement},$)`)
  void dimExp

  // Project
  const project = add(`IFCPROJECT('${guid()}',$,'${esc(projectName)}',$,$,$,$,(#${geomCtx}),#${unitAsg})`)

  // Placements hiérarchiques
  const sitePlacement = add(`IFCLOCALPLACEMENT($,#${axisPlacement})`)
  const site = add(`IFCSITE('${guid()}',$,'Site',$,$,#${sitePlacement},$,$,.ELEMENT.,$,$,$,$,$)`)
  const bldgPlacement = add(`IFCLOCALPLACEMENT(#${sitePlacement},#${axisPlacement})`)
  const building = add(`IFCBUILDING('${guid()}',$,'${esc(projectName)}',$,$,#${bldgPlacement},$,$,.ELEMENT.,$,$,$)`)
  const storeyPlacement = add(`IFCLOCALPLACEMENT(#${bldgPlacement},#${axisPlacement})`)
  const storey = add(`IFCBUILDINGSTOREY('${guid()}',$,'Niveau 1',$,$,#${storeyPlacement},$,$,.ELEMENT.,0.)`)

  // Agrégations
  add(`IFCRELAGGREGATES('${guid()}',$,$,$,#${project},(#${site}))`)
  add(`IFCRELAGGREGATES('${guid()}',$,$,$,#${site},(#${building}))`)
  add(`IFCRELAGGREGATES('${guid()}',$,$,$,#${building},(#${storey}))`)

  // Profil fermé (footprint)
  const ptIds = poly.map((p) => add(`IFCCARTESIANPOINT((${num(p[0])},${num(p[1])}))`))
  const polyline = add(`IFCPOLYLINE((${ptIds.map((p) => `#${p}`).join(',')},#${ptIds[0]}))`)
  const profile = add(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#${polyline})`)

  // Extrusion verticale = volume bâti
  const extrudeDir = add('IFCDIRECTION((0.,0.,1.))')
  const solidPlacement = add(`IFCAXIS2PLACEMENT3D(#${origin},#${dirZ},#${dirX})`)
  const solid = add(`IFCEXTRUDEDAREASOLID(#${profile},#${solidPlacement},#${extrudeDir},${num(height)})`)
  const shapeRep = add(`IFCSHAPEREPRESENTATION(#${geomCtx},'Body','SweptSolid',(#${solid}))`)
  const prodShape = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRep}))`)
  const proxyPlacement = add(`IFCLOCALPLACEMENT(#${storeyPlacement},#${axisPlacement})`)
  const proxy = add(`IFCBUILDINGELEMENTPROXY('${guid()}',$,'Volume bâti',$,$,#${proxyPlacement},#${prodShape},$,$)`)

  add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',$,$,$,(#${proxy}),#${storey})`)
  void ref

  const body = lines.join(';\n') + ';'
  const ts = '2026-01-01T00:00:00'
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('${esc(projectName)}.ifc','${ts}',(''),(''),'Measura','Measura','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
${body}
ENDSEC;
END-ISO-10303-21;
`
}

function num(n: number): string {
  const r = Math.round(n * 1000) / 1000
  return Number.isInteger(r) ? `${r}.` : String(r)
}
function esc(s: string): string {
  return s.replace(/'/g, "''")
}
// GUID IFC compressé simplifié (22 chars base64-like, déterministe par compteur global)
let guidCounter = 0
function guid(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$'
  guidCounter++
  let n = guidCounter + 1000000
  let s = ''
  while (s.length < 22) { s = chars[n % 64] + s; n = Math.floor(n / 64) + 7 }
  return s.slice(0, 22)
}
