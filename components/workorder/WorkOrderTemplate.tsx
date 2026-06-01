// components/workorder/WorkOrderTemplate.tsx
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import type { Photo, Project, WorkOrder } from '@/lib/supabase/types'

// ─── Props ──────────────────────────────────────────────────────────────────

export interface WorkOrderTemplateProps {
  workOrder: WorkOrder
  project: Project
  photos: Photo[] // signed URLs on .url
  companyName?: string
  companyLogo?: string
  companyPhone?: string
  locale: 'fr' | 'en'
}

// ─── i18n ───────────────────────────────────────────────────────────────────

const T = {
  fr: {
    title: 'BON DE TRAVAIL',
    no: 'N°',
    client: 'Client',
    name: 'Nom',
    phone: 'Téléphone',
    email: 'Courriel',
    address: 'Adresse',
    schedule: 'Planification',
    scheduledDate: 'Date prévue',
    crewLead: 'Chef d’équipe',
    crew: 'Équipe',
    estHours: 'Heures estimées',
    workType: 'Type de travaux',
    measurements: 'Mesures',
    surface: 'Surface / Élément',
    value: 'Valeur',
    products: 'Produits & matériaux',
    product: 'Produit',
    brand: 'Marque',
    color: 'Couleur',
    code: 'Code',
    qty: 'Qté',
    instructions: 'Instructions',
    preparation: 'Préparation',
    application: 'Application',
    cleanup: 'Nettoyage',
    qualityControl: 'Contrôle qualité',
    photosRef: 'Photos de référence',
    checklist: 'Checklist',
    before: 'Avant travaux',
    during: 'Pendant travaux',
    after: 'Après travaux',
    validation: 'Validation & signatures',
    crewSignature: 'Signature chef d’équipe',
    clientSignature: 'Signature client',
    signedOn: 'Signé le',
    notSigned: 'Non signé',
    notes: 'Notes',
    generatedOn: 'Généré le',
    none: 'Aucun',
  },
  en: {
    title: 'WORK ORDER',
    no: 'No.',
    client: 'Client',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    schedule: 'Scheduling',
    scheduledDate: 'Scheduled date',
    crewLead: 'Crew lead',
    crew: 'Crew',
    estHours: 'Estimated hours',
    workType: 'Work type',
    measurements: 'Measurements',
    surface: 'Surface / Item',
    value: 'Value',
    products: 'Products & materials',
    product: 'Product',
    brand: 'Brand',
    color: 'Color',
    code: 'Code',
    qty: 'Qty',
    instructions: 'Instructions',
    preparation: 'Preparation',
    application: 'Application',
    cleanup: 'Cleanup',
    qualityControl: 'Quality control',
    photosRef: 'Reference photos',
    checklist: 'Checklist',
    before: 'Before work',
    during: 'During work',
    after: 'After work',
    validation: 'Validation & signatures',
    crewSignature: 'Crew lead signature',
    clientSignature: 'Client signature',
    signedOn: 'Signed on',
    notSigned: 'Not signed',
    notes: 'Notes',
    generatedOn: 'Generated on',
    none: 'None',
  },
}

