// app/api/photos/[photoId]/tags/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ photoId: string }> }

// ─── Shared auth + membership guard ─────────────────────────────────────────

async function resolveAccess(photoId: string) {
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
      photo: null,
    }
  }

  const { data: photo, error: photoError } = await supabase
    .from('photos')
    .select('id, project_id')
    .eq('id', photoId)
    .single()

  if (photoError || !photo) {
    return {
      error: NextResponse.json({ error: 'Photo introuvable' }, { status: 404 }),
      supabase,
      user,
      photo: null,
    }
  }

  // Verify project membership
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', photo.project_id)
    .eq('user_id', user.id)
    .single()

  // Also allow project owner directly
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', photo.project_id)
    .single()

  const isOwner = project?.owner_id === user.id

  if (!membership && !isOwner) {
    return {
      error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }),
      supabase,
      user,
      photo: null,
    }
  }

  return { error: null, supabase, user, photo }
}

// ─── GET /api/photos/[photoId]/tags ─────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { photoId } = await params
  const { error, supabase } = await resolveAccess(photoId)
  if (error) return error

  const { data: tags, error: dbError } = await supabase
    .from('photo_tags')
    .select('id, photo_id, tag, note, x, y, created_at')
    .eq('photo_id', photoId)
    .order('created_at', { ascending: true })

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ tags: tags ?? [] })
}

// ─── POST /api/photos/[photoId]/tags ────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const { photoId } = await params
  const { error, supabase, user } = await resolveAccess(photoId)
  if (error || !user) return error ?? NextResponse.json({ error: 'Erreur' }, { status: 500 })

  const body = await request.json()
  const { tag, note, x, y } = body

  // Validate required fields
  const VALID_TAGS = ['damage', 'repair', 'attention', 'completed', 'good', 'priority']
  if (!tag || !VALID_TAGS.includes(tag)) {
    return NextResponse.json(
      { error: 'Type de marqueur invalide. Valeurs acceptées: ' + VALID_TAGS.join(', ') },
      { status: 422 }
    )
  }

  if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || x > 1 || y < 0 || y > 1) {
    return NextResponse.json(
      { error: 'Les coordonnées x et y doivent être des nombres entre 0 et 1' },
      { status: 422 }
    )
  }

  const { data: newTag, error: insertError } = await supabase
    .from('photo_tags')
    .insert({
      photo_id: photoId,
      tag,
      note: note ?? null,
      x,
      y,
      created_by: user.id,
    })
    .select('id, photo_id, tag, note, x, y, created_at')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ tag: newTag }, { status: 201 })
}

// ─── DELETE /api/photos/[photoId]/tags?id= ──────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  const { photoId } = await params
  const { error, supabase, user } = await resolveAccess(photoId)
  if (error || !user) return error ?? NextResponse.json({ error: 'Erreur' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const tagId = searchParams.get('id')

  if (!tagId) {
    return NextResponse.json({ error: 'Le paramètre id est requis' }, { status: 400 })
  }

  // Verify the tag belongs to this photo
  const { data: existing } = await supabase
    .from('photo_tags')
    .select('id, photo_id')
    .eq('id', tagId)
    .eq('photo_id', photoId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Marqueur introuvable' }, { status: 404 })
  }

  const { error: deleteError } = await supabase
    .from('photo_tags')
    .delete()
    .eq('id', tagId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
