'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { X, AlertTriangle, CheckCircle } from 'lucide-react'

interface PhotoPreviewModalProps {
  url: string
  name?: string
  qualityStatus?: string | null
  onClose: () => void
}

export default function PhotoPreviewModal({
  url,
  name,
  qualityStatus,
  onClose,
}: PhotoPreviewModalProps) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const showBadge = qualityStatus === 'warning' || qualityStatus === 'rejected'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex max-h-[90vh] max-w-[90vw] flex-col items-center">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 transition-colors"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Image container */}
        <div className="relative overflow-hidden rounded-lg">
          {/* Quality badge */}
          {showBadge && (
            <div
              className={`absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                qualityStatus === 'warning'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-red-500 text-white'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {qualityStatus === 'warning' ? 'Avertissement qualité' : 'Qualité insuffisante'}
            </div>
          )}
          {qualityStatus === 'good' && (
            <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-green-500 px-2.5 py-1 text-xs font-medium text-white">
              <CheckCircle className="h-3.5 w-3.5" />
              Bonne qualité
            </div>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={name ?? 'Aperçu de la photo'}
            className="max-h-[80vh] max-w-[85vw] rounded-lg object-contain"
          />
        </div>

        {/* File name */}
        {name && (
          <p className="mt-3 text-sm text-white/80">{name}</p>
        )}
      </div>
    </div>
  )
}
