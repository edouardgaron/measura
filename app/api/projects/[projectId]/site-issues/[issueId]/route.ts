// app/api/projects/[projectId]/site-issues/[issueId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'

type RouteContext = { params: Promise<{ projectId: string; issueId: string }> }

const EDITABLE = ['type', 'severity', 'title', 'description', 'status'] as const

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { projectId, issueId } = await params
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
  if (body.status === 'resolved') patch.resolved_at = new Date().toISOString()
  if (body.status && body.status !== 'resolved') patch.resolved_at = null

  const { data, error } = await supabase
    .from('site_issues')
    .update(patch)
    .eq('id', issueId)
    .eq('project_id', projectId)
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  return NextResponse.json({ issue: data })
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { projectId, issueId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await supabase.from('site_issues').delete().eq('id', issueId).eq('project_id', projectId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
