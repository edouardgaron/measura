import type { MeasurementPoint } from '@/lib/supabase/types'

export function pixelDistance(p1: MeasurementPoint, p2: MeasurementPoint, imgWidth: number, imgHeight: number): number {
  const dx = (p2.x - p1.x) * imgWidth
  const dy = (p2.y - p1.y) * imgHeight
  return Math.sqrt(dx * dx + dy * dy)
}

export function computePxPerUnit(
  p1: MeasurementPoint,
  p2: MeasurementPoint,
  realLength: number,
  imgWidth: number,
  imgHeight: number
): number {
  const pixelDist = pixelDistance(p1, p2, imgWidth, imgHeight)
  return pixelDist / realLength
}

export function pixelToReal(pixelDist: number, pxPerUnit: number): number {
  return pixelDist / pxPerUnit
}

export function realToPixel(realDist: number, pxPerUnit: number): number {
  return realDist * pxPerUnit
}

export function computeLineLength(
  points: MeasurementPoint[],
  imgWidth: number,
  imgHeight: number
): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += pixelDistance(points[i - 1], points[i], imgWidth, imgHeight)
  }
  return total
}

export function computePolygonArea(
  points: MeasurementPoint[],
  imgWidth: number,
  imgHeight: number
): number {
  if (points.length < 3) return 0
  const px = points.map((p) => ({ x: p.x * imgWidth, y: p.y * imgHeight }))
  let area = 0
  const n = px.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += px[i].x * px[j].y
    area -= px[j].x * px[i].y
  }
  return Math.abs(area) / 2
}
