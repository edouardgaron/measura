// components/model3d/DesignExtras.tsx
'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2, Columns2, Box, Smartphone, Download } from 'lucide-react'
import { buildHouseScene, exportGLB, exportOBJ } from '@/lib/three/exportModel'
import ARViewer from '@/components/model3d/ARViewer'

const ModelViewer = dynamic(() => import('@/components/model3d/ModelViewer'), {
  ssr: false,
  loading: () => <div className="flex h-[300px] items-center justify-center rounded-xl bg-gray-900"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>,
})

interface Colors { walls: string; roof: string; trim: string }
type RoofType = 'gable' | 'hip' | 'flat' | 'shed'

export default function DesignExtras({ roofType, colors }: { roofType: RoofType; colors: Colors }) {
  // Snapshot "avant" = couleurs au montage
  const beforeRef = useRef<Colors>({ ...colors })
  const [compare, setCompare] = useState(false)
  const [arUrl, setArUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<'glb' | 'obj' | 'ar' | null>(null)

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  async function exportGlb() {
    setBusy('glb')
    try { const scene = buildHouseScene({ roofType }, colors); download(await exportGLB(scene), 'maison.glb') } finally { setBusy(null) }
  }
  function exportObj() {
    setBusy('obj')
    try { const scene = buildHouseScene({ roofType }, colors); download(exportOBJ(scene), 'maison.obj') } finally { setBusy(null) }
  }
  async function viewAr() {
    setBusy('ar')
    try {
      const scene = buildHouseScene({ roofType }, colors)
      const blob = await exportGLB(scene)
      setArUrl(URL.createObjectURL(blob))
    } finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setCompare((c) => !c)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${compare ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
          <Columns2 className="h-4 w-4" /> Avant / Après
        </button>
        <button onClick={viewAr} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60">
          {busy === 'ar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} Voir en RA
        </button>
        <button onClick={exportGlb} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          {busy === 'glb' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />} GLB
        </button>
        <button onClick={exportObj} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          {busy === 'obj' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} OBJ (SketchUp)
        </button>
      </div>

      {compare && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-center text-xs font-medium uppercase tracking-wide text-gray-400">Avant</p>
            <ModelViewer measurements={{}} roofType={roofType} colors={beforeRef.current} onColorsChange={() => {}} />
          </div>
          <div>
            <p className="mb-1 text-center text-xs font-medium uppercase tracking-wide text-blue-500">Après</p>
            <ModelViewer measurements={{}} roofType={roofType} colors={colors} onColorsChange={() => {}} />
          </div>
        </div>
      )}

      {arUrl && <ARViewer src={arUrl} onClose={() => setArUrl(null)} />}
    </div>
  )
}
