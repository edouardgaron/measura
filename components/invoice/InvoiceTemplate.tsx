// components/invoice/InvoiceTemplate.tsx
import React from 'react'
import { APP_NAME } from '@/lib/brand'
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import type { Invoice, InvoiceItem } from '@/lib/supabase/types'

export interface InvoiceTemplateProps {
  invoice: Invoice
  items: InvoiceItem[]
  companyName?: string
  companyLogo?: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
}

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: '#1f2937', padding: 44 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  logo: { width: 56, height: 56, objectFit: 'contain', marginBottom: 8 },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1e3a5f' },
  companyMeta: { fontSize: 8.5, color: '#6b7280', marginTop: 2 },
  invoiceTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#1e3a5f', letterSpacing: 1, textAlign: 'right' },
  invoiceNo: { fontSize: 11, color: '#2563eb', textAlign: 'right', marginTop: 4 },
  invoiceMeta: { fontSize: 9, color: '#6b7280', textAlign: 'right', marginTop: 2 },

  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  billBox: { width: '48%' },
  billLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  billText: { fontSize: 9.5, color: '#374151', lineHeight: 1.4 },

  tHead: { flexDirection: 'row', backgroundColor: '#1e3a5f', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 2 },
  tHeadCell: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
  tRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tRowAlt: { backgroundColor: '#f9fafb' },
  tCell: { fontSize: 9, color: '#374151' },

  totals: { marginTop: 16, marginLeft: 'auto', width: '46%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { fontSize: 9.5, color: '#6b7280' },
  totalValue: { fontSize: 9.5, color: '#1f2937' },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 8, marginTop: 4, backgroundColor: '#1e3a5f', borderRadius: 3 },
  grandLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  grandValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 8, marginTop: 4, backgroundColor: '#eff6ff', borderRadius: 3 },
  balanceLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1e3a5f' },
  balanceValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1e3a5f' },

  notesBox: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12 },
  notesLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', marginBottom: 3 },
  notesText: { fontSize: 8.5, color: '#6b7280', lineHeight: 1.4 },

  footer: { position: 'absolute', bottom: 26, left: 44, right: 44, textAlign: 'center', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8 },
  footerText: { fontSize: 7.5, color: '#9ca3af', textAlign: 'center' },
  statusBadge: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#ffffff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, marginTop: 6, alignSelf: 'flex-end' },
})

const STATUS_LABEL: Record<string, string> = {
  draft: 'BROUILLON', sent: 'ENVOYÉE', partial: 'PARTIELLE', paid: 'PAYÉE', overdue: 'EN RETARD', cancelled: 'ANNULÉE',
}
const STATUS_COLOR: Record<string, string> = {
  draft: '#9ca3af', sent: '#2563eb', partial: '#f59e0b', paid: '#16a34a', overdue: '#ef4444', cancelled: '#6b7280',
}

function money(n: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n ?? 0)
}
function frDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

