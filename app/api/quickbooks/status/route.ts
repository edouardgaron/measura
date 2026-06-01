// app/api/quickbooks/status/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data } = await supabase
    .from('accounting_connections')
    .select('realm_id, connected_at')
    .eq('owner_id', user.id)
    .eq('provider', 'quickbooks')
    .maybeSingle()

  return NextResponse.json({
    connected: !!data?.connected_at,
    realmId: data?.realm_id ?? null,
    configured: !!process.env.QUICKBOOKS_CLIENT_ID,
  })
}
