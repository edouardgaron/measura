// app/(dashboard)/crm/KanbanBoard.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, Loader2, Phone, Mail, MapPin, DollarSign, Trash2, FolderInput,
  Calendar, MessageSquare, StickyNote, ArrowRightLeft, Building2, GripVertical, Send, Sparkles,
} from 'lucide-react'
import { PIPELINE_STAGES, SOURCE_LABELS } from '@/lib/crm/stages'
import type { Lead, LeadActivity, LeadActivityType, LeadStage, LeadPriority, MessageTemplate } from '@/lib/supabase/types'

const money = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n ?? 0)

const WORK_TYPES: { value: string; label: string }[] = [
  { value: 'painting', label: 'Peinture' }, { value: 'roofing', label: 'Toiture' },
  { value: 'siding', label: 'Revêtement' }, { value: 'windows', label: 'Fenêtres' },
  { value: 'doors', label: 'Portes' }, { value: 'inspection', label: 'Inspection' },
  { value: 'insurance', label: 'Assurance' }, { value: 'cleaning', label: 'Nettoyage' },
  { value: 'repair', label: 'Réparation' }, { value: 'other', label: 'Autre' },
]

const PRIORITY_COLOR: Record<LeadPriority, string> = {
  low: 'border-l-gray-300', medium: 'border-l-amber-400', high: 'border-l-red-500',
}

