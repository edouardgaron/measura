// app/(dashboard)/accounting/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AccountingClient from './AccountingClient'

export default async function AccountingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <AccountingClient />
}
