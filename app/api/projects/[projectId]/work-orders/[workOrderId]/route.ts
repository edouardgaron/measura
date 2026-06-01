// app/api/projects/[projectId]/work-orders/[workOrderId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ projectId: string; workOrderId: string }> }

async function requireProjectAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  requireWrite = false
) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { user: null, error: 'Non authentifié', status: 401 } as const

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single()
    if (!project || project.owner_id !== user.id) {
      return { user: null, error: 'Accès refusé', status: 403 } as const
    }
  }

  if (requireWrite && membership?.role === 'client') {
    return { user: null, error: 'Accès refusé', status: 403 } as const
  }

  return { user, error: null, status: 200 } as const
}

// ── GET — un bon de travail ───────────────────────────────────────────────────
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { projectId, workOrderId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .eq('project_id', projectId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Bon de travail introuvable' }, { status: 404 })

  return NextResponse.json({ workOrder: data })
}

// ── PATCH — mise à jour (contenu, statut, signatures) ─────────────────────────
const EDITABLE_FIELDS = [
  'title', 'status', 'work_type',
  'client_name', 'client_phone', 'client_email', 'site_address',
  'scheduled_date', 'crew_lead', 'crew_members', 'estimated_hours',
  'products', 'instructions', 'checklist', 'measurements_summary', 'photo_ids', 'notes',
  'crew_signature', 'crew_signed_name',
  'client_signature', 'client_signed_name',
] as const

const STATUS_ALLOWED = ['draft', 'issued', 'in_progress', 'completed', 'signed', 'cancelled']

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { projectId, workOrderId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  if (typeof body.status === 'string' && !STATUS_ALLOWED.includes(body.status)) {
    return NextResponse.json({ error: 'statut invalide' }, { status: 422 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) patch[key] = body[key]
  }

  const now = new Date().toISOString()
  // Horodatage automatique des signatures
  if (body.crew_signature !== undefined && body.crew_signature) patch.crew_signed_at = now
  if (body.client_signature !== undefined && body.client_signature) patch.client_signed_at = now

  const { data, error } = await supabase
    .from('work_orders')
    .update(patch)
    .eq('id', workOrderId)
    .eq('project_id', projectId)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Erreur mise à jour' },
      { status: 500 }
    )
  }

  return NextResponse.json({ workOrder: data })
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { projectId, workOrderId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await supabase
    .from('work_orders')
    .delete()
    .eq('id', workOrderId)
    .eq('project_id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