const WORK_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  painting: { fr: 'Peinture', en: 'Painting' },
  roofing: { fr: 'Toiture', en: 'Roofing' },
  siding: { fr: 'Revêtement', en: 'Siding' },
  windows: { fr: 'Fenêtres', en: 'Windows' },
  doors: { fr: 'Portes', en: 'Doors' },
  inspection: { fr: 'Inspection', en: 'Inspection' },
  insurance: { fr: 'Assurance', en: 'Insurance' },
  cleaning: { fr: 'Nettoyage', en: 'Cleaning' },
  repair: { fr: 'Réparation', en: 'Repair' },
  other: { fr: 'Autre', en: 'Other' },
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: '#1f2937',
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 42,
  },
  // Header band
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#1e3a5f',
    marginHorizontal: -42,
    marginTop: -40,
    paddingHorizontal: 42,
    paddingTop: 28,
    paddingBottom: 20,
    marginBottom: 18,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 46, height: 46, objectFit: 'contain' },
  headerTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#ffffff', letterSpacing: 1 },
  headerCompany: { fontSize: 10, color: '#bfdbfe', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  woNumber: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  woDate: { fontSize: 8, color: '#93c5fd', marginTop: 3 },
  woProject: { fontSize: 9, color: '#dbeafe', marginTop: 3, maxWidth: 200, textAlign: 'right' },

  // Two-column row of cards
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 10,
  },
  cardTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#2563eb',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  kvRow: { flexDirection: 'row', marginBottom: 2.5 },
  kvLabel: { width: '38%', color: '#6b7280', fontSize: 8.5 },
  kvValue: { flex: 1, color: '#1f2937', fontSize: 8.5 },

  sectionTitle: {
    fontSize: 11.5,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    marginTop: 6,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: '#2563eb',
  },

  // Table
  tHead: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 2,
  },
  tHeadCell: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  tRow: {
    flexDirection: 'row',
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tRowAlt: { backgroundColor: '#f9fafb' },
  tCell: { fontSize: 8.5, color: '#374151' },

  // Instructions
  instrBlock: { marginBottom: 8 },
  instrLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1e3a5f', marginBottom: 2 },
  instrText: { fontSize: 8.5, color: '#374151', lineHeight: 1.45 },

  // Checklist
  checkColumns: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  checkCol: { flex: 1 },
  checkColTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#2563eb',
    marginBottom: 5,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  checkItem: { flexDirection: 'row', marginBottom: 4, alignItems: 'flex-start' },
  checkBox: {
    width: 9,
    height: 9,
    borderWidth: 1,
    borderColor: '#9ca3af',
    borderRadius: 2,
    marginRight: 5,
    marginTop: 0.5,
    textAlign: 'center',
    fontSize: 7,
    color: '#16a34a',
  },
  checkText: { flex: 1, fontSize: 8, color: '#374151', lineHeight: 1.35 },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { width: '31.5%' },
  photoImage: { width: '100%', height: 90, objectFit: 'cover', borderRadius: 3, marginBottom: 2 },
  photoCaption: { fontSize: 7, color: '#6b7280', textAlign: 'center' },

  // Signatures
  signRow: { flexDirection: 'row', gap: 16, marginTop: 6 },
  signBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 10,
    minHeight: 96,
  },
  signTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#1e3a5f', marginBottom: 6 },
  signImage: { width: 150, height: 46, objectFit: 'contain' },
  signLine: { borderTopWidth: 1, borderTopColor: '#9ca3af', marginTop: 30, paddingTop: 4 },
  signName: { fontSize: 9, color: '#1f2937', fontFamily: 'Helvetica-Bold' },
  signDate: { fontSize: 7.5, color: '#9ca3af', marginTop: 2 },
  signEmpty: { fontSize: 8, color: '#9ca3af', fontStyle: 'italic', marginTop: 30 },

  notesBox: {
    marginTop: 4,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  notesText: { fontSize: 8.5, color: '#374151', lineHeight: 1.45 },
  empty: { fontSize: 8.5, color: '#9ca3af', fontStyle: 'italic', paddingVertical: 4 },

  footer: {
    position: 'absolute',
    bottom: 22,
    left: 42,
    right: 42,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
  },
  footerText: { fontSize: 7.5, color: '#9ca3af' },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined, locale: 'fr' | 'en'): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value || '—'}</Text>
    </View>
  )
}

