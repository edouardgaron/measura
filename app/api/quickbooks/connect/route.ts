// app/api/quickbooks/connect/route.ts
// Démarre le flux OAuth2 Intuit QuickBooks (redirige vers l'autorisation).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/api/quickbooks/callback`

  if (!clientId) {
    return NextResponse.redirect(new URL('/accounting?qb=not_configured', request.url))
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: redirectUri,
    state: user.id, // identifie l'utilisateur au retour
  })

  return NextResponse.redirect(`https://appcenter.intuit.com/connect/oauth2?${params.toString()}`)
}
