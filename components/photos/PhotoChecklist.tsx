'use client'

import { useRef, useState } from 'react'
import { CheckCircle2, Circle, Camera, Loader2, AlertTriangle, X } from 'lucide-react'
import { analyzeImageQuality, compressImage } from '@/lib/image-processing'
import type { QualityIssue } from '@/lib/image-processing'
import PhotoQualityWarning from './PhotoQualityWarning'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhotoRecord {
  id: string
  storage_path: string
  original_name: string | null
  facade_label: string | null
  photo_category: string | null
  quality_status: string | null
  url: string
}

interface ChecklistItem {
  id: string
  label: string
  instructions: string
  required: boolean
}

interface PhotoChecklistProps {
  projectId: string
  existingPhotos: PhotoRecord[]
  onPhotoUploaded: (photo: PhotoRecord) => void
}

// ─── Checklist definition ─────────────────────────────────────────────────────

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'front_elevation',   label: 'Façade avant',          instructions: 'Reculez pour voir toute la façade. Gardez le téléphone droit.', required: true },
  { id: 'rear_elevation',    label: 'Façade arrière',         instructions: "Vue complète de l'arrière. Même distance qu'à l'avant.", required: true },
  { id: 'left_elevation',    label: 'Côté gauche',            instructions: 'Vue complète du côté gauche de la maison.', required: true },
  { id: 'right_elevation',   label: 'Côté droit',             instructions: 'Vue complète du côté droit de la maison.', required: true },
  { id: 'front_left_corner', label: 'Coin avant gauche',      instructions: 'Photographiez le coin à 45°, deux façades visibles.', required: false },
  { id: 'front_right_corner',label: 'Coin avant droit',       instructions: 'Photographiez le coin à 45°, deux façades visibles.', required: false },
  { id: 'rear_left_corner',  label: 'Coin arrière gauche',    instructions: 'Coin arrière gauche à 45°.', required: false },
  { id: 'rear_right_corner', label: 'Coin arrière droit',     instructions: 'Coin arrière droit à 45°.', required: false },
  { id: 'roof_front',        label: 'Toiture (avant)',        instructions: 'Photographiez la pente du toit depuis l\'avant.', required: true },
  { id: 'roof_rear',         label: 'Toiture (arrière)',      instructions: 'Vue de la pente arrière du toit.', required: false },
  { id: 'window_detail',     label: 'Détail fenêtres',        instructions: 'Gros plan sur une fenêtre typique.', required: false },
  { id: 'door_detail',       label: 'Détail portes',          instructions: 'Photographiez la porte principale.', required: false },
  { id: 'material_detail',   label: 'Revêtement extérieur',   instructions: 'Gros plan sur le revêtement (bardeau, brique, etc).', required: false },
  { id: 'damage',            label: 'Zones endommagées',      instructions: 'Photographiez tout dommage visible.', required: false },
]

// ─── Quality warning overlay state ───────────────────────────────────────────

