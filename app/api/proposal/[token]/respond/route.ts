import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

interface Params { params: Promise<{ token: string }> }

// Réponse publique à une proposition (par token). Client service_role scopé par
// le token : les proposals n'ont pas de policy UPDATE publique, donc l'anon
// échouait silencieusement. On enregistre aussi le palier d'option choisi.
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params
  const supabase = await createAdminClient()
  const body = await req.json().catch(() => ({}))
  const { action, client_name, selected_option_id } = body as {
    action: string; client_name?: string; selected_option_id?: string | null
  }

  if (!['accepted', 'rejected'].includes(action)) {
    return NextResponse.json({ error: 'action invalide' }, { status: 400 })
  }

  // Récupère la proposition (et son estimation) par token, statut ouvert.
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, estimate_id, status')
    .eq('share_token', token)
    .single()
  if (!proposal || !['sent', 'viewed'].includes(proposal.status as string)) {
    return NextResponse.json({ error: 'Proposition introuvable ou déjà traitée' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const patch: Record<string, string | null> = {
    status: action,
    client_name: client_name || '',
    client_signature: client_name || '',
  }
  if (action === 'accepted') patch.accepted_at = now
  if (action === 'rejected') patch.rejected_at = now

  const { error } = await supabase.from('proposals').update(patch).eq('id', proposal.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enregistre le palier choisi sur l'estimation (si valide) + marque acceptée.
  if (action === 'accepted' && proposal.estimate_id) {
    const estPatch: Record<string, string | null> = { status: 'accepted', accepted_at: now }
    if (selected_option_id) {
      const { data: opt } = await supabase
        .from('quote_options').select('id').eq('id', selected_option_id).eq('estimate_id', proposal.estimate_id).maybeSingle()
      if (opt) estPatch.selected_option_id = selected_option_id
    }
    await supabase.from('estimates').update(estPatch).eq('id', proposal.estimate_id)
  }

  return NextResponse.json({ ok: true })
}
