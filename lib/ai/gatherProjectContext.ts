// lib/ai/gatherProjectContext.ts
import type { createClient } from '@/lib/supabase/server'
import type { ProjectContextData } from '@/lib/ai/assistant'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

export async function gatherProjectContext(
  supabase: SupabaseServer,
  projectId: string
): Promise<ProjectContextData | null> {
  const { data: project } = await supabase
    .from('projects')
    .select('title, status, unit_system, address_line1, address_city, address_province')
    .eq('id', projectId)
    .single()
  if (!project) return null

  const [{ count: photoCount }, { count: measurementCount }, { data: surfaces }, estimateRes, { count: workOrderCount }, { count: dailyReportCount }, { count: openIssues }, { data: clientMember }] =
    await Promise.all([
      supabase.from('photos').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('measurements').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('surface_calculations').select('facade_side, surface_type, net_area, gross_area').eq('project_id', projectId),
      supabase.from('estimates').select('status, total, items:estimate_items(unit)').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('daily_reports').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('site_issues').select('id', { count: 'exact', head: true }).eq('project_id', projectId).neq('status', 'resolved'),
      supabase.from('project_members').select('id').eq('project_id', projectId).eq('role', 'client').limit(1).maybeSingle(),
    ])

  const surfaceRows = (surfaces as { facade_side: string | null; surface_type: string | null; net_area: number | null; gross_area: number | null }[]) ?? []
  const coveredFacades = [...new Set(surfaceRows.map((s) => s.facade_side).filter(Boolean) as string[])]
  const totalWallArea = surfaceRows
    .filter((s) => s.surface_type === 'wall')
    .reduce((sum, s) => sum + (s.net_area ?? s.gross_area ?? 0), 0)

  const est = estimateRes.data as { status: string; total: number; items: { unit: string | null }[] } | null

  const metric = project.unit_system === 'metric'

  return {
    title: project.title,
    status: project.status,
    unit: metric ? 'm' : 'pi',
    address: [project.address_line1, project.address_city, project.address_province].filter(Boolean).join(', ') || null,
    photoCount: photoCount ?? 0,
    measurementCount: measurementCount ?? 0,
    surfaceCount: surfaceRows.length,
    coveredFacades,
    totalWallArea: totalWallArea > 0 ? Math.round(totalWallArea * 100) / 100 : null,
    estimate: est ? { status: est.status, total: est.total ?? 0, hasHourLines: (est.items ?? []).some((i) => i.unit === 'hour') } : null,
    workOrderCount: workOrderCount ?? 0,
    dailyReportCount: dailyReportCount ?? 0,
    openIssues: openIssues ?? 0,
    hasClient: !!clientMember,
  }
}
