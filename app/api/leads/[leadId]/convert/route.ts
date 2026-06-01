// app/api/leads/[leadId]/convert/route.ts
// Convertit un lead en projet (réutilise la logique de création de projet).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ leadId: string }> }

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { leadId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()
  if (leadErr || !lead) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })

  // Déjà converti ?
  if (lead.project_id) {
    return NextResponse.json({ projectId: lead.project_id, alreadyConverted: true })
  }

  // Crée le projet
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .insert({
      owner_id: user.id,
      company_id: lead.company_id ?? null,
      title: lead.name,
      address_line1: lead.address_line1,
      address_city: lead.address_city,
      address_province: lead.address_province,
      address_postal: lead.address_postal,
      address_country: lead.address_country ?? 'CA',
      status: 'draft',
      unit_system: 'imperial',
      notes: lead.notes,
    })
    .select('id')
    .single()

  if (projErr || !project) {
    return NextResponse.json({ error: projErr?.message ?? 'Erreur création projet' }, { status: 500 })
  }

  // Membre propriétaire (même comportement que /api/projects)
  await supabase.from('project_members').insert({
    project_id: project.id,
    user_id: user.id,
    email: user.email ?? '',
    role: 'owner',
  })

  // Lie le lead au projet + journalise
  await supabase
    .from('leads')
    .update({ project_id: project.id, last_activity_at: new Date().toISOString() })
    .eq('id', leadId)

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    author_id: user.id,
    type: 'task',
    content: 'Lead converti en projet',
    metadata: { project_id: project.id },
  })

  return NextResponse.json({ projectId: project.id }, { status: 201 })
}
