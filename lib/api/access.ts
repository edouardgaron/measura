// lib/api/access.ts
// ============================================================
// Helper d'autorisation partagé pour les routes liées à un projet.
// ============================================================

import type { createClient } from '@/lib/supabase/server'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

export interface AccessResult {
  user: { id: string } | null
  role: string | null
  error: string | null
  status: number
}

/**
 * Vérifie que l'utilisateur courant a accès au projet (propriétaire ou membre).
 * Si requireWrite, refuse les membres de rôle 'client'.
 */
export async function requireProjectAccess(
  supabase: SupabaseServer,
  projectId: string,
  requireWrite = false
): Promise<AccessResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { user: null, role: null, error: 'Non authentifié', status: 401 }
  }

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single()

    if (!project || project.owner_id !== user.id) {
      return { user: null, role: null, error: 'Accès refusé', status: 403 }
    }
  }

  if (requireWrite && membership?.role === 'client') {
    return { user: null, role: null, error: 'Accès refusé', status: 403 }
  }

  return { user: { id: user.id }, role: membership?.role ?? 'owner', error: null, status: 200 }
}
