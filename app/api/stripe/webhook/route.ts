// app/api/stripe/webhook/route.ts
// Webhook Stripe : confirme les paiements et met à jour les factures.
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/server'

// Le webhook a besoin du corps brut pour vérifier la signature.
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })

  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const meta = session.metadata ?? {}
    const invoiceId = meta.invoice_id
    const projectId = meta.project_id
    const kind = meta.kind
    const amount = session.amount_total != null ? session.amount_total / 100 : Number(meta.amount ?? 0)

    if (invoiceId && projectId && amount > 0) {
      const admin = await createAdminClient()

      // Idempotence : ignore si un paiement existe déjà pour cette session
      const { data: existing } = await admin
        .from('payments')
        .select('id')
        .eq('stripe_session_id', session.id)
        .maybeSingle()

      if (!existing) {
        await admin.from('payments').insert({
          invoice_id: invoiceId,
          project_id: projectId,
          amount,
          method: 'stripe',
          status: 'succeeded',
          is_deposit: kind === 'deposit',
          stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          stripe_session_id: session.id,
          paid_at: new Date().toISOString(),
        })

        // Met à jour le cumul payé + statut de la facture
        const { data: inv } = await admin
          .from('invoices')
          .select('total, amount_paid')
          .eq('id', invoiceId)
          .single()

        if (inv) {
          const newPaid = Math.round(((inv.amount_paid ?? 0) + amount) * 100) / 100
          const status = newPaid >= (inv.total ?? 0) ? 'paid' : 'partial'
          await admin
            .from('invoices')
            .update({
              amount_paid: newPaid,
              status,
              stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoiceId)
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
