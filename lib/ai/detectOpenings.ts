// lib/ai/detectOpenings.ts
// ============================================================
// Détection des ouvertures (fenêtres / portes / garage) sur une photo de
// façade par vision Claude, puis remappage en coordonnées RÉELLES du mur
// pour des élévations exactes (style Hover) — sans GPU ni service externe.
//
// Claude renvoie, en coordonnées normalisées (0..1, origine en haut-gauche) :
//   - la boîte englobante du MUR de la façade dans l'image,
//   - une boîte par ouverture + son type.
// On convertit ensuite chaque ouverture dans le repère du mur :
//   position_x  = décalage horizontal du bord gauche (depuis le bord gauche du mur)
//   sill_height = hauteur de l'allège au-dessus du sol
//   width/height = dimensions réelles
// le tout à l'échelle de la largeur (sideWidthFt) et hauteur (wallHeightFt) réelles.
//
// Repli : si ANTHROPIC_API_KEY est absente ou la réponse inexploitable,
// renvoie { configured:false } / openings vides — l'appelant garde alors la
// répartition uniforme du rapport.
// ============================================================

import type Anthropic from '@anthropic-ai/sdk'
import { getAnthropic, aiModel } from '@/lib/ai/client'

export type OpeningKind = 'window' | 'door' | 'garage'

export interface DetectedOpening {
  type: OpeningKind
  /** Décalage horizontal du bord gauche depuis le bord gauche du mur (unité réelle). */
  position_x: number
  /** Hauteur de l'allège (bas de l'ouverture) au-dessus du sol (unité réelle). */
  sill_height: number
  /** Largeur réelle de l'ouverture (unité réelle). */
  width: number
  /** Hauteur réelle de l'ouverture (unité réelle). */
  height: number
  confidence: number
}

export interface DetectOpeningsResult {
  configured: boolean
  wallFound: boolean
  openings: DetectedOpening[]
  warning?: string
}

export interface NormBox { x: number; y: number; w: number; h: number }
export interface RawOpening { type?: string; box?: NormBox; confidence?: number }
export interface RawResponse { wall?: NormBox | null; openings?: RawOpening[] }

const SYSTEM = `Tu es un système de vision par ordinateur spécialisé en analyse de façades de bâtiments résidentiels. On te donne UNE photo d'une façade. Tu dois localiser le plan du mur principal puis chaque ouverture (fenêtre, porte, porte de garage).

Réponds UNIQUEMENT avec un objet JSON valide (aucun texte autour, pas de Markdown), avec ce schéma exact :
{
  "wall": { "x": number, "y": number, "w": number, "h": number },
  "openings": [
    { "type": "window" | "door" | "garage", "box": { "x": number, "y": number, "w": number, "h": number }, "confidence": number }
  ]
}

Règles :
- Toutes les coordonnées sont NORMALISÉES entre 0 et 1, origine en HAUT-GAUCHE de l'image. x,y = coin supérieur gauche de la boîte ; w,h = largeur/hauteur.
- "wall" = boîte englobant la surface de mur visible de CETTE façade (du sol/base au bas du toit, sur toute la largeur visible du mur). Exclus le ciel, le sol, la végétation et le toit.
- N'inclus que les ouvertures clairement situées sur cette façade. Ignore les reflets et ouvertures d'autres bâtiments.
- "confidence" entre 0 et 1.
- Si aucun mur n'est identifiable, renvoie "wall": null et "openings": [].`

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Extrait le premier objet JSON d'une chaîne (tolère les ```json … ``` ou texte parasite). */
function extractJson(text: string): RawResponse | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as RawResponse
  } catch {
    return null
  }
}

function normType(t: string | undefined): OpeningKind | null {
  const v = (t ?? '').toLowerCase()
  if (v === 'window' || v === 'fenetre' || v === 'fenêtre') return 'window'
  if (v === 'door' || v === 'porte') return 'door'
  if (v === 'garage' || v === 'porte de garage') return 'garage'
  return null
}

/**
 * Remappe les boîtes normalisées renvoyées par le modèle en ouvertures réelles
 * dans le repère du mur. Exporté pour être testé indépendamment de l'API.
 */
