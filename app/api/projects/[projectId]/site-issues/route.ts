// app/api/projects/[projectId]/site-issues/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'

type RouteContext = { params: Promise<{ projectId: string }> }

const TYPES = ['delay', 'issue', 'risk', 'safety', 'quality']
const SEVERITIES = ['low', 'medium', 'high', 'critical']

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await supabase
    .from('site_issues')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ issues: data ?? [] })
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: {
    type?: string
    severity?: string
    title?: string
    description?: string
    daily_report_id?: string
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: 'Le titre est requis' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('site_issues')
    .insert({
      project_id: projectId,
      daily_report_id: body.daily_report_id ?? null,
      type: TYPES.includes(body.type ?? '') ? body.type : 'issue',
      severity: SEVERITIES.includes(body.severity ?? '') ? body.severity : 'medium',
      title: body.title.trim(),
      description: body.description ?? null,
      status: 'open',
      reported_by: auth.user!.id,
    })
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erreur création' }, { status: 500 })
  }
  return NextResponse.json({ issue: data }, { status: 201 })
}
