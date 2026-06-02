// lib/photogrammetry/reconstruct.ts
// ============================================================
// Reconstruction paramétrique : génère un modèle 3D glTF dimensionnellement
// exact à partir des mesures calibrées des photos (surfaces/mesures/footprint).
// Réel (pas un mock), exécutable en Node, stocké dans Supabase.
// ============================================================

import type { createClient } from '@/lib/supabase/server'
import { buildPlanData } from '@/lib/plans/geometry'
import { buildGltf, type Box } from '@/lib/photogrammetry/gltf'
import type { HouseModel, Measurement, Project, RoofType, SurfaceCalculation } from '@/lib/supabase/types'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

const DEFAULT_COLORS = { walls: '#e8d5b7', roof: '#8b5e3c', trim: '#ffffff' }

export function buildBuildingBoxes(
  width: number, depth: number, height: number,
  roofType: RoofType, colors: { walls: string; roof: string; trim: string }
): Box[] {
  const t = 0.2
  const boxes: Box[] = [
    { center: [0, height / 2, depth / 2], size: [width, height, t], color: colors.walls },   // avant
    { center: [0, height / 2, -depth / 2], size: [width, height, t], color: colors.walls },  // arrière
    { center: [-width / 2, height / 2, 0], size: [t, height, depth], color: colors.walls },  // gauche
    { center: [width / 2, height / 2, 0], size: [t, height, depth], color: colors.walls },   // droite
    { center: [0, 0.05, 0], size: [width, 0.1, depth], color: colors.trim },                 // plancher
  ]
  // Toit (massing) : slab plat, ou faîte surélevé pour les toits en pente
  if (roofType === 'flat') {
    boxes.push({ center: [0, height + 0.15, 0], size: [width + 0.3, 0.3, depth + 0.3], color: colors.roof })
  } else {
    const ridge = Math.min(width, depth) * 0.3
    boxes.push({ center: [0, height + 0.1, 0], size: [width + 0.3, 0.2, depth + 0.3], color: colors.roof })
    boxes.push({ center: [0, height + 0.1 + ridge / 2, 0], size: [width * 0.5, ridge, depth * 0.5], color: colors.roof })
  }
  return boxes
}

export interface ReconstructResult {
  storagePath: string
  width: number
  depth: number
  height: number
  roofType: RoofType
  triangles: number
  houseModelId: string
}

/** Exécute la reconstruction paramétrique et persiste le modèle. */
export async function runParametricReconstruction(
  supabase: SupabaseServer,
  admin: SupabaseServer,
  projectId: string,
  userId: string
): Promise<ReconstructResult> {
  const { data: project } = await supabase
    .from('projects')
    .select('id, unit_system')
    .eq('id', projectId)
    .single()
  if (!project) throw new Error('Projet introuvable')

  const { data: existingModel } = await supabase
    .from('house_models')
    .select('footprint_json, wall_height, roof_type')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: surfaces } = await supabase.from('surface_calculations').select('*').eq('project_id', projectId)
  const { data: measurements } = await supabase.from('measurements').select('*').eq('project_id', projectId)

  const plan = buildPlanData(
    project as Pick<Project, 'unit_system'>,
    (existingModel as Pick<HouseModel, 'footprint_json' | 'wall_height'> | null) ?? null,
    (surfaces as SurfaceCalculation[]) ?? [],
    (measurements as Measurement[]) ?? []
  )

  const roofType = (existingModel?.roof_type as RoofType) ?? 'gable'

  // Couleurs du design actif si disponible
  let colors = DEFAULT_COLORS
  const { data: design } = await supabase
    .from('design_versions')
    .select('colors')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (design?.colors) {
    const c = design.colors as { walls?: string; roof?: string; trim?: string }
    colors = { walls: c.walls ?? DEFAULT_COLORS.walls, roof: c.roof ?? DEFAULT_COLORS.roof, trim: c.trim ?? DEFAULT_COLORS.trim }
  }

  const boxes = buildBuildingBoxes(plan.width, plan.depth, plan.height, roofType, colors)
  const gltf = buildGltf(boxes)
  const triangles = boxes.length * 12

  // Upload (bucket reports, préfixe models/)
  const fileName = `models/${projectId}/model-${Date.now()}.gltf`
  const { error: upErr } = await admin.storage
    .from('reports')
    .upload(fileName, Buffer.from(gltf), { contentType: 'model/gltf+json', upsert: false })
  if (upErr) throw new Error(`Upload échoué : ${upErr.message}`)

  // Footprint rectangulaire (mètres) pour house_models
  const footprint: [number, number][] = [
    [0, 0], [plan.width, 0], [plan.width, plan.depth], [0, plan.depth],
  ]

  // house_models est unique par projet → upsert (remplace le modèle existant).
  const { data: model, error: insErr } = await supabase
    .from('house_models')
    .upsert({
      project_id: projectId,
      geometry_json: { method: 'parametric', boxes: boxes.length, triangles, width: plan.width, depth: plan.depth, height: plan.height },
      roof_type: roofType,
      wall_height: plan.height,
      footprint_json: footprint,
      generated_at: new Date().toISOString(),
      gltf_storage_path: fileName,
    }, { onConflict: 'project_id' })
    .select('id')
    .single()
  if (insErr || !model) throw new Error(insErr?.message ?? 'Échec enregistrement modèle')

  // Journalise une tâche de traitement (historique)
  await supabase.from('project_processing_jobs').insert({
    project_id: projectId,
    type: 'manual_model_generation',
    status: 'completed',
    progress: 100,
    current_step: 'Reconstruction paramétrique terminée',
    input_data: { provider: 'parametric' },
    output_data: { gltf_storage_path: fileName, triangles, width: plan.width, depth: plan.depth, height: plan.height },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  })

  void userId
  return { storagePath: fileName, width: plan.width, depth: plan.depth, height: plan.height, roofType, triangles, houseModelId: model.id }
}
