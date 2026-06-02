// components/projects/ProjectHeaderActions.tsx
'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MoreHorizontal, Share2, Download, Loader2, Archive, PenLine,
  MapPin, Crown, Edit3, User, Upload, FileText, CheckCircle2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Member {
  id: string
  email: string
  role: 'owner' | 'editor' | 'client'
  invite_accepted_at: string | null
}

interface Props {
  projectId: string
  projectTitle: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function buildCsv(surfaces: Record<string, unknown>[]): string {
  const header = ['Façade', 'Type', 'Label', 'Superficie brute (ft²)', 'Ouvertures (ft²)', 'Superficie nette (ft²)', 'Périmètre (ft)', 'Pente', 'Unité']
  const rows = surfaces.map((s) => [
    s.facade_side ?? '',
    s.surface_type ?? '',
    s.label ?? '',
    s.gross_area ?? '',
    s.opening_area ?? '',
    s.net_area ?? '',
    s.perimeter ?? '',
    s.pitch ?? '',
    s.unit ?? '',
  ])
  return [header, ...rows].map((r) => r.join(',')).join('\n')
}

// ─── Export Dialog ────────────────────────────────────────────────────────────

function ExportDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(['pdf']))
  const [loading, setLoading] = useState(false)

  function toggle(format: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(format)) next.delete(format)
      else next.add(format)
      return next
    })
  }

  async function handleDownload() {
    setLoading(true)
    try {
      if (selected.has('pdf')) {
        window.open(`/projects/${projectId}/report`, '_blank')
      }
      if (selected.has('json')) {
        const [measRes, surfRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/measurements`),
          fetch(`/api/projects/${projectId}/surfaces`),
        ])
        const [measData, surfData] = await Promise.all([measRes.json(), surfRes.json()])
        const payload = {
          measurements: measData.measurements ?? [],
          surfaces: surfData.surfaces ?? [],
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        downloadBlob(blob, `projet-${projectId}-mesures.json`)
      }
      if (selected.has('csv')) {
        const surfRes = await fetch(`/api/projects/${projectId}/surfaces`)
        const { surfaces } = await surfRes.json()
        const csv = buildCsv(surfaces ?? [])
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        downloadBlob(blob, `projet-${projectId}-surfaces.csv`)
      }
    } finally {
      setLoading(false)
      onOpenChange(false)
    }
  }

  const formats = [
    { key: 'pdf', label: 'PDF', desc: 'Rapport complet du projet' },
    { key: 'json', label: 'JSON', desc: 'Mesures et surfaces (données brutes)' },
    { key: 'csv',  label: 'CSV', desc: 'Tableau des surfaces (compatible Excel)' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exporter les données</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 mb-3">Sélectionner les formats à télécharger.</p>
        <div className="space-y-2">
          {formats.map(({ key, label, desc }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.has(key)}
                onChange={() => toggle(key)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </label>
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
          </DialogClose>
          <button
            onClick={handleDownload}
            disabled={selected.size === 0 || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Télécharger
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Share Dialog ─────────────────────────────────────────────────────────────

function ShareDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'owner' | 'editor' | 'client'>('client')
  const [members, setMembers] = useState<Member[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadMembers() {
    setLoadingMembers(true)
    const res = await fetch(`/api/projects/${projectId}`)
    if (res.ok) {
      const { project } = await res.json()
      setMembers(project.members ?? [])
    }
    setLoadingMembers(false)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setInviting(true)
    setError(null)
    setSuccess(null)
    const res = await fetch(`/api/projects/${projectId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), role }),
    })
    setInviting(false)
    if (res.ok) {
      setSuccess('Invitation envoyée avec succès.')
      setEmail('')
      loadMembers()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Erreur lors de l'invitation.")
    }
  }

  type IconComponent = React.ComponentType<{ className?: string }>
  const roleLabels: Record<string, string> = { owner: 'Propriétaire', editor: 'Éditeur', client: 'Client' }
  const RoleIcon: Record<string, IconComponent> = { owner: Crown, editor: Edit3, client: User }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (v) loadMembers()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Partager ce projet</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-2 mb-4">
          Invitez un collaborateur ou un client à accéder à ce projet.
        </p>

        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="courriel@exemple.com"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'owner' | 'editor' | 'client')}
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="client">Client</option>
            <option value="editor">Éditeur</option>
            <option value="owner">Propriétaire</option>
          </select>
          <button
            type="submit"
            disabled={inviting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Inviter'}
          </button>
        </form>

        {success && <p className="mt-2 text-xs text-green-600">{success}</p>}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Qui a accès
          </p>
          {loadingMembers ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {members.map((m) => {
                const Icon = RoleIcon[m.role] ?? User
                return (
                  <li key={m.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                      {m.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{m.email}</p>
                      <p className="text-xs text-gray-400">
                        {m.invite_accepted_at ? 'Actif' : 'Invitation en attente'}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      <Icon className="h-3 w-3" />
                      {roleLabels[m.role]}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Title Dialog ────────────────────────────────────────────────────────

function EditTitleDialog({
  projectId,
  currentTitle,
  open,
  onOpenChange,
  onSaved,
}: {
  projectId: string
  currentTitle: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [value, setValue] = useState(currentTitle)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!value.trim()) return
    setSaving(true)
    await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: value.trim() }),
    })
    setSaving(false)
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Modifier le nom du projet</DialogTitle>
        </DialogHeader>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        <DialogFooter>
          <DialogClose asChild>
            <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
          </DialogClose>
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Import Hover PDF Dialog ──────────────────────────────────────────────────

interface ImportResult {
  imported: number
  surfaces: Array<{ label: string; area: number; unit: string }>
  message: string
}

function ImportHoverPdfDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setResult(null)
    setError(null)
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/projects/${projectId}/import`, {
      method: 'POST',
      body: formData,
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (res.ok) {
      setResult(data)
    } else {
      setError(data.error ?? "Erreur lors de l'import.")
    }
  }

  function handleClose() {
    setFile(null)
    setResult(null)
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importer un rapport Hover</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-2 mb-4">
          Importez un PDF de mesures Hover pour créer automatiquement les surfaces du projet.
        </p>

        {!result ? (
          <>
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-8 hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload className="h-8 w-8 text-gray-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  {file ? file.name : 'Sélectionner un PDF Hover'}
                </p>
                <p className="text-xs text-gray-400 mt-1">Fichier PDF uniquement</p>
              </div>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <DialogClose asChild>
                <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Annuler
                </button>
              </DialogClose>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Traitement...</>
                ) : (
                  <><FileText className="h-4 w-4" /> Importer</>
                )}
              </button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-green-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm font-semibold text-green-800">{result.message}</p>
              </div>
              <ul className="space-y-1">
                {result.surfaces.map((s, i) => (
                  <li key={i} className="flex items-center justify-between text-xs text-green-700">
                    <span>{s.label}</span>
                    <span className="font-medium">{s.area.toLocaleString('fr-CA')} {s.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <DialogFooter>
              <button
                onClick={handleClose}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Fermer
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProjectHeaderActions({ projectId, projectTitle }: Props) {
  const router = useRouter()
  const [showExport, setShowExport] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showEditTitle, setShowEditTitle] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [archiving, setArchiving] = useState(false)

  async function archive() {
    if (!confirm('Archiver ce projet ? Il ne sera plus visible dans la liste active.')) return
    setArchiving(true)
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    setArchiving(false)
    router.push('/dashboard')
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-200 transition-colors"
        >
          <Download className="h-4 w-4" />
          Exporter
        </button>
        <button
          onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-200 transition-colors"
        >
          <Share2 className="h-4 w-4" />
          Partager
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setShowEditTitle(true)}>
              <PenLine className="h-4 w-4" />
              Modifier le nom du projet
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/projects/${projectId}/settings`)}>
              <MapPin className="h-4 w-4" />
              Modifier l&apos;adresse
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4" />
              Importer un PDF Hover
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-orange-600 focus:bg-orange-50 focus:text-orange-700"
              onClick={archive}
              disabled={archiving}
            >
              {archiving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              Archiver le projet
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ExportDialog projectId={projectId} open={showExport} onOpenChange={setShowExport} />
      <ShareDialog projectId={projectId} open={showShare} onOpenChange={setShowShare} />
      <EditTitleDialog
        projectId={projectId}
        currentTitle={projectTitle}
        open={showEditTitle}
        onOpenChange={setShowEditTitle}
        onSaved={() => router.refresh()}
      />
      <ImportHoverPdfDialog projectId={projectId} open={showImport} onOpenChange={setShowImport} />
    </>
  )
}
