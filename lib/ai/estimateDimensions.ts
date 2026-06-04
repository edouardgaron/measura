// lib/ai/estimateDimensions.ts
// ============================================================
// Estimation des DIMENSIONS RÉELLES d'une façade à partir d'une seule photo,
// par mise à l'échelle sur un objet de référence (méthode « known-size »), sans
// GPU ni service externe. C'est le chaînon qui rend les mesures AUTOMATIQUES :
// sans lui, buildPlanData retombe sur des dimensions par défaut (estimated=true).
//
// Principe : la vision Claude renvoie (via requestFacadeDetection) la boîte du
// mur et des ouvertures en coordonnées normalisées 0..1. On choisit l'ouverture
// de référence la plus fiable (porte > garage > fenêtre), dont on connaît la
// hauteur réelle standard, et on en déduit l'échelle pixels→réel :
//
//   échelle verticale  = hauteurRéelleRéférence / (boxRéférence.h)         [unité/fraction]
//   hauteurMur (unité) = mur.h × échelle
//   largeurMur (unité) = mur.w × AR × échelle      (AR = largeur_px / hauteur_px)
//
// AR corrige le fait que x/w sont des fractions de la LARGEUR de l'image alors
// que y/h sont des fractions de la HAUTEUR : on ramène tout au même px/unité.
//
// Repli : si aucune référence exploitable, renvoie null → l'appelant garde les
// dimensions manuelles/par défaut.
// ============================================================

import type { NormBox, RawOpening, RawResponse } from '@/lib/ai/detectOpenings'
import { requestFacadeDetection } from '@/lib/ai/detectOpenings'

export type ReferenceKind = 'door' | 'garage' | 'window'

/** Hauteurs réelles standards (Québec/Canada résidentiel) par unité de projet. */
const REFERENCE_HEIGHT: Record<ReferenceKind, { ft: number; m: number; reliability: number }> = {
  // Porte d'entrée standard : 80 po = 6.667 pi = 2.03 m. La plus fiable.
  door:   { ft: 6.667, m: 2.03, reliability: 1.0 },
  // Porte de garage simple : 7 pi = 2.13 m (hauteur). Très fiable, grande boîte.
  garage: { ft: 7.0,   m: 2.13, reliability: 0.9 },
  // Fenêtre : très variable (1.0–1.5 m). Repli faible uniquement.
  window: { ft: 4.0,   m: 1.22, reliability: 0.5 },
}

const PREFERENCE: ReferenceKind[] = ['door', 'garage', 'window']

export interface FacadeScale {
  /** Largeur réelle du mur de cette façade (unité projet). */
  width: number
  /** Hauteur réelle du mur (unité projet). */
  height: number
  /** Type d'ouverture ayant servi de référence d'échelle. */
  reference: ReferenceKind
  /** Indice de confiance 0..1 (fiabilité référence × confiance détection × plausibilité). */
  confidence: number
}

function normType(t: string | undefined): ReferenceKind | null {
  const v = (t ?? '').toLowerCase()
  if (v === 'window' || v === 'fenetre' || v === 'fenêtre') return 'window'
  if (v === 'door' || v === 'porte') return 'door'
  if (v === 'garage' || v === 'porte de garage') return 'garage'
  return null
}

/** Boîte valide et non dégénérée. */
function validBox(b: NormBox | undefined | null): b is NormBox {
  return !!b && b.h > 0 && b.w > 0 && b.h <= 1.5 && b.w <= 1.5
}

/**
 * Choisit l'ouverture de référence : par ordre de préférence de type, puis la
 * plus grande boîte (hauteur) du type retenu — plus proche = plus précise.
 */
export function pickReference(openings: RawOpening[] | undefined): { kind: ReferenceKind; box: NormBox; confidence: number } | null {
  const usable = (openings ?? [])
    .map((o) => ({ kind: normType(o.type), box: o.box, confidence: o.confidence }))
    .filter((o): o is { kind: ReferenceKind; box: NormBox; confidence: number | undefined } => !!o.kind && validBox(o.box))
  if (usable.length === 0) return null

  for (const kind of PREFERENCE) {
    const sameKind = usable.filter((o) => o.kind === kind)
    if (sameKind.length === 0) continue
    // Plus grande hauteur de boîte = référence la plus nette.
    const best = sameKind.reduce((a, b) => (b.box.h > a.box.h ? b : a))
    return { kind, box: best.box, confidence: best.confidence ?? 0.6 }
  }
  return null
}

/**
 * Calcule l'échelle réelle d'une façade depuis les boîtes normalisées.
 * Fonction PURE (testable sans IA).
 *
 * @param raw          réponse vision (mur + ouvertures normalisés)
 * @param aspectRatio  largeur_px / hauteur_px de l'image source
 * @param metric       true → unités en mètres, false → pieds
 */
