// app/api/cron/process-automations/route.ts
// Traite les relances planifiées dues. À déclencher périodiquement
// (Railway Cron / scheduler externe) avec l'en-tête Authorization: Bearer <CRON_SECRET>.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { processScheduledMessages } from '@/lib/messaging/automations'

export const runtime = 'nodejs'

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    const qs = request.nextUrl.searchParams.get('secret')
    const provided = auth?.replace(/^Bearer\s+/i, '') ?? qs
    if (provided !== secret) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
  }

  const admin = await createAdminClient()
  const result = await processScheduledMessages(admin, 100)
  return NextResponse.json({ ok: true, ...result })
}

export async function POST(request: NextRequest) {
  return handle(request)
}
export async function GET(request: NextRequest) {
  return handle(request)
}
