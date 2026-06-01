// app/(dashboard)/team/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Employee } from '@/lib/supabase/types'
import TeamClient from './TeamClient'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.from('employees').select('*').eq('is_active', true).order('full_name', { ascending: true })
  return <TeamClient initialEmployees={(data as Employee[]) ?? []} />
}
