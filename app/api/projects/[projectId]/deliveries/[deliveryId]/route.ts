// app/api/projects/[projectId]/deliveries/[deliveryId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'

type RouteContext = { params: Promise<{ projectId: string; deliveryId: string }> }

const EDITABLE = ['supplier', 'description', 'quantity', 'expected_date', 'received_date', 'status', 'notes'] as const

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { projectId, deliveryId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of EDITABLE) {
    if (body[key] !== undefined) patch[key] = body[key]
  }
  // Marquer reçu : date auto si non fournie
  if (body.status === 'received' && body.received_date === undefined) {
    patch.received_date = new Date().toISOString().slice(0, 10)
  }

  const { data, error } = await supabase
    .from('deliveries')
    .update(patch)
    .eq('id', deliveryId)
    .eq('project_id', projectId)
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ delivery: data })
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { projectId, deliveryId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await supabase.from('deliveries').delete().eq('id', deliveryId).eq('project_id', projectId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
