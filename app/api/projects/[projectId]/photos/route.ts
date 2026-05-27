// app/api/projects/[projectId]/photos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Params {
  params: Promise<{ projectId: string }>
}

async function hasProjectAccess(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, projectId: string) {
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

export async function GET(_request: NextRequest, { params }: Params) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const hasAccess = await hasProjectAccess(supabase, user.id, projectId)
  if (!hasAccess) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, storage_path, original_name, facade_label, sort_order, is_calibrated, created_at, width_px, height_px, file_size_bytes')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Generate signed URLs for all photos
  const photosWithUrls = await Promise.all(
    (photos ?? []).map(async (photo) => {
      const { data: signedUrl } = await supabase.storage
        .from('photos')
        .createSignedUrl(photo.storage_path, 3600)

      return {
        ...photo,
        url: signedUrl?.signedUrl ?? null,
      }
    })
  )

  return NextResponse.json({ photos: photosWithUrls })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const hasAccess = await hasProjectAccess(supabase, user.id, projectId)
  if (!hasAccess) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await request.json()
  const { storage_path, original_name, width_px, height_px, file_size_bytes, mime_type, facade_label } = body

  if (!storage_path) {
    return NextResponse.json({ error: 'storage_path requis' }, { status: 400 })
  }

  const { data: photo, error } = await supabase
    .from('photos')
    .insert({
      project_id: projectId,
      uploaded_by: user.id,
      storage_path,
      original_name: original_name ?? null,
      width_px: width_px ?? null,
      height_px: height_px ?? null,
      file_size_bytes: file_size_bytes ?? null,
      mime_type: mime_type ?? 'image/jpeg',
      facade_label: facade_label ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update project status to 'photos_pending' or 'measuring' if it was 'draft'
  await supabase
    .from('projects')
    .update({ status: 'photos_pending' })
    .eq('id', projectId)
    .eq('status', 'draft')

  return NextResponse.json({ photo }, { status: 201 })
}
