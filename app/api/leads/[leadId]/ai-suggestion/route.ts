// app/api/leads/[leadId]/ai-suggestion/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFollowupSuggestion } from '@/lib/ai/followup'
import { isAiConfigured } from '@/lib/ai/client'
import type { Lead, LeadActivity } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ leadId: string }> }

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { leadId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single()
  if (!lead) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })

  const { data: activities } = await supabase
    .from('lead_activities')
    .select('type, content, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(12)

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name, full_name')
    .eq('id', user.id)
    .single()

  const suggestion = await generateFollowupSuggestion({
    lead: lead as Lead,
    activities: (activities as Pick<LeadActivity, 'type' | 'content' | 'created_at'>[]) ?? [],
    companyName: profile?.company_name ?? profile?.full_name,
  })

  return NextResponse.json({ suggestion, aiEnabled: isAiConfigured() })
}
