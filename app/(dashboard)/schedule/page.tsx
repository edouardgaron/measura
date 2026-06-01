// app/(dashboard)/schedule/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Employee } from '@/lib/supabase/types'
import ScheduleClient, { type ProjectOption } from './ScheduleClient'

export default async function SchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [employeesRes, projectsRes] = await Promise.all([
    supabase.from('employees').select('*').eq('is_active', true).order('full_name', { ascending: true }),
    supabase.from('projects').select('id, title').neq('status', 'archived').order('updated_at', { ascending: false }),
  ])

  const projects: ProjectOption[] = (projectsRes.data ?? []).map((p) => ({ id: p.id, title: p.title }))

  return <ScheduleClient employees={(employeesRes.data as Employee[]) ?? []} projects={projects} />
}
