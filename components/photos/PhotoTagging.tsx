// components/photos/PhotoTagging.tsx
'use client'

import * as React from 'react'
import { Trash2, X, Tag, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TagType = 'damage' | 'repair' | 'attention' | 'completed' | 'good' | 'priority'

export interface PhotoTag {
  id: string
  photo_id: string
  tag: TagType
  note: string | null
  x: number
  y: number
  created_at: string
}

export interface PhotoTaggingProps {
  photoId: string
  photoUrl: string
  projectId: string
  readOnly?: boolean
}

// ─── Tag config ───────────────────────────────────────────────────────────────

const TAG_CONFIG: Record<TagType, { label: string; color: string; bg: string; ring: string }> = {
  damage:    { label: 'Dommage',    color: '#ef4444', bg: 'bg-red-500',    ring: 'ring-red-300' },
  repair:    { label: 'Réparation', color: '#f97316', bg: 'bg-orange-500', ring: 'ring-orange-300' },
  attention: { label: 'Attention',  color: '#eab308', bg: 'bg-yellow-500', ring: 'ring-yellow-300' },
  completed: { label: 'Complété',   color: '#22c55e', bg: 'bg-green-500',  ring: 'ring-green-300' },
  good:      { label: 'Bon état',   color: '#3b82f6', bg: 'bg-blue-500',   ring: 'ring-blue-300' },
  priority:  { label: 'Priorité',   color: '#a855f7', bg: 'bg-purple-500', ring: 'ring-purple-300' },
}

const TAG_TYPES = Object.keys(TAG_CONFIG) as TagType[]

// ─── Marker pin ──────────────────────────────────────────────────────────────

function TagMarker({
  tag,
  index,
  isSelected,
  readOnly,
  onClick,
}: {
  tag: PhotoTag
  index: number
  isSelected: boolean
  readOnly: boolean
  onClick: () => void
}) {
  const cfg = TAG_CONFIG[tag.tag]
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={cfg.label}
      style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%` }}
      className={[
        'absolute -translate-x-1/2 -translate-y-1/2 z-10',
        'flex items-center justify-center',
        'h-6 w-6 rounded-full shadow-lg border-2 border-white',
        'transition-transform hover:scale-125',
        isSelected ? 'scale-125 ring-2 ' + cfg.ring : '',
        cfg.bg,
        readOnly ? 'cursor-default' : 'cursor-pointer',
      ].join(' ')}
      aria-label={`${cfg.label} — tag ${index + 1}`}
    >
      <span className="text-white text-[10px] font-bold select-none">{index + 1}</span>
    </button>
  )
}

// ─── Popover ─────────────────────────────────────────────────────────────────

function TagPopover({
  tag,
  onClose,
  onDelete,
  readOnly,
}: {
  tag: PhotoTag
  onClose: () => void
  onDelete: (id: string) => void
  readOnly: boolean
}) {
  const cfg = TAG_CONFIG[tag.tag]
  return (
    <div className="absolute z-20 bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-60"
      style={{
        left: `calc(${tag.x * 100}% + 16px)`,
        top: `calc(${tag.y * 100}% - 40px)`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${cfg.bg}`} />
          <span className="text-sm font-semibold text-gray-900">{cfg.label}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 rounded p-0.5"
          aria-label="Fermer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {tag.note ? (
        <p className="text-xs text-gray-600 mb-3 leading-relaxed">{tag.note}</p>
      ) : (
        <p className="text-xs text-gray-400 italic mb-3">Aucune note</p>
      )}
      <p className="text-[10px] text-gray-400 mb-3">
        Position: {(tag.x * 100).toFixed(1)}% / {(tag.y * 100).toFixed(1)}%
      </p>
      {!readOnly && (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(tag.id)}
          className="w-full gap-1.5 text-xs"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Supprimer
        </Button>
      )}
    </div>
  )
}

// ─── Add tag form ─────────────────────────────────────────────────────────────

