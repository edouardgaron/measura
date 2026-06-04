import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { sendProposalEmail } from '@/lib/messaging/reminders'

interface Params { params: Promise<{ projectId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ proposals: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { title, message, estimate_id, valid_until, locale, client_email, client_name } = body

  const shareToken = randomBytes(24).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      project_id: projectId,
      created_by: user.id,
      share_token: shareToken,
      title: title || null,
      message: message || null,
      estimate_id: estimate_id || null,
      valid_until: valid_until || null,
      client_email: client_email || null,
      client_name: client_name || null,
      locale: locale || 'fr',
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ proposal: data }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { id, action, ...patch } = body

  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  // Action « relancer » : envoie une relance courriel sans changer le statut.
  if (action === 'remind') {
    const { data: owns } = await supabase.from('proposals').select('id').eq('id', id).eq('project_id', projectId).maybeSingle()
    if (!owns) return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404 })
    const res = await sendProposalEmail(supabase, id, { isReminder: true })
    if (!res.ok) return NextResponse.json({ error: res.error ?? 'Échec de la relance' }, { status: 502 })
    return NextResponse.json({ ok: true })
  }

  const becomingSent = patch.status === 'sent'
  if (becomingSent) patch.sent_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('proposals')
    .update(patch)
    .eq('id', id)
    .eq('project_id', projectId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Envoi initial par courriel au passage en « envoyée » (si courriel client).
  let emailed = false
  if (becomingSent && data?.client_email) {
    const res = await sendProposalEmail(supabase, id, { isReminder: false })
    emailed = res.ok
  }
  return NextResponse.json({ proposal: data, emailed })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', id)
    .eq('project_id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
