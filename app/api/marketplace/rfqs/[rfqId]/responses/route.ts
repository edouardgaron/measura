// app/api/marketplace/rfqs/[rfqId]/responses/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ rfqId: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { rfqId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { supplier_name?: string; price?: number; lead_time_days?: number; message?: string; contact_email?: string } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  const { data, error } = await supabase.from('rfq_responses').insert({
    rfq_id: rfqId, supplier_owner_id: user.id,
    supplier_name: body.supplier_name ?? null, price: body.price ?? null,
    lead_time_days: body.lead_time_days ?? null, message: body.message ?? null,
    contact_email: body.contact_email ?? null,
  }).select('*').single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ response: data }, { status: 201 })
}
