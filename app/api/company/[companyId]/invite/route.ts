// app/api/company/[companyId]/invite/route.ts
// Invitations de membres au niveau entreprise : créer (+ courriel), lister, révoquer.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'

type RouteContext = { params: Promise<{ companyId: string }> }

const inviteSchema = z.object({
  email: z.string().email('Courriel invalide'),
  role: z.enum(['admin', 'employee', 'estimator', 'inspector']).default('employee'),
})

// Vérifie que l'utilisateur est propriétaire ou admin de l'entreprise.
async function assertCompanyAdmin(companyId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, owner_id')
    .eq('id', companyId)
    .maybeSingle()

  if (!company) {
    return { error: NextResponse.json({ error: 'Entreprise introuvable' }, { status: 404 }) }
  }

  let allowed = company.owner_id === user.id
  if (!allowed) {
    const { data: membership } = await supabase
      .from('company_members')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    allowed = membership?.role === 'owner' || membership?.role === 'admin'
  }

  if (!allowed) {
    return { error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  }

  return { user, company }
}

// ─── GET : liste les invitations en attente ─────────────────────────────────
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { companyId } = await params
  const guard = await assertCompanyAdmin(companyId)
  if (guard.error) return guard.error

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('company_invitations')
    .select('id, email, role, accepted_at, expires_at, created_at')
    .eq('company_id', companyId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invitations: data ?? [] })
}

// ─── POST : crée une invitation + envoie le courriel ────────────────────────
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { companyId } = await params
  const guard = await assertCompanyAdmin(companyId)
  if (guard.error) return guard.error
  const { user, company } = guard

  const body = await request.json().catch(() => null)
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const email = parsed.data.email.toLowerCase().trim()
  const { role } = parsed.data
  const token = randomBytes(32).toString('hex')

  const supabase = await createClient()

  // Upsert l'invitation (réinvite si déjà présente pour ce courriel)
  const { data: invitation, error: upsertError } = await supabase
    .from('company_invitations')
    .upsert(
      {
        company_id: companyId,
        email,
        role,
        token,
        invited_by: user.id,
        accepted_at: null,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'company_id,email' }
    )
    .select('id, email, role, expires_at, created_at')
    .single()

  if (upsertError || !invitation) {
    return NextResponse.json(
      { error: upsertError?.message ?? "Erreur lors de la création de l'invitation" },
      { status: 500 }
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteLink = `${baseUrl}/accept-invite?token=${token}`

  // Envoi du courriel via Resend (non bloquant)
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? 'noreply@measura.app',
          to: email,
          subject: `${company.name} vous invite à rejoindre l'équipe`,
          html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: auto;">
              <h2 style="color: #111827;">${company.name} — Invitation à l'équipe</h2>
              <p>Bonjour,</p>
              <p>Vous avez été invité à rejoindre l'équipe de <strong>${company.name}</strong> sur ChantierPro 360.</p>
              <p>Cliquez sur le bouton ci-dessous pour créer votre compte et accéder à la plateforme :</p>
              <a href="${inviteLink}"
                 style="display: inline-block; margin-top: 16px; background: #111827; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Rejoindre l'équipe
              </a>
              <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">
                Ce lien est personnel et expirera dans 14 jours. Ne le partagez pas.
              </p>
            </div>
          `,
        }),
      })
    } catch (emailError) {
      // Non bloquant — l'invitation est créée même si le courriel échoue
      console.error('Échec envoi courriel invitation entreprise:', emailError)
    }
  }

  // Indique au front si l'envoi courriel n'est pas configuré (afficher le lien)
  const emailSent = Boolean(RESEND_API_KEY)
  return NextResponse.json({ invitation, inviteLink, emailSent }, { status: 201 })
}

// ─── DELETE : révoque une invitation en attente ─────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { companyId } = await params
  const guard = await assertCompanyAdmin(companyId)
  if (guard.error) return guard.error

  const invitationId = request.nextUrl.searchParams.get('invitationId')
  if (!invitationId) {
    return NextResponse.json({ error: 'invitationId manquant' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('company_invitations')
    .delete()
    .eq('id', invitationId)
    .eq('company_id', companyId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
