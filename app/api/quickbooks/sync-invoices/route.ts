// app/api/quickbooks/sync-invoices/route.ts
// Pousse vers QuickBooks toutes les factures non encore synchronisées
// (statut envoyée/partielle/payée/en retard, qb_invoice_id null).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushInvoiceToQuickBooks } from '@/lib/quickbooks/api'
import type { InvoiceItem } from '@/lib/supabase/types'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Factures éligibles des projets de l'utilisateur, non synchronisées.
  const { data: projects } = await supabase.from('projects').select('id').eq('owner_id', user.id)
  const ids = (projects ?? []).map((p) => p.id)
  if (ids.length === 0) return NextResponse.json({ synced: 0, failed: 0, total: 0 })

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, client_name, client_email, items:invoice_items(description, total)')
    .in('project_id', ids)
    .in('status', ['sent', 'partial', 'paid', 'overdue'])
    .is('qb_invoice_id', null)
    .limit(100)

  let synced = 0, failed = 0
  const errors: string[] = []
  for (const inv of invoices ?? []) {
    const items = (inv.items as Pick<InvoiceItem, 'description' | 'total'>[]) ?? []
    const lines = items.length > 0
      ? items.map((i) => ({ description: i.description, amount: i.total ?? 0 }))
      : [{ description: `Facture ${inv.invoice_number}`, amount: 0 }]
    try {
      const { qbInvoiceId } = await pushInvoiceToQuickBooks(supabase, user.id, {
        customerName: inv.client_name ?? 'Client', customerEmail: inv.client_email, lines, docNumber: inv.invoice_number,
      })
      await supabase.from('invoices').update({ qb_invoice_id: qbInvoiceId, qb_synced_at: new Date().toISOString() }).eq('id', inv.id)
      synced++
    } catch (e) {
      failed++
      if (errors.length < 3) errors.push(`${inv.invoice_number}: ${(e as Error).message}`)
    }
  }

  return NextResponse.json({ synced, failed, total: (invoices ?? []).length, errors })
}
