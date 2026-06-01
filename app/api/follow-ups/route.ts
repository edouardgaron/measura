// app/api/follow-ups/route.ts
// Liste priorisée des leads à relancer (classement heuristique, sans appel IA
// pour rester rapide/peu coûteux ; la suggestion IA est demandée par lead à la demande).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { daysSince, heuristicSuggestion } from '@/lib/ai/followup'
import type { Lead } from '@/lib/supabase/types'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .not('stage', 'in', '(completed,lost)')
    .order('last_activity_at', { ascending: true })

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name, full_name')
    .eq('id', user.id)
    .single()
  const companyName = profile?.company_name ?? profile?.full_name

  const rows = ((leads as Lead[]) ?? [])
    .map((lead) => {
      const days = daysSince(lead.last_activity_at)
      const h = heuristicSuggestion({ lead, companyName, days })
      return {
        leadId: lead.id,
        name: lead.name,
        contact_name: lead.contact_name,
        stage: lead.stage,
        estimated_value: lead.estimated_value,
        days,
        score: h.score,
        priority: h.priority,
        reason: h.reason,
        next_action: h.next_action,
        hasEmail: !!lead.contact_email,
        hasPhone: !!lead.contact_phone,
      }
    })
    .sort((a, b) => b.score - a.score)

  return NextResponse.json({ followUps: rows })
}
