// app/api/certifications/[certId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ certId: string }> }
const EDITABLE = ['name', 'issuer', 'category', 'issued_date', 'expiry_date', 'notes', 'document_url'] as const

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { certId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of EDITABLE) if (body[k] !== undefined) patch[k] = body[k]

  const { data, error } = await supabase.from('employee_certifications').update(patch).eq('id', certId).select('*').single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ certification: data })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { certId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { error } = await supabase.from('employee_certifications').delete().eq('id', certId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
