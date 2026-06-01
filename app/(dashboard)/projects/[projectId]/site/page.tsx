// app/(dashboard)/projects/[projectId]/site/page.tsx
import { createClient } from '@/lib/supabase/server'
import type {
  DailyReport,
  Delivery,
  Employee,
  SiteIssue,
} from '@/lib/supabase/types'
import SiteClient, { type SitePhoto } from './SiteClient'

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function SitePage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()

  const [reportsRes, issuesRes, deliveriesRes, employeesRes, photosRes] = await Promise.all([
    supabase
      .from('daily_reports')
      .select(
        `*,
         time_entries:time_entries(id, employee_id, employee_name, work_date, clock_in, clock_out,
           break_minutes, hours, hourly_cost, labor_cost, notes),
         materials:daily_report_materials(id, material_id, description, quantity, unit, unit_cost, total_cost),
         issues:site_issues(id, type, severity, title, description, status, resolved_at)`
      )
      .eq('project_id', projectId)
      .order('report_date', { ascending: false }),
    supabase.from('site_issues').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('deliveries').select('*').eq('project_id', projectId).order('expected_date', { ascending: true, nullsFirst: false }),
    supabase.from('employees').select('*').eq('is_active', true).order('full_name', { ascending: true }),
    supabase.from('photos').select('id, storage_path, facade_label, sort_order').eq('project_id', projectId).order('sort_order', { ascending: true }),
  ])

  const photos: SitePhoto[] = (photosRes.data ?? []).map((p) => {
    const { data } = supabase.storage.from('photos').getPublicUrl(p.storage_path)
    return { id: p.id, url: data.publicUrl, facade_label: p.facade_label }
  })

  return (
    <SiteClient
      projectId={projectId}
      initialReports={(reportsRes.data as DailyReport[]) ?? []}
      initialIssues={(issuesRes.data as SiteIssue[]) ?? []}
      initialDeliveries={(deliveriesRes.data as Delivery[]) ?? []}
      employees={(employeesRes.data as Employee[]) ?? []}
      photos={photos}
    />
  )
}
