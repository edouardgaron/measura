// app/(dashboard)/projects/[projectId]/work-orders/page.tsx
import { createClient } from '@/lib/supabase/server'
import type { WorkOrder } from '@/lib/supabase/types'
import WorkOrderClient from './WorkOrderClient'

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function WorkOrdersPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('work_orders')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  // Y a-t-il une estimation pour pré-remplir le bon de travail ?
  const { count: estimateCount } = await supabase
    .from('estimates')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  return (
    <WorkOrderClient
      projectId={projectId}
      initialWorkOrders={(data as WorkOrder[]) ?? []}
      hasEstimate={(estimateCount ?? 0) > 0}
    />
  )
}
