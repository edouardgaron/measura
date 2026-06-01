// lib/ai/followup.ts
// ============================================================
// Suggestion de suivi IA pour un lead CRM.
// Utilise Claude (tool use forcé → JSON structuré) si configuré,
// sinon un repli heuristique déterministe.
// ============================================================

import { aiModel, getAnthropic } from '@/lib/ai/client'
import { STAGE_LABELS } from '@/lib/crm/stages'
import type { Lead, LeadActivity, LeadStage, MessageChannel } from '@/lib/supabase/types'

export interface FollowupSuggestion {
  score: number               // 0-100 : urgence/probabilité de relance utile
  priority: 'low' | 'medium' | 'high'
  reason: string              // pourquoi relancer maintenant
  next_action: string         // action recommandée
  channel: MessageChannel     // canal suggéré
  draft_subject: string | null
  draft_message: string       // message prêt à envoyer (variables déjà résolues)
  source: 'ai' | 'heuristic'
}

const TERMINAL: LeadStage[] = ['completed', 'lost']

export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 999
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 999
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000))
}

// ── Repli heuristique ─────────────────────────────────────────────────────────

export function heuristicSuggestion(args: {
  lead: Lead
  companyName?: string | null
  days?: number
}): FollowupSuggestion {
  const { lead, companyName } = args
  const days = args.days ?? daysSince(lead.last_activity_at)
  const firstName = (lead.contact_name ?? '').split(' ')[0] || lead.contact_name || ''
  const company = companyName ?? 'notre équipe'

  if (TERMINAL.includes(lead.stage)) {
    return {
      score: 0, priority: 'low',
      reason: lead.stage === 'completed' ? 'Projet complété.' : 'Lead marqué comme refusé.',
      next_action: 'Aucune relance nécessaire.',
      channel: lead.contact_email ? 'email' : 'sms',
      draft_subject: null, draft_message: '', source: 'heuristic',
    }
  }

  let score = Math.min(days * 8, 70)
  if (lead.estimated_value > 15000) score += 25
  else if (lead.estimated_value > 5000) score += 15
  if (lead.stage === 'quote_sent' || lead.stage === 'follow_up') score += 15
  if (lead.priority === 'high') score += 10
  score = Math.max(0, Math.min(100, Math.round(score)))

  const priority: FollowupSuggestion['priority'] = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'

  const hot = lead.stage === 'quote_sent' || lead.stage === 'follow_up'
  const channel: MessageChannel = hot && lead.contact_phone ? 'sms' : lead.contact_email ? 'email' : 'sms'

  const nextActionByStage: Partial<Record<LeadStage, string>> = {
    new: 'Faire un premier contact pour qualifier le besoin.',
    contacted: 'Proposer un rendez-vous pour évaluer le projet.',
    appointment: 'Confirmer le rendez-vous et préparer la prise de mesures.',
    measuring: 'Finaliser les mesures et préparer la soumission.',
    quote_sent: 'Relancer pour valider la réception et répondre aux questions.',
    follow_up: 'Relancer une dernière fois avec une incitation à décider.',
    won: 'Planifier le démarrage des travaux.',
    in_production: 'Donner une mise à jour d’avancement.',
    invoiced: 'Relancer pour le paiement de la facture.',
  }
  const next_action = nextActionByStage[lead.stage] ?? 'Faire un suivi avec le client.'

  const greeting = firstName ? `Bonjour ${firstName},` : 'Bonjour,'
  let draft_message: string
  let draft_subject: string | null
  if (lead.stage === 'quote_sent') {
    draft_subject = `Suivi de votre soumission — ${lead.name}`
    draft_message = `${greeting}\n\nJe fais un suivi concernant la soumission que nous vous avons envoyée pour « ${lead.name} ». Avez-vous des questions ? Je reste disponible pour en discuter.\n\nMerci,\n${company}`
  } else if (lead.stage === 'invoiced') {
    draft_subject = `Rappel de paiement — ${lead.name}`
    draft_message = `${greeting}\n\nPetit rappel amical concernant la facture pour « ${lead.name} ». N’hésitez pas si vous avez des questions.\n\nMerci,\n${company}`
  } else {
    draft_subject = `Suivi — ${lead.name}`
    draft_message = `${greeting}\n\nJe voulais faire un suivi concernant votre projet « ${lead.name} ». ${next_action}\n\nAu plaisir d’échanger,\n${company}`
  }
  if (channel === 'sms') {
    draft_subject = null
    draft_message = `${greeting} suivi pour « ${lead.name} ». ${hot ? 'Avez-vous eu le temps de regarder notre soumission ?' : 'Avez-vous des questions ?'} — ${company}`
  }

  const reason =
    days >= 7
      ? `Aucune activité depuis ${days} jours à l’étape « ${STAGE_LABELS[lead.stage]} ».`
      : `Lead à l’étape « ${STAGE_LABELS[lead.stage]} » — un suivi rapproché augmente les chances de conversion.`

  return { score, priority, reason, next_action, channel, draft_subject, draft_message, source: 'heuristic' }
}