export default function KanbanBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [showNew, setShowNew] = useState(false)
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null)

  const byStage = useMemo(() => {
    const map = new Map<LeadStage, Lead[]>()
    for (const s of PIPELINE_STAGES) map.set(s.key, [])
    for (const l of leads) map.get(l.stage)?.push(l)
    return map
  }, [leads])

  const openLead = leads.find((l) => l.id === openLeadId) ?? null

  async function moveLead(leadId: string, stage: LeadStage) {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.stage === stage) return
    setLeads((p) => p.map((l) => (l.id === leadId ? { ...l, stage } : l))) // optimiste
    const res = await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }),
    })
    if (!res.ok) {
      setLeads((p) => p.map((l) => (l.id === leadId ? { ...l, stage: lead.stage } : l))) // rollback
    } else {
      const json = await res.json()
      if (json.lead) setLeads((p) => p.map((l) => (l.id === leadId ? json.lead : l)))
    }
  }

  const totalValue = leads
    .filter((l) => !['lost', 'completed'].includes(l.stage))
    .reduce((s, l) => s + (l.estimated_value ?? 0), 0)

  return (
    <div className="flex h-full flex-col">
      {/* En-tête */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline de ventes</h1>
          <p className="text-sm text-gray-500">
            {leads.length} lead{leads.length !== 1 ? 's' : ''} · {money(totalValue)} en pipeline actif
          </p>
        </div>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nouveau lead
        </button>
      </div>

      {/* Board */}
      <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => {
          const list = byStage.get(stage.key) ?? []
          const colValue = list.reduce((s, l) => s + (l.estimated_value ?? 0), 0)
          return (
            <div
              key={stage.key}
              onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.key) }}
              onDragLeave={() => setDragOverStage((s) => (s === stage.key ? null : s))}
              onDrop={(e) => {
                e.preventDefault()
                if (dragId) moveLead(dragId, stage.key)
                setDragId(null); setDragOverStage(null)
              }}
              className={`flex w-72 shrink-0 flex-col rounded-xl border bg-gray-50/80 ${
                dragOverStage === stage.key ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className={`flex items-center justify-between rounded-t-xl px-3 py-2.5 ${stage.color}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                  <span className="text-sm font-semibold">{stage.label}</span>
                  <span className="rounded-full bg-white/60 px-1.5 text-xs">{list.length}</span>
                </div>
                {colValue > 0 && <span className="text-xs font-medium opacity-70">{money(colValue)}</span>}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ minHeight: 120 }}>
                {list.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    onDragEnd={() => { setDragId(null); setDragOverStage(null) }}
                    onClick={() => setOpenLeadId(lead.id)}
                    className={`group cursor-pointer rounded-lg border border-l-4 border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md ${PRIORITY_COLOR[lead.priority]} ${
                      dragId === lead.id ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                      <GripVertical className="h-4 w-4 shrink-0 text-gray-300 opacity-0 group-hover:opacity-100" />
                    </div>
                    {lead.contact_name && <p className="mt-0.5 text-xs text-gray-500">{lead.contact_name}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      {lead.estimated_value > 0 && (
                        <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                          <DollarSign className="h-3 w-3" />{money(lead.estimated_value)}
                        </span>
                      )}
                      {lead.work_type && <span className="rounded bg-gray-100 px-1.5 py-0.5">{WORK_TYPES.find((w) => w.value === lead.work_type)?.label ?? lead.work_type}</span>}
                    </div>
                    {lead.project_id && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">
                        <FolderInput className="h-3 w-3" /> Projet lié
                      </span>
                    )}
                  </article>
                ))}
                {list.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-gray-300">Déposez un lead ici</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showNew && (
        <NewLeadModal
          onClose={() => setShowNew(false)}
          onCreated={(lead) => { setLeads((p) => [lead, ...p]); setShowNew(false); setOpenLeadId(lead.id) }}
        />
      )}

      {openLead && (
        <LeadDrawer
          lead={openLead}
          onClose={() => setOpenLeadId(null)}
          onUpdate={(u) => setLeads((p) => p.map((l) => (l.id === u.id ? u : l)))}
          onDelete={(id) => { setLeads((p) => p.filter((l) => l.id !== id)); setOpenLeadId(null) }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Modale nouveau lead
// ════════════════════════════════════════════════════════════════════════════

function NewLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (l: Lead) => void }) {
  const [form, setForm] = useState({
    name: '', contact_name: '', contact_phone: '', contact_email: '',
    source: 'referral', work_type: 'painting', estimated_value: '', priority: 'medium',
    address_city: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!form.name.trim()) { setError('Le nom est requis'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, estimated_value: Number(form.estimated_value) || 0 }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erreur'); return }
      onCreated(json.lead)
    } finally { setSaving(false) }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Nouveau lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </div>
        {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom du lead *" full><input className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex. Toiture - Maison Tremblay" /></Field>
          <Field label="Contact"><input className={INPUT} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></Field>
          <Field label="Téléphone"><input className={INPUT} value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></Field>
          <Field label="Courriel"><input className={INPUT} value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></Field>
          <Field label="Ville"><input className={INPUT} value={form.address_city} onChange={(e) => setForm({ ...form, address_city: e.target.value })} /></Field>
          <Field label="Source">
            <select className={INPUT} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Type de travaux">
            <select className={INPUT} value={form.work_type} onChange={(e) => setForm({ ...form, work_type: e.target.value })}>
              {WORK_TYPES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </Field>
          <Field label="Valeur estimée ($)"><input type="number" className={INPUT} value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} /></Field>
          <Field label="Priorité">
            <select className={INPUT} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option>
            </select>
          </Field>
          <Field label="Notes" full><textarea rows={2} className={`${INPUT} resize-y`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer le lead
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Panneau détail
// ════════════════════════════════════════════════════════════════════════════

function LeadDrawer({
  lead, onClose, onUpdate, onDelete,
}: {
  lead: Lead
  onClose: () => void
  onUpdate: (l: Lead) => void
  onDelete: (id: string) => void
}) {
  const router = useRouter()
  const [form, setForm] = useState<Lead>(lead)
  const [activities, setActivities] = useState<LeadActivity[] | null>(
    (lead.activities as LeadActivity[]) ?? null
  )
  const [loadingAct, setLoadingAct] = useState(activities === null)
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [newNote, setNewNote] = useState('')
  const [noteType, setNoteType] = useState<LeadActivityType>('note')
  const [savingNote, setSavingNote] = useState(false)
  const [converting, setConverting] = useState(false)

  function reloadActivities() {
    fetch(`/api/leads/${lead.id}/activities`)
      .then((r) => r.json())
      .then((j) => setActivities(j.activities ?? []))
  }

  // Charge activités + modèles à l'ouverture
  useEffect(() => {
    let cancelled = false
    if (activities === null) {
      fetch(`/api/leads/${lead.id}/activities`)
        .then((r) => r.json())
        .then((j) => { if (!cancelled) setActivities(j.activities ?? []) })
        .finally(() => { if (!cancelled) setLoadingAct(false) })
    }
    fetch('/api/templates')
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setTemplates(j.templates ?? []) })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id])

  function set<K extends keyof Lead>(k: K, v: Lead[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function saveField(patch: Partial<Lead>) {
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (res.ok && json.lead) { setForm(json.lead); onUpdate(json.lead) }
  }

  async function addNote() {
    if (!newNote.trim()) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/activities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: noteType, content: newNote }),
      })
      const json = await res.json()
      if (res.ok) { setActivities((a) => [json.activity, ...(a ?? [])]); setNewNote('') }
    } finally { setSavingNote(false) }
  }

  async function convert() {
    setConverting(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/convert`, { method: 'POST' })
      const json = await res.json()
      if (res.ok && json.projectId) {
        router.push(`/projects/${json.projectId}`)
      } else {
        alert(json.error ?? 'Erreur')
      }
    } finally { setConverting(false) }
  }

  async function remove() {
    if (!confirm('Supprimer ce lead ?')) return
    const res = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' })
    if (res.ok) onDelete(lead.id)
  }

  return (
    <Overlay onClose={onClose} align="right">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="flex items-start justify-between border-b border-gray-200 p-5">
          <div className="min-w-0 flex-1">
            <input
              className="w-full rounded border border-transparent bg-transparent text-lg font-semibold text-gray-900 hover:border-gray-200 focus:border-blue-400 focus:outline-none"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              onBlur={() => form.name !== lead.name && saveField({ name: form.name })}
            />
            <div className="mt-2 flex items-center gap-2">
              <select
                value={form.stage}
                onChange={(e) => { set('stage', e.target.value as LeadStage); saveField({ stage: e.target.value as LeadStage }) }}
                className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
              >
                {PIPELINE_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <select
                value={form.priority}
                onChange={(e) => { set('priority', e.target.value as LeadPriority); saveField({ priority: e.target.value as LeadPriority }) }}
                className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
              >
                <option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option>
              </select>
            </div>
          </div>
          <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Coordonnées */}
          <section className="space-y-2">
            <DrawerField icon={<Building2 className="h-4 w-4" />} label="Contact" value={form.contact_name} onChange={(v) => set('contact_name', v)} onSave={(v) => saveField({ contact_name: v })} />
            <DrawerField icon={<Phone className="h-4 w-4" />} label="Téléphone" value={form.contact_phone} onChange={(v) => set('contact_phone', v)} onSave={(v) => saveField({ contact_phone: v })} />
            <DrawerField icon={<Mail className="h-4 w-4" />} label="Courriel" value={form.contact_email} onChange={(v) => set('contact_email', v)} onSave={(v) => saveField({ contact_email: v })} />
            <DrawerField icon={<MapPin className="h-4 w-4" />} label="Ville" value={form.address_city} onChange={(v) => set('address_city', v)} onSave={(v) => saveField({ address_city: v })} />
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <input type="number" className={`${INPUT} py-1.5`} value={form.estimated_value} onChange={(e) => set('estimated_value', Number(e.target.value) || 0)} onBlur={() => saveField({ estimated_value: form.estimated_value })} />
            </div>
          </section>

          {/* Actions rapides */}
          <div className="flex gap-2">
            {form.project_id ? (
              <button onClick={() => router.push(`/projects/${form.project_id}`)} className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
                Ouvrir le projet
              </button>
            ) : (
              <button onClick={convert} disabled={converting} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />} Convertir en projet
              </button>
            )}
            <button onClick={remove} className="rounded-lg border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
          </div>

          {/* Envoi de message */}
          <SendBox
            leadId={lead.id}
            templates={templates}
            hasEmail={!!form.contact_email}
            hasPhone={!!form.contact_phone}
            onSent={reloadActivities}
          />

          {/* Journal d'activité */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Historique & notes</h3>
            <div className="mb-3 rounded-lg border border-gray-200 p-2">
              <div className="mb-2 flex gap-1">
                {([['note', StickyNote, 'Note'], ['call', Phone, 'Appel'], ['email', Mail, 'Courriel'], ['meeting', Calendar, 'RDV'], ['sms', MessageSquare, 'SMS']] as const).map(([t, Icon, label]) => (
                  <button key={t} onClick={() => setNoteType(t)} title={label}
                    className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${noteType === t ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
              <textarea rows={2} className={`${INPUT} resize-y`} placeholder="Ajouter une note, un appel, un courriel…" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
              <div className="mt-2 flex justify-end">
                <button onClick={addNote} disabled={savingNote || !newNote.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                  {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Enregistrer
                </button>
              </div>
            </div>

            {loadingAct ? (
              <div className="flex justify-center py-4 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <ol className="space-y-3">
                {(activities ?? []).map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <div className="mt-0.5"><ActivityIcon type={a.type} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800">{a.content}</p>
                      <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString('fr-CA')}</p>
                    </div>
                  </li>
                ))}
                {(activities ?? []).length === 0 && <p className="py-2 text-center text-xs text-gray-400">Aucune activité.</p>}
              </ol>
            )}
          </section>
        </div>
      </div>
    </Overlay>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Bloc d'envoi de message (courriel / SMS)
// ════════════════════════════════════════════════════════════════════════════

function SendBox({
  leadId, templates, hasEmail, hasPhone, onSent,
}: {
  leadId: string
  templates: MessageTemplate[]
  hasEmail: boolean
  hasPhone: boolean
  onSent: () => void
}) {
  const [channel, setChannel] = useState<'email' | 'sms'>(hasEmail ? 'email' : 'sms')
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiReason, setAiReason] = useState<string | null>(null)

  const channelTemplates = templates.filter((t) => t.channel === channel)
  const recipientMissing = (channel === 'email' && !hasEmail) || (channel === 'sms' && !hasPhone)

  async function aiSuggest() {
    setAiLoading(true); setMsg(null)
    try {
      const res = await fetch(`/api/leads/${leadId}/ai-suggestion`, { method: 'POST' })
      const json = await res.json()
      if (res.ok && json.suggestion) {
        const s = json.suggestion
        setChannel(s.channel)
        setSubject(s.draft_subject ?? '')
        setBody(s.draft_message ?? '')
        setAiReason(`${s.next_action} (${s.source === 'ai' ? 'IA' : 'heuristique'})`)
        setTemplateId('')
      } else {
        setMsg(json.error ?? 'Erreur IA')
      }
    } finally { setAiLoading(false) }
  }

  function applyTemplate(id: string) {
    setTemplateId(id)
    const t = templates.find((x) => x.id === id)
    if (t) { setSubject(t.subject ?? ''); setBody(t.body) }
  }

  async function send() {
    if (!body.trim()) { setMsg('Contenu requis'); return }
    setSending(true); setMsg(null)
    try {
      const res = await fetch(`/api/leads/${leadId}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, subject: channel === 'email' ? subject : null, body }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error ?? 'Échec de l’envoi'); return }
      setMsg('✓ Envoyé'); setBody(''); setSubject(''); setTemplateId('')
      onSent()
    } finally { setSending(false) }
  }

  return (
    <section className="rounded-lg border border-gray-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Send className="h-4 w-4 text-blue-600" /> Envoyer un message
        </h3>
        <button onClick={aiSuggest} disabled={aiLoading} className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-200 disabled:opacity-60">
          {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Suggestion IA
        </button>
      </div>
      {aiReason && <p className="mb-2 rounded bg-violet-50 px-2 py-1 text-xs text-violet-700">{aiReason}</p>}
      <div className="mb-2 flex gap-1">
        <button onClick={() => setChannel('email')} className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs ${channel === 'email' ? 'bg-violet-100 text-violet-700' : 'text-gray-500 hover:bg-gray-100'}`}>
          <Mail className="h-3.5 w-3.5" /> Courriel
        </button>
        <button onClick={() => setChannel('sms')} className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs ${channel === 'sms' ? 'bg-teal-100 text-teal-700' : 'text-gray-500 hover:bg-gray-100'}`}>
          <MessageSquare className="h-3.5 w-3.5" /> SMS
        </button>
      </div>

      {channelTemplates.length > 0 && (
        <select className={`${INPUT} mb-2 py-1.5`} value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
          <option value="">— modèle (optionnel) —</option>
          {channelTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}

      {channel === 'email' && (
        <input className={`${INPUT} mb-2 py-1.5`} placeholder="Objet" value={subject} onChange={(e) => setSubject(e.target.value)} />
      )}
      <textarea rows={3} className={`${INPUT} resize-y`} placeholder="Message…" value={body} onChange={(e) => setBody(e.target.value)} />

      {recipientMissing && <p className="mt-1 text-xs text-amber-600">Ce lead n’a pas de {channel === 'email' ? 'courriel' : 'numéro'}.</p>}
      <div className="mt-2 flex items-center justify-between">
        <span className={`text-xs ${msg?.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{msg}</span>
        <button onClick={send} disabled={sending || recipientMissing} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Envoyer
        </button>
      </div>
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Primitives
// ════════════════════════════════════════════════════════════════════════════

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

function Overlay({ children, onClose, align = 'center' }: { children: React.ReactNode; onClose: () => void; align?: 'center' | 'right' }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm ${align === 'right' ? 'justify-end' : 'items-center justify-center p-4'}`}
      onClick={onClose}
    >
      {children}
    </div>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  )
}

function DrawerField({
  icon, label, value, onChange, onSave,
}: {
  icon: React.ReactNode
  label: string
  value: string | null
  onChange: (v: string) => void
  onSave: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400">{icon}</span>
      <input
        className={`${INPUT} py-1.5`}
        placeholder={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onSave(e.target.value)}
      />
    </div>
  )
}

function ActivityIcon({ type }: { type: LeadActivityType }) {
  const cls = 'h-4 w-4'
  const map: Record<LeadActivityType, React.ReactNode> = {
    note: <StickyNote className={`${cls} text-gray-400`} />,
    call: <Phone className={`${cls} text-sky-500`} />,
    email: <Mail className={`${cls} text-violet-500`} />,
    sms: <MessageSquare className={`${cls} text-teal-500`} />,
    meeting: <Calendar className={`${cls} text-indigo-500`} />,
    stage_change: <ArrowRightLeft className={`${cls} text-amber-500`} />,
    task: <FolderInput className={`${cls} text-green-500`} />,
    created: <Plus className={`${cls} text-blue-500`} />,
  }
  return <>{map[type] ?? <StickyNote className={cls} />}</>
}
