// lib/photogrammetry/providers/external.ts
// ============================================================
// Intégration d'un service de photogrammétrie externe (SfM / NeRF /
// Gaussian Splatting) via HTTP. Générique et adaptable au fournisseur
// choisi (COLMAP cloud, Luma, RealityCapture cloud, etc.).
// Gated par PHOTOGRAMMETRY_API_URL + PHOTOGRAMMETRY_API_KEY.
// ============================================================

export function isExternalConfigured(): boolean {
  return !!(process.env.PHOTOGRAMMETRY_API_URL && process.env.PHOTOGRAMMETRY_API_KEY)
}

function base(): string {
  return (process.env.PHOTOGRAMMETRY_API_URL ?? '').replace(/\/$/, '')
}
function headers(): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.PHOTOGRAMMETRY_API_KEY}` }
}

export interface ExternalSubmitResult { providerJobId: string }

/**
 * Ouverture renvoyée par le service de segmentation, en coordonnées RÉELLES
 * dans le repère du mur de sa façade (même unité que le projet : ft ou m).
 * Le service GPU (SfM + segmentation type SAM2/YOLO) connaît l'échelle, donc
 * fournit directement position/dimensions métriques.
 */
export interface ProviderOpening {
  facade_side: 'front' | 'back' | 'left' | 'right'
  type: 'window' | 'door' | 'garage'
  position_x: number
  sill_height: number
  width: number
  height: number
  confidence?: number
}

export interface ExternalPollResult {
  status: 'processing' | 'completed' | 'failed'
  progress?: number
  modelUrl?: string
  error?: string
  /** Ouvertures segmentées (optionnel selon le fournisseur) → colonnes 015. */
  openings?: ProviderOpening[]
}

const FACADES = new Set(['front', 'back', 'left', 'right'])
const KINDS = new Set(['window', 'door', 'garage'])

/** Valide/normalise les ouvertures brutes du fournisseur (ignore les invalides). */
export function parseProviderOpenings(raw: unknown): ProviderOpening[] {
  if (!Array.isArray(raw)) return []
  const out: ProviderOpening[] = []
  for (const r of raw as Record<string, unknown>[]) {
    const facade = String(r.facade_side ?? r.facade ?? '').toLowerCase()
    const kind = String(r.type ?? r.kind ?? '').toLowerCase()
    if (!FACADES.has(facade) || !KINDS.has(kind)) continue
    const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : Number(v))
    const width = num(r.width ?? r.w)
    const height = num(r.height ?? r.h)
    const position_x = num(r.position_x ?? r.x ?? 0)
    const sill_height = num(r.sill_height ?? r.sill ?? r.y ?? 0)
    if (!(width > 0) || !(height > 0)) continue
    out.push({
      facade_side: facade as ProviderOpening['facade_side'],
      type: kind as ProviderOpening['type'],
      position_x: Math.max(0, position_x), sill_height: Math.max(0, sill_height),
      width, height,
      confidence: typeof r.confidence === 'number' ? r.confidence : undefined,
    })
  }
  return out
}

/** Soumet les images (URLs signées) au service ; retourne l'id de job fournisseur. */
export async function submitReconstruction(imageUrls: string[]): Promise<ExternalSubmitResult> {
  const res = await fetch(`${base()}/reconstructions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ images: imageUrls, output_format: 'gltf' }),
  })
  if (!res.ok) throw new Error(`Service photogrammétrie : HTTP ${res.status}`)
  const json = (await res.json()) as { id?: string; job_id?: string }
  const id = json.id ?? json.job_id
  if (!id) throw new Error('Réponse du service invalide (id manquant)')
  return { providerJobId: id }
}

/** Interroge l'état d'un job de reconstruction. */
export async function pollReconstruction(providerJobId: string): Promise<ExternalPollResult> {
  const res = await fetch(`${base()}/reconstructions/${providerJobId}`, { headers: headers() })
  if (!res.ok) return { status: 'failed', error: `HTTP ${res.status}` }
  const json = (await res.json()) as {
    status?: string; progress?: number; model_url?: string; output_url?: string; error?: string; openings?: unknown
  }
  const status = json.status === 'completed' || json.status === 'succeeded' ? 'completed'
    : json.status === 'failed' || json.status === 'error' ? 'failed' : 'processing'
  return {
    status,
    progress: json.progress,
    modelUrl: json.model_url ?? json.output_url,
    error: json.error,
    openings: parseProviderOpenings(json.openings),
  }
}
