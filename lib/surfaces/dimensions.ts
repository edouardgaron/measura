// lib/surfaces/dimensions.ts
// ============================================================
// Persistance des DIMENSIONS de murs estimées par IA (surface_type='wall',
// detected_by='ai'). Idempotent par source : remplace les murs IA des façades
// traitées, sans toucher aux saisies manuelles ni à la photogrammétrie.
//
// Une rangée 'wall' par façade alimente directement buildPlanData :
//   length → largeur de la façade  (width via front/back, depth via left/right)
//   height → hauteur de mur        → estimated passe à false.
// ============================================================
import type { createClient } from '@/lib/supabase/server'
import type { SurfaceCalculation } from '@/lib/supabase/types'
import type { ReferenceKind } from '@/lib/ai/estimateDimensions'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>
export type FacadeSide = 'front' | 'back' | 'left' | 'right'

const SIDE_LABEL: Record<FacadeSide, string> = {
  front: 'Mur avant', back: 'Mur arrière', left: 'Mur gauche', right: 'Mur droit',
}
const REF_LABEL: Record<ReferenceKind, string> = {
  door: 'porte (203 cm)', garage: 'porte de garage (213 cm)', window: 'fenêtre (≈122 cm)',
}

export interface WallDimension {
  facade_side: FacadeSide
  length: number       // largeur réelle de la façade
  height: number       // hauteur de mur réelle
  reference: ReferenceKind
  confidence: number
}

export interface PersistDimensionsResult {
  count: number
  inserted: SurfaceCalculation[]
}

export async function persistWallDimensions(
  supabase: SupabaseServer,
  opts: { projectId: string; userId?: string; unit: string; walls: WallDimension[] }
): Promise<PersistDimensionsResult> {
  const { projectId, userId, unit, walls } = opts
  const sides = walls.map((w) => w.facade_side)

  // 1) Purge des murs IA précédents pour ces façades.
  if (sides.length > 0) {
    const { error: delErr } = await supabase
      .from('surface_calculations')
      .delete()
      .eq('project_id', projectId)
      .eq('detected_by', 'ai')
      .eq('surface_type', 'wall')
      .in('facade_side', sides)
    if (delErr) throw new Error(delErr.message)
  }

  if (walls.length === 0) return { count: 0, inserted: [] }

  // 2) Insertion d'un mur par façade.
  const rows = walls.map((w) => ({
    project_id: projectId,
    created_by: userId ?? null,
    facade_side: w.facade_side,
    surface_type: 'wall' as const,
    label: SIDE_LABEL[w.facade_side],
    gross_area: +(w.length * w.height).toFixed(2),
    opening_area: 0,
    length: +w.length.toFixed(2),
    height: +w.height.toFixed(2),
    detected_by: 'ai' as const,
    unit,
    notes: `Dimensions estimées par IA via ${REF_LABEL[w.reference]} — confiance ${(w.confidence * 100).toFixed(0)} %`,
  }))

  const { data, error: insErr } = await supabase.from('surface_calculations').insert(rows).select()
  if (insErr) throw new Error(insErr.message)
  return { count: rows.length, inserted: (data as SurfaceCalculation[]) ?? [] }
}
