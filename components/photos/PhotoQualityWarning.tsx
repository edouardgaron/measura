'use client'

import type { QualityIssue } from '@/lib/image-processing'
import { AlertTriangle, X, RefreshCw } from 'lucide-react'

const ISSUE_LABELS: Record<QualityIssue, string> = {
  too_small: 'Image trop petite (résolution insuffisante)',
  too_dark: 'Image trop sombre',
  blurry: 'Image potentiellement floue',
  too_close: 'Photo trop proche du sujet',
  wrong_format: 'Format non supporté',
  too_large: 'Fichier trop volumineux (max 30 Mo)',
}

interface PhotoQualityWarningProps {
  issues: QualityIssue[]
  onDismiss: () => void
  onRetake?: () => void
}

export default function PhotoQualityWarning({
  issues,
  onDismiss,
  onRetake,
}: PhotoQualityWarningProps) {
  if (issues.length === 0) return null

  return (
    <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-yellow-800">
            Problèmes de qualité détectés
          </p>
          <ul className="mt-2 space-y-1">
            {issues.map((issue) => (
              <li key={issue} className="flex items-center gap-1.5 text-sm text-yellow-700">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
                {ISSUE_LABELS[issue]}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetake && (
              <button
                onClick={onRetake}
                className="inline-flex items-center gap-1.5 rounded-md border border-yellow-400 bg-yellow-100 px-3 py-1.5 text-xs font-medium text-yellow-800 hover:bg-yellow-200 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reprendre la photo
              </button>
            )}
            <button
              onClick={onDismiss}
              className="inline-flex items-center gap-1.5 rounded-md border border-yellow-400 bg-white px-3 py-1.5 text-xs font-medium text-yellow-800 hover:bg-yellow-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Utiliser quand même
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
