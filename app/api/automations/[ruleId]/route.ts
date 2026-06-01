// app/api/automations/[ruleId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ ruleId: string }> }

const EDITABLE = ['name', 'is_active', 'trigger_stage', 'channel', 'template_id', 'delay_minutes'] as const

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { ruleId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of EDITABLE) if (body[k] !== undefined) patch[k] = body[k]

  const { data, error } = await supabase
    .from('automation_rules')
    .update(patch)
    .eq('id', ruleId)
    .select('*, template:message_templates(id, name, channel)')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ rule: data })
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { ruleId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { error } = await supabase.from('automation_rules').delete().eq('id', ruleId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
