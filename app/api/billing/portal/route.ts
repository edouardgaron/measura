// app/api/billing/portal/route.ts
// Ouvre le portail de facturation Stripe pour gérer l'abonnement de l'entreprise.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createBillingPortal } from '@/lib/stripe/billing'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: company } = await supabase
    .from('companies')
    .select('id, stripe_customer_id')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!company?.stripe_customer_id) {
    return NextResponse.json({ error: 'Aucun abonnement actif à gérer.' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const result = await createBillingPortal({ customerId: company.stripe_customer_id, appUrl })
  if (result.error) return NextResponse.json({ error: result.error }, { status: 503 })
  return NextResponse.json({ url: result.url })
}
