// components/report/ReportTemplate.tsx
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import type { Project, Measurement, Photo, FacadeLabel } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportTemplateProps {
  project: Project
  measurements: Measurement[]
  photos: Photo[]        // with signed URLs on .url
  companyName?: string
  companyLogo?: string   // base64 or absolute URL
  locale: 'fr' | 'en'
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  fr: {
    reportTitle:     'RAPPORT DE MESURES',
    preparedBy:      'Préparé par',
    projectInfo:     'Informations du projet',
    projectName:     'Nom du projet',
    address:         'Adresse',
    status:          'Statut',
    unitSystem:      'Système d\'unités',
    createdAt:       'Date de création',
    notes:           'Notes',
    measurementsTitle: 'Tableau des mesures',
    description:     'Description',
    facade:          'Façade',
    type:            'Type',
    value:           'Valeur',
    unit:            'Unité',
    photosTitle:     'Photos du projet',
    summaryTitle:    'Récapitulatif',
    totalWallArea:   'Surface totale des murs',
    totalPerimeter:  'Périmètre total',
    generatedOn:     'Généré le',
    page:            'Page',
    of:              'sur',
    noMeasurements:  'Aucune mesure enregistrée.',
    noPhotos:        'Aucune photo disponible.',
    facadeLabels: {
      front: 'Façade avant',
      back: 'Façade arrière',
      left: 'Façade gauche',
      right: 'Façade droite',
      roof: 'Toit',
      other: 'Autre',
    } as Record<FacadeLabel, string>,
    measurementTypes: {
      line: 'Ligne',
      area: 'Aire',
      angle: 'Angle',
      perimeter: 'Périmètre',
    } as Record<string, string>,
    statuses: {
      draft: 'Brouillon',
      photos_pending: 'Photos requises',
      measuring: 'En mesure',
      review: 'En révision',
      completed: 'Terminé',
      archived: 'Archivé',
    } as Record<string, string>,
  },
  en: {
    reportTitle:     'MEASUREMENTS REPORT',
    preparedBy:      'Prepared by',
    projectInfo:     'Project Information',
    projectName:     'Project Name',
    address:         'Address',
    status:          'Status',
    unitSystem:      'Unit System',
    createdAt:       'Created On',
    notes:           'Notes',
    measurementsTitle: 'Measurements Table',
    description:     'Description',
    facade:          'Facade',
    type:            'Type',
    value:           'Value',
    unit:            'Unit',
    photosTitle:     'Project Photos',
    summaryTitle:    'Summary',
    totalWallArea:   'Total Wall Area',
    totalPerimeter:  'Total Perimeter',
    generatedOn:     'Generated on',
    page:            'Page',
    of:              'of',
    noMeasurements:  'No measurements recorded.',
    noPhotos:        'No photos available.',
    facadeLabels: {
      front: 'Front Facade',
      back: 'Back Facade',
      left: 'Left Facade',
      right: 'Right Facade',
      roof: 'Roof',
      other: 'Other',
    } as Record<FacadeLabel, string>,
    measurementTypes: {
      line: 'Line',
      area: 'Area',
      angle: 'Angle',
      perimeter: 'Perimeter',
    } as Record<string, string>,
    statuses: {
      draft: 'Draft',
      photos_pending: 'Photos Pending',
      measuring: 'Measuring',
      review: 'Review',
      completed: 'Completed',
      archived: 'Archived',
    } as Record<string, string>,
  },
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1f2937',
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 45,
  },
  // Cover page
  coverPage: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1f2937',
    padding: 0,
    backgroundColor: '#1e3a5f',
  },
  coverTop: {
    backgroundColor: '#1e3a5f',
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 45,
    flex: 1,
    justifyContent: 'center',
  },
  coverBottom: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 45,
    paddingVertical: 24,
  },
  coverLogo: {
    width: 80,
    height: 80,
    marginBottom: 24,
    objectFit: 'contain',
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 12,
  },
  coverProjectName: {
    fontSize: 18,
    color: '#93c5fd',
    marginBottom: 8,
  },
  coverAddress: {
    fontSize: 11,
    color: '#bfdbfe',
    marginBottom: 4,
  },
  coverDate: {
    fontSize: 9,
    color: '#93c5fd',
    marginTop: 12,
  },
  coverPreparedBy: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
  // Section titles
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  // Info table
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    width: '35%',
    fontFamily: 'Helvetica-Bold',
    color: '#4b5563',
    fontSize: 9,
  },
  infoValue: {
    flex: 1,
    color: '#1f2937',
    fontSize: 10,
  },
  // Measurements table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginBottom: 2,
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    fontSize: 9,
    color: '#374151',
  },
  facadeGroupHeader: {
    backgroundColor: '#eff6ff',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },
  facadeGroupLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#2563eb',
  },
  // Photo pages
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    width: '47%',
    marginBottom: 16,
  },
  photoImage: {
    width: '100%',
    height: 160,
    objectFit: 'cover',
    borderRadius: 4,
    marginBottom: 4,
  },
  photoCaption: {
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'center',
  },
  // Summary
  summaryCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    marginRight: 8,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#4b5563',
  },
  notesBox: {
    marginTop: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  notesText: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.5,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 45,
    right: 45,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
  emptyState: {
    padding: 20,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 10,
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(isoString: string, locale: 'fr' | 'en'): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return isoString
  }
}