export function estimateFacadeScale(
  raw: RawResponse,
  aspectRatio: number,
  metric: boolean,
): FacadeScale | null {
  const wall = raw.wall
  if (!validBox(wall) || !(aspectRatio > 0)) return null

  const ref = pickReference(raw.openings)
  if (!ref) return null

  const refReal = metric ? REFERENCE_HEIGHT[ref.kind].m : REFERENCE_HEIGHT[ref.kind].ft
  const reliability = REFERENCE_HEIGHT[ref.kind].reliability

  // unité réelle par fraction-de-hauteur-d'image.
  const unitPerFracH = refReal / ref.box.h

  const height = +(wall.h * unitPerFracH).toFixed(2)
  const width = +(wall.w * aspectRatio * unitPerFracH).toFixed(2)
  if (!(height > 0) || !(width > 0)) return null

  // Plausibilité : un mur résidentiel fait 2.2–6 m de haut et 3–30 m de large.
  const hMin = metric ? 2.2 : 7,  hMax = metric ? 6 : 20
  const wMin = metric ? 3 : 10,   wMax = metric ? 30 : 100
  const inRange = height >= hMin && height <= hMax && width >= wMin && width <= wMax
  const plausibility = inRange ? 1 : 0.4

  const confidence = +Math.max(0.1, Math.min(1, reliability * ref.confidence * plausibility)).toFixed(2)
  return { width, height, reference: ref.kind, confidence }
}

export type FacadeSide = 'front' | 'back' | 'left' | 'right'

export interface ReconciledDimensions {
  width: number | null    // façade avant (front/back)
  depth: number | null    // côté (left/right)
  height: number | null   // hauteur de mur
  confidence: number      // 0..1 moyen pondéré des façades contributrices
  /** Une entrée par façade analysée, prête pour persistWallDimensions. */
  walls: Array<{ facade_side: FacadeSide; length: number; height: number; reference: ReferenceKind; confidence: number }>
}

function weightedAvg(items: Array<{ value: number; weight: number }>): number | null {
  const ws = items.reduce((s, i) => s + i.weight, 0)
  if (ws <= 0) return null
  return +(items.reduce((s, i) => s + i.value * i.weight, 0) / ws).toFixed(2)
}

/**
 * Réconcilie les échelles de chaque façade en dimensions cohérentes du bâtiment.
 * front/back → largeur, left/right → profondeur, hauteur = moyenne pondérée par
 * confiance de toutes les façades. Fonction PURE (testable).
 */
export function reconcileDimensions(
  scales: Partial<Record<FacadeSide, FacadeScale>>
): ReconciledDimensions {
  const entries = (Object.entries(scales) as Array<[FacadeSide, FacadeScale | undefined]>)
    .filter((e): e is [FacadeSide, FacadeScale] => !!e[1])

  const widthEntries = entries.filter(([s]) => s === 'front' || s === 'back')
  const depthEntries = entries.filter(([s]) => s === 'left' || s === 'right')

  const width = weightedAvg(widthEntries.map(([, sc]) => ({ value: sc.width, weight: sc.confidence })))
  const depth = weightedAvg(depthEntries.map(([, sc]) => ({ value: sc.width, weight: sc.confidence })))
  const height = weightedAvg(entries.map(([, sc]) => ({ value: sc.height, weight: sc.confidence })))
  const confidence = entries.length
    ? +(entries.reduce((s, [, sc]) => s + sc.confidence, 0) / entries.length).toFixed(2)
    : 0

  const walls = entries.map(([side, sc]) => ({
    facade_side: side,
    length: (side === 'front' || side === 'back' ? width : depth) ?? sc.width,
    height: height ?? sc.height,
    reference: sc.reference,
    confidence: sc.confidence,
  }))

  return { width, depth, height, confidence, walls }
}

/**
 * Détecte une façade (un appel vision) puis en estime l'échelle réelle.
 * @returns la réponse brute (réutilisable pour replacer les ouvertures) + l'échelle.
 */
export async function estimateFacadeDimensions(opts: {
  imageUrl: string
  aspectRatio: number
  metric: boolean
}): Promise<{ configured: boolean; raw: RawResponse | null; scale: FacadeScale | null; warning?: string }> {
  const { imageUrl, aspectRatio, metric } = opts
  const { configured, raw, warning } = await requestFacadeDetection(imageUrl)
  if (!configured || !raw) return { configured, raw: null, scale: null, warning }
  const scale = estimateFacadeScale(raw, aspectRatio, metric)
  return {
    configured: true,
    raw,
    scale,
    warning: scale ? undefined : 'Aucun objet de référence (porte/garage/fenêtre) exploitable pour l’échelle',
  }
}
