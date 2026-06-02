// components/report/ReportTemplate.tsx
// ============================================================
// Rapport de mesures complet — style « Hover » en noir & blanc.
// Piloté par les surface_calculations (via buildReportData) + photos
// + modèle 3D. Sections : couverture, sommaire des aires, toiture,
// empreinte, façades par élévation, ouvertures, garnitures, mesures
// annotées, photos.
// ============================================================
import React from 'react'
import {
  Document, Page, Text, View, Image, StyleSheet,
  Svg, Polygon, Line, Rect, Circle, G, Path,
} from '@react-pdf/renderer'
import type { Project, Measurement, Photo, FacadeLabel } from '@/lib/supabase/types'
import {
  buildReportData,
  type ReportSurface,
  type HouseModelLike,
  type ReportData,
  type WasteRow,
} from '@/lib/report/buildReportData'

export interface ReportTemplateProps {
  project: Project
  measurements: Measurement[]
  photos: Photo[]
  surfaces?: ReportSurface[]
  houseModel?: HouseModelLike | null
  companyName?: string
  companyLogo?: string
  locale: 'fr' | 'en'
  propertyId?: string
  modelId?: string
}

const INK = '#111111'
const GREY = '#6b7280'
const LIGHT = '#9ca3af'
const LINE = '#e5e5e5'
const SOFT = '#f7f7f7'

const FACADE_LABELS: Record<string, string> = {
  front: 'Avant', back: 'Arrière', left: 'Gauche', right: 'Droite', roof: 'Toit', other: 'Autre',
}
const TYPE_LABELS: Record<string, string> = {
  line: 'Ligne', area: 'Aire', angle: 'Angle', perimeter: 'Périmètre',
}
const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', photos_pending: 'Photos nécessaires', measuring: 'En mesure',
  review: 'En révision', completed: 'Complete', archived: 'Archivé',
}

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: INK, paddingTop: 42, paddingBottom: 54, paddingHorizontal: 40 },
  // header band
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: INK, letterSpacing: -0.5 },
  brandSub: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 3 },
  topRight: { textAlign: 'right' },
  topTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: INK },
  topAddr: { fontSize: 9, color: GREY, marginTop: 2 },
  topTag: { fontSize: 9, color: GREY, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 6, marginBottom: 8, paddingBottom: 5, borderBottomWidth: 1.5, borderBottomColor: INK },
  subTitle: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 12, marginBottom: 4 },

  // generic table
  th: { flexDirection: 'row', backgroundColor: INK, paddingVertical: 5, paddingHorizontal: 7 },
  thCell: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  tr: { flexDirection: 'row', paddingVertical: 4.5, paddingHorizontal: 7, borderBottomWidth: 0.6, borderBottomColor: LINE },
  trAlt: { backgroundColor: SOFT },
  td: { fontSize: 8.5, color: '#1f2937' },
  trTotal: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 7, borderTopWidth: 1, borderTopColor: INK, backgroundColor: SOFT },
  tdTotal: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK },

  groupHead: { backgroundColor: SOFT, paddingVertical: 4, paddingHorizontal: 7, marginTop: 8, borderLeftWidth: 3, borderLeftColor: INK },
  groupLabel: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK },

  // stat cards
  cardRow: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 6 },
  card: { flex: 1, backgroundColor: SOFT, borderRadius: 8, padding: 12 },
  cardValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: INK },
  cardUnit: { fontSize: 9, color: GREY },
  cardLabel: { fontSize: 8, color: GREY, marginTop: 3 },

  notesBox: { marginTop: 14, backgroundColor: SOFT, borderRadius: 6, padding: 11 },
  notesText: { fontSize: 8.5, color: '#374151', lineHeight: 1.5 },

  footer: { position: 'absolute', bottom: 22, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.6, borderTopColor: LINE, paddingTop: 6 },
  footerText: { fontSize: 7, color: LIGHT },

  empty: { padding: 14, color: LIGHT, fontSize: 9 },

  // cover
  cover: { fontFamily: 'Helvetica', padding: 0, color: INK },
  coverHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 40, paddingTop: 36 },
  coverHero: { marginTop: 26, marginHorizontal: 40, height: 360, backgroundColor: SOFT, borderRadius: 8, objectFit: 'cover' },
  coverHeroPlaceholder: { marginTop: 26, marginHorizontal: 40, height: 360, backgroundColor: SOFT, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  coverView3d: { textAlign: 'center', marginTop: 12, fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK, letterSpacing: 1 },
  coverFooter: { position: 'absolute', bottom: 28, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.6, borderTopColor: LINE, paddingTop: 8 },
  legal: { fontSize: 6.5, color: LIGHT, width: '64%', lineHeight: 1.4 },
  idBlock: { fontSize: 7.5, color: GREY, textAlign: 'right' },

  // footprint
  fpWrap: { flexDirection: 'row', gap: 18, marginTop: 6, alignItems: 'center' },
})

// ── helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso: string, locale: 'fr' | 'en') {
  try {
    return new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return iso }
}
function fmtAddress(p: Project) {
  return [p.address_line1, p.address_city, p.address_province, p.address_postal, p.address_country].filter(Boolean).join(', ')
}
function rnd(n: number) { return Math.round(n).toLocaleString('fr-CA') }
function fmtArea(n: number, unit: string) { return `${rnd(n)} ${unit}` }
function fmtSquares(n: number) {
  const r = Math.round(n * 2) / 2
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
function fmtFtIn(decFeet: number) {
  let ft = Math.floor(decFeet)
  let inch = Math.round((decFeet - ft) * 12)
  if (inch === 12) { ft += 1; inch = 0 }
  return `${ft}' ${inch}"`
}
function fmtLen(n: number, imperial: boolean) {
  return imperial ? fmtFtIn(n) : `${n.toFixed(2)} m`
}
function fmtPitch(p: number | null) {
  if (p == null) return '—'
  return `${Math.round(p)}/12`
}

// ── small components ──────────────────────────────────────────────────────────
function Footer({ companyName, generatedOn }: { companyName?: string; generatedOn: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{companyName ?? 'Measura'}</Text>
      <Text style={styles.footerText}>{generatedOn}</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function TopBar({ title, address, tag, brand }: { title: string; address: string; tag: string; brand: string }) {
  return (
    <View style={styles.topbar}>
      <View>
        <Text style={styles.brand}>{brand}</Text>
        <Text style={styles.brandSub}>Mesures complètes</Text>
      </View>
      <View style={styles.topRight}>
        <Text style={styles.topTitle}>{title}</Text>
        {!!address && <Text style={styles.topAddr}>{address}</Text>}
        <Text style={styles.topTag}>{tag}</Text>
      </View>
    </View>
  )
}

function Th({ cols }: { cols: { label: string; flex: number; right?: boolean }[] }) {
  return (
    <View style={styles.th}>
      {cols.map((c, i) => (
        <Text key={i} style={[styles.thCell, { flex: c.flex, textAlign: c.right ? 'right' : 'left' }]}>{c.label}</Text>
      ))}
    </View>
  )
}

function Row({ cells, alt, total }: { cells: { v: string; flex: number; right?: boolean }[]; alt?: boolean; total?: boolean }) {
  return (
    <View style={[total ? styles.trTotal : styles.tr, !total && alt ? styles.trAlt : {}]} wrap={false}>
      {cells.map((c, i) => (
        <Text key={i} style={[total ? styles.tdTotal : styles.td, { flex: c.flex, textAlign: c.right ? 'right' : 'left' }]}>{c.v}</Text>
      ))}
    </View>
  )
}

function svgText(x: number, y: number, s: string, opts?: { anchor?: 'start' | 'middle' | 'end'; size?: number; fill?: string; bold?: boolean }) {
  return (
    <Text
      x={x} y={y}
      style={{ fontFamily: opts?.bold ? 'Helvetica-Bold' : 'Helvetica', fontSize: opts?.size ?? 7 }}
      fill={opts?.fill ?? GREY}
      textAnchor={opts?.anchor ?? 'middle'}
    >{s}</Text>
  )
}

function FootprintDiagram({ points, imperial }: { points: [number, number][]; imperial: boolean }) {
  const W = 300, H = 260, pad = 40
  const xs = points.map((p) => p[0]); const ys = points.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const wFt = maxX - minX, dFt = maxY - minY
  const span = Math.max(wFt, dFt) || 1
  const scale = (Math.min(W, H) - pad * 2) / span
  const ox = (W - wFt * scale) / 2
  const oy = (H - dFt * scale) / 2
  const proj = points.map(([x, y]) => [ox + (x - minX) * scale, H - (oy + (y - minY) * scale)] as [number, number])
  const poly = proj.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const left = ox, right = ox + wFt * scale
  const top = H - (oy + dFt * scale), bot = H - oy
  const len = (ft: number) => (imperial ? fmtFtIn(ft) : `${ft.toFixed(1)} m`)
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Polygon points={poly} fill={SOFT} stroke={INK} strokeWidth={1.3} />
      {/* cote largeur (bas) */}
      <Line x1={left} y1={bot + 12} x2={right} y2={bot + 12} stroke={LIGHT} strokeWidth={0.6} />
      <Line x1={left} y1={bot + 8} x2={left} y2={bot + 16} stroke={LIGHT} strokeWidth={0.6} />
      <Line x1={right} y1={bot + 8} x2={right} y2={bot + 16} stroke={LIGHT} strokeWidth={0.6} />
      {svgText((left + right) / 2, bot + 22, len(wFt), { fill: INK })}
      {/* cote profondeur (droite) */}
      <Line x1={right + 12} y1={top} x2={right + 12} y2={bot} stroke={LIGHT} strokeWidth={0.6} />
      {svgText(right + 16, (top + bot) / 2, len(dFt), { anchor: 'start', fill: INK })}
      {/* étiquettes avant / arrière */}
      {svgText((left + right) / 2, top - 6, 'ARRIÈRE', { size: 6.5 })}
      {svgText((left + right) / 2, bot + 34, 'AVANT', { size: 6.5 })}
    </Svg>
  )
}

function Compass() {
  return (
    <Svg width={56} height={56} viewBox="0 0 56 56">
      <Line x1={10} y1={46} x2={46} y2={10} stroke={INK} strokeWidth={0.8} />
      <Line x1={10} y1={10} x2={46} y2={46} stroke={INK} strokeWidth={0.8} />
      {svgText(28, 8, 'N', { size: 7, fill: INK, bold: true })}
      {svgText(52, 30, 'E', { size: 7, fill: INK, bold: true })}
      {svgText(28, 54, 'S', { size: 7, fill: INK, bold: true })}
      {svgText(4, 30, 'O', { size: 7, fill: INK, bold: true })}
    </Svg>
  )
}

function ElevationDiagram({
  sideWidthFt, wallHeightFt, pitch, roofType, openings, imperial, isGableEnd = true,
}: {
  sideWidthFt: number; wallHeightFt: number; pitch: number
  roofType: string | null; openings: ReportSurface[]; imperial: boolean
  // Pignon (triangle) seulement sur les façades pignons (avant/arrière par défaut) ;
  // les façades de gouttereau (côtés) montrent le profil d'avant-toit.
  isGableEnd?: boolean
}) {
  const W = 500, mX = 38, mTop = 16, mBot = 30
  const drawW = W - mX * 2
  const scale = sideWidthFt > 0 ? drawW / sideWidthFt : 4
  const wallPx = Math.max(wallHeightFt * scale, 50)
  const gableFt = (sideWidthFt / 2) * (pitch / 12)

  // Hauteur du toit dessiné selon le type de toit et l'orientation de la façade.
  let gablePx: number
  if (roofType === 'flat') gablePx = 8
  else if (roofType === 'shed') gablePx = Math.min(gableFt * scale, 90)
  else if (roofType === 'hip') gablePx = Math.min(gableFt * scale * 0.7, 90)
  else gablePx = isGableEnd ? Math.min(gableFt * scale, 110) : 16 // gable

  const H = mTop + gablePx + wallPx + mBot
  const xL = mX, xR = mX + drawW
  const yRoofTop = mTop
  const yWallTop = mTop + gablePx
  const yWallBot = yWallTop + wallPx
  const cx = (xL + xR) / 2
  const len = (ft: number) => (imperial ? fmtFtIn(ft) : `${ft.toFixed(1)} m`)

  // Forme du toit
  let roof: React.ReactNode = null
  if (roofType === 'flat') {
    roof = <Rect x={xL - 4} y={yWallTop - 8} width={drawW + 8} height={8} fill="#d9d9d9" stroke={INK} strokeWidth={1} />
  } else if (roofType === 'shed') {
    roof = <Polygon points={`${xL},${yRoofTop} ${xR},${yWallTop} ${xR},${yWallTop} ${xL},${yWallTop}`} fill="#ededed" stroke={INK} strokeWidth={1} />
  } else if (roofType === 'hip') {
    const inset = drawW * 0.24
    roof = <Polygon points={`${xL},${yWallTop} ${xL + inset},${yRoofTop} ${xR - inset},${yRoofTop} ${xR},${yWallTop}`} fill="#ededed" stroke={INK} strokeWidth={1} />
  } else if (isGableEnd) {
    // Pignon : triangle
    roof = <Polygon points={`${xL},${yWallTop} ${cx},${yRoofTop} ${xR},${yWallTop}`} fill="#ededed" stroke={INK} strokeWidth={1} />
  } else {
    // Gouttereau : profil d'avant-toit (bandeau + ligne de faîte en débord)
    roof = (
      <G>
        <Rect x={xL - 6} y={yWallTop - gablePx} width={drawW + 12} height={gablePx} fill="#f0f0f0" stroke={INK} strokeWidth={1} />
        <Line x1={xL - 6} y1={yWallTop - gablePx} x2={xR + 6} y2={yWallTop - gablePx} stroke={INK} strokeWidth={0.8} />
      </G>
    )
  }

  // Une ouverture est « positionnée » si on connaît son décalage horizontal
  // et sa hauteur d'allège (migration 015) → placée à sa vraie position.
  const isPlaced = (o: ReportSurface) => o.position_x != null && o.sill_height != null
  const ops = openings.slice(0, 12)

  // Disposition de repli (uniforme) pour les ouvertures sans position connue.
  const unplaced = ops.filter((o) => !isPlaced(o))
  const fbWidths = unplaced.map((o) => Math.max((o.length ?? 1) * scale, 6))
  const fbTotalW = fbWidths.reduce((a, b) => a + b, 0)
  const fbSpace = unplaced.length ? (drawW - fbTotalW) / (unplaced.length + 1) : 0
  let fbPenX = xL + fbSpace

  // Géométrie de chaque ouverture en pixels SVG.
  const opGeom = ops.map((o) => {
    const w = Math.max((o.length ?? 1) * scale, 6)
    if (isPlaced(o)) {
      const h = Math.min((o.height ?? 1) * scale, wallPx * 0.92)
      const x = Math.max(xL, Math.min(xL + (o.position_x ?? 0) * scale, xR - w))
      const y = Math.max(yWallTop + 2, yWallBot - (o.sill_height ?? 0) * scale - h)
      return { o, x, y, w, h }
    }
    const h = Math.min((o.height ?? 1) * scale, wallPx * 0.78)
    const x = fbPenX
    const y = yWallBot - h - wallPx * 0.12
    fbPenX += w + fbSpace
    return { o, x, y, w, h }
  })

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {roof}
      <Rect x={xL} y={yWallTop} width={drawW} height={wallPx} fill="#f4f4f4" stroke={INK} strokeWidth={1} />
      {opGeom.map(({ o, x, y, w, h }, i) => (
        <G key={o.id}>
          <Rect x={x} y={y} width={w} height={h} fill="#ffffff" stroke={INK} strokeWidth={0.8} />
          {/* pastille numérotée (style Hover) */}
          <Circle cx={x} cy={y} r={6.5} fill={INK} stroke="#ffffff" strokeWidth={0.8} />
          <Text x={x} y={y + 2.3} style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5 }} fill="#ffffff" textAnchor="middle">{String(i + 1)}</Text>
          {svgText(x + w / 2, y - 4, o.label ?? '', { size: 5, fill: GREY })}
        </G>
      ))}
      {/* cote largeur */}
      <Line x1={xL} y1={yWallBot + 12} x2={xR} y2={yWallBot + 12} stroke={LIGHT} strokeWidth={0.6} />
      <Line x1={xL} y1={yWallBot + 8} x2={xL} y2={yWallBot + 16} stroke={LIGHT} strokeWidth={0.6} />
      <Line x1={xR} y1={yWallBot + 8} x2={xR} y2={yWallBot + 16} stroke={LIGHT} strokeWidth={0.6} />
      {svgText(cx, yWallBot + 22, len(sideWidthFt), { fill: INK })}
      {/* cote hauteur */}
      <Line x1={xL - 12} y1={yWallTop} x2={xL - 12} y2={yWallBot} stroke={LIGHT} strokeWidth={0.6} />
      {svgText(xL - 16, (yWallTop + yWallBot) / 2, len(wallHeightFt), { anchor: 'end', fill: INK })}
    </Svg>
  )
}

