// app/api/projects/[projectId]/processing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Params {
  params: Promise<{ projectId: string }>
}

type JobType =
  | 'photo_quality_analysis'
  | 'photo_grouping'
  | 'manual_model_generation'
  | 'ai_model_generation'
  | 'measurement_extraction'
  | 'pdf_generation'

type JobStatus = 'queued' | 'processing' | 'needs_user_input' | 'completed' | 'failed'

const VALID_JOB_TYPES: JobType[] = [
  'photo_quality_analysis',
  'photo_grouping',
  'manual_model_generation',
  'ai_model_generation',
  'measurement_extraction',
  'pdf_generation',
]

const VALID_STATUSES: JobStatus[] = [
  'queued',
  'processing',
  'needs_user_input',
  'completed',
  'failed',
]

async function hasProjectAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('projects')
    .select('id, owner_id')
    .eq('id', projectId)
    .single()

  if (!data) return false
  if (data.owner_id === userId) return true

  const { data: member } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single()

  return !!member
}

// GET: fetch all jobs for this project
export async function GET(_request: NextRequest, { params }: Params) {
  const { projectId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const hasAccess = await hasProjectAccess(supabase, user.id, projectId)
  if (!hasAccess) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data: jobs, error } = await supabase
    .from('project_processing_jobs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ jobs: jobs ?? [] })
}

// POST: create a new job
export async function POST(request: NextRequest, { params }: Params) {
  const { projectId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const hasAccess = await hasProjectAccess(supabase, user.id, projectId)
  if (!hasAccess) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await request.json() as { type?: unknown; input_data?: unknown }
  const { type, input_data } = body

  if (!type || !VALID_JOB_TYPES.includes(type as JobType)) {
    return NextResponse.json(
      { error: `Type invalide. Types valides: ${VALID_JOB_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  const { data: job, error } = await supabase
    .from('project_processing_jobs')
    .insert({
      project_id: projectId,
      type: type as JobType,
      status: 'queued',
      progress: 0,
      input_data: input_data ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ job }, { status: 201 })
}

// PATCH: update an existing job
export async function PATCH(request: NextRequest, { params }: Params) {
  const { projectId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const hasAccess = await hasProjectAccess(supabase, user.id, projectId)
  if (!hasAccess) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await request.json() as {
    id?: unknown
    status?: unknown
    progress?: unknown
    current_step?: unknown
    output_data?: unknown
    error_message?: unknown
  }
  const { id, status, progress, current_step, output_data, error_message } = body

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id requis' }, { status: 400 })
  }

  if (status && !VALID_STATUSES.includes(status as JobStatus)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  const updatePayload: Record<string, unknown> = {}
  if (status !== undefined) updatePayload.status = status
  if (progress !== undefined) updatePayload.progress = progress
  if (current_step !== undefined) updatePayload.current_step = current_step
  if (output_data !== undefined) updatePayload.output_data = output_data
  if (error_message !== undefined) updatePayload.error_message = error_message

  // Set timestamps based on status transitions
  if (status === 'processing' && !updatePayload.started_at) {
    updatePayload.started_at = new Date().toISOString()
  }
  if (status === 'completed' || status === 'failed') {
    updatePayload.completed_at = new Date().toISOString()
  }

  const { data: job, error } = await supabase
    .from('project_processing_jobs')
    .update(updatePayload)
    .eq('id', id)
    .eq('project_id', projectId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!job) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  return NextResponse.json({ job })
}
