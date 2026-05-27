// app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?reason=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('Auth callback error:', error.message)
    return NextResponse.redirect(`${origin}/auth/error?reason=${encodeURIComponent(error.message)}`)
  }

  // Redirect to dashboard (or the next param if present and safe)
  const redirectTo = next.startsWith('/') ? `${origin}${next}` : `${origin}/dashboard`
  return NextResponse.redirect(redirectTo)
}