export default function InvoiceTemplate({
  invoice, items, companyName, companyLogo, companyAddress, companyPhone, companyEmail,
}: InvoiceTemplateProps) {
  const balance = (invoice.total ?? 0) - (invoice.amount_paid ?? 0)
  const gstPct = ((invoice.tax_gst_rate ?? 0) * 100).toFixed(3).replace(/\.?0+$/, '')
  const qstPct = ((invoice.tax_qst_rate ?? 0) * 100).toFixed(3).replace(/\.?0+$/, '')

  return (
    <Document title={`Facture ${invoice.invoice_number}`} author={companyName ?? APP_NAME}>
      <Page size="A4" style={styles.page}>
        <View style={styles.topRow}>
          <View>
            {companyLogo && <Image src={companyLogo} style={styles.logo} />}
            <Text style={styles.companyName}>{companyName ?? APP_NAME}</Text>
            {companyAddress && <Text style={styles.companyMeta}>{companyAddress}</Text>}
            {companyPhone && <Text style={styles.companyMeta}>{companyPhone}</Text>}
            {companyEmail && <Text style={styles.companyMeta}>{companyEmail}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>FACTURE</Text>
            <Text style={styles.invoiceNo}>{invoice.invoice_number}</Text>
            <Text style={styles.invoiceMeta}>Émise le {frDate(invoice.issue_date)}</Text>
            {invoice.due_date && <Text style={styles.invoiceMeta}>Échéance : {frDate(invoice.due_date)}</Text>}
            <Text style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[invoice.status] ?? '#9ca3af' }]}>
              {STATUS_LABEL[invoice.status] ?? invoice.status}
            </Text>
          </View>
        </View>

        <View style={styles.billRow}>
          <View style={styles.billBox}>
            <Text style={styles.billLabel}>Facturé à</Text>
            <Text style={styles.billText}>{invoice.client_name ?? '—'}</Text>
            {invoice.client_address && <Text style={styles.billText}>{invoice.client_address}</Text>}
            {invoice.client_email && <Text style={styles.billText}>{invoice.client_email}</Text>}
          </View>
        </View>

        {/* Lignes */}
        <View style={styles.tHead}>
          <Text style={[styles.tHeadCell, { flex: 5 }]}>Description</Text>
          <Text style={[styles.tHeadCell, { flex: 1.3 }]}>Qté</Text>
          <Text style={[styles.tHeadCell, { flex: 1.3 }]}>Unité</Text>
          <Text style={[styles.tHeadCell, { flex: 2 }]}>Prix unit.</Text>
          <Text style={[styles.tHeadCell, { flex: 2, textAlign: 'right' }]}>Total</Text>
        </View>
        {items.map((it, i) => (
          <View key={it.id} style={[styles.tRow, i % 2 === 1 ? styles.tRowAlt : {}]} wrap={false}>
            <Text style={[styles.tCell, { flex: 5 }]}>{it.description}</Text>
            <Text style={[styles.tCell, { flex: 1.3 }]}>{it.quantity}</Text>
            <Text style={[styles.tCell, { flex: 1.3 }]}>{it.unit ?? '—'}</Text>
            <Text style={[styles.tCell, { flex: 2 }]}>{money(it.unit_price)}</Text>
            <Text style={[styles.tCell, { flex: 2, textAlign: 'right' }]}>{money(it.total)}</Text>
          </View>
        ))}

        {/* Totaux */}
        <View style={styles.totals}>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Sous-total</Text><Text style={styles.totalValue}>{money(invoice.subtotal)}</Text></View>
          {invoice.discount_amount > 0 && (
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Rabais</Text><Text style={styles.totalValue}>- {money(invoice.discount_amount)}</Text></View>
          )}
          <View style={styles.totalRow}><Text style={styles.totalLabel}>TPS ({gstPct}%)</Text><Text style={styles.totalValue}>{money(invoice.tax_gst)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>TVQ ({qstPct}%)</Text><Text style={styles.totalValue}>{money(invoice.tax_qst)}</Text></View>
          <View style={styles.grandRow}><Text style={styles.grandLabel}>TOTAL</Text><Text style={styles.grandValue}>{money(invoice.total)}</Text></View>
          {invoice.amount_paid > 0 && (
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Déjà payé</Text><Text style={styles.totalValue}>- {money(invoice.amount_paid)}</Text></View>
          )}
          <View style={styles.balanceRow}><Text style={styles.balanceLabel}>Solde dû</Text><Text style={styles.balanceValue}>{money(balance)}</Text></View>
          {invoice.deposit_amount > 0 && invoice.amount_paid < invoice.deposit_amount && (
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Dépôt demandé</Text><Text style={styles.totalValue}>{money(invoice.deposit_amount)}</Text></View>
          )}
        </View>

        {(invoice.notes || invoice.terms) && (
          <View style={styles.notesBox}>
            {invoice.notes && (<><Text style={styles.notesLabel}>Notes</Text><Text style={styles.notesText}>{invoice.notes}</Text></>)}
            {invoice.terms && (<><Text style={[styles.notesLabel, { marginTop: 8 }]}>Conditions</Text><Text style={styles.notesText}>{invoice.terms}</Text></>)}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{(companyName ?? APP_NAME) + ` · Facture ${invoice.invoice_number}`}</Text>
        </View>
      </Page>
    </Document>
  )
}
