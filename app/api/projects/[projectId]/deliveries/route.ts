// app/api/projects/[projectId]/deliveries/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'

type RouteContext = { params: Promise<{ projectId: string }> }

const STATUSES = ['pending', 'received', 'delayed', 'cancelled']

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await supabase
    .from('deliveries')
    .select('*')
    .eq('project_id', projectId)
    .order('expected_date', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deliveries: data ?? [] })
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: {
    supplier?: string
    description?: string
    quantity?: string
    expected_date?: string
    notes?: string
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  if (!body.description || !body.description.trim()) {
    return NextResponse.json({ error: 'La description est requise' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('deliveries')
    .insert({
      project_id: projectId,
      supplier: body.supplier ?? null,
      description: body.description.trim(),
      quantity: body.quantity ?? null,
      expected_date: body.expected_date ?? null,
      received_date: null,
      status: 'pending',
      notes: body.notes ?? null,
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur création' }, { status: 500 })
  return NextResponse.json({ delivery: data }, { status: 201 })
}
