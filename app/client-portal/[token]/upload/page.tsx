// app/client-portal/[token]/upload/page.tsx
'use client'

import { use, useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Upload, CheckCircle2, Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react'

type StepStatus = 'pending' | 'uploading' | 'done' | 'error' | 'skipped'

interface UploadStep {
  id: string
  label: string
  facadeLabel: 'front' | 'back' | 'left' | 'right' | 'roof' | 'other'
  description: string
  status: StepStatus
  preview: string | null
  file: File | null
}

const STEPS: Omit<UploadStep, 'status' | 'preview' | 'file'>[] = [
  { id: 'front', label: 'Façade avant', facadeLabel: 'front', description: 'Photographiez la façade principale de la maison en entier.' },
  { id: 'left', label: 'Façade gauche', facadeLabel: 'left', description: 'Côté gauche de la maison, de la fondation au toit.' },
  { id: 'right', label: 'Façade droite', facadeLabel: 'right', description: 'Côté droit de la maison, de la fondation au toit.' },
  { id: 'back', label: 'Façade arrière', facadeLabel: 'back', description: 'Façade arrière depuis la cour ou le jardin.' },
  { id: 'roof', label: 'Toit', facadeLabel: 'roof', description: 'Vue du toit — en angle depuis la rue ou une position surélevée.' },
  { id: 'extra', label: 'Photo supplémentaire', facadeLabel: 'other', description: 'Fenêtres, portes, lucarnes ou tout détail particulier.' },
]

interface Props {
  params: Promise<{ token: string }>
}

export default function ClientUploadPage({ params }: Props) {
  const { token } = use(params)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [steps, setSteps] = useState<UploadStep[]>(
    STEPS.map((s) => ({ ...s, status: 'pending', preview: null, file: null }))
  )
  const [completed, setCompleted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentStep = steps[currentIndex]
  const doneCount = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length

  function selectFile(file: File) {
    const preview = URL.createObjectURL(file)
    setSteps((prev) =>
      prev.map((s, i) =>
        i === currentIndex ? { ...s, file, preview, status: 'pending' } : s
      )
    )
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) selectFile(file)
    e.target.value = ''
  }

  function clearCurrentPhoto() {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== currentIndex) return s
        if (s.preview) URL.revokeObjectURL(s.preview)
        return { ...s, file: null, preview: null, status: 'pending' }
      })
    )
  }

  async function uploadCurrentStep() {
    const step = steps[currentIndex]
    if (!step.file) return

    setSteps((prev) =>
      prev.map((s, i) => (i === currentIndex ? { ...s, status: 'uploading' } : s))
    )

    try {
      const ext = step.file.name.split('.').pop() ?? 'jpg'
      const filename = `${Date.now()}-${step.facadeLabel}.${ext}`

      // Get signed URL — token-based auth, projectId inferred server-side
      const signedRes = await fetch(
        `/api/upload/signed-url?token=${encodeURIComponent(token)}&filename=${encodeURIComponent(filename)}`
      )
      if (!signedRes.ok) throw new Error('URL signée invalide')
      const { signedUrl, path, projectId } = await signedRes.json()

      // Upload binary
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: step.file,
        headers: { 'Content-Type': step.file.type },
      })
      if (!uploadRes.ok) throw new Error('Échec du téléversement')

      // Save metadata
      await fetch(`/api/projects/${projectId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: path,
          original_name: step.file.name,
          mime_type: step.file.type,
          file_size_bytes: step.file.size,
          facade_label: step.facadeLabel,
          uploaded_via_token: token,
        }),
      })

      setSteps((prev) =>
        prev.map((s, i) => (i === currentIndex ? { ...s, status: 'done' } : s))
      )

      // Auto-advance
      if (currentIndex < STEPS.length - 1) {
        setTimeout(() => setCurrentIndex((i) => i + 1), 600)
      }
    } catch {
      setSteps((prev) =>
        prev.map((s, i) => (i === currentIndex ? { ...s, status: 'error' } : s))
      )
    }
  }

  function skipStep() {
    setSteps((prev) =>
      prev.map((s, i) => (i === currentIndex ? { ...s, status: 'skipped' } : s))
    )
    if (currentIndex < STEPS.length - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }

  async function finish() {
    await fetch(`/api/client-portal/${token}/complete`, { method: 'POST' })
    setCompleted(true)
  }

  if (completed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-4 text-center">
        <div className="rounded-3xl bg-white p-10 shadow-md">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h1 className="text-2xl font-bold text-gray-900">Photos déposées !</h1>
          <p className="mt-3 text-gray-500">
            Merci ! Votre entrepreneur a été notifié et analysera vos photos prochainement.
          </p>
          <p className="mt-6 text-sm text-gray-400">Vous pouvez fermer cette page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            <span className="font-bold text-gray-900">Dépôt de photos</span>
          </div>
          <span className="text-sm text-gray-500">{doneCount} / {STEPS.length}</span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200">
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${(doneCount / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step tabs */}
      <div className="overflow-x-auto border-b bg-white">
        <div className="mx-auto flex max-w-lg gap-1 px-4 py-2">
          {steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setCurrentIndex(i)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                i === currentIndex
                  ? 'bg-blue-600 text-white'
                  : s.status === 'done'
                  ? 'bg-green-100 text-green-700'
                  : s.status === 'skipped'
                  ? 'bg-gray-100 text-gray-400'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {s.status === 'done' ? '✓ ' : ''}{s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 space-y-5">
        {/* Step info */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">{currentStep.label}</h2>
          <p className="mt-1 text-sm text-gray-600">{currentStep.description}</p>
        </div>

        {/* Upload area */}
        <div
          onClick={() => !currentStep.preview && fileInputRef.current?.click()}
          className={`relative flex min-h-64 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
            currentStep.preview
              ? 'border-transparent'
              : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          {currentStep.preview ? (
            <>
              <Image
                src={currentStep.preview}
                alt="Aperçu"
                fill
                className="rounded-2xl object-cover"
                sizes="(max-width: 512px) 100vw, 512px"
              />
              <button
                onClick={(e) => { e.stopPropagation(); clearCurrentPhoto() }}
                className="absolute right-3 top-3 rounded-full bg-black/60 p-1.5 text-white hover:bg-red-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              {currentStep.status === 'done' && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-green-500/30">
                  <CheckCircle2 className="h-16 w-16 text-white drop-shadow" />
                </div>
              )}
            </>
          ) : (
            <>
              <Camera className="mb-3 h-12 w-12 text-gray-300" />
              <p className="font-medium text-gray-500">Appuyer pour sélectionner</p>
              <p className="mt-1 text-sm text-gray-400">ou glisser une photo ici</p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handleFileInput}
        />

        {/* Action buttons */}
        <div className="space-y-2">
          {currentStep.file && currentStep.status !== 'done' && (
            <button
              onClick={uploadCurrentStep}
              disabled={currentStep.status === 'uploading'}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {currentStep.status === 'uploading' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Téléversement…
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  Téléverser cette photo
                </>
              )}
            </button>
          )}

          {currentStep.status === 'error' && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-center text-sm text-red-700">
              Erreur lors du téléversement. Réessayez.
            </p>
          )}

          {!currentStep.file && currentStep.status !== 'done' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white border-2 border-gray-200 py-4 text-base font-semibold text-gray-700 hover:border-blue-300 transition-colors"
            >
              <Camera className="h-5 w-5 text-blue-500" />
              Prendre / choisir une photo
            </button>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Précédent
            </button>

            <button
              onClick={skipStep}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Passer
            </button>

            <button
              onClick={() =>
                currentIndex < STEPS.length - 1
                  ? setCurrentIndex((i) => i + 1)
                  : null
              }
              disabled={currentIndex === STEPS.length - 1}
              className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Suivant <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>

      {/* Finish button */}
      <footer className="border-t bg-white px-4 py-4">
        <div className="mx-auto max-w-lg">
          <button
            onClick={finish}
            disabled={doneCount === 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            <CheckCircle2 className="h-5 w-5" />
            Terminer ({doneCount} photo{doneCount > 1 ? 's' : ''})
          </button>
          {doneCount === 0 && (
            <p className="mt-2 text-center text-xs text-gray-400">
              Déposez au moins une photo pour terminer.
            </p>
          )}
        </div>
      </footer>
    </div>
  )
}
