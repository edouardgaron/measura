// lib/stripe/billing.ts
// ============================================================
// Abonnement SaaS de l'entrepreneur (facturer le client de ChantierPro).
// Définit les forfaits, crée les sessions Checkout (mode subscription)
// et le portail de facturation Stripe. Les Price IDs viennent de l'env
// (STRIPE_PRICE_PRO / STRIPE_PRICE_ENTERPRISE) ; sans eux, seul le forfait
// gratuit est disponible et la mise à niveau est désactivée proprement.
// ============================================================
import { getStripe } from '@/lib/stripe/server'

export type PlanTier = 'free' | 'pro' | 'enterprise'

export interface Plan {
  tier: PlanTier
  name: string
  priceMonthly: number // CAD, affichage
  priceId: string | null // Stripe Price ID (null pour gratuit / non configuré)
  features: string[]
  highlight?: boolean
}

/** Forfaits affichés. Les prix CAD sont indicatifs (la source de vérité = Stripe). */
export function getPlans(): Plan[] {
  return [
    {
      tier: 'free',
      name: 'Gratuit',
      priceMonthly: 0,
      priceId: null,
      features: [
        'Jusqu’à 3 projets actifs',
        'Mesures et soumissions',
        '1 utilisateur',
      ],
    },
    {
      tier: 'pro',
      name: 'Pro',
      priceMonthly: 49,
      priceId: process.env.STRIPE_PRICE_PRO ?? null,
      highlight: true,
      features: [
        'Projets illimités',
        'Facturation + paiements en ligne',
        'Rentabilité temps réel + équipes',
        'CRM, planification, automatisations',
        'Jusqu’à 10 utilisateurs',
      ],
    },
    {
      tier: 'enterprise',
      name: 'Entreprise',
      priceMonthly: 149,
      priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
      features: [
        'Tout Pro, sans limites',
        'Utilisateurs illimités',
        'QuickBooks + comptabilité',
        'Marketplace fournisseurs',
        'Support prioritaire',
      ],
    },
  ]
}

/** Retrouve le tier correspondant à un Price ID Stripe (pour le webhook). */
export function tierForPriceId(priceId: string | null | undefined): PlanTier {
  if (!priceId) return 'free'
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return 'enterprise'
  return 'free'
}

export interface BillingResult {
  url: string | null
  error?: string
}

/**
 * Crée (ou réutilise) un client Stripe pour la compagnie puis ouvre une
 * session Checkout d'abonnement. Renvoie l'URL de paiement.
 */
export async function createSubscriptionCheckout(opts: {
  priceId: string
  companyId: string
  customerId: string | null
  customerEmail: string | null
  appUrl: string
}): Promise<BillingResult & { customerId?: string }> {
  const stripe = getStripe()
  if (!stripe) return { url: null, error: 'Stripe n’est pas configuré (STRIPE_SECRET_KEY manquante).' }

  let customerId = opts.customerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: opts.customerEmail ?? undefined,
      metadata: { company_id: opts.companyId },
    })
    customerId = customer.id
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: opts.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${opts.appUrl}/settings/billing?upgraded=1`,
    cancel_url: `${opts.appUrl}/settings/billing?canceled=1`,
    metadata: { company_id: opts.companyId },
    subscription_data: { metadata: { company_id: opts.companyId } },
  })

  return { url: session.url, customerId }
}

/** Ouvre le portail de facturation Stripe (gérer carte, factures, annulation). */
export async function createBillingPortal(opts: {
  customerId: string
  appUrl: string
}): Promise<BillingResult> {
  const stripe = getStripe()
  if (!stripe) return { url: null, error: 'Stripe n’est pas configuré.' }

  const session = await stripe.billingPortal.sessions.create({
    customer: opts.customerId,
    return_url: `${opts.appUrl}/settings/billing`,
  })
  return { url: session.url }
}
