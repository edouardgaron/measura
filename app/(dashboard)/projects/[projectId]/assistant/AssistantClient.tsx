// app/(dashboard)/projects/[projectId]/assistant/AssistantClient.tsx
'use client'

import { useRef, useState } from 'react'
import { Bot, Send, Loader2, ImageIcon, AlertTriangle, AlertOctagon, CheckCircle2, Sparkles, Calculator, Eye } from 'lucide-react'
import type { Gap } from '@/lib/ai/assistant'

interface Msg { role: 'user' | 'assistant'; content: string }
const money = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n ?? 0)

const SUGGESTIONS = [
  'Quels matériaux pour ce projet ?',
  'Détecte les oublis dans ce dossier.',
  'Analyse les photos et signale les problèmes.',
  'Estime le temps de main-d’œuvre.',
]

export default function AssistantClient({ projectId, gaps, aiEnabled }: { projectId: string; gaps: Gap[]; aiEnabled: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [includePhotos, setIncludePhotos] = useState(false)
  const [loading, setLoading] = useState(false)
  const [advanced, setAdvanced] = useState<'estimate' | 'photos' | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  function pushAssistant(content: string) {
    setMessages((m) => [...m, { role: 'assistant', content }])
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50)
  }

  async function aiEstimate() {
    setAdvanced('estimate')
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-estimate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const json = await res.json()
      if (!res.ok) { pushAssistant(json.error ?? 'Erreur'); return }
      const lines = (json.items ?? []).map((i: { description: string; quantity: number; unit: string; unit_price: number }) => `• ${i.description} — ${i.quantity} ${i.unit} × ${money(i.unit_price)} = ${money(i.quantity * i.unit_price)}`)
      const total = (json.items ?? []).reduce((s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0)
      pushAssistant(`Suggestion d'estimation (${json.source === 'ai' ? 'IA' : 'heuristique'}) :\n${lines.join('\n')}\n\nSous-total estimé : ${money(total)}\n${json.note ?? ''}`)
    } finally { setAdvanced(null) }
  }

  async function aiPhotos() {
    setAdvanced('photos')
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-photo-analysis`, { method: 'POST' })
      const json = await res.json()
      pushAssistant(json.analysis ?? json.error ?? 'Aucune analyse disponible.')
    } finally { setAdvanced(null) }
  }

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    const next = [...messages, { role: 'user' as const, content }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/assistant`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, includePhotos }),
      })
      const json = await res.json()
      setMessages((m) => [...m, { role: 'assistant', content: res.ok ? json.reply : (json.error ?? 'Erreur') }])
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Oublis détectés */}
      <div className="space-y-3 lg:col-span-1">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Sparkles className="h-5 w-5 text-violet-500" /> Oublis détectés
        </h2>
        <div className="space-y-2">
          {gaps.map((g, i) => <GapCard key={i} gap={g} />)}
        </div>
      </div>

      {/* Chat */}
      <div className="flex h-[70vh] flex-col rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-4">
          <Bot className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">Assistant IA construction</h2>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={aiEstimate} disabled={advanced !== null} className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-200 disabled:opacity-60">
              {advanced === 'estimate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calculator className="h-3.5 w-3.5" />} Estimation IA
            </button>
            <button onClick={aiPhotos} disabled={advanced !== null} className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-200 disabled:opacity-60">
              {advanced === 'photos' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Analyser photos
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
              <Bot className="h-10 w-10" />
              <p className="mt-2 text-sm">Posez une question sur ce projet.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">{s}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {m.content}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start"><div className="rounded-2xl bg-gray-100 px-3.5 py-2.5 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /></div></div>
          )}
        </div>

        <div className="border-t border-gray-100 p-3">
          <label className="mb-2 flex items-center gap-1.5 text-xs text-gray-500">
            <input type="checkbox" checked={includePhotos} onChange={(e) => setIncludePhotos(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300" />
            <ImageIcon className="h-3.5 w-3.5" /> Joindre les photos du projet (analyse visuelle)
          </label>
          <div className="flex gap-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Écrivez votre question…"
              className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button onClick={() => send()} disabled={loading || !input.trim()} className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GapCard({ gap }: { gap: Gap }) {
  const cfg = {
    danger: { cls: 'border-red-200 bg-red-50 text-red-800', icon: <AlertOctagon className="h-4 w-4 text-red-600" /> },
    warning: { cls: 'border-amber-200 bg-amber-50 text-amber-800', icon: <AlertTriangle className="h-4 w-4 text-amber-600" /> },
    info: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" /> },
  }[gap.level]
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 ${cfg.cls}`}>
      <div className="mt-0.5 shrink-0">{cfg.icon}</div>
      <div>
        <p className="text-sm font-medium">{gap.title}</p>
        <p className="text-xs opacity-80">{gap.detail}</p>
      </div>
    </div>
  )
}
