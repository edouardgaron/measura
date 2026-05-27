// app/api/upload/signed-url/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const projectId = searchParams.get('projectId')
  const filename = searchParams.get('filename')
  const token = searchParams.get('token') // client-portal token (unauthenticated flow)

  if (!filename) {
    return NextResponse.json({ error: 'Paramètre filename requis' }, { status: 400 })
  }

  const supabase = await createClient()

  /* --- Authenticated user flow (dashboard) --- */
  if (!token) {
    if (!projectId) {
      return NextResponse.json({ error: 'Paramètre projectId requis' }, { status: 400 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Verify the user has access to this project
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const storagePath = `photos/${projectId}/${filename}`

    const { data, error } = await supabase.storage
      .from('photos')
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Erreur URL signée' }, { status: 500 })
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      path: storagePath,
      projectId,
    })
  }

  /* --- Client portal flow (token-based) --- */
  const { data: member } = await supabase
    .from('project_members')
    .select('project_id, role')
    .eq('invite_token', token)
    .eq('role', 'client')
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 403 })
  }

  const resolvedProjectId = member.project_id
  const storagePath = `photos/${resolvedProjectId}/${filename}`

  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erreur URL signée' }, { status: 500 })
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path: storagePath,
    projectId: resolvedProjectId,
  })
}
