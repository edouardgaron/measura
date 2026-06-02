// app/api/projects/[projectId]/estimate-from-photos/route.ts
// ============================================================
// « Mesures prises selon les photos » — estime le bâtiment complet par vision
// Claude (dimensions + toit + murs + ouvertures) à partir des photos de façade,
// puis persiste house_models + surface_calculations (murs + ouvertures).
// Alimente l'éditeur d'élévations ET le rapport PDF.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { isAiConfigured } from '@/lib/ai/client'
import { estimateBuilding, type FacadeSide } from '@/lib/ai/estimateBuilding'
import { persistDetectedOpenings, type OpeningPlacement } from '@/lib/surfaces/openings'

type RouteContext = { params: Promise<{ projectId: string }> }
export const runtime = 'nodejs'
export const maxDuration = 120

const SIDES: FacadeSide[] = ['front', 'back', 'left', 'right']

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()
  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'Estimation IA non disponible (ANTHROPIC_API_KEY manquante).' }, { status: 200 })
  }

  const { data: project } = await supabase
    .from('projects').select('unit_system').eq('id', projectId).single()
  const unit = project?.unit_system === 'metric' ? 'm' : 'ft'

  // Photos de façade (toutes), URLs signées.
  const { data: photos } = await supabase
    .from('photos').select('storage_path, facade_label, sort_order')
    .eq('project_id', projectId).in('facade_label', SIDES)
    .order('sort_order', { ascending: true })
  if (!photos || photos.length === 0) {
    return NextResponse.json({ error: 'Aucune photo de façade étiquetée (avant/arrière/gauche/droite).' }, { status: 422 })
  }

  const imgs: { facade_side: string; imageUrl: string }[] = []
  for (const p of photos) {
    const { data } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 7200)
    if (data?.signedUrl) imgs.push({ facade_side: p.facade_label as string, imageUrl: data.signedUrl })
  }
  if (imgs.length === 0) return NextResponse.json({ error: 'Photos inaccessibles.' }, { status: 500 })

  // Estimation par vision.
  const est = await estimateBuilding(imgs)
  if (!est.configured) {
    return NextResponse.json({ error: est.warning ?? 'Estimation indisponible.' }, { status: 200 })
  }
  if (est.facades.length === 0) {
    return NextResponse.json({ error: est.warning ?? 'Le modèle n’a pas pu estimer le bâtiment.' }, { status: 422 })
  }

  // ── house_models (footprint rectangulaire + toit) ────────────────────────
  const footprint: [number, number][] = [[0, 0], [est.width, 0], [est.width, est.depth], [0, est.depth]]
  await supabase.from('house_models').insert({
    project_id: projectId,
    geometry_json: { method: 'ai-photo-estimate', width: est.width, depth: est.depth, wall_height: est.wall_height, roof_pitch: est.roof_pitch },
    roof_type: est.roof_type,
    wall_height: est.wall_height,
    footprint_json: footprint,
    generated_at: new Date().toISOString(),
  })

  // ── Murs par façade (remplace les murs estimés par IA précédents) ─────────
  await supabase.from('surface_calculations').delete()
    .eq('project_id', projectId).eq('detected_by', 'ai').eq('surface_type', 'wall')
  const wallRows = est.facades
    .filter((f) => f.wall_width > 0 && f.wall_height > 0)
    .map((f) => {
      const openingArea = f.openings.reduce((s, o) => s + o.width * o.height, 0)
      const gross = f.wall_width * f.wall_height
      return {
        project_id: projectId,
        created_by: auth.user?.id ?? null,
        facade_side: f.facade_side,
        surface_type: 'wall',
        label: `Mur ${f.facade_side}`,
        gross_area: +gross.toFixed(3),
        opening_area: +Math.min(openingArea, gross).toFixed(3),
        length: +f.wall_width.toFixed(3),
        height: +f.wall_height.toFixed(3),
        detected_by: 'ai',
        unit,
      }
    })
  if (wallRows.length > 0) await supabase.from('surface_calculations').insert(wallRows)

  // ── Ouvertures (helper partagé, source 'ai') ──────────────────────────────
  const placements: OpeningPlacement[] = []
  for (const f of est.facades) {
    for (const o of f.openings) {
      placements.push({
        facade_side: f.facade_side, type: o.type,
        position_x: o.position_x, sill_height: o.sill_height,
        width: o.width, height: o.height, confidence: o.confidence,
      })
    }
  }
  const persisted = await persistDetectedOpenings(supabase, {
    projectId, userId: auth.user?.id, source: 'ai', unit, sides: SIDES, openings: placements,
  })

  return NextResponse.json({
    dimensions: { width: est.width, depth: est.depth, wall_height: est.wall_height, unit },
    roof: { type: est.roof_type, pitch: est.roof_pitch },
    facades: est.facades.map((f) => ({ side: f.facade_side, wall_width: f.wall_width, openings: f.openings.length })),
    walls: wallRows.length,
    openings: persisted.count,
  })
}
