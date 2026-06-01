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
export interface ExternalPollResult {
  status: 'processing' | 'completed' | 'failed'
  progress?: number
  modelUrl?: string
  error?: string
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
  const json = (await res.json()) as { status?: string; progress?: number; model_url?: string; output_url?: string; error?: string }
  const status = json.status === 'completed' || json.status === 'succeeded' ? 'completed'
    : json.status === 'failed' || json.status === 'error' ? 'failed' : 'processing'
  return { status, progress: json.progress, modelUrl: json.model_url ?? json.output_url, error: json.error }
}
