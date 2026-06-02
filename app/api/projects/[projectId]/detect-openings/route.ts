// app/api/projects/[projectId]/detect-openings/route.ts
// ============================================================
// Détecte les ouvertures (fenêtres / portes / garage) des photos de façade
// par vision Claude et persiste leur position réelle dans surface_calculations
// (position_x, sill_height, detected_by='ai') → élévations exactes du rapport.
//
// POST body (optionnel) : { facade?: 'front'|'back'|'left'|'right' }
//   - sans facade : traite les 4 façades qui ont une photo.
// Idempotent : remplace les ouvertures précédemment détectées par IA pour les
// façades traitées (les ouvertures saisies manuellement sont conservées).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { buildPlanData } from '@/lib/plans/geometry'
import { detectOpenings } from '@/lib/ai/detectOpenings'
import { isAiConfigured } from '@/lib/ai/client'
import { persistDetectedOpenings, type OpeningPlacement, type FacadeSide } from '@/lib/surfaces/openings'
import type { HouseModel, Measurement, Project, SurfaceCalculation } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ projectId: string }> }
export const runtime = 'nodejs'
export const maxDuration = 60

type Side = FacadeSide
const ALL_SIDES: Side[] = ['front', 'back', 'left', 'right']

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: 'Détection IA non disponible (ANTHROPIC_API_KEY manquante).' },
      { status: 200 }
    )
  }

  let body: { facade?: string } = {}
  try { body = await request.json() } catch { /* defaults */ }
  const requested = body.facade
  const sides: Side[] = requested && ALL_SIDES.includes(requested as Side)
    ? [requested as Side]
    : ALL_SIDES

  // ── Dimensions réelles du bâtiment ───────────────────────────────────────
  const { data: project } = await supabase
    .from('projects').select('id, unit_system').eq('id', projectId).single()
  if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

  const { data: houseModel } = await supabase
    .from('house_models')
    .select('footprint_json, wall_height')
    .eq('project_id', projectId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: surfaces } = await supabase
    .from('surface_calculations').select('*').eq('project_id', projectId)
  const { data: measurements } = await supabase
    .from('measurements').select('*').eq('project_id', projectId)

  const plan = buildPlanData(
    project as Pick<Project, 'unit_system'>,
    (houseModel as Pick<HouseModel, 'footprint_json' | 'wall_height'> | null) ?? null,
    (surfaces as SurfaceCalculation[]) ?? [],
    (measurements as Measurement[]) ?? []
  )
  const sideWidth = (s: Side) => (s === 'front' || s === 'back' ? plan.width : plan.depth)

  // ── Photos de façade (une par côté demandé) ──────────────────────────────
  const { data: photos } = await supabase
    .from('photos')
    .select('storage_path, facade_label, sort_order')
    .eq('project_id', projectId)
    .in('facade_label', sides)
    .order('sort_order', { ascending: true })

  if (!photos || photos.length === 0) {
    return NextResponse.json(
      { error: 'Aucune photo de façade étiquetée (front/back/left/right) à analyser.' },
      { status: 422 }
    )
  }

  // Première photo disponible par façade.
  const photoBySide = new Map<Side, string>()
  for (const p of photos) {
    const s = p.facade_label as Side
    if (sides.includes(s) && !photoBySide.has(s)) photoBySide.set(s, p.storage_path)
  }

  // ── Détection façade par façade ──────────────────────────────────────────
  const placements: OpeningPlacement[] = []
  const perSideDetected: Record<string, number> = {}
  const warnings: string[] = []

  for (const side of sides) {
    const storagePath = photoBySide.get(side)
    if (!storagePath) continue

    const { data: signed } = await supabase.storage
      .from('photos').createSignedUrl(storagePath, 3600)
    if (!signed?.signedUrl) { warnings.push(`${side}: photo inaccessible`); continue }

    const result = await detectOpenings({
      imageUrl: signed.signedUrl,
      sideWidthFt: sideWidth(side),
      wallHeightFt: plan.height,
    })
    if (result.warning) warnings.push(`${side}: ${result.warning}`)
    if (!result.wallFound) { perSideDetected[side] = 0; continue }

    perSideDetected[side] = result.openings.length
    for (const o of result.openings) {
      placements.push({
        facade_side: side, type: o.type,
        position_x: o.position_x, sill_height: o.sill_height,
        width: o.width, height: o.height, confidence: o.confidence,
      })
    }
  }

  // ── Persistance (remplace les détections IA précédentes pour ces façades) ──
  let result
  try {
    result = await persistDetectedOpenings(supabase, {
      projectId, userId: auth.user!.id, source: 'ai', unit: plan.unit, sides, openings: placements,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  return NextResponse.json({
    detected: result.count,
    perSide: perSideDetected,
    sidesProcessed: sides.filter((s) => photoBySide.has(s)),
    dimensions: { width: plan.width, depth: plan.depth, wallHeight: plan.height, unit: plan.unit, estimated: plan.estimated },
    warnings,
    surfaces: result.inserted,
  })
}