function AddTagPanel({
  pendingPos,
  onSave,
  onCancel,
  saving,
}: {
  pendingPos: { x: number; y: number }
  onSave: (tag: TagType, note: string) => void
  onCancel: () => void
  saving: boolean
}) {
  const [selectedType, setSelectedType] = React.useState<TagType>('damage')
  const [note, setNote] = React.useState('')

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">Nouveau marqueur</p>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Position: {(pendingPos.x * 100).toFixed(1)}% / {(pendingPos.y * 100).toFixed(1)}%
      </p>

      {/* Tag type selector */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {TAG_TYPES.map((t) => {
          const cfg = TAG_CONFIG[t]
          return (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedType(t)}
              className={[
                'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors border',
                selectedType === t
                  ? `${cfg.bg} text-white border-transparent`
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
              ].join(' ')}
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${selectedType === t ? 'bg-white/70' : cfg.bg}`} />
              {cfg.label}
            </button>
          )
        })}
      </div>

      {/* Note */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optionnel)…"
        rows={2}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
      />

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => onSave(selectedType, note)}
          loading={saving}
          className="flex-1 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="text-xs">
          Annuler
        </Button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PhotoTagging({
  photoId,
  photoUrl,
  projectId,
  readOnly = false,
}: PhotoTaggingProps) {
  const [tags, setTags] = React.useState<PhotoTag[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [selectedTagId, setSelectedTagId] = React.useState<string | null>(null)
  const [pendingPos, setPendingPos] = React.useState<{ x: number; y: number } | null>(null)
  const imgRef = React.useRef<HTMLDivElement>(null)

  // ── Load tags on mount ─────────────────────────────────────────────────────
  React.useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await fetch(`/api/photos/${photoId}/tags`)
      if (res.ok) {
        const data = await res.json()
        setTags(data.tags ?? [])
      }
      setLoading(false)
    }
    load()
  }, [photoId])

  // ── Click on photo to place tag ────────────────────────────────────────────
  function handlePhotoClick(e: React.MouseEvent<HTMLDivElement>) {
    if (readOnly) return
    if (selectedTagId) { setSelectedTagId(null); return }
    const rect = imgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setPendingPos({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) })
    setSelectedTagId(null)
  }

  // ── Save new tag ───────────────────────────────────────────────────────────
  async function handleSaveTag(tagType: TagType, note: string) {
    if (!pendingPos) return
    setSaving(true)
    const res = await fetch(`/api/photos/${photoId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photo_id: photoId,
        tag: tagType,
        note: note.trim() || null,
        x: pendingPos.x,
        y: pendingPos.y,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setTags((prev) => [...prev, data.tag])
      setPendingPos(null)
      toast({ variant: 'success', title: 'Marqueur ajouté' })
    } else {
      const err = await res.json()
      toast({ variant: 'error', title: 'Erreur', description: err.error })
    }
    setSaving(false)
  }

  // ── Delete tag ─────────────────────────────────────────────────────────────
  async function handleDeleteTag(id: string) {
    const res = await fetch(`/api/photos/${photoId}/tags?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTags((prev) => prev.filter((t) => t.id !== id))
      setSelectedTagId(null)
      toast({ variant: 'success', title: 'Marqueur supprimé' })
    } else {
      toast({ variant: 'error', title: 'Erreur lors de la suppression' })
    }
  }

  const selectedTag = tags.find((t) => t.id === selectedTagId) ?? null

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* ── Photo with tag overlays ── */}
      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-100 h-64">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-2">
            {!readOnly && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" />
                Cliquez sur la photo pour ajouter un marqueur
              </p>
            )}
            <div
              ref={imgRef}
              className={[
                'relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100 select-none',
                !readOnly && !pendingPos ? 'cursor-crosshair' : 'cursor-default',
              ].join(' ')}
              onClick={handlePhotoClick}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Photo"
                className="w-full h-auto block"
                draggable={false}
              />

              {/* Existing tag markers */}
              {tags.map((tag, i) => (
                <TagMarker
                  key={tag.id}
                  tag={tag}
                  index={i}
                  isSelected={selectedTagId === tag.id}
                  readOnly={readOnly}
                  onClick={() => setSelectedTagId(selectedTagId === tag.id ? null : tag.id)}
                />
              ))}

              {/* Pending position indicator */}
              {pendingPos && (
                <div
                  className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gray-700 opacity-60 pointer-events-none z-10"
                  style={{ left: `${pendingPos.x * 100}%`, top: `${pendingPos.y * 100}%` }}
                />
              )}

              {/* Popover for selected tag */}
              {selectedTag && (
                <TagPopover
                  tag={selectedTag}
                  onClose={() => setSelectedTagId(null)}
                  onDelete={handleDeleteTag}
                  readOnly={readOnly}
                />
              )}
            </div>

            {/* Add tag form */}
            {pendingPos && !readOnly && (
              <AddTagPanel
                pendingPos={pendingPos}
                onSave={handleSaveTag}
                onCancel={() => setPendingPos(null)}
                saving={saving}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Tag sidebar list ── */}
      <div className="w-full lg:w-64 shrink-0">
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <Tag className="h-4 w-4 text-gray-500" />
              Marqueurs
              {tags.length > 0 && (
                <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {tags.length}
                </span>
              )}
            </h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
            </div>
          ) : tags.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Tag className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Aucun marqueur</p>
              {!readOnly && (
                <p className="text-xs text-gray-400 mt-1">
                  Cliquez sur la photo pour ajouter un marqueur
                </p>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {tags.map((tag, i) => {
                const cfg = TAG_CONFIG[tag.tag]
                const isSelected = selectedTagId === tag.id
                return (
                  <li key={tag.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTagId(isSelected ? null : tag.id)}
                      className={[
                        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                        isSelected ? 'bg-gray-50' : 'hover:bg-gray-50',
                      ].join(' ')}
                    >
                      <div className={`mt-0.5 h-5 w-5 rounded-full ${cfg.bg} flex items-center justify-center shrink-0`}>
                        <span className="text-white text-[10px] font-bold">{i + 1}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-800">{cfg.label}</p>
                        {tag.note && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{tag.note}</p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {(tag.x * 100).toFixed(0)}% / {(tag.y * 100).toFixed(0)}%
                        </p>
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.id) }}
                          className="shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-xs font-semibold text-gray-700 mb-2">Légende</p>
          <div className="grid grid-cols-2 gap-1">
            {TAG_TYPES.map((t) => {
              const cfg = TAG_CONFIG[t]
              return (
                <div key={t} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg.bg}`} />
                  <span className="text-xs text-gray-600">{cfg.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
