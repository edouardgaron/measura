// app/api/projects/[projectId]/processing/[jobId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Params {
  params: Promise<{ projectId: string; jobId: string }>
}

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

// GET: fetch single job by ID
export async function GET(_request: NextRequest, { params }: Params) {
  const { projectId, jobId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const hasAccess = await hasProjectAccess(supabase, user.id, projectId)
  if (!hasAccess) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data: job, error } = await supabase
    .from('project_processing_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('project_id', projectId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!job) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  return NextResponse.json({ job })
}

// DELETE: delete a job record
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { projectId, jobId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const hasAccess = await hasProjectAccess(supabase, user.id, projectId)
  if (!hasAccess) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { error } = await supabase
    .from('project_processing_jobs')
    .delete()
    .eq('id', jobId)
    .eq('project_id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
