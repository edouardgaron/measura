// app/api/templates/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('message_templates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { name?: string; channel?: string; subject?: string; body?: string } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  if (!body.name?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: 'Nom et contenu requis' }, { status: 422 })
  }
  const channel = body.channel === 'sms' ? 'sms' : 'email'

  const { data, error } = await supabase
    .from('message_templates')
    .insert({
      owner_id: user.id,
      company_id: null,
      name: body.name.trim(),
      channel,
      subject: channel === 'email' ? body.subject ?? null : null,
      body: body.body,
      is_active: true,
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ template: data }, { status: 201 })
}
