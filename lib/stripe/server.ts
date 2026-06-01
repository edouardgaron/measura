// lib/stripe/server.ts
// ============================================================
// Initialisation paresseuse du client Stripe (serveur uniquement).
// Renvoie null si STRIPE_SECRET_KEY n'est pas configurée — la
// facturation fonctionne alors sans paiement en ligne.
// ============================================================

import Stripe from 'stripe'

let cached: Stripe | null = null

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (cached) return cached
  cached = new Stripe(key, {
    // Version d'API épinglée pour la stabilité du SDK v17.
    apiVersion: '2025-02-24.acacia',
    appInfo: { name: 'Measura', url: 'https://measura.app' },
  })
  return cached
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}
