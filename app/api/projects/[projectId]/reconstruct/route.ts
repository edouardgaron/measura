// app/api/projects/[projectId]/reconstruct/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { runParametricReconstruction } from '@/lib/photogrammetry/reconstruct'
import { isExternalConfigured, pollReconstruction, submitReconstruction } from '@/lib/photogrammetry/providers/external'

type RouteContext = { params: Promise<{ projectId: string }> }
export const runtime = 'nodejs'
export const maxDuration = 60

async function signedModelUrl(admin: Awaited<ReturnType<typeof createAdminClient>>, path: string): Promise<string | null> {
  const { data } = await admin.storage.from('reports').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

// POST — lance la reconstruction (paramétrique par défaut, ou externe)
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()
  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: { mode?: 'parametric' | 'external' } = {}
  try { body = await request.json() } catch { /* defaults */ }
  const mode = body.mode === 'external' ? 'external' : 'parametric'
  const admin = await createAdminClient()

  if (mode === 'external') {
    if (!isExternalConfigured()) {
      return NextResponse.json({ error: 'Service de photogrammétrie externe non configuré (PHOTOGRAMMETRY_API_URL/KEY).' }, { status: 400 })
    }
    const { data: photos } = await supabase
      .from('photos').select('storage_path').eq('project_id', projectId).order('sort_order', { ascending: true }).limit(40)
    if (!photos || photos.length < 3) {
      return NextResponse.json({ error: 'Au moins 3 photos sont requises pour la reconstruction dense.' }, { status: 422 })
    }
    const urls: string[] = []
    for (const p of photos) {
      const { data } = await admin.storage.from('photos').createSignedUrl(p.storage_path, 7200)
      if (data?.signedUrl) urls.push(data.signedUrl)
    }
    try {
      const { providerJobId } = await submitReconstruction(urls)
      const { data: job } = await supabase.from('project_processing_jobs').insert({
        project_id: projectId, type: 'ai_model_generation', status: 'processing', progress: 5,
        current_step: 'Reconstruction dense en cours (service externe)',
        input_data: { provider: 'external', providerJobId },
        started_at: new Date().toISOString(),
      }).select('id').single()
      return NextResponse.json({ status: 'processing', jobId: job?.id, providerJobId })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur service externe' }, { status: 502 })
    }
  }

  // Paramétrique
  try {
    const result = await runParametricReconstruction(supabase, admin, projectId, auth.user!.id)
    const url = await signedModelUrl(admin, result.storagePath)
    return NextResponse.json({ status: 'completed', model: result, gltfUrl: url })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur reconstruction' }, { status: 500 })
  }
}

// GET — interroge un job externe et finalise (téléchargement + stockage du modèle)
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()
  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const jobId = request.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'jobId requis' }, { status: 422 })

  const { data: job } = await supabase
    .from('project_processing_jobs').select('*').eq('id', jobId).eq('project_id', projectId).single()
  if (!job) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  if (job.status === 'completed' || job.status === 'failed') {
    const admin = await createAdminClient()
    const path = (job.output_data as { gltf_storage_path?: string } | null)?.gltf_storage_path
    const url = path ? await signedModelUrl(admin, path) : null
    return NextResponse.json({ status: job.status, gltfUrl: url, job })
  }

  const providerJobId = (job.input_data as { providerJobId?: string } | null)?.providerJobId
  if (!providerJobId) return NextResponse.json({ status: job.status, job })

  const poll = await pollReconstruction(providerJobId)

  if (poll.status === 'processing') {
    await supabase.from('project_processing_jobs').update({ progress: poll.progress ?? job.progress }).eq('id', jobId)
    return NextResponse.json({ status: 'processing', progress: poll.progress ?? job.progress })
  }

  if (poll.status === 'failed' || !poll.modelUrl) {
    await supabase.from('project_processing_jobs').update({ status: 'failed', error_message: poll.error ?? 'Échec', completed_at: new Date().toISOString() }).eq('id', jobId)
    return NextResponse.json({ status: 'failed', error: poll.error ?? 'Échec de la reconstruction' })
  }

  // Téléchargement du modèle et stockage
  const admin = await createAdminClient()
  try {
    const modelRes = await fetch(poll.modelUrl)
    const arrayBuf = await modelRes.arrayBuffer()
    const ext = poll.modelUrl.includes('.glb') ? 'glb' : 'gltf'
    const fileName = `models/${projectId}/dense-${Date.now()}.${ext}`
    await admin.storage.from('reports').upload(fileName, Buffer.from(arrayBuf), {
      contentType: ext === 'glb' ? 'model/gltf-binary' : 'model/gltf+json', upsert: false,
    })
    await supabase.from('house_models').insert({
      project_id: projectId, geometry_json: { method: 'external-dense' }, roof_type: 'gable',
      wall_height: null, footprint_json: null, generated_at: new Date().toISOString(), gltf_storage_path: fileName,
    })
    await supabase.from('project_processing_jobs').update({
      status: 'completed', progress: 100, current_step: 'Modèle dense reçu',
      output_data: { gltf_storage_path: fileName, provider: 'external' }, completed_at: new Date().toISOString(),
    }).eq('id', jobId)
    const url = await signedModelUrl(admin, fileName)
    return NextResponse.json({ status: 'completed', gltfUrl: url })
  } catch (e) {
    return NextResponse.json({ status: 'failed', error: e instanceof Error ? e.message : 'Téléchargement échoué' }, { status: 502 })
  }
}
