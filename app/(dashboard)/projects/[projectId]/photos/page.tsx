// app/(dashboard)/projects/[projectId]/photos/page.tsx
'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import * as Tabs from '@radix-ui/react-tabs'
import {
  Upload,
  X,
  Tag,
  Loader2,
  ImageIcon,
  CheckCircle2,
  AlertCircle,
  Tags,
  ListChecks,
  Grid3X3,
} from 'lucide-react'
import type { PhotoRecord as ChecklistPhotoRecord } from '@/components/photos/PhotoChecklist'

// Lazy-load browser-only components
const PhotoTagging = dynamic(
  () => import('@/components/photos/PhotoTagging'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    ),
  }
)

const PhotoChecklist = dynamic(
  () => import('@/components/photos/PhotoChecklist'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    ),
  }
)

// ─── Types ────────────────────────────────────────────────────────────────────

type FacadeLabel = 'front' | 'back' | 'left' | 'right' | 'roof' | 'other'

const FACADE_OPTIONS: { value: FacadeLabel; label: string }[] = [
  { value: 'front', label: 'Façade avant' },
  { value: 'back', label: 'Façade arrière' },
  { value: 'left', label: 'Façade gauche' },
  { value: 'right', label: 'Façade droite' },
  { value: 'roof', label: 'Toit' },
  { value: 'other', label: 'Autre' },
]

interface PhotoRecord {
  id: string
  storage_path: string
  original_name: string | null
  facade_label: FacadeLabel | null
  sort_order: number
  url: string
  quality_status?: string | null
  photo_category?: string | null
}

interface UploadItem {
  id: string
  file: File
  preview: string
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
  facadeLabel: FacadeLabel | null
}

