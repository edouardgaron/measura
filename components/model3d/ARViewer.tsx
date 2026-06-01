// components/model3d/ARViewer.tsx
'use client'

import { createElement, useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'

// Charge le web component <model-viewer> une seule fois (CDN, module).
let loaderPromise: Promise<void> | null = null
function loadModelViewer(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (loaderPromise) return loaderPromise
  loaderPromise = new Promise<void>((resolve) => {
    if (customElements.get('model-viewer')) return resolve()
    const s = document.createElement('script')
    s.type = 'module'
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js'
    s.onload = () => resolve()
    s.onerror = () => resolve()
    document.head.appendChild(s)
  })
  return loaderPromise
}

export default function ARViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const [ready, setReady] = useState(false)
  useEffect(() => { loadModelViewer().then(() => setReady(true)) }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="relative h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 text-gray-700 shadow hover:bg-white"><X className="h-5 w-5" /></button>
        {!ready ? (
          <div className="flex h-full items-center justify-center text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          createElement('model-viewer', {
            src,
            ar: true,
            'ar-modes': 'webxr scene-viewer quick-look',
            'camera-controls': true,
            'auto-rotate': true,
            'shadow-intensity': '1',
            style: { width: '100%', height: '100%', backgroundColor: '#f3f4f6' },
          })
        )}
        <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-gray-400">
          Sur mobile, touchez l’icône RA pour visualiser en réalité augmentée.
        </p>
      </div>
    </div>
  )
}
