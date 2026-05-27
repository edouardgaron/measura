// app/api/projects/[projectId]/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ projectId: string }> }

// ─── Auth + membership guard ─────────────────────────────────────────────────

async function resolveProjectAccess(projectId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }),
      supabase,
      user: null,
      membership: null,
    }
  }

  // Check owner or project_members
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id')
    .eq('id', projectId)
    .single()

  if (!project) {
    return {
      error: NextResponse.json({ error: 'Projet introuvable' }, { status: 404 }),
      supabase,
      user,
      membership: null,
    }
  }

  if (project.owner_id === user.id) {
    return { error: null, supabase, user, membership: { role: 'owner' } }
  }

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return {
      error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }),
      supabase,
      user,
      membership: null,
    }
  }

  return { error: null, supabase, user, membership }
}

// ─── GET /api/projects/[projectId]/tasks ────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  const { projectId } = await params
  const { error, supabase } = await resolveProjectAccess(projectId)
  if (error) return error

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')
  const assigneeFilter = searchParams.get('assigned_to')

  let query = supabase
    .from('tasks')
    .select('id, project_id, title, description, status, priority, due_date, assigned_to, photo_id, created_at, updated_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }
  if (assigneeFilter) {
    query = query.eq('assigned_to', assigneeFilter)
  }

  const { data: tasks, error: dbError } = await query

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ tasks: tasks ?? [] })
}

// ─── POST /api/projects/[projectId]/tasks ────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const { projectId } = await params
  const { error, supabase, user, membership } = await resolveProjectAccess(projectId)
  if (error || !user) return error ?? NextResponse.json({ error: 'Erreur' }, { status: 500 })

  if (membership?.role === 'client') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await request.json()
  const { title, description, status, priority, due_date, assigned_to, photo_id } = body

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Le titre est requis' }, { status: 422 })
  }

  const VALID_STATUSES = ['todo', 'in_progress', 'blocked', 'done']
  const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent']

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 422 })
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: 'Priorité invalide' }, { status: 422 })
  }

  const { data: task, error: insertError } = await supabase
    .from('tasks')
    .insert({
      project_id: projectId,
      title: title.trim(),
      description: description?.trim() || null,
      status: status ?? 'todo',
      priority: priority ?? 'medium',
      due_date: due_date || null,
      assigned_to: assigned_to || null,
      photo_id: photo_id || null,
      created_by: user.id,
    })
    .select('id, project_id, title, description, status, priority, due_date, assigned_to, photo_id, created_at, updated_at')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ task }, { status: 201 })
}

// ─── PATCH /api/projects/[projectId]/tasks ───────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const { projectId } = await params
  const { error, supabase, membership } = await resolveProjectAccess(projectId)
  if (error) return error

  if (membership?.role === 'client') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'Le champ id est requis' }, { status: 422 })
  }

  // Verify task belongs to this project
  const { data: existing } = await supabase
    .from('tasks')
    .select('id, project_id')
    .eq('id', id)
    .eq('project_id', projectId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })
  }

  // Whitelist updatable fields
  const allowed: Record<string, unknown> = {}
  const UPDATABLE = ['title', 'description', 'status', 'priority', 'due_date', 'assigned_to', 'photo_id']
  for (const key of UPDATABLE) {
    if (key in updates) {
      allowed[key] = updates[key]
    }
  }
  allowed['updated_at'] = new Date().toISOString()

  const { data: task, error: updateError } = await supabase
    .from('tasks')
    .update(allowed)
    .eq('id', id)
    .select('id, project_id, title, description, status, priority, due_date, assigned_to, photo_id, created_at, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ task })
}

// ─── DELETE /api/projects/[projectId]/tasks?id= ──────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  const { projectId } = await params
  const { error, supabase, membership } = await resolveProjectAccess(projectId)
  if (error) return error

  if (membership?.role === 'client') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('id')

  if (!taskId) {
    return NextResponse.json({ error: 'Le paramètre id est requis' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })
  }

  const { error: deleteError } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
