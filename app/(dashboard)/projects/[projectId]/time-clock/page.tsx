// app/(dashboard)/projects/[projectId]/time-clock/page.tsx
import { createClient } from '@/lib/supabase/server'
import type { Employee } from '@/lib/supabase/types'
import TimeClockClient from './TimeClockClient'

interface Props { params: Promise<{ projectId: string }> }

export default async function TimeClockPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('employees').select('id, full_name').eq('is_active', true).order('full_name', { ascending: true })
  return <TimeClockClient projectId={projectId} employees={(data as Pick<Employee, 'id' | 'full_name'>[]) ?? []} />
}