function RoofTopDiagram({ points, totalArea, areaUnit }: { points: [number, number][] | null; totalArea: number; areaUnit: string }) {
  const W = 300, H = 240, pad = 30
  if (!points || points.length < 3) {
    return (
      <View style={{ width: W, height: H, backgroundColor: SOFT, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: LIGHT, fontSize: 9 }}>Schéma de toiture indisponible</Text>
      </View>
    )
  }
  const xs = points.map((p) => p[0]); const ys = points.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const span = Math.max(maxX - minX, maxY - minY) || 1
  const scale = (Math.min(W, H) - pad * 2) / span
  const ox = (W - (maxX - minX) * scale) / 2
  const oy = (H - (maxY - minY) * scale) / 2
  const proj = points.map(([x, y]) => [ox + (x - minX) * scale, H - (oy + (y - minY) * scale)] as [number, number])
  const poly = proj.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const cxp = ox + ((maxX - minX) / 2) * scale
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Polygon points={poly} fill="#f0f0f0" stroke={INK} strokeWidth={1.2} />
      {/* faîte central */}
      <Line x1={cxp} y1={H - oy - (maxY - minY) * scale} x2={cxp} y2={H - oy} stroke={INK} strokeWidth={0.9} />
      {svgText(cxp, H / 2, `${Math.round(totalArea)} ${areaUnit}`, { fill: INK, bold: true, size: 8 })}
    </Svg>
  )
}

