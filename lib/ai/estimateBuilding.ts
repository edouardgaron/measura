// lib/ai/estimateBuilding.ts
// ============================================================
// Estimation COMPLÈTE d'un bâtiment à partir des photos de façade par vision
// Claude — « mesures prises selon les photos » (approche Hover sans GPU).
//
// À partir des photos étiquetées (avant/arrière/gauche/droite), Claude estime :
//   - les dimensions hors-tout (largeur de pignon, profondeur de gouttereau,
//     hauteur de mur) calées sur des références standards (porte ≈ 80 po,
//     fenêtres, lattes de revêtement),
//   - le type de toit + la pente,
//   - pour chaque façade : la surface de mur + les ouvertures
//     (type, position_x, allège, largeur, hauteur) en pieds réels.
//
// La sortie alimente house_models + surface_calculations (murs + ouvertures)
// → l'éditeur d'élévations et le rapport PDF deviennent pilotés par les photos.
//
// Repli : sans ANTHROPIC_API_KEY ou réponse inexploitable → configured:false.
// ============================================================

import type Anthropic from '@anthropic-ai/sdk'
import { getAnthropic, aiModel } from '@/lib/ai/client'

export type FacadeSide = 'front' | 'back' | 'left' | 'right'
export type OpeningKind = 'window' | 'door' | 'garage'

export interface EstimatedOpening {
  type: OpeningKind
  position_x: number
  sill_height: number
  width: number
  height: number
  confidence?: number
}

export interface FacadeEstimate {
  facade_side: FacadeSide
  wall_width: number
  wall_height: number
  is_gable_end: boolean
  openings: EstimatedOpening[]
}

export interface BuildingEstimate {
  configured: boolean
  width: number        // largeur (façade pignon), pi
  depth: number        // profondeur (gouttereau), pi
  wall_height: number  // hauteur de mur, pi
  roof_type: 'gable' | 'hip' | 'flat' | 'shed'
  roof_pitch: number   // x/12
  stories: number
  confidence: number   // confiance globale 0..1
  facades: FacadeEstimate[]
  warning?: string
}

const SIDES = new Set(['front', 'back', 'left', 'right'])
const KINDS = new Set(['window', 'door', 'garage'])
const ROOFS = new Set(['gable', 'hip', 'flat', 'shed'])

const SYSTEM = `Tu es un estimateur en bâtiment résidentiel doublé d'un système de vision. On te fournit plusieurs photos d'une même maison, chacune étiquetée par façade (front/back/left/right). Estime les mesures EXTÉRIEURES en PIEDS (unités impériales, Québec).

Calibration de l'échelle (très important) :
- Sers-toi de références standards visibles : une porte extérieure ≈ 6,67 pi de haut (80 po), une porte de garage simple ≈ 7 pi, une marche ≈ 7,5 po, une rangée de revêtement à clin ≈ 0,5–1 pi, une fenêtre de sous-sol ≈ 1,5–2 pi.
- Garde la cohérence dimensionnelle : la largeur des façades avant et arrière (murs pignons) doit être identique ; la longueur des façades gauche et droite (gouttereaux) doit être identique.

Repère par façade (pour chaque ouverture) :
- position_x = distance horizontale en pieds entre le bord GAUCHE du mur (vu de l'extérieur, face à la façade) et le bord gauche de l'ouverture.
- sill_height = hauteur en pieds entre le sol/plancher du rez-de-chaussée et le BAS de l'ouverture (allège). Une porte a une allège ≈ 0.
- width, height = dimensions réelles de l'ouverture en pieds.
- N'inclus QUE les ouvertures du rez-de-chaussée et les portes ; ignore les soupiraux/fenêtres de sous-sol et les évents de pignon.

Multi-photos : plusieurs photos peuvent montrer la MÊME façade (vue de face + vue d'angle). Combine-les pour une estimation plus précise de cette façade (ne compte pas les ouvertures en double). Les vues d'angle aident à juger la profondeur (gouttereau).

Réponds UNIQUEMENT avec un objet JSON valide (aucun texte, pas de Markdown) :
{
  "width": number, "depth": number, "wall_height": number,
  "roof_type": "gable" | "hip" | "flat" | "shed",
  "roof_pitch": number,                // x/12 (0 si plat)
  "stories": number,
  "confidence": number,                // confiance globale 0..1
  "facades": [
    {
      "facade_side": "front"|"back"|"left"|"right",
      "wall_width": number,            // largeur de CE mur en pi
      "wall_height": number,
      "is_gable_end": boolean,         // true si ce mur est un pignon (triangle de toit)
      "openings": [
        { "type":"window"|"door"|"garage", "position_x":number, "sill_height":number,
          "width":number, "height":number, "confidence":number }
      ]
    }
  ]
}
N'inclus une façade que si tu as une photo qui la montre. Confiance entre 0 et 1.`

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const s = cleaned.indexOf('{'); const e = cleaned.lastIndexOf('}')
  if (s === -1 || e === -1 || e < s) return null
  try { return JSON.parse(cleaned.slice(s, e + 1)) as Record<string, unknown> } catch { return null }
}