function formatAddress(project: Project): string {
  return [
    project.address_line1,
    project.address_city,
    project.address_province,
    project.address_postal,
    project.address_country,
  ]
    .filter(Boolean)
    .join(', ')
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PageFooter({ companyName, generatedOn }: { companyName?: string; generatedOn: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{companyName ?? 'Measura'}</Text>
      <Text style={styles.footerText}>{generatedOn}</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
      />
    </View>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportTemplate({
  project,
  measurements,
  photos,
  companyName,
  companyLogo,
  locale,
}: ReportTemplateProps) {
  const t = T[locale]
  const today = formatDate(new Date().toISOString(), locale)
  const address = formatAddress(project)

  // Group measurements by facade_side
  const facadeOrder: FacadeLabel[] = ['front', 'back', 'left', 'right', 'roof', 'other']
  const grouped = facadeOrder.reduce<Record<string, Measurement[]>>((acc, side) => {
    const items = measurements.filter((m) => m.facade_side === side)
    if (items.length > 0) acc[side] = items
    return acc
  }, {})
  // Measurements with no facade assigned
  const noFacade = measurements.filter((m) => !m.facade_side)
  if (noFacade.length > 0) grouped['other'] = [...(grouped['other'] ?? []), ...noFacade]

  // Totals
  const totalArea = measurements
    .filter((m) => m.measurement_type === 'area' && m.real_value !== null)
    .reduce((sum, m) => sum + (m.real_value ?? 0), 0)
  const totalPerimeter = measurements
    .filter((m) => (m.measurement_type === 'perimeter' || m.measurement_type === 'line') && m.real_value !== null)
    .reduce((sum, m) => sum + (m.real_value ?? 0), 0)

  // Photos in pairs for 2-per-page layout
  const photosWithUrls = photos.filter((p) => p.url)
  const photoPairs = chunkArray(photosWithUrls, 4) // 4 per page (2×2 grid)

  return (
    <Document
      title={`${t.reportTitle} — ${project.title}`}
      author={companyName ?? 'Measura'}
    >
      {/* ── Page 1: Cover ───────────────────────────────────────────────── */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverTop}>
          {companyLogo && (
            <Image src={companyLogo} style={styles.coverLogo} />
          )}
          <Text style={styles.coverTitle}>{t.reportTitle}</Text>
          <Text style={styles.coverProjectName}>{project.title}</Text>
          {address && <Text style={styles.coverAddress}>{address}</Text>}
          <Text style={styles.coverDate}>{today}</Text>
        </View>
        <View style={styles.coverBottom}>
          {companyName && (
            <Text style={styles.coverPreparedBy}>
              {t.preparedBy} : {companyName}
            </Text>
          )}
        </View>
      </Page>

      {/* ── Page 2: Project info ─────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>{t.projectInfo}</Text>

        <View>
          <InfoRow label={t.projectName} value={project.title} />
          {address && <InfoRow label={t.address} value={address} />}
          <InfoRow label={t.status} value={t.statuses[project.status] ?? project.status} />
          <InfoRow
            label={t.unitSystem}
            value={project.unit_system === 'metric' ? 'Métrique' : 'Impérial'}
          />
          <InfoRow label={t.createdAt} value={formatDate(project.created_at, locale)} />
        </View>

        {project.notes && (
          <View style={[styles.notesBox, { marginTop: 20 }]}>
            <Text style={[styles.infoLabel, { marginBottom: 6 }]}>{t.notes}</Text>
            <Text style={styles.notesText}>{project.notes}</Text>
          </View>
        )}

        <PageFooter companyName={companyName} generatedOn={`${t.generatedOn} ${today}`} />
      </Page>

      {/* ── Page(s) 3+: Measurements table ──────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>{t.measurementsTitle}</Text>

        {measurements.length === 0 ? (
          <Text style={styles.emptyState}>{t.noMeasurements}</Text>
        ) : (
          <>
            {/* Table header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>{t.description}</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>{t.facade}</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>{t.type}</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>{t.value}</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>{t.unit}</Text>
            </View>

            {/* Grouped rows */}
            {Object.entries(grouped).map(([facadeKey, items]) => (
              <View key={facadeKey}>
                <View style={styles.facadeGroupHeader}>
                  <Text style={styles.facadeGroupLabel}>
                    {t.facadeLabels[facadeKey as FacadeLabel] ?? facadeKey}
                  </Text>
                </View>
                {items.map((m, idx) => (
                  <View
                    key={m.id}
                    style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                    wrap={false}
                  >
                    <Text style={[styles.tableCell, { flex: 3 }]}>
                      {m.label ?? '—'}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 2 }]}>
                      {m.facade_side ? (t.facadeLabels[m.facade_side] ?? m.facade_side) : '—'}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 2 }]}>
                      {t.measurementTypes[m.measurement_type] ?? m.measurement_type}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1.5 }]}>
                      {m.real_value !== null ? m.real_value.toFixed(2) : '—'}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>
                      {m.unit}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        <PageFooter companyName={companyName} generatedOn={`${t.generatedOn} ${today}`} />
      </Page>

      {/* ── Photos pages ─────────────────────────────────────────────────── */}
      {photosWithUrls.length > 0 &&
        photoPairs.map((group, pageIdx) => (
          <Page key={`photos-${pageIdx}`} size="A4" style={styles.page}>
            {pageIdx === 0 && (
              <Text style={styles.sectionTitle}>{t.photosTitle}</Text>
            )}
            <View style={styles.photoGrid}>
              {group.map((photo) => (
                <View key={photo.id} style={styles.photoItem}>
                  <Image
                    src={photo.url!}
                    style={styles.photoImage}
                  />
                  <Text style={styles.photoCaption}>
                    {photo.original_name ?? ''}
                    {photo.facade_label
                      ? ` — ${t.facadeLabels[photo.facade_label]}`
                      : ''}
                  </Text>
                </View>
              ))}
            </View>

            <PageFooter companyName={companyName} generatedOn={`${t.generatedOn} ${today}`} />
          </Page>
        ))}

      {/* ── Last page: Summary ───────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>{t.summaryTitle}</Text>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Text style={styles.summaryValue}>{totalArea.toFixed(2)}</Text>
            <View>
              <Text style={styles.summaryLabel}>{t.totalWallArea}</Text>
              <Text style={[styles.summaryLabel, { fontFamily: 'Helvetica-Bold' }]}>
                {project.unit_system === 'metric' ? 'm²' : 'pi²'}
              </Text>
            </View>
          </View>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Text style={styles.summaryValue}>{totalPerimeter.toFixed(2)}</Text>
            <View>
              <Text style={styles.summaryLabel}>{t.totalPerimeter}</Text>
              <Text style={[styles.summaryLabel, { fontFamily: 'Helvetica-Bold' }]}>
                {project.unit_system === 'metric' ? 'm' : 'pi'}
              </Text>
            </View>
          </View>
        </View>

        {project.notes && (
          <View style={styles.notesBox}>
            <Text style={[styles.infoLabel, { marginBottom: 6 }]}>{t.notes}</Text>
            <Text style={styles.notesText}>{project.notes}</Text>
          </View>
        )}

        <PageFooter companyName={companyName} generatedOn={`${t.generatedOn} ${today}`} />
      </Page>
    </Document>
  )
}

// ─── Tiny helper ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}
