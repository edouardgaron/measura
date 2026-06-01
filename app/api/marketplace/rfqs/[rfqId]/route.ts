// app/api/marketplace/rfqs/[rfqId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ rfqId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { rfqId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  let body: { status?: string } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status && ['open', 'closed', 'awarded'].includes(body.status)) patch.status = body.status
  const { data, error } = await supabase.from('rfqs').update(patch).eq('id', rfqId).eq('owner_id', user.id).select('*').single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ rfq: data })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { rfqId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { error } = await supabase.from('rfqs').delete().eq('id', rfqId).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