/** Normalise/valide la réponse brute du modèle. Exporté pour tests. */
export function normalizeEstimate(raw: Record<string, unknown>): BuildingEstimate {
  const rt = String(raw.roof_type ?? 'gable').toLowerCase()
  const facadesRaw = Array.isArray(raw.facades) ? (raw.facades as Record<string, unknown>[]) : []
  const facades: FacadeEstimate[] = []
  for (const f of facadesRaw) {
    const side = String(f.facade_side ?? '').toLowerCase()
    if (!SIDES.has(side)) continue
    const openingsRaw = Array.isArray(f.openings) ? (f.openings as Record<string, unknown>[]) : []
    const openings: EstimatedOpening[] = []
    for (const o of openingsRaw) {
      const type = String(o.type ?? '').toLowerCase()
      if (!KINDS.has(type)) continue
      const width = num(o.width), height = num(o.height)
      if (!(width > 0) || !(height > 0)) continue
      openings.push({
        type: type as OpeningKind,
        position_x: Math.max(0, num(o.position_x)),
        sill_height: Math.max(0, num(o.sill_height)),
        width, height,
        confidence: typeof o.confidence === 'number' ? o.confidence : undefined,
      })
    }
    facades.push({
      facade_side: side as FacadeSide,
      wall_width: num(f.wall_width),
      wall_height: num(f.wall_height, num(raw.wall_height, 9)),
      is_gable_end: Boolean(f.is_gable_end ?? (side === 'front' || side === 'back')),
      openings,
    })
  }

  // Dimensions cohérentes : largeur = moyenne des pignons, profondeur = moyenne des gouttereaux.
  const widthsGable = facades.filter((f) => f.facade_side === 'front' || f.facade_side === 'back').map((f) => f.wall_width).filter((w) => w > 0)
  const widthsEave = facades.filter((f) => f.facade_side === 'left' || f.facade_side === 'right').map((f) => f.wall_width).filter((w) => w > 0)
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
  const width = avg(widthsGable) || num(raw.width, 32)
  const depth = avg(widthsEave) || num(raw.depth, 26)
  const wall_height = num(raw.wall_height, avg(facades.map((f) => f.wall_height)) || 9)

  // Confiance globale : valeur du modèle si fournie, sinon moyenne des ouvertures.
  const opConf = facades.flatMap((f) => f.openings.map((o) => o.confidence)).filter((c): c is number => typeof c === 'number')
  const confidence = typeof raw.confidence === 'number'
    ? Math.max(0, Math.min(1, raw.confidence))
    : opConf.length ? avg(opConf) : 0.7

  return {
    configured: true,
    width: +width.toFixed(2),
    depth: +depth.toFixed(2),
    wall_height: +wall_height.toFixed(2),
    roof_type: (ROOFS.has(rt) ? rt : 'gable') as BuildingEstimate['roof_type'],
    roof_pitch: num(raw.roof_pitch, 6),
    stories: Math.max(1, Math.round(num(raw.stories, 1))),
    confidence: +confidence.toFixed(2),
    facades,
  }
}

/** Estime le bâtiment à partir des photos de façade (URLs accessibles/signées). */
export async function estimateBuilding(
  photos: { facade_side: string; imageUrl: string }[]
): Promise<BuildingEstimate> {
  const client = getAnthropic()
  if (!client) {
    return emptyEstimate('ANTHROPIC_API_KEY manquante')
  }
  const usable = photos.filter((p) => SIDES.has((p.facade_side ?? '').toLowerCase()) && p.imageUrl)
  if (usable.length === 0) return emptyEstimate('Aucune photo de façade étiquetée')

  // Regroupe les photos par façade (les vues multiples d'une même façade sont
  // présentées ensemble pour une meilleure précision).
  const order: FacadeSide[] = ['front', 'back', 'left', 'right']
  const grouped = order
    .map((side) => ({ side, photos: usable.filter((p) => p.facade_side.toLowerCase() === side) }))
    .filter((g) => g.photos.length > 0)

  const content: Anthropic.ContentBlockParam[] = [
    { type: 'text', text: 'Estime ce bâtiment à partir des photos ci-dessous, regroupées par façade.' },
  ]
  let count = 0
  for (const g of grouped) {
    if (count >= 12) break
    content.push({ type: 'text', text: `=== Façade ${g.side} (${g.photos.length} photo(s)) ===` })
    for (const p of g.photos) {
      if (count >= 12) break
      content.push({ type: 'image', source: { type: 'url', url: p.imageUrl } })
      count++
    }
  }

  try {
    const res = await client.messages.create({
      model: aiModel(),
      max_tokens: 2500,
      thinking: { type: 'disabled' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
    })
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n')
    const raw = extractJson(text)
    if (!raw) return emptyEstimate('Réponse IA inexploitable')
    return normalizeEstimate(raw)
  } catch (e) {
    return emptyEstimate(`Erreur vision IA : ${(e as Error).message}`)
  }
}

function emptyEstimate(warning: string): BuildingEstimate {
  return {
    configured: warning !== 'ANTHROPIC_API_KEY manquante',
    width: 0, depth: 0, wall_height: 9, roof_type: 'gable', roof_pitch: 6, stories: 1,
    confidence: 0, facades: [], warning,
  }
}