function IsoHouse() {
  // Petite maison isométrique schématique (massing)
  return (
    <Svg width={200} height={150} viewBox="0 0 200 150">
      {/* mur gauche */}
      <Polygon points="40,70 100,100 100,140 40,110" fill="#ededed" stroke={INK} strokeWidth={1} />
      {/* mur droit */}
      <Polygon points="100,100 160,70 160,110 100,140" fill="#f6f6f6" stroke={INK} strokeWidth={1} />
      {/* toit gauche */}
      <Polygon points="40,70 100,40 100,100" fill="#dcdcdc" stroke={INK} strokeWidth={1} />
      {/* toit droit */}
      <Polygon points="100,40 160,70 100,100" fill="#e7e7e7" stroke={INK} strokeWidth={1} />
      <Circle cx={70} cy={92} r={6} fill="#ffffff" stroke={INK} strokeWidth={0.8} />
      <Circle cx={130} cy={92} r={6} fill="#ffffff" stroke={INK} strokeWidth={0.8} />
    </Svg>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function ReportTemplate(props: ReportTemplateProps) {
  const { project, measurements, photos, surfaces = [], houseModel = null, companyName, companyLogo, locale, propertyId, modelId } = props
  const today = fmtDate(new Date().toISOString(), locale)
  const address = fmtAddress(project)
  const data: ReportData = buildReportData(surfaces, houseModel)
  const gen = `Généré le ${today}`
  const brand = companyName ?? 'Measura'
  const heroPhoto = photos.find((p) => p.url)?.url
  const photosWithUrls = photos.filter((p) => p.url)
  const propId = propertyId ?? project.id.replace(/-/g, '').slice(0, 8).toUpperCase()

  // measurements grouped (annotations manuelles)
  const order: FacadeLabel[] = ['front', 'back', 'left', 'right', 'roof', 'other']
  const grouped = order
    .map((side) => ({ side, items: measurements.filter((m) => (m.facade_side ?? 'other') === side) }))
    .filter((g) => g.items.length > 0)

  const hasSurfaces = surfaces.length > 0

  return (
    <Document title={`Mesures complètes — ${project.title}`} author={companyName ?? 'Measura'}>
      {/* ── Couverture ─────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.cover}>
        <View style={styles.coverHead}>
          <View>
            <Text style={styles.brand}>{companyName ?? 'Measura'}</Text>
            <Text style={styles.brandSub}>Mesures complètes</Text>
          </View>
          <View style={styles.topRight}>
            <Text style={styles.topTitle}>{project.title}</Text>
            {!!address && <Text style={styles.topAddr}>{address}</Text>}
          </View>
        </View>

        {heroPhoto ? (
          <Image src={heroPhoto} style={styles.coverHero} />
        ) : (
          <View style={styles.coverHeroPlaceholder}>
            <Text style={{ color: LIGHT, fontSize: 10 }}>Aucune photo</Text>
          </View>
        )}
        <Text style={styles.coverView3d}>VOIR LE MODÈLE 3D</Text>

        <View style={styles.coverFooter}>
          <Text style={styles.legal}>
            © {new Date(project.created_at).getFullYear()} {companyName ?? 'Measura'}. Ce document, les images et les
            données de mesure sont fournis « tels quels ». Measura ne donne aucune garantie quant à l&apos;exactitude,
            l&apos;exhaustivité ou l&apos;adéquation à un usage particulier. Vérifiez les quantités avant toute commande.
          </Text>
          <View style={styles.idBlock}>
            <Text>ID PROPRIÉTÉ : {propId}</Text>
            {!!modelId && <Text>ID MODÈLE : {modelId}</Text>}
            <Text>{address || project.title}</Text>
            <Text>{today}</Text>
          </View>
        </View>
      </Page>

      {/* ── Sommaire des aires ─────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <TopBar brand={brand} title={project.title} address={address} tag="Sommaire" />
        <Text style={styles.sectionTitle}>Sommaire des aires</Text>

        <View style={styles.cardRow}>
          <Stat value={fmtArea(data.wallArea, data.areaUnit)} label="Revêtement (murs)" />
          <Stat value={fmtArea(data.roofArea, data.areaUnit)} label="Toiture" />
          <Stat value={fmtArea(data.trimArea, data.areaUnit)} label="Garnitures / soffite" />
          <Stat value={fmtArea(data.totalArea, data.areaUnit)} label="Total" />
        </View>

        <Th cols={[{ label: 'Catégorie', flex: 3 }, { label: 'Aire', flex: 2, right: true }, { label: 'Carrés', flex: 1.4, right: true }]} />
        <Row cells={[{ v: 'Murs (net)', flex: 3 }, { v: fmtArea(data.wallArea, data.areaUnit), flex: 2, right: true }, { v: fmtSquares(data.wallArea / 100), flex: 1.4, right: true }]} />
        <Row alt cells={[{ v: 'Toiture', flex: 3 }, { v: fmtArea(data.roofArea, data.areaUnit), flex: 2, right: true }, { v: fmtSquares(data.roofArea / 100), flex: 1.4, right: true }]} />
        <Row cells={[{ v: 'Garnitures / soffite / fascia', flex: 3 }, { v: fmtArea(data.trimArea, data.areaUnit), flex: 2, right: true }, { v: fmtSquares(data.trimArea / 100), flex: 1.4, right: true }]} />
        <Row alt cells={[{ v: `Ouvertures (${data.openingCount})`, flex: 3 }, { v: fmtArea(data.openingArea, data.areaUnit), flex: 2, right: true }, { v: '—', flex: 1.4, right: true }]} />
        <Row total cells={[{ v: 'Total (excl. ouvertures)', flex: 3 }, { v: fmtArea(data.totalArea, data.areaUnit), flex: 2, right: true }, { v: fmtSquares(data.totalArea / 100), flex: 1.4, right: true }]} />

        <Text style={styles.subTitle}>Facteurs de perte — revêtement (carrés = aire / 100)</Text>
        <WasteTable rows={data.sidingWaste} areaUnit={data.areaUnit} />

        {!hasSurfaces && (
          <Text style={styles.empty}>
            Aucune surface calculée pour ce projet. Ajoutez des surfaces (murs, toiture, ouvertures…)
            depuis l&apos;onglet Mesures pour remplir automatiquement ces tableaux.
          </Text>
        )}

        <Footer companyName={companyName} generatedOn={gen} />
      </Page>

      {/* ── Toiture ────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <TopBar brand={brand} title={project.title} address={address} tag="Toiture" />
        <Text style={styles.sectionTitle}>Sommaire de la toiture</Text>

        <View style={styles.cardRow}>
          <Stat value={fmtArea(data.roofTotalArea, data.areaUnit)} label="Aire totale de toiture" />
          <Stat value={fmtSquares(data.roofTotalArea / 100)} label="Carrés (toiture)" />
          <Stat value={String(data.roofFacets.length)} label="Facettes" />
        </View>
        {data.roofEstimated && (
          <Text style={{ fontSize: 7.5, color: GREY, marginBottom: 4 }}>
            Aire estimée à partir de l&apos;empreinte au sol et de la pente — à confirmer sur place.
          </Text>
        )}

        {data.footprint.points && data.footprint.points.length > 2 && (
          <View style={{ alignItems: 'center', marginVertical: 6 }}>
            <RoofTopDiagram points={data.footprint.points} totalArea={data.roofTotalArea} areaUnit={data.areaUnit} />
          </View>
        )}

        <Text style={styles.subTitle}>Facettes de toiture</Text>
        <Th cols={[{ label: 'Facette', flex: 3 }, { label: 'Pente', flex: 1.5 }, { label: 'Aire', flex: 2, right: true }]} />
        {data.roofFacets.length === 0 ? (
          <Text style={styles.empty}>Aucune facette de toiture.</Text>
        ) : data.roofFacets.map((f, i) => (
          <Row key={i} alt={i % 2 === 1} cells={[{ v: f.label, flex: 3 }, { v: fmtPitch(f.pitch), flex: 1.5 }, { v: fmtArea(f.area, data.areaUnit), flex: 2, right: true }]} />
        ))}

        {data.roofPitchBreakdown.length > 0 && (
          <>
            <Text style={styles.subTitle}>Répartition par pente</Text>
            <Th cols={[{ label: 'Pente', flex: 2 }, { label: 'Aire', flex: 2, right: true }, { label: '%', flex: 1.5, right: true }]} />
            {data.roofPitchBreakdown.map((p, i) => (
              <Row key={i} alt={i % 2 === 1} cells={[{ v: fmtPitch(p.pitch), flex: 2 }, { v: fmtArea(p.area, data.areaUnit), flex: 2, right: true }, { v: `${p.pct.toFixed(1)} %`, flex: 1.5, right: true }]} />
            ))}
          </>
        )}

        {data.roofLines.length > 0 && (
          <>
            <Text style={styles.subTitle}>Lignes de toiture (faîtes, avant-toits, rives…)</Text>
            <Th cols={[{ label: 'Élément', flex: 3 }, { label: 'Longueur', flex: 2, right: true }]} />
            {data.roofLines.map((l, i) => (
              <Row key={i} alt={i % 2 === 1} cells={[{ v: l.label, flex: 3 }, { v: fmtLen(l.length, data.imperial), flex: 2, right: true }]} />
            ))}
          </>
        )}

        <Text style={styles.subTitle}>Facteurs de perte — toiture</Text>
        <WasteTable rows={data.roofWaste} areaUnit={data.areaUnit} />

        <Footer companyName={companyName} generatedOn={gen} />
      </Page>

      {/* ── Empreinte ──────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <TopBar brand={brand} title={project.title} address={address} tag="Empreinte" />
        <Text style={styles.sectionTitle}>Empreinte au sol</Text>
        <View style={styles.fpWrap}>
          <View>
            {data.footprint.points && data.footprint.points.length > 2 ? (
              <FootprintDiagram points={data.footprint.points} imperial={data.imperial} />
            ) : (
              <View style={{ width: 300, height: 260, backgroundColor: SOFT, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: LIGHT, fontSize: 9 }}>Empreinte non disponible</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ alignItems: 'flex-end', marginBottom: 8 }}><Compass /></View>
            <InfoLine label="Nombre d'étages" value={String(data.footprint.stories)} />
            <InfoLine label="Périmètre" value={data.footprint.perimeter > 0 ? fmtLen(data.footprint.perimeter, data.imperial) : '—'} />
            <InfoLine label="Aire au sol" value={data.footprint.area > 0 ? fmtArea(data.footprint.area, data.areaUnit) : '—'} />
            <InfoLine label="Type de toit" value={data.footprint.roofType ? ROOF_LABELS[data.footprint.roofType] ?? data.footprint.roofType : '—'} />
          </View>
        </View>

        {data.byElevation.length > 0 && (
          <>
            <Text style={styles.subTitle}>Revêtement par élévation</Text>
            <Th cols={[{ label: 'Élévation', flex: 3 }, { label: 'Aire (net)', flex: 2, right: true }, { label: 'Carrés', flex: 1.4, right: true }]} />
            {data.byElevation.map((e, i) => (
              <Row key={i} alt={i % 2 === 1} cells={[{ v: FACADE_LABELS[e.side] ?? e.side, flex: 3 }, { v: fmtArea(e.area, data.areaUnit), flex: 2, right: true }, { v: fmtSquares(e.area / 100), flex: 1.4, right: true }]} />
            ))}
            <Row total cells={[{ v: 'Total', flex: 3 }, { v: fmtArea(data.wallArea, data.areaUnit), flex: 2, right: true }, { v: fmtSquares(data.wallArea / 100), flex: 1.4, right: true }]} />
          </>
        )}

        <Footer companyName={companyName} generatedOn={gen} />
      </Page>

      {/* ── Élévations (schémas) ───────────────────────────────────────────── */}
      {data.dims.width > 0 && [
        [
          { side: 'front', label: 'AVANT', width: data.dims.width },
          { side: 'right', label: 'DROITE', width: data.dims.depth },
        ],
        [
          { side: 'back', label: 'ARRIÈRE', width: data.dims.width },
          { side: 'left', label: 'GAUCHE', width: data.dims.depth },
        ],
      ].map((pair, pi) => (
        <Page key={`elev-${pi}`} size="A4" style={styles.page}>
          <TopBar brand={brand} title={project.title} address={address} tag="Élévations" />
          {pi === 0 && <Text style={styles.sectionTitle}>Élévations</Text>}
          {pair.map((e) => {
            const ops = data.openingsBySide[e.side] ?? []
            const placed = ops.filter((o) => o.position_x != null && o.sill_height != null).length
            const positionNote =
              ops.length === 0
                ? 'aucune ouverture'
                : placed === ops.length
                  ? 'positions réelles'
                  : placed > 0
                    ? `${placed}/${ops.length} positionnée(s) · reste approximatif`
                    : 'positions approximatives'
            return (
              <View key={e.side} style={{ marginBottom: 16 }} wrap={false}>
                <Text style={styles.subTitle}>{e.label}</Text>
                <View style={{ alignItems: 'center' }}>
                  <ElevationDiagram
                    sideWidthFt={e.width}
                    wallHeightFt={data.dims.wallHeight}
                    pitch={data.dims.pitch}
                    roofType={data.footprint.roofType}
                    openings={ops}
                    imperial={data.imperial}
                    isGableEnd={e.side === 'front' || e.side === 'back'}
                  />
                </View>
                <Text style={{ fontSize: 7.5, color: GREY, marginTop: 2 }}>
                  {ops.length} ouverture(s) · schéma proportionnel ({positionNote})
                </Text>
              </View>
            )
          })}
          <Footer companyName={companyName} generatedOn={gen} />
        </Page>
      ))}

      {/* ── Clé des mesures ────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <TopBar brand={brand} title={project.title} address={address} tag="Clé des mesures" />
        <Text style={styles.sectionTitle}>Clé des mesures</Text>
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 6 }}>
          <View style={{ flex: 1 }}>
            {[
              'Mur (revêtement)', 'Pignon', 'Avant-toit / fascia', 'Soffite',
              'Rive (rake)', 'Garniture verticale', 'Coin extérieur', 'Ouverture (fenêtre / porte)',
            ].map((label, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 0.6, borderBottomColor: LINE }}>
                <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: i % 2 ? '#dcdcdc' : '#ededed', borderWidth: 0.8, borderColor: INK, marginRight: 8 }} />
                <Text style={{ fontSize: 9 }}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <IsoHouse />
            <Text style={{ fontSize: 7.5, color: GREY, marginTop: 6 }}>Modèle volumétrique (massing)</Text>
          </View>
        </View>
        <Footer companyName={companyName} generatedOn={gen} />
      </Page>

      {/* ── Façades (détail des surfaces) ──────────────────────────────────── */}
      {data.wallSurfaces.length > 0 && (
        <Page size="A4" style={styles.page}>
          <TopBar brand={brand} title={project.title} address={address} tag="Façades" />
          <Text style={styles.sectionTitle}>Détail des surfaces de revêtement</Text>
          <Th cols={[
            { label: 'Code / Label', flex: 3 }, { label: 'Élévation', flex: 1.6 },
            { label: 'Brute', flex: 1.6, right: true }, { label: 'Ouv.', flex: 1.4, right: true }, { label: 'Nette', flex: 1.6, right: true },
          ]} />
          {data.wallSurfaces.map((s, i) => (
            <Row key={s.id} alt={i % 2 === 1} cells={[
              { v: s.label ?? `SI-${i + 1}`, flex: 3 },
              { v: s.facade_side ? (FACADE_LABELS[s.facade_side] ?? s.facade_side) : '—', flex: 1.6 },
              { v: rnd(s.gross_area ?? 0), flex: 1.6, right: true },
              { v: rnd(s.opening_area ?? 0), flex: 1.4, right: true },
              { v: rnd(s.net_area ?? Math.max((s.gross_area ?? 0) - (s.opening_area ?? 0), 0)), flex: 1.6, right: true },
            ]} />
          ))}
          <Row total cells={[
            { v: 'Total', flex: 3 }, { v: '', flex: 1.6 },
            { v: rnd(data.wallSurfaces.reduce((a, s) => a + (s.gross_area ?? 0), 0)), flex: 1.6, right: true },
            { v: rnd(data.wallSurfaces.reduce((a, s) => a + (s.opening_area ?? 0), 0)), flex: 1.4, right: true },
            { v: rnd(data.wallArea), flex: 1.6, right: true },
          ]} />
          <Footer companyName={companyName} generatedOn={gen} />
        </Page>
      )}

      {/* ── Ouvertures ─────────────────────────────────────────────────────── */}
      {(data.windows.length > 0 || data.doors.length > 0) && (
        <Page size="A4" style={styles.page}>
          <TopBar brand={brand} title={project.title} address={address} tag="Ouvertures" />
          <Text style={styles.sectionTitle}>Ouvertures</Text>

          {data.windows.length > 0 && (
            <>
              <Text style={styles.subTitle}>Fenêtres ({data.windows.length})</Text>
              <Th cols={[
                { label: 'Code', flex: 2 }, { label: 'L × H', flex: 2.4 },
                { label: 'Po. unis', flex: 1.6, right: true }, { label: 'Aire', flex: 1.8, right: true },
              ]} />
              {data.windows.map((w, i) => (
                <Row key={w.id} alt={i % 2 === 1} cells={[
                  { v: w.label ?? `W-${i + 1}`, flex: 2 },
                  { v: dims(w, data.imperial), flex: 2.4 },
                  { v: unitedInches(w, data.imperial), flex: 1.6, right: true },
                  { v: fmtArea(w.gross_area ?? 0, data.areaUnit), flex: 1.8, right: true },
                ]} />
              ))}
            </>
          )}

          {data.doors.length > 0 && (
            <>
              <Text style={styles.subTitle}>Portes ({data.doors.length})</Text>
              <Th cols={[{ label: 'Code', flex: 2 }, { label: 'L × H', flex: 2.4 }, { label: 'Aire', flex: 1.8, right: true }]} />
              {data.doors.map((d, i) => (
                <Row key={d.id} alt={i % 2 === 1} cells={[
                  { v: d.label ?? `D-${i + 1}`, flex: 2 },
                  { v: dims(d, data.imperial), flex: 2.4 },
                  { v: fmtArea(d.gross_area ?? 0, data.areaUnit), flex: 1.8, right: true },
                ]} />
              ))}
            </>
          )}
          <Footer companyName={companyName} generatedOn={gen} />
        </Page>
      )}

      {/* ── Garnitures / soffite + mesures annotées ────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <TopBar brand={brand} title={project.title} address={address} tag="Détails" />

        {data.trimSurfaces.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Garnitures, soffite & fascia</Text>
            <Th cols={[{ label: 'Élément', flex: 3 }, { label: 'Longueur', flex: 2, right: true }, { label: 'Aire', flex: 2, right: true }]} />
            {data.trimSurfaces.map((s, i) => (
              <Row key={s.id} alt={i % 2 === 1} cells={[
                { v: s.label ?? (s.surface_type ?? '—'), flex: 3 },
                { v: s.length ? fmtLen(s.length, data.imperial) : '—', flex: 2, right: true },
                { v: fmtArea(s.gross_area ?? 0, data.areaUnit), flex: 2, right: true },
              ]} />
            ))}
          </>
        )}

        <Text style={[styles.sectionTitle, { marginTop: data.trimSurfaces.length > 0 ? 18 : 6 }]}>Mesures annotées</Text>
        {measurements.length === 0 ? (
          <Text style={styles.empty}>Aucune mesure annotée.</Text>
        ) : (
          <>
            <Th cols={[
              { label: 'Description', flex: 3 }, { label: 'Façade', flex: 2 },
              { label: 'Type', flex: 1.8 }, { label: 'Valeur', flex: 1.4, right: true }, { label: 'Unité', flex: 1, right: true },
            ]} />
            {grouped.map((g) => (
              <View key={g.side}>
                <View style={styles.groupHead}><Text style={styles.groupLabel}>{FACADE_LABELS[g.side] ?? g.side}</Text></View>
                {g.items.map((m, idx) => (
                  <Row key={m.id} alt={idx % 2 === 1} cells={[
                    { v: m.label ?? '—', flex: 3 },
                    { v: m.facade_side ? (FACADE_LABELS[m.facade_side] ?? m.facade_side) : '—', flex: 2 },
                    { v: TYPE_LABELS[m.measurement_type] ?? m.measurement_type, flex: 1.8 },
                    { v: m.real_value != null ? m.real_value.toFixed(2) : '—', flex: 1.4, right: true },
                    { v: m.unit, flex: 1, right: true },
                  ]} />
                ))}
              </View>
            ))}
          </>
        )}

        {project.notes && (
          <View style={styles.notesBox}>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Notes</Text>
            <Text style={styles.notesText}>{project.notes}</Text>
          </View>
        )}
        <Footer companyName={companyName} generatedOn={gen} />
      </Page>

      {/* ── Photos ─────────────────────────────────────────────────────────── */}
      {photosWithUrls.length > 0 && (
        <Page size="A4" style={styles.page}>
          <TopBar brand={brand} title={project.title} address={address} tag="Photos" />
          <Text style={styles.sectionTitle}>Photos</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {photosWithUrls.map((p) => (
              <View key={p.id} style={{ width: '31%' }} wrap={false}>
                <Image src={p.url!} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 5 }} />
                <Text style={{ fontSize: 7, color: GREY, marginTop: 3, textAlign: 'center' }}>
                  {p.facade_label ? (FACADE_LABELS[p.facade_label] ?? p.facade_label) : (p.original_name ?? '')}
                </Text>
              </View>
            ))}
          </View>
          <Footer companyName={companyName} generatedOn={gen} />
        </Page>
      )}
    </Document>
  )
}

