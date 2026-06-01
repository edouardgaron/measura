// app/api/leads/[leadId]/activities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ leadId: string }> }

const TYPES = ['note', 'call', 'email', 'sms', 'meeting', 'task']

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { leadId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activities: data ?? [] })
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { leadId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { type?: string; content?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  if (!body.content || !body.content.trim()) {
    return NextResponse.json({ error: 'Le contenu est requis' }, { status: 422 })
  }

  const type = TYPES.includes(body.type ?? '') ? body.type : 'note'

  const { data, error } = await supabase
    .from('lead_activities')
    .insert({ lead_id: leadId, author_id: user.id, type: type as never, content: body.content.trim(), metadata: {} })
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  }

  // Met à jour la dernière activité du lead
  await supabase.from('leads').update({ last_activity_at: new Date().toISOString() }).eq('id', leadId)

  return NextResponse.json({ activity: data }, { status: 201 })
}