interface Props {
  params: Promise<{ projectId: string }>
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function PhotosPage({ params }: Props) {
  const { projectId } = use(params)
  const [photos, setPhotos] = useState<PhotoRecord[]>([])
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [taggingPhoto, setTaggingPhoto] = useState<PhotoRecord | null>(null)
  const [activeTab, setActiveTab] = useState('checklist')

  /* ---- Load existing photos ---- */
  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await fetch(`/api/projects/${projectId}/photos`)
      if (res.ok) {
        const data = await res.json() as { photos: PhotoRecord[] }
        setPhotos(data.photos ?? [])
      }
      setLoading(false)
    }
    void load()
  }, [projectId])

  /* ---- Drag & drop ---- */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    )
    addToQueue(files)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    addToQueue(files)
    e.target.value = ''
  }

  function addToQueue(files: File[]) {
    const items: UploadItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: 'pending',
      facadeLabel: null,
    }))
    setUploadQueue((prev) => [...prev, ...items])
  }

  /* ---- Upload flow ---- */
  async function uploadItem(item: UploadItem) {
    setUploadQueue((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading', progress: 10 } : q))
    )

    try {
      const ext = item.file.name.split('.').pop() ?? 'jpg'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const signedRes = await fetch(
        `/api/upload/signed-url?projectId=${projectId}&filename=${encodeURIComponent(filename)}`
      )
      if (!signedRes.ok) throw new Error("Impossible d'obtenir l'URL signée")
      const { signedUrl, path } = await signedRes.json() as { signedUrl: string; path: string }

      setUploadQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, progress: 30 } : q))
      )

      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: item.file,
        headers: { 'Content-Type': item.file.type },
      })
      if (!uploadRes.ok) throw new Error('Échec du téléversement vers le stockage')

      setUploadQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, progress: 80 } : q))
      )

      const metaRes = await fetch(`/api/projects/${projectId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: path,
          original_name: item.file.name,
          mime_type: item.file.type,
          file_size_bytes: item.file.size,
          facade_label: item.facadeLabel,
        }),
      })
      if (!metaRes.ok) throw new Error("Échec de l'enregistrement des métadonnées")
      const { photo } = await metaRes.json() as { photo: PhotoRecord }

      setPhotos((prev) => [...prev, photo])
      setUploadQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'done', progress: 100 } : q))
      )

      URL.revokeObjectURL(item.preview)

      setTimeout(() => {
        setUploadQueue((prev) => prev.filter((q) => q.id !== item.id))
      }, 1500)
    } catch (err) {
      setUploadQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? { ...q, status: 'error', error: (err as Error).message }
            : q
        )
      )
    }
  }

  function removeFromQueue(id: string) {
    setUploadQueue((prev) => {
      const item = prev.find((q) => q.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter((q) => q.id !== id)
    })
  }

  function setFacadeLabel(id: string, label: FacadeLabel | null) {
    setUploadQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, facadeLabel: label } : q))
    )
  }

  async function deletePhoto(photoId: string) {
    if (!confirm('Supprimer cette photo ?')) return
    const res = await fetch(`/api/projects/${projectId}/photos/${photoId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    }
  }

  async function updateFacadeLabel(photoId: string, label: FacadeLabel | null) {
    await fetch(`/api/projects/${projectId}/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facade_label: label }),
    })
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, facade_label: label } : p))
    )
  }

  // Called when PhotoChecklist uploads a photo successfully
  function handleChecklistPhotoUploaded(photo: ChecklistPhotoRecord) {
    const converted: PhotoRecord = {
      id: photo.id,
      storage_path: photo.storage_path,
      original_name: photo.original_name,
      facade_label: null,
      sort_order: 0,
      url: photo.url,
      quality_status: photo.quality_status,
      photo_category: photo.photo_category,
    }
    setPhotos((prev) => {
      // Replace if same id already exists, otherwise prepend
      const existing = prev.find((p) => p.id === photo.id)
      if (existing) return prev.map((p) => (p.id === photo.id ? converted : p))
      return [converted, ...prev]
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Photo Tagging Modal */}
      {taggingPhoto && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setTaggingPhoto(null)}
          />
          <div className="relative ml-auto flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-900">
                  Annoter — {taggingPhoto.original_name ?? 'Photo'}
                </h2>
              </div>
              <button
                onClick={() => setTaggingPhoto(null)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PhotoTagging
                photoId={taggingPhoto.id}
                photoUrl={taggingPhoto.url}
                projectId={projectId}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="flex gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1">
          <Tabs.Trigger
            value="checklist"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm hover:text-gray-900"
          >
            <ListChecks className="h-4 w-4" />
            Checklist guidée
          </Tabs.Trigger>
          <Tabs.Trigger
            value="gallery"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm hover:text-gray-900"
          >
            <Grid3X3 className="h-4 w-4" />
            Galerie
            {photos.length > 0 && (
              <span className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                {photos.length}
              </span>
            )}
          </Tabs.Trigger>
        </Tabs.List>

        {/* Checklist Tab */}
        <Tabs.Content value="checklist" className="mt-6">
          <PhotoChecklist
            projectId={projectId}
            existingPhotos={photos.map((p) => ({
              id: p.id,
              storage_path: p.storage_path,
              original_name: p.original_name,
              facade_label: p.facade_label,
              photo_category: p.photo_category ?? null,
              quality_status: p.quality_status ?? null,
              url: p.url,
            }))}
            onPhotoUploaded={handleChecklistPhotoUploaded}
          />
        </Tabs.Content>

        {/* Gallery Tab */}
        <Tabs.Content value="gallery" className="mt-6 space-y-6">
          {/* Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          >
            <Upload className={`mb-3 h-10 w-10 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="text-base font-medium text-gray-700">
              Glissez vos photos ici
            </p>
            <p className="mt-1 text-sm text-gray-500">ou</p>
            <label className="mt-3 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Choisir des fichiers
              <input
                type="file"
                multiple
                accept="image/*"
                className="sr-only"
                onChange={handleFileInput}
              />
            </label>
            <p className="mt-2 text-xs text-gray-400">JPG, PNG, HEIC jusqu&apos;à 30 Mo</p>
          </div>

          {/* Upload Queue */}
          {uploadQueue.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">
                  En attente de téléversement ({uploadQueue.length})
                </h3>
                <button
                  onClick={() => {
                    const pending = uploadQueue.filter((q) => q.status === 'pending')
                    pending.forEach((item) => void uploadItem(item))
                  }}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Tout téléverser
                </button>
              </div>

              {uploadQueue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3"
                >
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    <Image src={item.preview} alt="" fill className="object-cover" sizes="96px" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="truncate text-sm font-medium text-gray-900">{item.file.name}</p>

                    <select
                      value={item.facadeLabel ?? ''}
                      onChange={(e) => setFacadeLabel(item.id, (e.target.value as FacadeLabel) || null)}
                      disabled={item.status !== 'pending'}
                      className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sélectionner la façade...</option>
                      {FACADE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>

                    {item.status === 'uploading' && (
                      <div className="space-y-1">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400">{item.progress}%</p>
                      </div>
                    )}

                    {item.status === 'error' && (
                      <p className="flex items-center gap-1 text-xs text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        {item.error}
                      </p>
                    )}

                    {item.status === 'done' && (
                      <p className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Téléversé
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-start gap-1">
                    {item.status === 'pending' && (
                      <button
                        onClick={() => void uploadItem(item)}
                        className="rounded p-1 text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Téléverser"
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                    )}
                    {item.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    )}
                    <button
                      onClick={() => removeFromQueue(item.id)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                      title="Retirer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gallery grid */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                Galerie
                {photos.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">({photos.length})</span>
                )}
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-16 text-center">
                <ImageIcon className="mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-500">Aucune photo pour l&apos;instant</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-gray-100">
                      <Image
                        src={photo.url}
                        alt={photo.original_name ?? 'Photo'}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />

                      {/* Quality badge */}
                      {photo.quality_status && photo.quality_status !== 'pending' && (
                        <span
                          className={`absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                            photo.quality_status === 'good'
                              ? 'bg-green-100 text-green-700'
                              : photo.quality_status === 'warning'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {photo.quality_status === 'good'
                            ? '✓'
                            : photo.quality_status === 'warning'
                            ? '⚠'
                            : '✗'}
                        </span>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="p-3">
                      <p className="truncate text-xs text-gray-500">
                        {photo.original_name ?? 'Sans nom'}
                      </p>

                      {/* Facade label selector */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <select
                          value={photo.facade_label ?? ''}
                          onChange={(e) =>
                            void updateFacadeLabel(photo.id, (e.target.value as FacadeLabel) || null)
                          }
                          className="w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Sans étiquette</option>
                          {FACADE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="absolute right-2 top-2 hidden flex-col gap-1 group-hover:flex">
                      <button
                        onClick={() => setTaggingPhoto(photo)}
                        className="rounded-full bg-black/60 p-1 text-white hover:bg-blue-600 transition-colors"
                        title="Annoter"
                      >
                        <Tag className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => void deletePhoto(photo.id)}
                        className="rounded-full bg-black/60 p-1 text-white hover:bg-red-600 transition-colors"
                        title="Supprimer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
