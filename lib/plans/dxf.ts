// lib/plans/dxf.ts
// ============================================================
// Génère un fichier DXF (AutoCAD R12 ASCII) à partir des plans :
// vue en plan (footprint) + 4 élévations. Format texte, sans dépendance.
// ============================================================

import type { PlanData } from '@/lib/plans/geometry'
import { bbox } from '@/lib/plans/geometry'

class DxfBuilder {
  private lines: string[] = []
  private add(code: number, value: string | number) {
    this.lines.push(String(code), String(value))
  }
  line(x1: number, y1: number, x2: number, y2: number, layer = 'PLAN') {
    this.add(0, 'LINE'); this.add(8, layer)
    this.add(10, round(x1)); this.add(20, round(y1)); this.add(30, 0)
    this.add(11, round(x2)); this.add(21, round(y2)); this.add(31, 0)
  }
  polyline(pts: [number, number][], layer = 'PLAN', closed = true) {
    for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      this.line(a[0], a[1], b[0], b[1], layer)
    }
  }
  text(x: number, y: number, height: number, value: string, layer = 'TEXT') {
    this.add(0, 'TEXT'); this.add(8, layer)
    this.add(10, round(x)); this.add(20, round(y)); this.add(30, 0)
    this.add(40, round(height)); this.add(1, value)
  }
  build(): string {
    return ['0', 'SECTION', '2', 'ENTITIES', ...this.lines, '0', 'ENDSEC', '0', 'EOF'].join('\n')
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** Construit un DXF avec la vue en plan et les 4 élévations, disposées côte à côte. */
export function buildPlanDxf(plan: PlanData): string {
  const dxf = new DxfBuilder()
  const gap = Math.max(plan.width, plan.depth) * 0.6 + 2

  // ── Vue en plan ──
  let originX = 0
  const originY = 0
  if (plan.footprint) {
    const b = bbox(plan.footprint)
    const shifted = plan.footprint.map(([x, y]) => [x - b.minX, y - b.minY] as [number, number])
    dxf.polyline(shifted, 'PLAN', true)
    dxf.text(0, b.maxY - b.minY + 0.5, 0.4, 'VUE EN PLAN')
    originX = (b.maxX - b.minX) + gap
  } else {
    dxf.polyline([[0, 0], [plan.width, 0], [plan.width, plan.depth], [0, plan.depth]], 'PLAN', true)
    dxf.text(0, plan.depth + 0.5, 0.4, `VUE EN PLAN  ${plan.width} x ${plan.depth} ${plan.unit}`)
    originX = plan.width + gap
  }

  // ── Élévations (rectangles largeur × hauteur) ──
  const elevs: { label: string; w: number }[] = [
    { label: 'AVANT', w: plan.width },
    { label: 'ARRIERE', w: plan.width },
    { label: 'GAUCHE', w: plan.depth },
    { label: 'DROITE', w: plan.depth },
  ]
  let ex = originX
  for (const e of elevs) {
    const h = plan.height
    dxf.polyline([[ex, originY], [ex + e.w, originY], [ex + e.w, originY + h], [ex, originY + h]], 'ELEV', true)
    dxf.text(ex, originY + h + 0.5, 0.4, `ELEVATION ${e.label}  ${round(e.w)} x ${round(h)} ${plan.unit}`)
    ex += e.w + gap
  }

  return dxf.build()
}