function ChecklistColumn({
  title,
  items,
}: {
  title: string
  items: { label: string; checked: boolean }[]
}) {
  return (
    <View style={styles.checkCol}>
      <Text style={styles.checkColTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.checkText}>—</Text>
      ) : (
        items.map((it, i) => (
          <View key={i} style={styles.checkItem} wrap={false}>
            <Text style={styles.checkBox}>{it.checked ? 'X' : ' '}</Text>
            <Text style={styles.checkText}>{it.label}</Text>
          </View>
        ))
      )}
    </View>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function WorkOrderTemplate({
  workOrder,
  project,
  photos,
  companyName,
  companyLogo,
  companyPhone,
  locale,
}: WorkOrderTemplateProps) {
  const t = T[locale]
  const today = fmtDate(new Date().toISOString(), locale)

  const wt = workOrder.work_type
    ? WORK_TYPE_LABELS[workOrder.work_type]?.[locale] ?? workOrder.work_type
    : '—'

  const products = workOrder.products ?? []
  const measurements = workOrder.measurements_summary ?? []
  const instr = workOrder.instructions ?? {}
  const checklist = workOrder.checklist ?? {}
  const photosWithUrls = photos.filter((p) => p.url)

  const footer = (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{companyName ?? 'Measura'}</Text>
      <Text style={styles.footerText}>{`${t.title} ${t.no} ${workOrder.wo_number}`}</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  )

  return (
    <Document title={`${t.title} ${t.no} ${workOrder.wo_number} — ${project.title}`} author={companyName ?? 'Measura'}>
      {/* ── Page 1 ── */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {companyLogo && <Image src={companyLogo} style={styles.logo} />}
            <View>
              <Text style={styles.headerTitle}>{t.title}</Text>
              <Text style={styles.headerCompany}>
                {(companyName ?? 'Measura') + (companyPhone ? ` · ${companyPhone}` : '')}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.woNumber}>{`${t.no} ${workOrder.wo_number}`}</Text>
            <Text style={styles.woDate}>{today}</Text>
            <Text style={styles.woProject}>{project.title}</Text>
          </View>
        </View>

        {/* Client + planning cards */}
        <View style={styles.cardRow}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.client}</Text>
            <KV label={t.name} value={workOrder.client_name ?? ''} />
            <KV label={t.phone} value={workOrder.client_phone ?? ''} />
            <KV label={t.email} value={workOrder.client_email ?? ''} />
            <KV label={t.address} value={workOrder.site_address ?? ''} />
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.schedule}</Text>
            <KV label={t.workType} value={wt} />
            <KV label={t.scheduledDate} value={fmtDate(workOrder.scheduled_date, locale)} />
            <KV label={t.crewLead} value={workOrder.crew_lead ?? ''} />
            <KV label={t.crew} value={workOrder.crew_members ?? ''} />
            <KV
              label={t.estHours}
              value={workOrder.estimated_hours != null ? String(workOrder.estimated_hours) : ''}
            />
          </View>
        </View>

        {/* Measurements */}
        <Text style={styles.sectionTitle}>{t.measurements}</Text>
        {measurements.length === 0 ? (
          <Text style={styles.empty}>{t.none}</Text>
        ) : (
          <>
            <View style={styles.tHead}>
              <Text style={[styles.tHeadCell, { flex: 4 }]}>{t.surface}</Text>
              <Text style={[styles.tHeadCell, { flex: 2 }]}>{t.value}</Text>
            </View>
            {measurements.map((m, i) => (
              <View key={i} style={[styles.tRow, i % 2 === 1 ? styles.tRowAlt : {}]} wrap={false}>
                <Text style={[styles.tCell, { flex: 4 }]}>
                  {m.label}
                  {m.facade_side ? ` (${m.facade_side})` : ''}
                </Text>
                <Text style={[styles.tCell, { flex: 2 }]}>
                  {m.value != null ? `${m.value.toFixed(2)} ${m.unit ?? ''}` : '—'}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Products */}
        <Text style={styles.sectionTitle}>{t.products}</Text>
        {products.length === 0 ? (
          <Text style={styles.empty}>{t.none}</Text>
        ) : (
          <>
            <View style={styles.tHead}>
              <Text style={[styles.tHeadCell, { flex: 4 }]}>{t.product}</Text>
              <Text style={[styles.tHeadCell, { flex: 2 }]}>{t.brand}</Text>
              <Text style={[styles.tHeadCell, { flex: 2 }]}>{t.color}</Text>
              <Text style={[styles.tHeadCell, { flex: 1.5 }]}>{t.code}</Text>
              <Text style={[styles.tHeadCell, { flex: 1.5 }]}>{t.qty}</Text>
            </View>
            {products.map((p, i) => (
              <View key={i} style={[styles.tRow, i % 2 === 1 ? styles.tRowAlt : {}]} wrap={false}>
                <Text style={[styles.tCell, { flex: 4 }]}>{p.name}</Text>
                <Text style={[styles.tCell, { flex: 2 }]}>{p.brand ?? '—'}</Text>
                <Text style={[styles.tCell, { flex: 2 }]}>{p.color ?? '—'}</Text>
                <Text style={[styles.tCell, { flex: 1.5 }]}>{p.color_code ?? '—'}</Text>
                <Text style={[styles.tCell, { flex: 1.5 }]}>
                  {p.quantity != null ? `${p.quantity} ${p.unit ?? ''}` : '—'}
                </Text>
              </View>
            ))}
          </>
        )}

        {footer}
      </Page>

      {/* ── Page 2 : Instructions + Checklist + Photos ── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>{t.instructions}</Text>
        <View style={styles.instrBlock}>
          <Text style={styles.instrLabel}>{t.preparation}</Text>
          <Text style={styles.instrText}>{instr.preparation || '—'}</Text>
        </View>
        <View style={styles.instrBlock}>
          <Text style={styles.instrLabel}>{t.application}</Text>
          <Text style={styles.instrText}>{instr.application || '—'}</Text>
        </View>
        <View style={styles.instrBlock}>
          <Text style={styles.instrLabel}>{t.cleanup}</Text>
          <Text style={styles.instrText}>{instr.cleanup || '—'}</Text>
        </View>
        <View style={styles.instrBlock}>
          <Text style={styles.instrLabel}>{t.qualityControl}</Text>
          <Text style={styles.instrText}>{instr.quality_control || '—'}</Text>
        </View>

        <Text style={styles.sectionTitle}>{t.checklist}</Text>
        <View style={styles.checkColumns}>
          <ChecklistColumn title={t.before} items={checklist.before ?? []} />
          <ChecklistColumn title={t.during} items={checklist.during ?? []} />
          <ChecklistColumn title={t.after} items={checklist.after ?? []} />
        </View>

        {photosWithUrls.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t.photosRef}</Text>
            <View style={styles.photoGrid}>
              {photosWithUrls.map((photo) => (
                <View key={photo.id} style={styles.photoItem}>
                  <Image src={photo.url!} style={styles.photoImage} />
                  <Text style={styles.photoCaption}>
                    {photo.facade_label ?? photo.original_name ?? ''}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {footer}
      </Page>

      {/* ── Page 3 : Notes + signatures ── */}
      <Page size="A4" style={styles.page}>
        {workOrder.notes && (
          <>
            <Text style={styles.sectionTitle}>{t.notes}</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{workOrder.notes}</Text>
            </View>
          </>
        )}

        <Text style={[styles.sectionTitle, { marginTop: workOrder.notes ? 16 : 6 }]}>
          {t.validation}
        </Text>
        <View style={styles.signRow}>
          {/* Crew lead */}
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>{t.crewSignature}</Text>
            {workOrder.crew_signature ? (
              <Image src={workOrder.crew_signature} style={styles.signImage} />
            ) : (
              <Text style={styles.signEmpty}>{t.notSigned}</Text>
            )}
            <View style={styles.signLine}>
              <Text style={styles.signName}>{workOrder.crew_signed_name ?? '—'}</Text>
              {workOrder.crew_signed_at && (
                <Text style={styles.signDate}>
                  {`${t.signedOn} ${fmtDate(workOrder.crew_signed_at, locale)}`}
                </Text>
              )}
            </View>
          </View>
          {/* Client */}
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>{t.clientSignature}</Text>
            {workOrder.client_signature ? (
              <Image src={workOrder.client_signature} style={styles.signImage} />
            ) : (
              <Text style={styles.signEmpty}>{t.notSigned}</Text>
            )}
            <View style={styles.signLine}>
              <Text style={styles.signName}>{workOrder.client_signed_name ?? '—'}</Text>
              {workOrder.client_signed_at && (
                <Text style={styles.signDate}>
                  {`${t.signedOn} ${fmtDate(workOrder.client_signed_at, locale)}`}
                </Text>
              )}
            </View>
          </View>
        </View>

        {footer}
      </Page>
    </Document>
  )
}
