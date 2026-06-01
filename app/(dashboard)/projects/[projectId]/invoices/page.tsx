// app/(dashboard)/projects/[projectId]/invoices/page.tsx
import { createClient } from '@/lib/supabase/server'
import { isStripeConfigured } from '@/lib/stripe/server'
import type { Invoice } from '@/lib/supabase/types'
import InvoiceClient, { type EstimateOption } from './InvoiceClient'

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function InvoicesPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()

  const [invoicesRes, estimatesRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, items:invoice_items(id, sort_order, description, quantity, unit, unit_price, total), payments:payments(id, amount, method, status, is_deposit, paid_at)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    supabase
      .from('estimates')
      .select('id, title, total, status')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
  ])

  const estimates: EstimateOption[] = (estimatesRes.data ?? []).map((e) => ({
    id: e.id,
    title: e.title ?? 'Estimation',
    total: e.total ?? 0,
    status: e.status,
  }))

  return (
    <InvoiceClient
      projectId={projectId}
      initialInvoices={(invoicesRes.data as Invoice[]) ?? []}
      estimates={estimates}
      stripeEnabled={isStripeConfigured()}
    />
  )
}
