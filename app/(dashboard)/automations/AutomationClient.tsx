// app/(dashboard)/automations/AutomationClient.tsx
'use client'

import { useState } from 'react'
import {
  Zap, Plus, Trash2, Loader2, Mail, MessageSquare, X, Pencil, Clock, AlertCircle,
} from 'lucide-react'
import { PIPELINE_STAGES, STAGE_LABELS } from '@/lib/crm/stages'
import { AVAILABLE_VARS } from '@/lib/messaging/render'
import type { AutomationRule, MessageChannel, MessageTemplate, LeadStage } from '@/lib/supabase/types'

interface Props {
  initialTemplates: MessageTemplate[]
  initialRules: AutomationRule[]
  emailEnabled: boolean
  smsEnabled: boolean
}

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

function ChannelBadge({ channel }: { channel: MessageChannel }) {
  return channel === 'email' ? (
    <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-xs text-violet-700"><Mail className="h-3 w-3" /> Courriel</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded bg-teal-100 px-1.5 py-0.5 text-xs text-teal-700"><MessageSquare className="h-3 w-3" /> SMS</span>
  )
}

export default function AutomationClient({ initialTemplates, initialRules, emailEnabled, smsEnabled }: Props) {
  const [tab, setTab] = useState<'rules' | 'templates'>('rules')
  const [templates, setTemplates] = useState<MessageTemplate[]>(initialTemplates)
  const [rules, setRules] = useState<AutomationRule[]>(initialRules)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Zap className="h-6 w-6 text-amber-500" /> Automatisation
        </h1>
        <p className="text-sm text-gray-500">Courriels et SMS automatiques déclenchés par l’avancement des leads.</p>
      </div>

      {!emailEnabled && !smsEnabled && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Aucun canal configuré. Ajoutez <code className="rounded bg-amber-100 px-1">RESEND_API_KEY</code> (courriel) et/ou les variables Twilio (SMS) pour activer les envois.
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {(['rules', 'templates'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'rules' ? `Règles (${rules.length})` : `Modèles (${templates.length})`}
          </button>
        ))}
      </div>

      {tab === 'templates'
        ? <TemplatesTab templates={templates} setTemplates={setTemplates} emailEnabled={emailEnabled} smsEnabled={smsEnabled} />
        : <RulesTab rules={rules} setRules={setRules} templates={templates} />}
    </div>
  )
}

// ── Modèles ──────────────────────────────────────────────────────────────────

