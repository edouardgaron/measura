import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import ProposalAcceptClient from './ProposalAcceptClient'

interface Props { params: Promise<{ token: string }> }

interface QuoteOption {
  id: string; tier: string; name: string | null; description: string | null
  features: string[]; total: number; is_recommended: boolean
}

export default async function ProposalPublicPage({ params }: Props) {
  const { token } = await params
  // Page publique par token → client à privilèges service_role, strictement
  // scopé par share_token (la lecture/maj n'a pas de policy RLS publique).
  const supabase = await createAdminClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*, project:projects(id, title, address_line1, address_city, address_province, notes), estimate:estimates(id, title, total, subtotal, tax_gst, tax_qst, selected_option_id, items:estimate_items(*))')
    .eq('share_token', token)
    .single()

  if (!proposal) return notFound()

  // Options de soumission (paliers) liées à l'estimation
  let options: QuoteOption[] = []
  const estimateId = (proposal.estimate as { id?: string } | null)?.id
  if (estimateId) {
    const { data: opts } = await supabase
      .from('quote_options')
      .select('id, tier, name, description, features, total, is_recommended, sort_order')
      .eq('estimate_id', estimateId)
      .order('sort_order', { ascending: true })
    options = (opts ?? []).map((o) => ({
      id: o.id, tier: o.tier, name: o.name, description: o.description,
      features: Array.isArray(o.features) ? (o.features as string[]) : [],
      total: Number(o.total ?? 0), is_recommended: !!o.is_recommended,
    }))
  }

  // Mark as viewed if first time
  if (proposal.status === 'sent') {
    const hdrs = await headers()
    const ip = hdrs.get('x-forwarded-for') ?? 'unknown'
    await supabase
      .from('proposals')
      .update({ status: 'viewed', viewed_at: new Date().toISOString(), client_ip: ip })
      .eq('id', proposal.id)
  }

  const p = proposal.project as {
    title: string
    address_line1: string | null
    address_city: string | null
    address_province: string | null
    notes: string | null
  } | null

  const e = proposal.estimate as {
    id: string
    title: string | null
    total: number
    subtotal: number
    tax_gst: number
    tax_qst: number
    items: Array<{
      id: string
      description: string
      quantity: number
      unit_price: number
      total: number
      category: string | null
    }>
  } | null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {proposal.title || 'Proposition de services'}
          </h1>
          {p && (
            <p className="mt-1 text-gray-500">
              {p.title}
              {(p.address_city || p.address_province) && ` — ${[p.address_city, p.address_province].filter(Boolean).join(', ')}`}
            </p>
          )}
        </div>

        {/* Message */}
        {proposal.message && (
          <div className="mb-6 rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Message</h2>
            <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{proposal.message}</p>
          </div>
        )}

        {/* Estimate Summary */}
        {e && (
          <div className="mb-6 rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              {e.title || 'Estimation'}
            </h2>
            {e.items && e.items.length > 0 && (
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">Description</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Qté</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Prix unit.</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {e.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="py-2 text-gray-700">{item.description}</td>
                      <td className="py-2 text-right text-gray-600">{item.quantity}</td>
                      <td className="py-2 text-right text-gray-600">
                        {item.unit_price.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                      </td>
                      <td className="py-2 text-right font-medium text-gray-900">
                        {item.total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="space-y-1 text-sm border-t border-gray-100 pt-3">
              <div className="flex justify-between text-gray-600">
                <span>Sous-total</span>
                <span>{e.subtotal.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>
              </div>
              {e.tax_gst > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>TPS (5%)</span>
                  <span>{e.tax_gst.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>
                </div>
              )}
              {e.tax_qst > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>TVQ (9.975%)</span>
                  <span>{e.tax_qst.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>{e.total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>
              </div>
            </div>
          </div>
        )}

        {/* Validity */}
        {proposal.valid_until && (
          <p className="text-center text-sm text-gray-400 mb-6">
            Cette proposition est valide jusqu&apos;au{' '}
            {new Date(proposal.valid_until).toLocaleDateString('fr-CA', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}.
          </p>
        )}

        {/* Accept/Reject Client Component */}
        <ProposalAcceptClient
          proposalId={proposal.id}
          token={token}
          status={proposal.status as string}
          clientName={proposal.client_name}
          options={options}
          selectedOptionId={(proposal.estimate as { selected_option_id?: string | null } | null)?.selected_option_id ?? null}
        />
      </div>
    </div>
  )
}