export function mapDetections(
  raw: RawResponse,
  sideWidthFt: number,
  wallHeightFt: number,
): DetectOpeningsResult {
  const wall = raw.wall
  if (!wall || !(wall.w > 0) || !(wall.h > 0)) {
    return { configured: true, wallFound: false, openings: [] }
  }
  const wx = clamp01(wall.x), wy = clamp01(wall.y)
  const ww = Math.max(wall.w, 1e-3), wh = Math.max(wall.h, 1e-3)

  const openings: DetectedOpening[] = []
  for (const o of raw.openings ?? []) {
    const type = normType(o.type)
    const b = o.box
    if (!type || !b || !(b.w > 0) || !(b.h > 0)) continue

    // Fractions relatives au mur (peuvent légèrement déborder → on borne).
    const leftFrac = clamp01((b.x - wx) / ww)
    const topFrac = clamp01((b.y - wy) / wh)
    const wFrac = Math.min(b.w / ww, 1 - leftFrac)
    const hFrac = Math.min(b.h / wh, 1 - topFrac)
    const bottomFrac = topFrac + hFrac

    const width = +(wFrac * sideWidthFt).toFixed(3)
    const height = +(hFrac * wallHeightFt).toFixed(3)
    const position_x = +(leftFrac * sideWidthFt).toFixed(3)
    // sill = distance du bas de l'ouverture au sol = hauteur mur × (1 - bas%)
    const sill_height = +Math.max(0, (1 - bottomFrac) * wallHeightFt).toFixed(3)

    if (width <= 0 || height <= 0) continue
    openings.push({
      type, position_x, sill_height, width, height,
      confidence: clamp01(o.confidence ?? 0.5),
    })
  }
  // Tri de gauche à droite.
  openings.sort((a, b) => a.position_x - b.position_x)
  return { configured: true, wallFound: true, openings }
}

/**
 * Détecte les ouvertures d'une photo de façade via la vision Claude.
 * @param imageUrl      URL accessible de l'image (p. ex. URL signée Supabase).
 * @param sideWidthFt   largeur réelle du mur de cette façade.
 * @param wallHeightFt  hauteur réelle du mur.
 */
/**
 * Appel vision bas niveau : renvoie les boîtes normalisées (mur + ouvertures)
 * d'une photo de façade, SANS mise à l'échelle. Réutilisé par la détection
 * d'ouvertures ET par l'estimation des dimensions (un seul appel IA par façade).
 */
export async function requestFacadeDetection(imageUrl: string): Promise<{
  configured: boolean
  raw: RawResponse | null
  warning?: string
}> {
  const client = getAnthropic()
  if (!client) {
    return { configured: false, raw: null, warning: 'ANTHROPIC_API_KEY manquante' }
  }
  try {
    const res = await client.messages.create({
      model: aiModel(),
      max_tokens: 1500,
      thinking: { type: 'disabled' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Analyse cette façade et renvoie le JSON demandé.' },
          { type: 'image', source: { type: 'url', url: imageUrl } },
        ],
      }],
    })
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
    const raw = extractJson(text)
    if (!raw) return { configured: true, raw: null, warning: 'Réponse IA inexploitable' }
    return { configured: true, raw }
  } catch (e) {
    return { configured: true, raw: null, warning: `Erreur vision IA : ${(e as Error).message}` }
  }
}

/**
 * Détecte les ouvertures d'une photo de façade via la vision Claude.
 * @param imageUrl      URL accessible de l'image (p. ex. URL signée Supabase).
 * @param sideWidthFt   largeur réelle du mur de cette façade.
 * @param wallHeightFt  hauteur réelle du mur.
 */
export async function detectOpenings(opts: {
  imageUrl: string
  sideWidthFt: number
  wallHeightFt: number
}): Promise<DetectOpeningsResult> {
  const { imageUrl, sideWidthFt, wallHeightFt } = opts
  if (!(sideWidthFt > 0) || !(wallHeightFt > 0)) {
    return { configured: true, wallFound: false, openings: [], warning: 'Dimensions du mur inconnues' }
  }
  const { configured, raw, warning } = await requestFacadeDetection(imageUrl)
  if (!configured) return { configured: false, wallFound: false, openings: [], warning }
  if (!raw) return { configured: true, wallFound: false, openings: [], warning }
  return mapDetections(raw, sideWidthFt, wallHeightFt)
}
