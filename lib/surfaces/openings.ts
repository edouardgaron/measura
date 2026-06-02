// lib/surfaces/openings.ts
// ============================================================
// Persistance partagée des ouvertures détectées (fenêtres/portes/garage) avec
// leur position réelle sur la façade (migration 015). Utilisé par la détection
// vision IA (detected_by='ai') ET le pipeline photogrammétrie/segmentation
// externe (detected_by='photogrammetry'). Idempotent par source : remplace les
// rangées de cette même source pour les façades traitées, sans toucher aux
// saisies manuelles ni aux autres sources.
// ============================================================
import type { createClient } from '@/lib/supabase/server'
import type { SurfaceCalculation } from '@/lib/supabase/types'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

export type OpeningKind = 'window' | 'door' | 'garage'
export type FacadeSide = 'front' | 'back' | 'left' | 'right'
export type OpeningSource = 'ai' | 'photogrammetry'

/** Ouverture placée en coordonnées RÉELLES dans le repère du mur de sa façade. */
export interface OpeningPlacement {
  facade_side: FacadeSide
  type: OpeningKind
  position_x: number   // décalage horizontal du bord gauche depuis le bord gauche du mur
  sill_height: number  // hauteur de l'allège au-dessus du sol
  width: number        // largeur réelle
  height: number       // hauteur réelle
  confidence?: number
}

const LABEL_PREFIX: Record<OpeningKind, string> = { window: 'W', door: 'D', garage: 'G' }
const OPENING_TYPES: OpeningKind[] = ['window', 'door', 'garage']

export interface PersistResult {
  count: number
  perSide: Record<string, number>
  inserted: SurfaceCalculation[]
}

/**
 * Remplace les ouvertures d'une source donnée pour les façades indiquées, puis
 * insère les nouvelles. Étiquettes auto (W1, D1, G1…) par type.
 */
export async function persistDetectedOpenings(
  supabase: SupabaseServer,
  opts: {
    projectId: string
    userId?: string
    source: OpeningSource
    unit: string
    sides: FacadeSide[]
    openings: OpeningPlacement[]
  }
): Promise<PersistResult> {
  const { projectId, userId, source, unit, sides, openings } = opts

  // 1) Purge des détections précédentes de CETTE source pour ces façades.
  const { error: delErr } = await supabase
    .from('surface_calculations')
    .delete()
    .eq('project_id', projectId)
    .eq('detected_by', source)
    .in('facade_side', sides)
    .in('surface_type', OPENING_TYPES)
  if (delErr) throw new Error(delErr.message)

  if (openings.length === 0) return { count: 0, perSide: {}, inserted: [] }

  // 2) Construction des rangées avec étiquettes et provenance.
  const counters: Record<OpeningKind, number> = { window: 0, door: 0, garage: 0 }
  const perSide: Record<string, number> = {}
  const rows = openings.map((o) => {
    counters[o.type] += 1
    perSide[o.facade_side] = (perSide[o.facade_side] ?? 0) + 1
    return {
      project_id: projectId,
      created_by: userId ?? null,
      facade_side: o.facade_side,
      surface_type: o.type,
      label: `${LABEL_PREFIX[o.type]}${counters[o.type]}`,
      gross_area: +(o.width * o.height).toFixed(3),
      opening_area: 0,
      length: +o.width.toFixed(3),
      height: +o.height.toFixed(3),
      position_x: +o.position_x.toFixed(3),
      sill_height: +o.sill_height.toFixed(3),
      detected_by: source,
      unit,
      notes:
        source === 'ai'
          ? `Détecté par IA${o.confidence != null ? ` (confiance ${(o.confidence * 100).toFixed(0)} %)` : ''}`
          : `Détecté par photogrammétrie${o.confidence != null ? ` (confiance ${(o.confidence * 100).toFixed(0)} %)` : ''}`,
    }
  })

  // 3) Insertion.
  const { data, error: insErr } = await supabase.from('surface_calculations').insert(rows).select()
  if (insErr) throw new Error(insErr.message)

  return { count: rows.length, perSide, inserted: (data as SurfaceCalculation[]) ?? [] }
}
