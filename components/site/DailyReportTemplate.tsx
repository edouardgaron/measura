// components/site/DailyReportTemplate.tsx
import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import type {
  DailyReport,
  DailyReportMaterial,
  Photo,
  Project,
  SiteIssue,
  TimeEntry,
} from '@/lib/supabase/types'

export interface DailyReportTemplateProps {
  report: DailyReport
  timeEntries: TimeEntry[]
  materials: DailyReportMaterial[]
  issues: SiteIssue[]
  project: Project
  photos: Photo[] // signed URLs
  companyName?: string
  companyLogo?: string
}

const WEATHER_LABELS: Record<string, string> = {
  sunny: 'Ensoleillé',
  cloudy: 'Nuageux',
  rain: 'Pluie',
  snow: 'Neige',
  wind: 'Vent',
  cold: 'Froid',
  hot: 'Chaud',
}
const TYPE_LABELS: Record<string, string> = {
  delay: 'Retard',
  issue: 'Problème',
  risk: 'Risque',
  safety: 'Sécurité',
  quality: 'Qualité',
}
const SEVERITY_LABELS: Record<string, string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
  critical: 'Critique',
}

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9.5, color: '#1f2937', paddingTop: 40, paddingBottom: 54, paddingHorizontal: 42 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    backgroundColor: '#0f766e', marginHorizontal: -42, marginTop: -40,
    paddingHorizontal: 42, paddingTop: 26, paddingBottom: 18, marginBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 44, height: 44, objectFit: 'contain' },
  headerTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#ffffff', letterSpacing: 1 },
  headerSub: { fontSize: 9, color: '#99f6e4', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  headerProject: { fontSize: 9, color: '#ccfbf1', marginTop: 3, maxWidth: 200, textAlign: 'right' },

  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metaCard: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, padding: 8, alignItems: 'center' },
  metaValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#0f766e' },
  metaLabel: { fontSize: 7.5, color: '#6b7280', marginTop: 2, textTransform: 'uppercase' },

  sectionTitle: {
    fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#115e59', marginTop: 8, marginBottom: 7,
    paddingBottom: 4, borderBottomWidth: 1.5, borderBottomColor: '#0f766e',
  },
  text: { fontSize: 9, color: '#374151', lineHeight: 1.45, marginBottom: 6 },

  tHead: { flexDirection: 'row', backgroundColor: '#0f766e', paddingVertical: 5, paddingHorizontal: 6, borderRadius: 2 },
  tHeadCell: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  tRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tRowAlt: { backgroundColor: '#f9fafb' },
  tCell: { fontSize: 8.5, color: '#374151' },
  tFoot: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, backgroundColor: '#f0fdfa', borderRadius: 2, marginTop: 2 },
  tFootCell: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#115e59' },

  issueRow: { flexDirection: 'row', marginBottom: 4, gap: 6, alignItems: 'flex-start' },
  badge: { fontSize: 7, color: '#ffffff', borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1.5 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { width: '31.5%' },
  photoImage: { width: '100%', height: 88, objectFit: 'cover', borderRadius: 3, marginBottom: 2 },
  photoCaption: { fontSize: 7, color: '#6b7280', textAlign: 'center' },

  summaryBox: { backgroundColor: '#f0fdfa', borderRadius: 4, padding: 10, borderWidth: 1, borderColor: '#99f6e4', marginBottom: 8 },
  summaryText: { fontSize: 8.5, color: '#134e4a', lineHeight: 1.5 },

  footer: {
    position: 'absolute', bottom: 22, left: 42, right: 42, flexDirection: 'row',
    justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6,
  },
  footerText: { fontSize: 7.5, color: '#9ca3af' },
  empty: { fontSize: 8.5, color: '#9ca3af', fontStyle: 'italic', paddingVertical: 3 },
})

function money(n: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n)
}
function frDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}
const SEVERITY_COLOR: Record<string, string> = { low: '#9ca3af', medium: '#f59e0b', high: '#ef4444', critical: '#991b1b' }