interface WarningState {
  itemId: string
  file: File
  issues: QualityIssue[]
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PhotoChecklist({
  projectId,
  existingPhotos,
  onPhotoUploaded,
}: PhotoChecklistProps) {
  // uploading state per item
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  // quality warning state
  const [warningState, setWarningState] = useState<WarningState | null>(null)
  // error message per item
  const [errors, setErrors] = useState<Record<string, string>>({})
  // file input refs per item
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Determine which categories already have photos
  const coveredCategories = new Set(
    existingPhotos.map((p) => p.photo_category).filter(Boolean) as string[]
  )

  const requiredItems = CHECKLIST_ITEMS.filter((i) => i.required)
  const completedRequired = requiredItems.filter((i) => coveredCategories.has(i.id)).length

  // ── Upload flow ──────────────────────────────────────────────────────────────

  async function processFile(itemId: string, file: File, skipQualityCheck = false) {
    setErrors((prev) => ({ ...prev, [itemId]: '' }))
    setUploading((prev) => ({ ...prev, [itemId]: true }))

    try {
      // 1. Quality analysis
      if (!skipQualityCheck) {
        const quality = await analyzeImageQuality(file)

        if (quality.status === 'rejected') {
          setErrors((prev) => ({
            ...prev,
            [itemId]: `Photo rejetée : ${quality.issues.join(', ')}`,
          }))
          setUploading((prev) => ({ ...prev, [itemId]: false }))
          return
        }

        if (quality.status === 'warning') {
          setWarningState({ itemId, file, issues: quality.issues })
          setUploading((prev) => ({ ...prev, [itemId]: false }))
          return
        }
      }

      // 2. Compress
      const compressed = await compressImage(file)

      // 3. Get signed URL
      const ext = compressed.name.split('.').pop() ?? 'jpg'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const signedRes = await fetch(
        `/api/upload/signed-url?projectId=${projectId}&filename=${encodeURIComponent(filename)}`
      )
      if (!signedRes.ok) throw new Error("Impossible d'obtenir l'URL signée")
      const { signedUrl, path } = await signedRes.json() as { signedUrl: string; path: string }

      // 4. Upload to storage
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: compressed,
        headers: { 'Content-Type': compressed.type },
      })
      if (!uploadRes.ok) throw new Error('Échec du téléversement vers le stockage')

      // 5. Analyze quality again for score (already done above, but we need the values)
      const finalQuality = await analyzeImageQuality(file)

      // 6. Save metadata
      const metaRes = await fetch(`/api/projects/${projectId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: path,
          original_name: file.name,
          mime_type: compressed.type,
          file_size_bytes: compressed.size,
          photo_category: itemId,
          quality_status: finalQuality.status,
          quality_issues: finalQuality.issues,
          quality_score: finalQuality.score,
        }),
      })
      if (!metaRes.ok) throw new Error("Échec de l'enregistrement des métadonnées")
      const { photo } = await metaRes.json() as { photo: PhotoRecord }

      // 7. Notify parent
      onPhotoUploaded(photo)
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [itemId]: (err as Error).message,
      }))
    } finally {
      setUploading((prev) => ({ ...prev, [itemId]: false }))
      // Reset the input so the same file can be re-selected
      const input = inputRefs.current[itemId]
      if (input) input.value = ''
    }
  }

  function handleFileChange(itemId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    void processFile(itemId, file)
  }

  // Warning dialog actions
  function handleWarningDismiss() {
    if (!warningState) return
    const { itemId, file } = warningState
    setWarningState(null)
    void processFile(itemId, file, true) // skip quality check, proceed
  }

  function handleWarningRetake() {
    if (!warningState) return
    const { itemId } = warningState
    setWarningState(null)
    // Re-open the file picker for this item
    inputRefs.current[itemId]?.click()
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Progress counter */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">
            {completedRequired} / {requiredItems.length} photos requises complétées
          </p>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              completedRequired >= requiredItems.length
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {completedRequired >= requiredItems.length ? 'Complet' : 'En cours'}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{
              width: `${requiredItems.length > 0 ? (completedRequired / requiredItems.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Warning overlay */}
      {warningState && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-yellow-800">
              Photo : {CHECKLIST_ITEMS.find((i) => i.id === warningState.itemId)?.label}
            </p>
            <button
              onClick={() => setWarningState(null)}
              className="rounded p-1 text-yellow-600 hover:bg-yellow-100"
              aria-label="Annuler"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <PhotoQualityWarning
            issues={warningState.issues}
            onDismiss={handleWarningDismiss}
            onRetake={handleWarningRetake}
          />
        </div>
      )}

      {/* Checklist items */}
      <div className="space-y-3">
        {CHECKLIST_ITEMS.map((item) => {
          const isDone = coveredCategories.has(item.id)
          const isUploading = uploading[item.id] ?? false
          const error = errors[item.id]

          return (
            <div
              key={item.id}
              className={`rounded-xl border bg-white p-4 transition-colors ${
                isDone
                  ? 'border-green-200 bg-green-50/40'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status indicator */}
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-semibold ${isDone ? 'text-green-700' : 'text-gray-900'}`}>
                      {item.label}
                    </p>
                    {item.required && !isDone && (
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                        Requis
                      </span>
                    )}
                    {isDone && (
                      <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                        Complété
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{item.instructions}</p>

                  {error && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {error}
                    </p>
                  )}
                </div>

                {/* Action button */}
                <div className="shrink-0">
                  {isUploading ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <div className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isDone
                          ? 'border-green-300 bg-white text-green-700 hover:bg-green-50'
                          : 'border-blue-300 bg-blue-600 text-white hover:bg-blue-700'
                      }`}>
                        <Camera className="h-3.5 w-3.5" />
                        {isDone ? 'Remplacer' : 'Prendre / Importer'}
                      </div>
                      <input
                        ref={(el) => { inputRefs.current[item.id] = el }}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        onChange={(e) => handleFileChange(item.id, e)}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
