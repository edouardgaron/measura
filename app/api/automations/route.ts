// app/api/automations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { STAGE_KEYS } from '@/lib/crm/stages'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('automation_rules')
    .select('*, template:message_templates(id, name, channel)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rules: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: {
    name?: string; trigger_stage?: string; channel?: string; template_id?: string; delay_minutes?: number
  } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  if (!body.name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 422 })
  if (!STAGE_KEYS.includes(body.trigger_stage as never)) return NextResponse.json({ error: 'Étape invalide' }, { status: 422 })
  if (!body.template_id) return NextResponse.json({ error: 'Modèle requis' }, { status: 422 })

  const { data, error } = await supabase
    .from('automation_rules')
    .insert({
      owner_id: user.id,
      company_id: null,
      name: body.name.trim(),
      is_active: true,
      trigger_type: 'lead_stage_changed',
      trigger_stage: body.trigger_stage as never,
      channel: body.channel === 'sms' ? 'sms' : 'email',
      template_id: body.template_id,
      delay_minutes: Math.max(0, body.delay_minutes ?? 0),
    })
    .select('*, template:message_templates(id, name, channel)')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ rule: data }, { status: 201 })
}
