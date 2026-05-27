// app/api/invite/validate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token manquant' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  const { data: member, error } = await supabase
    .from('project_members')
    .select(`
      *,
      projects(id, title, address_line1, address_city)
    `)
    .eq('invite_token', token)
    .is('invite_accepted_at', null)
    .single()

  if (error || !member) {
    return NextResponse.json({ valid: false, error: 'Invitation invalide' }, { status: 404 })
  }

  const proj = member.projects as unknown as { id: string, title: string, address_line1: string | null, address_city: string | null }

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.some(u => u.email === member.email) ?? false

  return NextResponse.json({
    valid: true,
    token,
    email: member.email,
    projectTitle: proj?.title ?? 'Projet sans titre',
    projectAddress: [proj?.address_line1, proj?.address_city].filter(Boolean).join(', '),
    existingUser,
  })
}