// ── Suggestion via Claude ──────────────────────────────────────────────────────

const SYSTEM = `Tu es un assistant de vente pour des entrepreneurs en construction résidentielle au Québec.
On te donne un lead (prospect) et son historique. Tu dois recommander la meilleure action de suivi et rédiger
un message court, chaleureux et professionnel, en français québécois, prêt à être envoyé.

Règles :
- Le message doit être personnalisé, concis et orienté action (1 court paragraphe pour un courriel, 1-2 phrases pour un SMS).
- N'invente pas de faits non fournis (pas de prix précis si absent).
- Pour un SMS, pas d'objet et pas de mise en forme.
- score = urgence/probabilité qu'un suivi soit utile maintenant (0-100).
- Si le lead est à l'étape « completed » ou « lost », score bas et message vide.
- Réponds uniquement en appelant l'outil suggest_followup.`

const TOOL = {
  name: 'suggest_followup',
  description: 'Fournit une recommandation de suivi structurée pour un lead.',
  input_schema: {
    type: 'object' as const,
    properties: {
      score: { type: 'number', description: 'Urgence du suivi, 0 à 100' },
      priority: { type: 'string', enum: ['low', 'medium', 'high'] },
      reason: { type: 'string', description: 'Pourquoi relancer maintenant (1 phrase)' },
      next_action: { type: 'string', description: 'Action recommandée (1 phrase)' },
      channel: { type: 'string', enum: ['email', 'sms'] },
      draft_subject: { type: ['string', 'null'], description: 'Objet du courriel, ou null pour un SMS' },
      draft_message: { type: 'string', description: 'Message prêt à envoyer' },
    },
    required: ['score', 'priority', 'reason', 'next_action', 'channel', 'draft_message'],
  },
}

export async function generateFollowupSuggestion(args: {
  lead: Lead
  activities: Pick<LeadActivity, 'type' | 'content' | 'created_at'>[]
  companyName?: string | null
}): Promise<FollowupSuggestion> {
  const { lead, activities, companyName } = args
  const days = daysSince(lead.last_activity_at)
  const client = getAnthropic()

  // Pas de clé → repli heuristique
  if (!client) return heuristicSuggestion({ lead, companyName, days })

  const recent = activities
    .slice(0, 12)
    .map((a) => `- [${new Date(a.created_at).toLocaleDateString('fr-CA')}] ${a.type}: ${a.content ?? ''}`)
    .join('\n')

  const userText = `LEAD
Nom: ${lead.name}
Contact: ${lead.contact_name ?? '—'}
Étape actuelle: ${STAGE_LABELS[lead.stage]}
Type de travaux: ${lead.work_type ?? '—'}
Valeur estimée: ${lead.estimated_value ? `${lead.estimated_value} $` : '—'}
Priorité: ${lead.priority}
Canaux disponibles: ${[lead.contact_email ? 'courriel' : null, lead.contact_phone ? 'SMS' : null].filter(Boolean).join(', ') || 'aucun'}
Jours depuis la dernière activité: ${days}
Entreprise (signature): ${companyName ?? 'notre équipe'}

HISTORIQUE RÉCENT
${recent || 'Aucune activité enregistrée.'}`

  try {
    const res = await client.messages.create({
      model: aiModel(),
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'suggest_followup' },
      messages: [{ role: 'user', content: userText }],
    })

    const block = res.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') {
      return heuristicSuggestion({ lead, companyName, days })
    }
    const out = block.input as Record<string, unknown>

    const channel: MessageChannel = out.channel === 'sms' ? 'sms' : 'email'
    const priorityRaw = String(out.priority ?? 'medium')
    const priority: FollowupSuggestion['priority'] =
      priorityRaw === 'high' || priorityRaw === 'low' ? priorityRaw : 'medium'

    return {
      score: clampScore(Number(out.score)),
      priority,
      reason: String(out.reason ?? ''),
      next_action: String(out.next_action ?? ''),
      channel,
      draft_subject: channel === 'sms' ? null : (out.draft_subject ? String(out.draft_subject) : null),
      draft_message: String(out.draft_message ?? ''),
      source: 'ai',
    }
  } catch (e) {
    console.error('generateFollowupSuggestion AI error:', e)
    return heuristicSuggestion({ lead, companyName, days })
  }
}

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 50
  return Math.max(0, Math.min(100, Math.round(n)))
}
