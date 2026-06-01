// components/model3d/ReconstructPanel.tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Boxes, Loader2, Sparkles, Smartphone, Download, Info } from 'lucide-react'
import ARViewer from '@/components/model3d/ARViewer'

const GltfViewer = dynamic(() => import('@/components/model3d/GltfViewer'), {
  ssr: false,
  loading: () => <div className="flex h-[420px] items-center justify-center rounded-xl bg-gray-900"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>,
})

export default function ReconstructPanel({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState<'parametric' | 'external' | null>(null)
  const [gltfUrl, setGltfUrl] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [ar, setAr] = useState(false)
  const [stats, setStats] = useState<string | null>(null)

  async function reconstruct(mode: 'parametric' | 'external') {
    setBusy(mode); setMsg(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/reconstruct`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error ?? 'Erreur'); return }

      if (json.status === 'completed' && json.gltfUrl) {
        setGltfUrl(json.gltfUrl)
        if (json.model) setStats(`${json.model.width.toFixed(1)} × ${json.model.depth.toFixed(1)} × ${json.model.height.toFixed(1)} m · ${json.model.triangles} triangles`)
        return
      }
      if (json.status === 'processing' && json.jobId) {
        setMsg('Reconstruction dense en cours…')
        await pollExternal(json.jobId)
      }
    } finally {
      setBusy(null)
    }
  }

  async function pollExternal(jobId: string) {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const res = await fetch(`/api/projects/${projectId}/reconstruct?jobId=${jobId}`)
      const json = await res.json()
      if (json.status === 'completed' && json.gltfUrl) { setGltfUrl(json.gltfUrl); setMsg(null); return }
      if (json.status === 'failed') { setMsg(json.error ?? 'Échec de la reconstruction dense'); return }
      setMsg(`Reconstruction dense… ${json.progress ?? ''}%`)
    }
    setMsg('Toujours en cours — réessayez plus tard.')
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900"><Boxes className="h-5 w-5 text-blue-600" /> Reconstruction 3D depuis les photos</h3>
      <p className="mt-1 text-sm text-gray-500">Génère un modèle 3D à partir des mesures et photos du projet.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => reconstruct('parametric')} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {busy === 'parametric' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />} Reconstruire (paramétrique)
        </button>
        <button onClick={() => reconstruct('external')} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-60">
          {busy === 'external' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Reconstruction dense (IA)
        </button>
      </div>

      {msg && <p className="mt-3 text-sm text-amber-600">{msg}</p>}

      {gltfUrl && (
        <div className="mt-4 space-y-3">
          <GltfViewer url={gltfUrl} />
          {stats && <p className="text-center text-xs text-gray-500">{stats}</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setAr(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"><Smartphone className="h-4 w-4" /> Voir en RA</button>
            <a href={gltfUrl} download className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"><Download className="h-4 w-4" /> Télécharger glTF</a>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <strong>Paramétrique</strong> : modèle volumétrique exact dérivé de vos mesures (instantané, fonctionne toujours).
          <strong> Dense (IA)</strong> : maillage photogrammétrique complet via service externe (COLMAP/Gaussian Splatting) — nécessite la configuration <code>PHOTOGRAMMETRY_API_URL</code>.
        </span>
      </div>

      {ar && gltfUrl && <ARViewer src={gltfUrl} onClose={() => setAr(false)} />}
    </div>
  )
}
