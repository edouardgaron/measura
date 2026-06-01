// app/api/schedule/[eventId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ eventId: string }> }

const SELECT = `*, assignments:schedule_assignments(id, employee_id, employee:employees(id, full_name, role))`
const EDITABLE = ['title', 'event_type', 'start_date', 'end_date', 'start_time', 'end_time', 'all_day', 'status', 'color', 'notes', 'project_id', 'estimated_hours'] as const

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: Record<string, unknown> & { employee_ids?: string[] } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of EDITABLE) if (body[k] !== undefined) patch[k] = body[k]

  await supabase.from('schedule_events').update(patch).eq('id', eventId)

  // Remplacement des assignations si fourni
  if (body.employee_ids !== undefined) {
    await supabase.from('schedule_assignments').delete().eq('schedule_event_id', eventId)
    if (body.employee_ids.length) {
      await supabase.from('schedule_assignments').insert(
        body.employee_ids.map((employee_id) => ({ schedule_event_id: eventId, employee_id }))
      )
    }
  }

  const { data: full } = await supabase.from('schedule_events').select(SELECT).eq('id', eventId).single()
  return NextResponse.json({ event: full })
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { error } = await supabase.from('schedule_events').delete().eq('id', eventId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
