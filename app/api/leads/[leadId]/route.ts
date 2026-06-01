// app/api/leads/[leadId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { STAGE_KEYS, STAGE_LABELS } from '@/lib/crm/stages'
import { runStageAutomations } from '@/lib/messaging/automations'
import type { Lead, LeadStage } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ leadId: string }> }

const EDITABLE = [
  'name', 'contact_name', 'contact_email', 'contact_phone',
  'address_line1', 'address_city', 'address_province', 'address_postal',
  'source', 'work_type', 'estimated_value', 'priority', 'notes',
  'expected_close_date', 'lost_reason', 'position',
] as const

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { leadId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('leads')
    .select('*, activities:lead_activities(id, type, content, metadata, created_at, author_id)')
    .eq('id', leadId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })

  // Trie les activités (plus récentes d'abord)
  if (Array.isArray(data.activities)) {
    data.activities.sort((a: { created_at: string }, b: { created_at: string }) =>
      b.created_at.localeCompare(a.created_at)
    )
  }
  return NextResponse.json({ lead: data })
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { leadId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: Record<string, unknown> & { stage?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  // État courant (pour détecter un changement d'étape)
  const { data: current } = await supabase.from('leads').select('stage').eq('id', leadId).single()
  if (!current) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() }
  for (const key of EDITABLE) {
    if (body[key] !== undefined) patch[key] = body[key]
  }

  let stageChanged: { from: LeadStage; to: LeadStage } | null = null
  if (typeof body.stage === 'string' && STAGE_KEYS.includes(body.stage as LeadStage) && body.stage !== current.stage) {
    patch.stage = body.stage
    stageChanged = { from: current.stage as LeadStage, to: body.stage as LeadStage }
  }

  const { data: lead, error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', leadId)
    .select('*')
    .single()

  if (error || !lead) {
    return NextResponse.json({ error: error?.message ?? 'Erreur mise à jour' }, { status: 500 })
  }

  // Journalise un changement d'étape + déclenche les automatisations
  if (stageChanged) {
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      author_id: user.id,
      type: 'stage_change',
      content: `${STAGE_LABELS[stageChanged.from]} → ${STAGE_LABELS[stageChanged.to]}`,
      metadata: { from: stageChanged.from, to: stageChanged.to },
    })

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name, full_name')
      .eq('id', user.id)
      .single()

    await runStageAutomations(supabase, {
      lead: lead as Lead,
      stage: stageChanged.to,
      companyName: profile?.company_name ?? profile?.full_name,
    })
  }

  return NextResponse.json({ lead })
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { leadId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { error } = await supabase.from('leads').delete().eq('id', leadId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
