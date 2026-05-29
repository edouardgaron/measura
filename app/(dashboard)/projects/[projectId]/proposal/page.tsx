'use client'

import { use, useState, useEffect, useCallback } from 'react'
import {
  Send, Plus, Copy, Check, ExternalLink, Trash2,
  FileSignature, Clock, CheckCircle2, XCircle, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import type { Proposal, ProposalStatus } from '@/lib/supabase/types'

// ── Types ─────────────────────────────────────────────────────
interface Estimate { id: string; title: string | null; total: number; status: string }
interface Props { params: Promise<{ projectId: string }> }

// ── Status config ─────────────────────────────────────────────
const STATUS_CONFIG: Record<ProposalStatus, { label: string; className: string; icon: React.ReactNode }> = {
  draft:    { label: 'Brouillon',  className: 'bg-gray-100 text-gray-600',    icon: <FileSignature className="h-3 w-3" /> },
  sent:     { label: 'Envoyée',    className: 'bg-blue-100 text-blue-700',    icon: <Send className="h-3 w-3" /> },
  viewed:   { label: 'Vue',        className: 'bg-yellow-100 text-yellow-700',icon: <Eye className="h-3 w-3" /> },
  accepted: { label: 'Acceptée',   className: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: 'Refusée',    className: 'bg-red-100 text-red-700',      icon: <XCircle className="h-3 w-3" /> },
  expired:  { label: 'Expirée',    className: 'bg-orange-100 text-orange-700',icon: <Clock className="h-3 w-3" /> },
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const link = typeof window !== 'undefined'
    ? `${window.location.origin}/proposal/${token}`
    : `/proposal/${token}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    toast({ variant: 'success', title: 'Lien copié!' })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
      title="Copier le lien client"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copié' : 'Copier'}
    </button>
  )
}

export default function ProposalPage({ params }: Props) {
  const { projectId } = use(params)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    title: '',
    message: '',
    estimate_id: '',
    valid_until: '',
  })

  const load = useCallback(async () => {
    const [propRes, estRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/proposal`),
      fetch(`/api/projects/${projectId}/estimate`),
    ])
    const propJson = await propRes.json()
    const estJson = await estRes.json().catch(() => ({ estimates: [] }))
    setProposals(propJson.proposals ?? [])
    setEstimates(estJson.estimates ?? [])
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    setCreating(true)
    const res = await fetch(`/api/projects/${projectId}/proposal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title || null,
        message: form.message || null,
        estimate_id: form.estimate_id || null,
        valid_until: form.valid_until || null,
      }),
    })
    if (res.ok) {
      toast({ variant: 'success', title: 'Proposition créée' })
      setShowNew(false)
      setForm({ title: '', message: '', estimate_id: '', valid_until: '' })
      load()
    } else {
      const j = await res.json()
      toast({ variant: 'error', title: 'Erreur', description: j.error })
    }
    setCreating(false)
  }

  async function handleMarkSent(id: string) {
    const res = await fetch(`/api/projects/${projectId}/proposal`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'sent' }),
    })
    if (res.ok) {
      toast({ variant: 'success', title: 'Proposition marquée comme envoyée' })
      load()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette proposition ?')) return
    const res = await fetch(`/api/projects/${projectId}/proposal?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ variant: 'success', title: 'Proposition supprimée' })
      load()
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1,2].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Propositions client</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Créez et envoyez des propositions à vos clients pour approbation.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle proposition
        </Button>
      </div>

      {/* List */}
      {proposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <FileSignature className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-base font-medium text-gray-700">Aucune proposition</p>
          <p className="text-sm text-gray-400 mt-1 mb-5">
            Créez une proposition à envoyer à votre client pour signature.
          </p>
          <Button size="sm" onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            Créer une proposition
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => {
            const publicUrl = `/proposal/${p.share_token}`
            return (
              <Card key={p.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {p.title || 'Proposition sans titre'}
                        </h3>
                        <StatusBadge status={p.status} />
                      </div>
                      {p.message && (
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{p.message}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-gray-400">
                          Créée le {new Date(p.created_at).toLocaleDateString('fr-CA')}
                        </span>
                        {p.valid_until && (
                          <span className="text-xs text-gray-400">
                            Valide jusqu&apos;au {new Date(p.valid_until).toLocaleDateString('fr-CA')}
                          </span>
                        )}
                        {p.accepted_at && (
                          <span className="text-xs text-green-600 font-medium">
                            Acceptée le {new Date(p.accepted_at).toLocaleDateString('fr-CA')}
                          </span>
                        )}
                        {p.client_name && (
                          <span className="text-xs text-gray-500">par {p.client_name}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <CopyLinkButton token={p.share_token} />
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                        title="Voir la proposition"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Voir
                      </a>
                      {p.status === 'draft' && (
                        <button
                          onClick={() => handleMarkSent(p.id)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Marquer comme envoyée"
                        >
                          <Send className="h-3 w-3" />
                          Envoyer
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="inline-flex items-center rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* New proposal dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle proposition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              label="Titre de la proposition"
              placeholder="Ex : Proposition toiture — 123 rue des Érables"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Message au client</label>
              <textarea
                rows={4}
                placeholder="Bonjour, veuillez trouver ci-joint notre proposition pour votre projet…"
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
            {estimates.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Lier à une estimation</label>
                <select
                  value={form.estimate_id}
                  onChange={e => setForm(f => ({ ...f, estimate_id: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="">Aucune estimation liée</option>
                  {estimates.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.title || 'Estimation'} — {e.total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Input
              label="Date d'expiration (optionnel)"
              type="date"
              value={form.valid_until}
              onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Création…' : 'Créer la proposition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
