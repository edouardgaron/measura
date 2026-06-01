// app/(dashboard)/follow-ups/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAiConfigured } from '@/lib/ai/client'
import FollowUpsClient from './FollowUpsClient'

export default async function FollowUpsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <FollowUpsClient aiEnabled={isAiConfigured()} />
}
