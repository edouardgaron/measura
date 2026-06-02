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
import { detectOpenings, type OpeningKind } from '@/lib/ai/detectOpenings'
import { isAiConfigured } from '@/lib/ai/client'
import type { HouseModel, Measurement, Project, SurfaceCalculation } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ projectId: string }> }
export const runtime = 'nodejs'
export const maxDuration = 60

type Side = 'front' | 'back' | 'left' | 'right'
const ALL_SIDES: Side[] = ['front', 'back', 'left', 'right']
const TYPE_PREFIX: Record<OpeningKind, string> = { window: 'W', door: 'D', garage: 'G' }

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
  const counters: Record<OpeningKind, number> = { window: 0, door: 0, garage: 0 }
  const rowsToInsert: Record<string, unknown>[] = []
  const perSide: Record<string, number> = {}
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
    if (!result.wallFound) { perSide[side] = 0; continue }

    perSide[side] = result.openings.length
    for (const o of result.openings) {
      counters[o.type] += 1
      const surfaceType = o.type === 'garage' ? 'garage' : o.type // 'window' | 'door' | 'garage'
      rowsToInsert.push({
        project_id: projectId,
        created_by: auth.user!.id,
        facade_side: side,
        surface_type: surfaceType,
        label: `${TYPE_PREFIX[o.type]}${counters[o.type]}`,
        gross_area: +(o.width * o.height).toFixed(3),
        opening_area: 0,
        length: o.width,
        height: o.height,
        position_x: o.position_x,
        sill_height: o.sill_height,
        detected_by: 'ai',
        unit: plan.unit,
        notes: `Détecté par IA (confiance ${(o.confidence * 100).toFixed(0)} %)`,
      })
    }
  }

  // ── Remplace les détections IA précédentes pour ces façades ───────────────
  const { error: delErr } = await supabase
    .from('surface_calculations')
    .delete()
    .eq('project_id', projectId)
    .eq('detected_by', 'ai')
    .in('facade_side', sides)
    .in('surface_type', ['window', 'door', 'garage'])
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  let inserted: SurfaceCalculation[] = []
  if (rowsToInsert.length > 0) {
    const { data, error: insErr } = await supabase
      .from('surface_calculations').insert(rowsToInsert).select()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    inserted = (data as SurfaceCalculation[]) ?? []
  }

  return NextResponse.json({
    detected: rowsToInsert.length,
    perSide,
    sidesProcessed: sides.filter((s) => photoBySide.has(s)),
    dimensions: { width: plan.width, depth: plan.depth, wallHeight: plan.height, unit: plan.unit, estimated: plan.estimated },
    warnings,
    surfaces: inserted,
  })
}
