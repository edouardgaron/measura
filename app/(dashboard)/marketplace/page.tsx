// app/(dashboard)/marketplace/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MarketplaceClient from './MarketplaceClient'

export default async function MarketplacePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <MarketplaceClient />
}
