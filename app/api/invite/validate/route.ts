// app/api/invite/validate/route.ts
// Valide un token d'invitation, qu'il s'agisse d'une invitation de PROJET
// (client venant déposer des photos) ou d'une invitation d'ÉQUIPE (membre
// d'entreprise). Retourne un champ `type` pour que le front s'adapte.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token manquant' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // 1) Invitation de projet ?
  const { data: member } = await supabase
    .from('project_members')
    .select(`
      *,
      projects(id, title, address_line1, address_city)
    `)
    .eq('invite_token', token)
    .is('invite_accepted_at', null)
    .maybeSingle()

  if (member) {
    const proj = member.projects as unknown as {
      id: string
      title: string
      address_line1: string | null
      address_city: string | null
    }

    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.some((u) => u.email === member.email) ?? false

    return NextResponse.json({
      valid: true,
      type: 'project',
      token,
      email: member.email,
      projectTitle: proj?.title ?? 'Projet sans titre',
      projectAddress: [proj?.address_line1, proj?.address_city].filter(Boolean).join(', '),
      existingUser,
    })
  }

  // 2) Invitation d'équipe (entreprise) ?
  const { data: invitation } = await supabase
    .from('company_invitations')
    .select(`
      *,
      companies(id, name)
    `)
    .eq('token', token)
    .is('accepted_at', null)
    .maybeSingle()

  if (invitation) {
    // Expiration
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Invitation expirée' }, { status: 410 })
    }

    const comp = invitation.companies as unknown as { id: string; name: string }

    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.some((u) => u.email === invitation.email) ?? false

    return NextResponse.json({
      valid: true,
      type: 'company',
      token,
      email: invitation.email,
      companyName: comp?.name ?? 'Entreprise',
      role: invitation.role,
      existingUser,
    })
  }

  return NextResponse.json({ valid: false, error: 'Invitation invalide' }, { status: 404 })
}
