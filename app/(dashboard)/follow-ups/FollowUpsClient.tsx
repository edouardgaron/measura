// app/(dashboard)/follow-ups/FollowUpsClient.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sparkles, Loader2, RefreshCw, Clock, Mail, MessageSquare, Send, ChevronDown, AlertCircle, ExternalLink,
} from 'lucide-react'
import { STAGE_LABELS } from '@/lib/crm/stages'
import type { LeadStage, MessageChannel } from '@/lib/supabase/types'

interface FollowUpRow {
  leadId: string
  name: string
  contact_name: string | null
  stage: LeadStage
  estimated_value: number
  days: number
  score: number
  priority: 'low' | 'medium' | 'high'
  reason: string
  next_action: string
  hasEmail: boolean
  hasPhone: boolean
}

interface Suggestion {
  score: number
  priority: string
  reason: string
  next_action: string
  channel: MessageChannel
  draft_subject: string | null
  draft_message: string
  source: 'ai' | 'heuristic'
}

const money = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n ?? 0)

const PRIORITY: Record<string, string> = {
  high: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  low: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
}

export default function FollowUpsClient({ aiEnabled }: { aiEnabled: boolean }) {
  const [rows, setRows] = useState<FollowUpRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/follow-ups', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) setRows(json.followUps ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            <Sparkles className="h-6 w-6 text-violet-500" /> Suivi IA
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Leads à relancer en priorité, avec messages rédigés par l’IA.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {!aiEnabled && (
        <div className="flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          IA non configurée : les suggestions utilisent des règles heuristiques. Ajoutez <code className="rounded bg-violet-100 px-1 dark:bg-violet-900/50">ANTHROPIC_API_KEY</code> pour des messages rédigés par Claude.
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center text-neutral-400 dark:text-neutral-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
          Aucun lead à relancer. Beau travail ! 🎉
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <FollowUpCard key={r.leadId} row={r} open={openId === r.leadId} onToggle={() => setOpenId(openId === r.leadId ? null : r.leadId)} />
          ))}
        </div>
      )}
    </div>
  )
}

function FollowUpCard({ row, open, onToggle }: { row: FollowUpRow; open: boolean; onToggle: () => void }) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [channel, setChannel] = useState<MessageChannel>('email')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function loadSuggestion() {
    if (suggestion || loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${row.leadId}/ai-suggestion`, { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        const s: Suggestion = json.suggestion
        setSuggestion(s)
        setChannel(s.channel)
        setSubject(s.draft_subject ?? '')
        setBodyText(s.draft_message ?? '')
      }
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    onToggle()
    if (!open) loadSuggestion()
  }

  async function send() {
    if (!bodyText.trim()) return
    setSending(true); setErr(null)
    try {
      const res = await fetch(`/api/leads/${row.leadId}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, subject: channel === 'email' ? subject : null, body: bodyText }),
      })
      const json = await res.json()
      if (!res.ok) { setErr(json.error ?? 'Échec de l’envoi'); return }
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`rounded-2xl border bg-white dark:bg-neutral-900 ${open ? 'border-neutral-900 dark:border-neutral-100' : 'border-neutral-200 dark:border-neutral-800'}`}>
      <button onClick={toggle} className="flex w-full items-center gap-3 p-4 text-left">
        <ScoreRing score={row.score} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{row.name}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {row.contact_name ?? '—'} · {STAGE_LABELS[row.stage]}
            {row.estimated_value > 0 ? ` · ${money(row.estimated_value)}` : ''}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500"><Clock className="h-3.5 w-3.5" />{row.days} j</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY[row.priority]}`}>{row.priority}</span>
        <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform dark:text-neutral-500 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-neutral-400 dark:text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> L’IA prépare une suggestion…</div>
          ) : suggestion ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-violet-50 p-3 text-sm text-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
                <p className="font-medium">{suggestion.next_action}</p>
                <p className="mt-1 text-xs text-violet-700 dark:text-violet-400">{suggestion.reason}</p>
                <p className="mt-1 text-xs text-violet-400 dark:text-violet-500">{suggestion.source === 'ai' ? 'Rédigé par Claude' : 'Suggestion heuristique'}</p>
              </div>

              <div className="flex gap-1">
                <button onClick={() => setChannel('email')} disabled={!row.hasEmail}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${channel === 'email' ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400' : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'} disabled:opacity-40`}>
                  <Mail className="h-3.5 w-3.5" /> Courriel
                </button>
                <button onClick={() => setChannel('sms')} disabled={!row.hasPhone}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${channel === 'sms' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'} disabled:opacity-40`}>
                  <MessageSquare className="h-3.5 w-3.5" /> SMS
                </button>
              </div>

              {channel === 'email' && (
                <input className={INPUT} placeholder="Objet" value={subject} onChange={(e) => setSubject(e.target.value)} />
              )}
              <textarea rows={channel === 'sms' ? 3 : 5} className={`${INPUT} resize-y`} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />

              <div className="flex items-center justify-between">
                <Link href="/crm" className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                  <ExternalLink className="h-3.5 w-3.5" /> Ouvrir le pipeline
                </Link>
                <div className="flex items-center gap-2">
                  {err && <span className="text-xs text-red-600 dark:text-red-400">{err}</span>}
                  {sent ? (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ Envoyé</span>
                  ) : (
                    <button onClick={send} disabled={sending || (channel === 'email' ? !row.hasEmail : !row.hasPhone)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200">
                      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Envoyer
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="py-3 text-sm text-neutral-400 dark:text-neutral-500">Impossible de charger la suggestion.</p>
          )}
        </div>
      )}
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#a3a3a3'
  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90 text-neutral-200 dark:text-neutral-700">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 97.4} 97.4`} />
      </svg>
      <span className="absolute text-xs font-bold text-neutral-700 dark:text-neutral-200">{score}</span>
    </div>
  )
}

const INPUT = 'w-full rounded-xl border border-transparent bg-neutral-100 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-0 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-100'
