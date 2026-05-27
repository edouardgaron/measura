// app/api/projects/[projectId]/invite/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { inviteClientSchema } from '@/lib/validators/project.schema'
import { randomBytes } from 'crypto'

type RouteContext = { params: Promise<{ projectId: string }> }

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const { projectId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Must be owner or editor
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role === 'client') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = inviteClientSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Courriel invalide', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const { email } = parsed.data
  const invite_token = randomBytes(32).toString('hex')

  // Upsert member row (re-invite if already exists)
  const { data: member, error: upsertError } = await supabase
    .from('project_members')
    .upsert(
      {
        project_id: projectId,
        email,
        role: 'client',
        invite_token,
        user_id: null,
        invite_accepted_at: null,
      },
      { onConflict: 'project_id,email' }
    )
    .select()
    .single()

  if (upsertError || !member) {
    return NextResponse.json({ error: upsertError?.message ?? 'Erreur création membre' }, { status: 500 })
  }

  // Get project info for email
  const { data: project } = await supabase
    .from('projects')
    .select('title, address_line1, address_city')
    .eq('id', projectId)
    .single()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteLink = `${baseUrl}/client-portal/${invite_token}`

  // Send email via Resend
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (RESEND_API_KEY) {
    try {
      const projectTitle = project?.title ?? 'un projet'
      const address = [project?.address_line1, project?.address_city]
        .filter(Boolean)
        .join(', ')

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? 'noreply@measura.app',
          to: email,
          subject: `Votre entrepreneur vous invite à déposer des photos — ${projectTitle}`,
          html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: auto;">
              <h2 style="color: #1d4ed8;">Measura — Invitation</h2>
              <p>Bonjour,</p>
              <p>Votre entrepreneur vous invite à déposer des photos pour le projet :</p>
              <p><strong>${projectTitle}</strong>${address ? ` — ${address}` : ''}</p>
              <p>Cliquez sur le bouton ci-dessous pour accéder au portail de dépôt :</p>
              <a href="${inviteLink}"
                 style="display: inline-block; margin-top: 16px; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Déposer mes photos
              </a>
              <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">
                Ce lien est personnel. Ne le partagez pas. Il expirera une fois que votre entrepreneur aura reçu vos photos.
              </p>
            </div>
          `,
        }),
      })
    } catch (emailError) {
      // Non-fatal — invitation is still created
      console.error('Failed to send invite email:', emailError)
    }
  }

  return NextResponse.json({ inviteLink, member }, { status: 201 })
}
