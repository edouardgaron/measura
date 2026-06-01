// app/api/time-clock/route.ts
// Pointage GPS : entrée/sortie d'un employé sur un projet, avec géolocalisation.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { computeHours } from '@/lib/site/compute'

function nowTime() { return new Date().toISOString().slice(11, 19) } // HH:MM:SS (UTC)
function today() { return new Date().toISOString().slice(0, 10) }

// GET — pointages du jour pour un projet (qui est sur le chantier)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const projectId = request.nextUrl.searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id requis' }, { status: 422 })

  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data } = await supabase
    .from('time_entries')
    .select('id, employee_id, employee_name, clock_in, clock_out, hours, gps_lat, gps_lng')
    .eq('project_id', projectId)
    .eq('work_date', today())
    .order('clock_in', { ascending: true })

  return NextResponse.json({ entries: data ?? [] })
}

// POST — pointer entrée ou sortie
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  let body: { project_id?: string; employee_id?: string; action?: 'in' | 'out'; gps_lat?: number; gps_lng?: number } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  if (!body.project_id || !body.employee_id || !body.action) {
    return NextResponse.json({ error: 'project_id, employee_id et action requis' }, { status: 422 })
  }

  const auth = await requireProjectAccess(supabase, body.project_id, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (body.action === 'in') {
    const { data: emp } = await supabase.from('employees').select('hourly_cost, full_name').eq('id', body.employee_id).single()
    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        project_id: body.project_id,
        daily_report_id: null,
        employee_id: body.employee_id,
        employee_name: emp?.full_name ?? null,
        work_date: today(),
        clock_in: nowTime(),
        clock_out: null,
        break_minutes: 0,
        hours: 0,
        hourly_cost: emp?.hourly_cost ?? 0,
        gps_lat: body.gps_lat ?? null,
        gps_lng: body.gps_lng ?? null,
        notes: null,
        created_by: auth.user!.id,
      })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ entry: data }, { status: 201 })
  }

  // action 'out' : trouver l'entrée ouverte du jour
  const { data: open } = await supabase
    .from('time_entries')
    .select('*')
    .eq('project_id', body.project_id)
    .eq('employee_id', body.employee_id)
    .eq('work_date', today())
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!open) return NextResponse.json({ error: 'Aucune entrée ouverte à clôturer.' }, { status: 404 })

  const out = nowTime()
  const hours = computeHours(open.clock_in, out, open.break_minutes ?? 0)
  const { data, error } = await supabase
    .from('time_entries')
    .update({ clock_out: out, hours, updated_at: new Date().toISOString() })
    .eq('id', open.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data })
}
