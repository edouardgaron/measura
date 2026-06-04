// app/(dashboard)/field/page.tsx
// ============================================================
// « Ma journée » — hub mobile dédié aux employés terrain.
// Affiche les chantiers assignés aujourd'hui, le pointage in/out par
// chantier, les heures du jour, et des accès rapides (rapport, itinéraire).
// Mobile-first (grandes cibles tactiles). Owner/admin voit le dispatch du jour.
// ============================================================
import * as React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { HardHat, Clock, MapPin, FileText, ArrowRight, CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import FieldClockButton from './FieldClockButton'

const STATUS_LABEL: Record<string, string> = {
  planned: 'Planifié', in_progress: 'En cours', weather_hold: 'Pause météo',
  blocked: 'Bloqué', done: 'Terminé', to_invoice: 'À facturer',
}

interface EventRow {
  id: string; title: string; project_id: string | null; start_time: string | null; end_time: string | null
  status: string; estimated_hours: number | null; notes: string | null
  project: { id: string; title: string; address_line1: string | null; address_city: string | null; address_province: string | null } | null
}

function mapsHref(p: EventRow['project']): string | null {
  if (!p) return null
  const addr = [p.address_line1, p.address_city, p.address_province].filter(Boolean).join(', ')
  return addr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}` : null
}

async function FieldContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const firstName = (profile?.full_name ?? '').split(' ')[0] || ''

  // Employé lié à ce compte (sinon : owner/admin → dispatch du jour)
  const { data: employee } = await supabase
    .from('employees').select('id, full_name').eq('user_id', user.id).eq('is_active', true).maybeSingle()

  const today = new Date().toISOString().slice(0, 10)

  // Chantiers du jour
  let events: EventRow[] = []
  const evSelect = '*, project:projects(id, title, address_line1, address_city, address_province)'
  if (employee) {
    const { data: asg } = await supabase.from('schedule_assignments').select('schedule_event_id').eq('employee_id', employee.id)
    const ids = (asg ?? []).map((a) => a.schedule_event_id)
    if (ids.length) {
      const { data } = await supabase.from('schedule_events').select(evSelect)
        .in('id', ids).lte('start_date', today).gte('end_date', today).order('start_time', { ascending: true })
      events = (data ?? []) as unknown as EventRow[]
    }
  } else {
    const { data } = await supabase.from('schedule_events').select(evSelect)
      .eq('owner_id', user.id).lte('start_date', today).gte('end_date', today).order('start_time', { ascending: true })
    events = (data ?? []) as unknown as EventRow[]
  }

  // Pointages du jour de l'employé (heures + chantiers ouverts)
  let hoursToday = 0
  const openProjects = new Set<string>()
  if (employee) {
    const { data: entries } = await supabase
      .from('time_entries').select('project_id, hours, clock_out')
      .eq('employee_id', employee.id).eq('work_date', today)
    for (const e of entries ?? []) {
      hoursToday += Number(e.hours ?? 0)
      if (!e.clock_out && e.project_id) openProjects.add(e.project_id)
    }
  }

  const dateLabel = new Date().toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="mx-auto max-w-md space-y-5">
      {/* En-tête */}
      <div className="rounded-2xl bg-neutral-900 p-5 text-white dark:bg-neutral-100 dark:text-neutral-900">
        <div className="flex items-center gap-2 text-xs opacity-70"><CalendarDays className="h-3.5 w-3.5" /><span className="capitalize">{dateLabel}</span></div>
        <h1 className="mt-1 text-xl font-bold">Bonjour{firstName ? ` ${firstName}` : ''} 👋</h1>
        <div className="mt-3 flex gap-4">
          <div><p className="text-2xl font-bold">{events.length}</p><p className="text-xs opacity-70">chantier(s)</p></div>
          <div><p className="text-2xl font-bold">{hoursToday.toFixed(1)} h</p><p className="text-xs opacity-70">pointées aujourd’hui</p></div>
        </div>
        {!employee && <p className="mt-3 text-[11px] opacity-70">Vue dispatch (aucun profil employé lié à ce compte).</p>}
      </div>

      {/* Chantiers */}
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 py-14 text-center dark:border-neutral-800">
          <HardHat className="mb-3 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Aucun chantier prévu aujourd’hui</p>
          <p className="mt-1 text-xs text-neutral-400">Profitez-en ou consultez le calendrier.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((e) => {
            const isOpen = e.project_id ? openProjects.has(e.project_id) : false
            const maps = mapsHref(e.project)
            return (
              <div key={e.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-neutral-900 dark:text-neutral-100">{e.project?.title ?? e.title}</h3>
                    {e.project && e.title !== e.project.title && <p className="truncate text-xs text-neutral-500">{e.title}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                    {isOpen ? 'En cours' : (STATUS_LABEL[e.status] ?? e.status)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {(e.start_time || e.end_time) && (
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{(e.start_time ?? '').slice(0, 5)}{e.end_time ? ` – ${e.end_time.slice(0, 5)}` : ''}</span>
                  )}
                  {e.estimated_hours != null && <span>{e.estimated_hours} h prévues</span>}
                  {maps && <a href={maps} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-300"><MapPin className="h-3.5 w-3.5" />Itinéraire</a>}
                </div>

                {e.notes && <p className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">{e.notes}</p>}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {e.project_id ? (
                    <FieldClockButton projectId={e.project_id} employeeId={employee?.id ?? null} clockedIn={isOpen} />
                  ) : (
                    <span className="text-xs text-neutral-400">Aucun projet lié — pointage indisponible</span>
                  )}
                  {e.project_id && (
                    <>
                      <Link href={`/projects/${e.project_id}/site`} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"><FileText className="h-4 w-4" />Rapport</Link>
                      <Link href={`/projects/${e.project_id}`} className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">Projet<ArrowRight className="h-4 w-4" /></Link>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex justify-center pt-1 text-xs">
        <Link href="/schedule" className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">Voir le calendrier complet →</Link>
      </div>
    </div>
  )
}

export default function FieldPage() {
  return <React.Suspense fallback={<div className="py-16 text-center text-sm text-neutral-400">Chargement…</div>}><FieldContent /></React.Suspense>
}
