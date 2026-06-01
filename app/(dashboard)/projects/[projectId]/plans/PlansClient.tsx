// app/(dashboard)/projects/[projectId]/plans/PlansClient.tsx
'use client'

import { useState } from 'react'
import { Map, FileDown, Loader2, FileCode2, Info } from 'lucide-react'

export default function PlansClient({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false)

  async function openPdf() {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/plans/pdf`, { method: 'POST' })
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? 'Erreur'); return }
      const blob = await res.blob()
      window.open(URL.createObjectURL(blob), '_blank')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Map className="h-5 w-5 text-blue-600" /> Génération de plans
        </h2>
        <p className="text-sm text-gray-500">Vue en plan + élévations, dérivées du modèle 3D et des mesures.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <Map className="h-8 w-8 text-blue-600" />
          <h3 className="mt-3 font-semibold text-gray-900">Plans PDF</h3>
          <p className="mt-1 text-sm text-gray-500">Vue en plan dimensionnée et 4 élévations, prêtes à imprimer ou joindre au bon de travail.</p>
          <button onClick={openPdf} disabled={loading} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Générer le PDF
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <FileCode2 className="h-8 w-8 text-teal-600" />
          <h3 className="mt-3 font-semibold text-gray-900">Export CAO / BIM</h3>
          <p className="mt-1 text-sm text-gray-500">DXF (AutoCAD/LibreCAD) et IFC (BIM — BIMvision, Revit, ArchiCAD).</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/api/projects/${projectId}/plans/dxf`} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
              <FileDown className="h-4 w-4" /> DXF
            </a>
            <a href={`/api/projects/${projectId}/plans/ifc`} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              <FileDown className="h-4 w-4" /> IFC (BIM)
            </a>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        <span>
          Pour <strong>SketchUp</strong>, exportez le modèle 3D en <strong>OBJ</strong> depuis l’onglet Design (Avant/Après → OBJ). Les plans/IFC sont schématiques (massing) : faites-les valider par un professionnel pour un permis de construction.
        </span>
      </div>
    </div>
  )
}
