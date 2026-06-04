// app/api/billing/checkout/route.ts
// Démarre un abonnement SaaS pour l'entreprise de l'utilisateur (mode subscription).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSubscriptionCheckout, getPlans, type PlanTier } from '@/lib/stripe/billing'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { plan?: PlanTier } = {}
  try { body = await request.json() } catch { /* défaut */ }
  const tier = body.plan ?? 'pro'

  const plan = getPlans().find((p) => p.tier === tier)
  if (!plan || !plan.priceId) {
    return NextResponse.json(
      { error: "Ce forfait n'est pas disponible (Price ID Stripe non configuré)." },
      { status: 400 }
    )
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id, stripe_customer_id')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!company) {
    return NextResponse.json(
      { error: 'Aucune entreprise. Configurez votre entreprise avant de vous abonner.' },
      { status: 400 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const result = await createSubscriptionCheckout({
    priceId: plan.priceId,
    companyId: company.id,
    customerId: company.stripe_customer_id ?? null,
    customerEmail: user.email ?? null,
    appUrl,
  })

  if (result.error) return NextResponse.json({ error: result.error }, { status: 503 })

  // Persiste le customer Stripe créé à la volée
  if (result.customerId && result.customerId !== company.stripe_customer_id) {
    await supabase.from('companies').update({ stripe_customer_id: result.customerId }).eq('id', company.id)
  }

  return NextResponse.json({ url: result.url })
}
