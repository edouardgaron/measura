// app/(dashboard)/settings/billing/page.tsx
// ============================================================
// Abonnement SaaS — l'entrepreneur choisit/gère son forfait ChantierPro 360.
// Affiche les forfaits, le forfait actif et le bouton de gestion (portail Stripe).
// ============================================================
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPlans } from '@/lib/stripe/billing'
import { isStripeConfigured } from '@/lib/stripe/server'
import BillingClient from './BillingClient'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, subscription_tier, subscription_status, current_period_end, trial_ends_at, stripe_customer_id')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const plans = getPlans().map((p) => ({
    tier: p.tier,
    name: p.name,
    priceMonthly: p.priceMonthly,
    features: p.features,
    highlight: p.highlight ?? false,
    available: p.tier === 'free' || !!p.priceId, // achetable si Price ID configuré
  }))

  return (
    <BillingClient
      plans={plans}
      currentTier={(company?.subscription_tier as 'free' | 'pro' | 'enterprise') ?? 'free'}
      status={company?.subscription_status ?? null}
      periodEnd={company?.current_period_end ?? null}
      trialEnd={company?.trial_ends_at ?? null}
      hasCustomer={!!company?.stripe_customer_id}
      hasCompany={!!company}
      stripeConfigured={isStripeConfigured()}
    />
  )
}
