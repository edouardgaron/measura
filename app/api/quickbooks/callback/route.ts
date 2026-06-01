// app/api/quickbooks/callback/route.ts
// Callback OAuth2 : échange le code contre des jetons et enregistre la connexion.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const code = request.nextUrl.searchParams.get('code')
  const realmId = request.nextUrl.searchParams.get('realmId')
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/api/quickbooks/callback`

  if (!code || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/accounting?qb=error', request.url))
  }

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}`, Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }).toString(),
    })
    const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number }
    if (!res.ok || !json.access_token) {
      return NextResponse.redirect(new URL('/accounting?qb=error', request.url))
    }

    await supabase.from('accounting_connections').upsert({
      owner_id: user.id,
      provider: 'quickbooks',
      realm_id: realmId,
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? null,
      token_expires_at: json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,provider' })

    return NextResponse.redirect(new URL('/accounting?qb=connected', request.url))
  } catch (e) {
    console.error('QuickBooks callback error:', e)
    return NextResponse.redirect(new URL('/accounting?qb=error', request.url))
  }
}
