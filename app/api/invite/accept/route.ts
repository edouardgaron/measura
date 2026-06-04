// app/api/invite/accept/route.ts
// Accepte une invitation (projet OU équipe d'entreprise) pour l'utilisateur
// authentifié. Pour une invitation d'équipe, crée la ligne company_members.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { token } = await request.json()

  if (!token) {
    return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // 1) Invitation de projet
  const { data: projectMember } = await supabase
    .from('project_members')
    .select('id')
    .eq('invite_token', token)
    .is('invite_accepted_at', null)
    .maybeSingle()

  if (projectMember) {
    const { error } = await supabase
      .from('project_members')
      .update({
        user_id: user.id,
        invite_accepted_at: new Date().toISOString(),
      })
      .eq('invite_token', token)
      .is('invite_accepted_at', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, type: 'project' })
  }

  // 2) Invitation d'équipe (entreprise) — utilise le client admin car la
  //    création de company_members et la lecture de l'invitation se font
  //    hors du contexte RLS de l'invité (qui n'est pas encore membre).
  const admin = await createAdminClient()
  const { data: invitation } = await admin
    .from('company_invitations')
    .select('id, company_id, role, email, accepted_at, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation invalide' }, { status: 404 })
  }
  if (invitation.accepted_at) {
    return NextResponse.json({ error: 'Invitation déjà utilisée' }, { status: 409 })
  }
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invitation expirée' }, { status: 410 })
  }

  // Crée (ou réactive) le membre d'entreprise
  const { error: memberError } = await admin
    .from('company_members')
    .upsert(
      {
        company_id: invitation.company_id,
        user_id: user.id,
        role: invitation.role,
        is_active: true,
        joined_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,user_id' }
    )

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  // Marque l'invitation comme acceptée
  await admin
    .from('company_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  return NextResponse.json({ success: true, type: 'company' })
}
