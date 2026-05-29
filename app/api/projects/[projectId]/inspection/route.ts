import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Params { params: Promise<{ projectId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('inspections')
    .select('*, items:inspection_items(*)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inspections: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()

  // Create inspection
  if (!body.inspection_id) {
    const { data, error } = await supabase
      .from('inspections')
      .insert({
        project_id: projectId,
        created_by: user.id,
        title: body.title || 'Inspection',
        notes: body.notes || null,
        status: 'in_progress',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inspection: data }, { status: 201 })
  }

  // Create inspection item
  const { data, error } = await supabase
    .from('inspection_items')
    .insert({
      inspection_id: body.inspection_id,
      photo_id: body.photo_id || null,
      category: body.category || 'other',
      title: body.title,
      notes: body.notes || null,
      priority: body.priority || 'medium',
      status: 'pending',
      x: body.x ?? null,
      y: body.y ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { id, type, ...patch } = body

  if (type === 'item') {
    const { data, error } = await supabase
      .from('inspection_items')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ item: data })
  }

  const { data, error } = await supabase
    .from('inspections')
    .update(patch)
    .eq('id', id)
    .eq('project_id', projectId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inspection: data })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const type = searchParams.get('type') // 'item' or 'inspection'

  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  if (type === 'item') {
    const { error } = await supabase.from('inspection_items').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from('inspections').delete().eq('id', id).eq('project_id', projectId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