export default function DailyReportTemplate({
  report, timeEntries, materials, issues, project, photos, companyName, companyLogo,
}: DailyReportTemplateProps) {
  const totalHours = timeEntries.reduce((s, t) => s + (t.hours ?? 0), 0)
  const laborCost = timeEntries.reduce((s, t) => s + (t.labor_cost ?? 0), 0)
  const materialCost = materials.reduce((s, m) => s + (m.total_cost ?? 0), 0)
  const photosWithUrls = photos.filter((p) => p.url)

  const footer = (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{companyName ?? 'Measura'}</Text>
      <Text style={styles.footerText}>Rapport journalier — {frDate(report.report_date)}</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )

  return (
    <Document title={`Rapport journalier ${frDate(report.report_date)} — ${project.title}`} author={companyName ?? 'Measura'}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {companyLogo && <Image src={companyLogo} style={styles.logo} />}
            <View>
              <Text style={styles.headerTitle}>RAPPORT JOURNALIER</Text>
              <Text style={styles.headerSub}>{companyName ?? 'Measura'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerDate}>{frDate(report.report_date)}</Text>
            <Text style={styles.headerProject}>{project.title}</Text>
          </View>
        </View>

        {/* KPIs */}
        <View style={styles.metaRow}>
          <View style={styles.metaCard}>
            <Text style={styles.metaValue}>{timeEntries.length}</Text>
            <Text style={styles.metaLabel}>Travailleurs</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaValue}>{totalHours.toFixed(1)} h</Text>
            <Text style={styles.metaLabel}>Heures</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaValue}>{report.progress_percent != null ? `${report.progress_percent}%` : '—'}</Text>
            <Text style={styles.metaLabel}>Avancement</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaValue}>
              {report.weather ? WEATHER_LABELS[report.weather] ?? report.weather : '—'}
              {report.temperature != null ? ` ${report.temperature}°` : ''}
            </Text>
            <Text style={styles.metaLabel}>Météo</Text>
          </View>
        </View>

        {/* Travaux */}
        <Text style={styles.sectionTitle}>Travaux effectués</Text>
        <Text style={styles.text}>{report.work_performed || '—'}</Text>

        {/* Main d'œuvre */}
        <Text style={styles.sectionTitle}>Main d&apos;œuvre</Text>
        {timeEntries.length === 0 ? (
          <Text style={styles.empty}>Aucun pointage.</Text>
        ) : (
          <>
            <View style={styles.tHead}>
              <Text style={[styles.tHeadCell, { flex: 4 }]}>Employé</Text>
              <Text style={[styles.tHeadCell, { flex: 2 }]}>Entrée</Text>
              <Text style={[styles.tHeadCell, { flex: 2 }]}>Sortie</Text>
              <Text style={[styles.tHeadCell, { flex: 1.5 }]}>Heures</Text>
              <Text style={[styles.tHeadCell, { flex: 2 }]}>Coût</Text>
            </View>
            {timeEntries.map((t, i) => (
              <View key={t.id} style={[styles.tRow, i % 2 === 1 ? styles.tRowAlt : {}]} wrap={false}>
                <Text style={[styles.tCell, { flex: 4 }]}>{t.employee?.full_name ?? t.employee_name ?? '—'}</Text>
                <Text style={[styles.tCell, { flex: 2 }]}>{t.clock_in?.slice(0, 5) ?? '—'}</Text>
                <Text style={[styles.tCell, { flex: 2 }]}>{t.clock_out?.slice(0, 5) ?? '—'}</Text>
                <Text style={[styles.tCell, { flex: 1.5 }]}>{(t.hours ?? 0).toFixed(2)}</Text>
                <Text style={[styles.tCell, { flex: 2 }]}>{money(t.labor_cost ?? 0)}</Text>
              </View>
            ))}
            <View style={styles.tFoot}>
              <Text style={[styles.tFootCell, { flex: 8 }]}>Total</Text>
              <Text style={[styles.tFootCell, { flex: 1.5 }]}>{totalHours.toFixed(2)}</Text>
              <Text style={[styles.tFootCell, { flex: 2 }]}>{money(laborCost)}</Text>
            </View>
          </>
        )}

        {/* Matériaux */}
        <Text style={styles.sectionTitle}>Matériaux consommés</Text>
        {materials.length === 0 ? (
          <Text style={styles.empty}>Aucun matériau.</Text>
        ) : (
          <>
            <View style={styles.tHead}>
              <Text style={[styles.tHeadCell, { flex: 5 }]}>Description</Text>
              <Text style={[styles.tHeadCell, { flex: 2 }]}>Qté</Text>
              <Text style={[styles.tHeadCell, { flex: 2 }]}>Coût</Text>
            </View>
            {materials.map((m, i) => (
              <View key={m.id} style={[styles.tRow, i % 2 === 1 ? styles.tRowAlt : {}]} wrap={false}>
                <Text style={[styles.tCell, { flex: 5 }]}>{m.description}</Text>
                <Text style={[styles.tCell, { flex: 2 }]}>{m.quantity != null ? `${m.quantity} ${m.unit ?? ''}` : '—'}</Text>
                <Text style={[styles.tCell, { flex: 2 }]}>{money(m.total_cost ?? 0)}</Text>
              </View>
            ))}
            <View style={styles.tFoot}>
              <Text style={[styles.tFootCell, { flex: 7 }]}>Total matériaux</Text>
              <Text style={[styles.tFootCell, { flex: 2 }]}>{money(materialCost)}</Text>
            </View>
          </>
        )}

        {footer}
      </Page>

      {/* Page 2 : problèmes, incidents, photos, résumés */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Problèmes / retards / risques</Text>
        {issues.length === 0 ? (
          <Text style={styles.empty}>Aucun point signalé.</Text>
        ) : (
          issues.map((it) => (
            <View key={it.id} style={styles.issueRow} wrap={false}>
              <Text style={[styles.badge, { backgroundColor: SEVERITY_COLOR[it.severity] ?? '#9ca3af' }]}>
                {SEVERITY_LABELS[it.severity] ?? it.severity}
              </Text>
              <Text style={[styles.tCell, { flex: 1 }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{TYPE_LABELS[it.type] ?? it.type} — </Text>
                {it.title}
                {it.description ? ` : ${it.description}` : ''}
                {it.status === 'resolved' ? ' (résolu)' : ''}
              </Text>
            </View>
          ))
        )}

        {report.incidents && (
          <>
            <Text style={styles.sectionTitle}>Incidents</Text>
            <Text style={styles.text}>{report.incidents}</Text>
          </>
        )}

        {photosWithUrls.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Photos du chantier</Text>
            <View style={styles.photoGrid}>
              {photosWithUrls.map((p) => (
                <View key={p.id} style={styles.photoItem}>
                  <Image src={p.url!} style={styles.photoImage} />
                  <Text style={styles.photoCaption}>{p.facade_label ?? p.original_name ?? ''}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {report.generated_summary && (
          <>
            <Text style={styles.sectionTitle}>Synthèse (direction)</Text>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{report.generated_summary}</Text>
            </View>
          </>
        )}

        {report.comments && (
          <>
            <Text style={styles.sectionTitle}>Commentaires</Text>
            <Text style={styles.text}>{report.comments}</Text>
          </>
        )}

        {footer}
      </Page>
    </Document>
  )
}
