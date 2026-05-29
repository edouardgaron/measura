import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Params { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params
  const supabase = await createClient()
  const body = await req.json()
  const { action, client_name } = body as { action: string; client_name: string }

  if (!['accepted', 'rejected'].includes(action)) {
    return NextResponse.json({ error: 'action invalide' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const patch: Record<string, string> = {
    status: action,
    client_name: client_name || '',
    client_signature: client_name || '',
  }
  if (action === 'accepted') patch.accepted_at = now
  if (action === 'rejected') patch.rejected_at = now

  const { error } = await supabase
    .from('proposals')
    .update(patch)
    .eq('share_token', token)
    .in('status', ['sent', 'viewed'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
