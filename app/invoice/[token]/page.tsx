// app/invoice/[token]/page.tsx
// Page publique de consultation et de paiement d'une facture (par token).
import { createClient } from '@/lib/supabase/server'
import type { Invoice, InvoiceItem } from '@/lib/supabase/types'
import PayButton from './PayButton'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ paid?: string; canceled?: string }>
}

const money = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n ?? 0)
const frDate = (iso: string | null) => {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

export default async function PublicInvoicePage({ params, searchParams }: Props) {
  const { token } = await params
  const { paid, canceled } = await searchParams
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(id, sort_order, description, quantity, unit, unit_price, total)')
    .eq('share_token', token)
    .maybeSingle()

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">Facture introuvable</h1>
          <p className="mt-2 text-sm text-gray-500">Ce lien est invalide ou la facture n’est pas disponible.</p>
        </div>
      </div>
    )
  }

  const inv = invoice as unknown as Invoice & { items: InvoiceItem[] }
  const items = (inv.items ?? []).sort((a, b) => a.sort_order - b.sort_order)
  const balance = (inv.total ?? 0) - (inv.amount_paid ?? 0)
  const isPaid = inv.status === 'paid' || balance <= 0

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        {paid && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            ✅ Merci ! Votre paiement a été reçu. La facture sera mise à jour sous peu.
          </div>
        )}
        {canceled && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Paiement annulé. Vous pouvez réessayer ci-dessous.
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-[#1e3a5f] px-8 py-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-wide">FACTURE</h1>
                <p className="mt-1 text-blue-200">{inv.invoice_number}</p>
              </div>
              <div className="text-right text-sm text-blue-100">
                <p>Émise le {frDate(inv.issue_date)}</p>
                {inv.due_date && <p>Échéance : {frDate(inv.due_date)}</p>}
              </div>
            </div>
          </div>

          <div className="px-8 py-6">
            {inv.client_name && (
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Facturé à</p>
                <p className="mt-1 text-sm text-gray-800">{inv.client_name}</p>
                {inv.client_address && <p className="text-sm text-gray-500">{inv.client_address}</p>}
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="pb-2">Description</th>
                  <th className="pb-2 text-right">Qté</th>
                  <th className="pb-2 text-right">Prix</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-800">{it.description}</td>
                    <td className="py-2 text-right text-gray-600">{it.quantity}</td>
                    <td className="py-2 text-right text-gray-600">{money(it.unit_price)}</td>
                    <td className="py-2 text-right text-gray-800">{money(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Sous-total</span><span>{money(inv.subtotal)}</span></div>
              {inv.discount_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">Rabais</span><span>- {money(inv.discount_amount)}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">TPS</span><span>{money(inv.tax_gst)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">TVQ</span><span>{money(inv.tax_qst)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900"><span>Total</span><span>{money(inv.total)}</span></div>
              {inv.amount_paid > 0 && <div className="flex justify-between"><span className="text-gray-500">Déjà payé</span><span>- {money(inv.amount_paid)}</span></div>}
              <div className="flex justify-between rounded-lg bg-blue-50 px-3 py-2 font-semibold text-blue-800"><span>Solde dû</span><span>{money(balance)}</span></div>
            </div>

            {inv.terms && <p className="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-500">{inv.terms}</p>}

            <div className="mt-6">
              {isPaid ? (
                <div className="rounded-lg bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-700">
                  Cette facture est payée. Merci !
                </div>
              ) : (
                <PayButton
                  token={token}
                  balance={balance}
                  deposit={inv.amount_paid < inv.deposit_amount ? inv.deposit_amount : 0}
                />
              )}
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">Propulsé par Measura</p>
      </div>
    </div>
  )
}
