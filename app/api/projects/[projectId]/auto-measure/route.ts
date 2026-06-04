// app/api/projects/[projectId]/auto-measure/route.ts
// ============================================================
// ANALYSE AUTOMATIQUE COMPLÈTE (keystone « Hover ») — un seul appel vision par
// façade, sans GPU ni service externe :
//   1. Détecte mur + ouvertures (requestFacadeDetection).
//   2. Estime les DIMENSIONS réelles par objet de référence (porte/garage).
//   3. Réconcilie les 4 façades → largeur / profondeur / hauteur cohérentes.
//   4. Persiste les murs (surface_type='wall', detected_by='ai') → estimated=false.
//   5. Replace les ouvertures à la BONNE échelle (mapDetections) et les persiste.
//
// Idempotent par source IA : remplace murs+ouvertures IA des façades traitées,
// préserve les saisies manuelles et la photogrammétrie.
//
// POST body (optionnel) : { facade?: 'front'|'back'|'left'|'right' }
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { isAiConfigured } from '@/lib/ai/client'
import {
  estimateFacadeScale,
  reconcileDimensions,
  type FacadeScale,
  type FacadeSide,
} from '@/lib/ai/estimateDimensions'
import { requestFacadeDetection, mapDetections, type RawResponse } from '@/lib/ai/detectOpenings'
import { persistWallDimensions } from '@/lib/surfaces/dimensions'
import { persistDetectedOpenings, type OpeningPlacement } from '@/lib/surfaces/openings'

type RouteContext = { params: Promise<{ projectId: string }> }
export const runtime = 'nodejs'
export const maxDuration = 120

const ALL_SIDES: FacadeSide[] = ['front', 'back', 'left', 'right']
const DEFAULT_ASPECT = 4 / 3

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: 'Analyse IA non disponible (ANTHROPIC_API_KEY manquante).' },
      { status: 200 }
    )
  }

  let body: { facade?: string } = {}
  try { body = await request.json() } catch { /* defaults */ }
  const requested = body.facade
  const sides: FacadeSide[] = requested && ALL_SIDES.includes(requested as FacadeSide)
    ? [requested as FacadeSide]
    : ALL_SIDES

  const { data: project } = await supabase
    .from('projects').select('id, unit_system').eq('id', projectId).single()
  if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
  const metric = project.unit_system === 'metric'
  const unit = metric ? 'm' : 'ft'

  // Une photo par façade (la première par ordre de tri).
  const { data: photos } = await supabase
    .from('photos')
    .select('storage_path, facade_label, width_px, height_px, sort_order')
    .eq('project_id', projectId)
    .in('facade_label', sides)
    .order('sort_order', { ascending: true })

  if (!photos || photos.length === 0) {
    return NextResponse.json(
      { error: 'Aucune photo de façade étiquetée (front/back/left/right) à analyser.' },
      { status: 422 }
    )
  }

  type PhotoRow = { storage_path: string; width_px: number | null; height_px: number | null }
  const photoBySide = new Map<FacadeSide, PhotoRow>()
  for (const p of photos) {
    const s = p.facade_label as FacadeSide
    if (sides.includes(s) && !photoBySide.has(s)) {
      photoBySide.set(s, { storage_path: p.storage_path, width_px: p.width_px, height_px: p.height_px })
    }
  }

  // ── 1-2) Détection + échelle, façade par façade (un appel vision chacune) ──
  const scales: Partial<Record<FacadeSide, FacadeScale>> = {}
  const rawBySide: Partial<Record<FacadeSide, RawResponse>> = {}
  const warnings: string[] = []

  for (const side of sides) {
    const photo = photoBySide.get(side)
    if (!photo) continue

    const { data: signed } = await supabase.storage
      .from('photos').createSignedUrl(photo.storage_path, 3600)
    if (!signed?.signedUrl) { warnings.push(`${side}: photo inaccessible`); continue }

    const { configured, raw, warning } = await requestFacadeDetection(signed.signedUrl)
    if (!configured) {
      return NextResponse.json({ error: 'Analyse IA non disponible (ANTHROPIC_API_KEY manquante).' }, { status: 200 })
    }
    if (!raw) { if (warning) warnings.push(`${side}: ${warning}`); continue }
    rawBySide[side] = raw

    const aspect = photo.width_px && photo.height_px ? photo.width_px / photo.height_px : DEFAULT_ASPECT
    if (!photo.width_px || !photo.height_px) warnings.push(`${side}: dimensions image inconnues, ratio ${DEFAULT_ASPECT.toFixed(2)} supposé`)

    const scale = estimateFacadeScale(raw, aspect, metric)
    if (scale) scales[side] = scale
    else warnings.push(`${side}: aucun objet de référence pour l’échelle`)
  }

  // ── 3) Réconciliation ─────────────────────────────────────────────────────
  const reconciled = reconcileDimensions(scales)
  if (reconciled.walls.length === 0) {
    return NextResponse.json({
      error: 'Impossible d’estimer les dimensions : aucune porte ou porte de garage détectée comme référence. Ajoutez une photo de façade montrant clairement une porte, ou saisissez une mesure manuelle.',
      warnings,
    }, { status: 422 })
  }

  // ── 4) Persistance des dimensions de murs ─────────────────────────────────
  try {
    await persistWallDimensions(supabase, {
      projectId, userId: auth.user!.id, unit, walls: reconciled.walls,
    })
  } catch (e) {
    return NextResponse.json({ error: `Persistance dimensions : ${(e as Error).message}` }, { status: 500 })
  }

  // ── 5) Replacement des ouvertures à la bonne échelle ──────────────────────
  const sideWidth = (s: FacadeSide): number => {
    const w = s === 'front' || s === 'back' ? reconciled.width : reconciled.depth
    return w ?? scales[s]?.width ?? 0
  }
  const wallHeight = reconciled.height ?? 0

  const placements: OpeningPlacement[] = []
  const perSideOpenings: Record<string, number> = {}
  const processedSides: FacadeSide[] = []

  for (const side of sides) {
    const raw = rawBySide[side]
    if (!raw) continue
    processedSides.push(side)
    const sw = sideWidth(side)
    if (!(sw > 0) || !(wallHeight > 0)) continue

    const mapped = mapDetections(raw, sw, wallHeight)
    perSideOpenings[side] = mapped.openings.length
    for (const o of mapped.openings) {
      placements.push({
        facade_side: side, type: o.type,
        position_x: o.position_x, sill_height: o.sill_height,
        width: o.width, height: o.height, confidence: o.confidence,
      })
    }
  }

  let openingsResult
  try {
    openingsResult = await persistDetectedOpenings(supabase, {
      projectId, userId: auth.user!.id, source: 'ai', unit, sides: processedSides, openings: placements,
    })
  } catch (e) {
    return NextResponse.json({ error: `Persistance ouvertures : ${(e as Error).message}` }, { status: 500 })
  }

  return NextResponse.json({
    dimensions: {
      width: reconciled.width,
      depth: reconciled.depth,
      wallHeight: reconciled.height,
      unit,
      confidence: reconciled.confidence,
    },
    walls: reconciled.walls.map((w) => ({
      side: w.facade_side, length: w.length, height: w.height,
      reference: w.reference, confidence: w.confidence,
    })),
    openings: { total: openingsResult.count, perSide: perSideOpenings },
    sidesProcessed: processedSides,
    warnings,
  })
}
