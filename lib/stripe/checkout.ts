// lib/stripe/checkout.ts
import { getStripe } from '@/lib/stripe/server'
import type { Invoice } from '@/lib/supabase/types'

export type CheckoutKind = 'deposit' | 'balance'

export interface CheckoutResult {
  url: string | null
  sessionId: string | null
  error?: string
}

/**
 * Crée une session Stripe Checkout pour payer une facture (dépôt ou solde).
 * Renvoie { error } si Stripe n'est pas configuré ou si le montant est nul.
 */
export async function createInvoiceCheckout(
  invoice: Pick<Invoice, 'id' | 'project_id' | 'invoice_number' | 'currency' | 'total' | 'amount_paid' | 'deposit_amount' | 'client_email' | 'share_token'>,
  kind: CheckoutKind,
  appUrl: string
): Promise<CheckoutResult> {
  const stripe = getStripe()
  if (!stripe) return { url: null, sessionId: null, error: 'Stripe n’est pas configuré (STRIPE_SECRET_KEY manquante).' }

  const balance = (invoice.total ?? 0) - (invoice.amount_paid ?? 0)
  const amount = kind === 'deposit' ? Math.min(invoice.deposit_amount ?? 0, balance) : balance

  if (!amount || amount <= 0) {
    return { url: null, sessionId: null, error: 'Aucun montant à payer.' }
  }

  const label = kind === 'deposit' ? `Dépôt — facture ${invoice.invoice_number}` : `Facture ${invoice.invoice_number}`
  const returnUrl = `${appUrl}/invoice/${invoice.share_token}`

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: invoice.client_email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: (invoice.currency ?? 'CAD').toLowerCase(),
          product_data: { name: label },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${returnUrl}?paid=1`,
    cancel_url: `${returnUrl}?canceled=1`,
    metadata: {
      invoice_id: invoice.id,
      project_id: invoice.project_id,
      kind,
      amount: String(amount),
    },
  })

  return { url: session.url, sessionId: session.id }
}
