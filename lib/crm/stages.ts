// lib/crm/stages.ts
// ============================================================
// Métadonnées du pipeline CRM (étapes, libellés, couleurs).
// Partagé entre serveur et client.
// ============================================================

import type { LeadStage } from '@/lib/supabase/types'

export interface StageMeta {
  key: LeadStage
  label: string
  color: string        // classes Tailwind pour l'entête de colonne
  dot: string          // pastille
  terminal?: 'won' | 'lost'
}

export const PIPELINE_STAGES: StageMeta[] = [
  { key: 'new',           label: 'Nouveau lead',       color: 'bg-slate-100 text-slate-700',     dot: 'bg-slate-400' },
  { key: 'contacted',     label: 'Contacté',           color: 'bg-sky-100 text-sky-700',         dot: 'bg-sky-500' },
  { key: 'appointment',   label: 'Rendez-vous',        color: 'bg-indigo-100 text-indigo-700',   dot: 'bg-indigo-500' },
  { key: 'measuring',     label: 'Mesures',            color: 'bg-violet-100 text-violet-700',   dot: 'bg-violet-500' },
  { key: 'quote_sent',    label: 'Soumission envoyée', color: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500' },
  { key: 'follow_up',     label: 'Relance',            color: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-500' },
  { key: 'won',           label: 'Accepté',            color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', terminal: 'won' },
  { key: 'in_production',  label: 'En production',     color: 'bg-teal-100 text-teal-700',       dot: 'bg-teal-500' },
  { key: 'invoiced',      label: 'Facturé',            color: 'bg-cyan-100 text-cyan-700',       dot: 'bg-cyan-500' },
  { key: 'completed',     label: 'Complété',           color: 'bg-green-100 text-green-700',     dot: 'bg-green-600' },
  { key: 'lost',          label: 'Refusé',             color: 'bg-red-100 text-red-700',         dot: 'bg-red-500', terminal: 'lost' },
]

export const STAGE_LABELS: Record<LeadStage, string> = PIPELINE_STAGES.reduce(
  (acc, s) => {
    acc[s.key] = s.label
    return acc
  },
  {} as Record<LeadStage, string>
)

export const STAGE_KEYS: LeadStage[] = PIPELINE_STAGES.map((s) => s.key)

export const SOURCE_LABELS: Record<string, string> = {
  referral: 'Référence',
  website: 'Site web',
  phone: 'Téléphone',
  social: 'Réseaux sociaux',
  ad: 'Publicité',
  walk_in: 'Visite spontanée',
  other: 'Autre',
}
