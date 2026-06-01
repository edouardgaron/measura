// app/api/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SELECT = `*, assignments:schedule_assignments(id, employee_id, employee:employees(id, full_name, role))`

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')

  let q = supabase.from('schedule_events').select(SELECT).order('start_date', { ascending: true })
  if (from) q = q.gte('end_date', from)
  if (to) q = q.lte('start_date', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: {
    title?: string; event_type?: string; start_date?: string; end_date?: string
    start_time?: string; end_time?: string; all_day?: boolean; status?: string
    color?: string; notes?: string; project_id?: string; employee_ids?: string[]
    estimated_hours?: number
  } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  if (!body.title?.trim() || !body.start_date) {
    return NextResponse.json({ error: 'Titre et date de début requis' }, { status: 422 })
  }

  const { data: event, error } = await supabase
    .from('schedule_events')
    .insert({
      owner_id: user.id,
      company_id: null,
      project_id: body.project_id ?? null,
      work_order_id: null,
      title: body.title.trim(),
      event_type: (body.event_type as never) ?? 'job',
      start_date: body.start_date,
      end_date: body.end_date ?? body.start_date,
      start_time: body.start_time ?? null,
      end_time: body.end_time ?? null,
      all_day: body.all_day ?? true,
      status: (body.status as never) ?? 'planned',
      color: body.color ?? '#2563eb',
      notes: body.notes ?? null,
      estimated_hours: body.estimated_hours ?? null,
    })
    .select('id')
    .single()

  if (error || !event) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })

  if (body.employee_ids?.length) {
    await supabase.from('schedule_assignments').insert(
      body.employee_ids.map((employee_id) => ({ schedule_event_id: event.id, employee_id }))
    )
  }

  const { data: full } = await supabase.from('schedule_events').select(SELECT).eq('id', event.id).single()
  return NextResponse.json({ event: full }, { status: 201 })
}
