// components/plans/PlanTemplate.tsx
import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet, Svg, Line, Rect, Polygon } from '@react-pdf/renderer'
import type { Project } from '@/lib/supabase/types'
import type { PlanData } from '@/lib/plans/geometry'
import { bbox } from '@/lib/plans/geometry'

export interface PlanTemplateProps {
  project: Project
  plan: PlanData
  companyName?: string
  companyLogo?: string
}

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#1f2937', padding: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 2, borderBottomColor: '#1e3a5f', paddingBottom: 10, marginBottom: 16 },
  logo: { width: 40, height: 40, objectFit: 'contain' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1e3a5f', letterSpacing: 1 },
  sub: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1e3a5f', marginTop: 10, marginBottom: 8 },
  drawingBox: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, padding: 12, alignItems: 'center', marginBottom: 10 },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 6 },
  legendItem: { fontSize: 9, color: '#374151' },
  legendLabel: { fontFamily: 'Helvetica-Bold', color: '#1e3a5f' },
  elevGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  elevCard: { width: '47%', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, padding: 10, alignItems: 'center' },
  elevLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#2563eb', marginBottom: 6 },
  note: { fontSize: 8, color: '#9ca3af', marginTop: 4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
  footerText: { fontSize: 7.5, color: '#9ca3af' },
})

const NAVY = '#1e3a5f'
const BLUE = '#2563eb'

function fmt(n: number) { return Math.round(n * 100) / 100 }

function PlanView({ plan, size }: { plan: PlanData; size: number }) {
  if (plan.footprint) {
    const b = bbox(plan.footprint)
    const w = b.maxX - b.minX || 1
    const h = b.maxY - b.minY || 1
    const s = size / Math.max(w, h)
    const pts = plan.footprint
      .map(([x, y]) => `${(x - b.minX) * s + 4},${size - (y - b.minY) * s + 4}`)
      .join(' ')
    return (
      <Svg width={size + 8} height={size + 8}>
        <Polygon points={pts} fill="#eff6ff" stroke={NAVY} strokeWidth={1.5} />
      </Svg>
    )
  }
  // rectangle largeur x profondeur
  const s = size / Math.max(plan.width, plan.depth)
  const w = plan.width * s
  const h = plan.depth * s
  return (
    <Svg width={size + 8} height={size + 8}>
      <Rect x={4} y={4} width={w} height={h} fill="#eff6ff" stroke={NAVY} strokeWidth={1.5} />
      <Line x1={4} y1={size + 4} x2={4 + w} y2={size + 4} stroke={BLUE} strokeWidth={0.5} />
    </Svg>
  )
}

function Elevation({ widthVal, heightVal, size }: { widthVal: number; heightVal: number; size: number }) {
  const s = size / Math.max(widthVal, heightVal, 1)
  const w = widthVal * s
  const h = heightVal * s
  return (
    <Svg width={w + 8} height={h + 8}>
      <Rect x={4} y={4} width={w} height={h} fill="#f9fafb" stroke={NAVY} strokeWidth={1.2} />
      {/* ligne de toit simple */}
      <Line x1={4} y1={4} x2={4 + w} y2={4} stroke={BLUE} strokeWidth={1} />
    </Svg>
  )
}

export default function PlanTemplate({ project, plan, companyName, companyLogo }: PlanTemplateProps) {
  const u = plan.unit
  const facadeLabel: Record<string, string> = { front: 'Avant', back: 'Arrière', left: 'Gauche', right: 'Droite' }

  const footer = (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{companyName ?? 'Measura'} — Plans</Text>
      <Text style={styles.footerText}>{project.title}</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )

  return (
    <Document title={`Plans — ${project.title}`} author={companyName ?? 'Measura'}>
      {/* Page 1 — Vue en plan */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>PLANS</Text>
            <Text style={styles.sub}>{project.title}</Text>
          </View>
          {companyLogo && <Image src={companyLogo} style={styles.logo} />}
        </View>

        <Text style={styles.sectionTitle}>Vue en plan</Text>
        <View style={styles.drawingBox}>
          <PlanView plan={plan} size={360} />
          <View style={styles.legendRow}>
            <Text style={styles.legendItem}><Text style={styles.legendLabel}>Largeur : </Text>{fmt(plan.width)} {u}</Text>
            <Text style={styles.legendItem}><Text style={styles.legendLabel}>Profondeur : </Text>{fmt(plan.depth)} {u}</Text>
            <Text style={styles.legendItem}><Text style={styles.legendLabel}>Superficie au sol : </Text>{fmt(plan.width * plan.depth)} {u}²</Text>
          </View>
        </View>
        {plan.estimated && <Text style={styles.note}>* Certaines dimensions sont estimées (modèle 3D ou mesures incomplets).</Text>}

        {footer}
      </Page>

      {/* Page 2 — Élévations */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Élévations</Text>
        <View style={styles.elevGrid}>
          {plan.facades.map((f) => (
            <View key={f.side} style={styles.elevCard}>
              <Text style={styles.elevLabel}>Élévation {facadeLabel[f.side]}</Text>
              <Elevation widthVal={f.length ?? plan.width} heightVal={f.height ?? plan.height} size={150} />
              <View style={[styles.legendRow, { marginTop: 8 }]}>
                <Text style={styles.legendItem}>{fmt(f.length ?? 0)} × {fmt(f.height ?? 0)} {u}</Text>
                {f.area ? <Text style={styles.legendItem}><Text style={styles.legendLabel}>Surface : </Text>{fmt(f.area)} {u}²</Text> : null}
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          Plans schématiques générés automatiquement à des fins d&apos;estimation. Pour permis/construction, faire valider par un professionnel.
        </Text>
        {footer}
      </Page>
    </Document>
  )
}
