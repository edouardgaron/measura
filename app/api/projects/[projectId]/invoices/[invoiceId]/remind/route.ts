// app/api/projects/[projectId]/invoices/[invoiceId]/remind/route.ts
// Relance de paiement manuelle pour une facture (envoie un courriel au client).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { sendInvoiceReminder } from '@/lib/messaging/reminders'

type RouteContext = { params: Promise<{ projectId: string; invoiceId: string }> }
export const runtime = 'nodejs'

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { projectId, invoiceId } = await params
  const supabase = await createClient()
  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Vérifie que la facture appartient au projet
  const { data: inv } = await supabase
    .from('invoices').select('id').eq('id', invoiceId).eq('project_id', projectId).maybeSingle()
  if (!inv) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const res = await sendInvoiceReminder(supabase, invoiceId)
  if (!res.ok) return NextResponse.json({ error: res.error ?? 'Échec de la relance' }, { status: 502 })
  return NextResponse.json({ ok: true })
}