function TemplatesTab({
  templates, setTemplates, emailEnabled, smsEnabled,
}: {
  templates: MessageTemplate[]
  setTemplates: React.Dispatch<React.SetStateAction<MessageTemplate[]>>
  emailEnabled: boolean
  smsEnabled: boolean
}) {
  const [editing, setEditing] = useState<MessageTemplate | 'new' | null>(null)

  async function remove(id: string) {
    if (!confirm('Supprimer ce modèle ?')) return
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    if (res.ok) setTemplates((p) => p.filter((t) => t.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditing('new')} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nouveau modèle
        </button>
      </div>

      {templates.length === 0 ? (
        <Empty text="Aucun modèle. Créez-en un pour vos courriels et SMS." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{t.name}</p>
                  <div className="mt-1"><ChannelBadge channel={t.channel} /></div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(t)} className="text-gray-400 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(t.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {t.subject && <p className="mt-2 truncate text-xs font-medium text-gray-600">{t.subject}</p>}
              <p className="mt-1 line-clamp-2 text-xs text-gray-500">{t.body}</p>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TemplateModal
          template={editing === 'new' ? null : editing}
          emailEnabled={emailEnabled}
          smsEnabled={smsEnabled}
          onClose={() => setEditing(null)}
          onSaved={(tpl) => {
            setTemplates((p) => {
              const exists = p.some((x) => x.id === tpl.id)
              return exists ? p.map((x) => (x.id === tpl.id ? tpl : x)) : [tpl, ...p]
            })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function TemplateModal({
  template, emailEnabled, smsEnabled, onClose, onSaved,
}: {
  template: MessageTemplate | null
  emailEnabled: boolean
  smsEnabled: boolean
  onClose: () => void
  onSaved: (t: MessageTemplate) => void
}) {
  const [name, setName] = useState(template?.name ?? '')
  const [channel, setChannel] = useState<MessageChannel>(template?.channel ?? (emailEnabled ? 'email' : 'sms'))
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!name.trim() || !body.trim()) { setError('Nom et contenu requis'); return }
    setSaving(true); setError(null)
    try {
      const payload = { name, channel, subject: channel === 'email' ? subject : null, body }
      const res = template
        ? await fetch(`/api/templates/${template.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erreur'); return }
      onSaved(json.template)
    } finally { setSaving(false) }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{template ? 'Modifier le modèle' : 'Nouveau modèle'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </div>
        {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="space-y-3">
          <input className={INPUT} placeholder="Nom du modèle" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => setChannel('email')} disabled={!emailEnabled}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${channel === 'email' ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-300 text-gray-600'} disabled:opacity-40`}>
              <Mail className="h-4 w-4" /> Courriel
            </button>
            <button onClick={() => setChannel('sms')} disabled={!smsEnabled}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${channel === 'sms' ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-gray-300 text-gray-600'} disabled:opacity-40`}>
              <MessageSquare className="h-4 w-4" /> SMS
            </button>
          </div>
          {channel === 'email' && <input className={INPUT} placeholder="Objet du courriel" value={subject} onChange={(e) => setSubject(e.target.value)} />}
          <textarea rows={channel === 'sms' ? 3 : 6} className={`${INPUT} resize-y`} placeholder="Contenu du message…" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="rounded-lg bg-gray-50 p-2 text-xs text-gray-500">
            Variables : {AVAILABLE_VARS.map((v) => <code key={v} className="mr-1 rounded bg-white px-1">{v}</code>)}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ── Règles ───────────────────────────────────────────────────────────────────

function RulesTab({
  rules, setRules, templates,
}: {
  rules: AutomationRule[]
  setRules: React.Dispatch<React.SetStateAction<AutomationRule[]>>
  templates: MessageTemplate[]
}) {
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [stage, setStage] = useState<LeadStage>('quote_sent')
  const [templateId, setTemplateId] = useState('')
  const [delay, setDelay] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    if (!name.trim() || !templateId) { setError('Nom et modèle requis'); return }
    setSaving(true); setError(null)
    const tpl = templates.find((t) => t.id === templateId)
    try {
      const res = await fetch('/api/automations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, trigger_stage: stage, template_id: templateId, channel: tpl?.channel ?? 'email', delay_minutes: Number(delay) || 0 }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erreur'); return }
      setRules((p) => [json.rule, ...p]); setShowNew(false); setName(''); setTemplateId(''); setDelay('0')
    } finally { setSaving(false) }
  }

  async function toggle(rule: AutomationRule) {
    const res = await fetch(`/api/automations/${rule.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !rule.is_active }) })
    const json = await res.json()
    if (res.ok) setRules((p) => p.map((r) => (r.id === rule.id ? json.rule : r)))
  }
  async function remove(id: string) {
    if (!confirm('Supprimer cette règle ?')) return
    const res = await fetch(`/api/automations/${id}`, { method: 'DELETE' })
    if (res.ok) setRules((p) => p.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Quand un lead atteint une étape, envoie automatiquement un message.</p>
        <button onClick={() => setShowNew((s) => !s)} disabled={templates.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
          <Plus className="h-4 w-4" /> Nouvelle règle
        </button>
      </div>

      {templates.length === 0 && <Empty text="Créez d’abord un modèle de message dans l’onglet Modèles." />}

      {showNew && templates.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Nom de la règle</span>
              <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Relance après soumission" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Déclencheur : étape atteinte</span>
              <select className={INPUT} value={stage} onChange={(e) => setStage(e.target.value as LeadStage)}>
                {PIPELINE_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Modèle à envoyer</span>
              <select className={INPUT} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">— choisir —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.channel === 'email' ? 'courriel' : 'SMS'})</option>)}
              </select></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-500">Délai (minutes, 0 = immédiat)</span>
              <input type="number" min={0} className={INPUT} value={delay} onChange={(e) => setDelay(e.target.value)} /></label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setShowNew(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-white">Annuler</button>
            <button onClick={create} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        templates.length > 0 && <Empty text="Aucune règle d’automatisation." />
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 shadow-sm ${r.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
              <Zap className={`h-5 w-5 shrink-0 ${r.is_active ? 'text-amber-500' : 'text-gray-300'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{r.name}</p>
                <p className="text-xs text-gray-500">
                  Étape « {STAGE_LABELS[r.trigger_stage]} » → {r.template?.name ?? 'modèle'}
                  {r.delay_minutes > 0 ? <span className="ml-1 inline-flex items-center gap-0.5"><Clock className="h-3 w-3" />{r.delay_minutes} min</span> : ' · immédiat'}
                </p>
              </div>
              <ChannelBadge channel={r.channel} />
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
                <input type="checkbox" checked={r.is_active} onChange={() => toggle(r)} className="h-4 w-4 rounded border-gray-300" />
                Active
              </label>
              <button onClick={() => remove(r.id)} className="text-gray-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Primitives ───────────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      {children}
    </div>
  )
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">{text}</div>
}