const ROOF_LABELS: Record<string, string> = { gable: 'Pignon (gable)', hip: 'En croupe (hip)', flat: 'Plat', shed: 'En appentis (shed)' }

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 0.6, borderBottomColor: LINE }}>
      <Text style={{ width: '50%', fontFamily: 'Helvetica-Bold', color: GREY, fontSize: 8.5 }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 9 }}>{value}</Text>
    </View>
  )
}

function WasteTable({ rows, areaUnit }: { rows: WasteRow[]; areaUnit: string }) {
  return (
    <>
      <Th cols={[{ label: 'Facteur', flex: 2 }, { label: 'Aire', flex: 2, right: true }, { label: 'Carrés', flex: 1.5, right: true }]} />
      {rows.map((r, i) => (
        <Row key={i} alt={i % 2 === 1} cells={[
          { v: r.label, flex: 2 },
          { v: fmtArea(r.area, areaUnit), flex: 2, right: true },
          { v: fmtSquares(r.squares), flex: 1.5, right: true },
        ]} />
      ))}
    </>
  )
}

function dims(s: ReportSurface, imperial: boolean): string {
  const w = s.length ?? null
  const h = s.height ?? null
  if (w == null || h == null) return '—'
  return imperial ? `${fmtFtIn(w)} × ${fmtFtIn(h)}` : `${w.toFixed(2)} × ${h.toFixed(2)} m`
}
function unitedInches(s: ReportSurface, imperial: boolean): string {
  const w = s.length ?? null
  const h = s.height ?? null
  if (w == null || h == null) return '—'
  if (!imperial) return '—'
  return `${Math.round((w + h) * 12)}"`
}
