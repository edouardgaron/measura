// app/api/schedule/auto-plan/route.ts
// Planifie automatiquement un chantier : calcule la durée depuis les heures
// estimées de l'estimation et la taille d'équipe, puis crée l'événement.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeEndDate, workingDaysNeeded } from '@/lib/scheduling/plan'

const SELECT = `*, assignments:schedule_assignments(id, employee_id, employee:employees(id, full_name, role))`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: {
    project_id?: string; start_date?: string; employee_ids?: string[]
    hours_per_day?: number; estimated_hours?: number; title?: string
  } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  if (!body.project_id || !body.start_date) {
    return NextResponse.json({ error: 'Projet et date de début requis' }, { status: 422 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, title, company_id')
    .eq('id', body.project_id)
    .single()
  if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

  // Heures estimées : depuis l'estimation (lignes en heures), sinon corps de requête
  let estimatedHours = body.estimated_hours ?? 0
  if (!estimatedHours) {
    const { data: est } = await supabase
      .from('estimates')
      .select('id, items:estimate_items(quantity, unit)')
      .eq('project_id', body.project_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (est?.items) {
      estimatedHours = (est.items as { quantity: number | null; unit: string | null }[])
        .filter((i) => i.unit === 'hour')
        .reduce((s, i) => s + (i.quantity ?? 0), 0)
    }
  }

  const crewSize = Math.max(1, body.employee_ids?.length ?? 1)
  const hoursPerDay = body.hours_per_day ?? 8
  const days = workingDaysNeeded({ estimatedHours, crewSize, hoursPerDay })
  const endDate = computeEndDate(body.start_date, { estimatedHours, crewSize, hoursPerDay })

  const { data: event, error } = await supabase
    .from('schedule_events')
    .insert({
      owner_id: user.id,
      company_id: project.company_id ?? null,
      project_id: project.id,
      work_order_id: null,
      title: body.title ?? `Chantier — ${project.title}`,
      event_type: 'job',
      start_date: body.start_date,
      end_date: endDate,
      all_day: true,
      status: 'planned',
      color: '#0f766e',
      notes: estimatedHours > 0 ? `Planifié automatiquement : ${estimatedHours} h estimées, ${crewSize} pers., ${hoursPerDay} h/jour → ${days} jour(s) ouvrable(s).` : null,
      estimated_hours: estimatedHours || null,
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
  return NextResponse.json({ event: full, computed: { estimatedHours, crewSize, hoursPerDay, days, endDate } }, { status: 201 })
}
