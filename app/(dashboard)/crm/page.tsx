// app/(dashboard)/crm/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Lead } from '@/lib/supabase/types'
import KanbanBoard from './KanbanBoard'

export default async function CrmPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('position', { ascending: true })
    .order('updated_at', { ascending: false })

  return <KanbanBoard initialLeads={(leads as Lead[]) ?? []} />
}
