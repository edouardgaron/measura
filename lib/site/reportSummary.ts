// lib/site/reportSummary.ts
// ============================================================
// Génère des résumés de rapport journalier (direction + client)
// à partir des données structurées. Déterministe et sans API —
// un hook LLM (OpenAI/Anthropic) pourra remplacer ces fonctions
// plus tard sans changer les appelants.
// ============================================================

import type {
  DailyReport,
  DailyReportMaterial,
  SiteIssue,
  TimeEntry,
} from '@/lib/supabase/types'
import { sumSiteCosts } from '@/lib/site/compute'

const WEATHER_LABELS: Record<string, string> = {
  sunny: 'ensoleillé',
  cloudy: 'nuageux',
  rain: 'pluvieux',
  snow: 'neigeux',
  wind: 'venteux',
  cold: 'froid',
  hot: 'chaud',
}

function frDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('fr-CA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export interface SummaryInput {
  report: Pick<
    DailyReport,
    'report_date' | 'weather' | 'temperature' | 'work_performed' | 'progress_percent' | 'incidents' | 'comments'
  >
  timeEntries: Pick<TimeEntry, 'hours' | 'labor_cost' | 'employee_name'>[]
  materials: Pick<DailyReportMaterial, 'description' | 'quantity' | 'unit' | 'total_cost'>[]
  issues: Pick<SiteIssue, 'type' | 'severity' | 'title' | 'status'>[]
  projectTitle?: string
}

/** Résumé interne (direction) : factuel, avec heures et coûts. */
export function buildManagementSummary(input: SummaryInput): string {
  const { report, timeEntries, materials, issues } = input
  const totals = sumSiteCosts(timeEntries, materials)
  const lines: string[] = []

  lines.push(`Rapport du ${frDate(report.report_date)}.`)

  const weather = report.weather ? WEATHER_LABELS[report.weather] ?? report.weather : null
  if (weather || report.temperature != null) {
    const parts: string[] = []
    if (weather) parts.push(`temps ${weather}`)
    if (report.temperature != null) parts.push(`${report.temperature} °C`)
    lines.push(`Conditions : ${parts.join(', ')}.`)
  }

  const crew = timeEntries.length
  if (crew > 0) {
    lines.push(
      `${crew} ${crew > 1 ? 'travailleurs' : 'travailleur'} sur le chantier, ` +
        `${totals.totalHours} h travaillées (coût main d'œuvre : ${money(totals.laborCost)}).`
    )
  }

  if (report.work_performed) {
    lines.push(`Travaux : ${report.work_performed.trim()}`)
  }

  if (report.progress_percent != null) {
    lines.push(`Avancement global estimé : ${report.progress_percent} %.`)
  }

  if (materials.length > 0) {
    lines.push(`Matériaux consommés (${money(totals.materialCost)}) : ${materials
      .map((m) => `${m.description}${m.quantity != null ? ` ×${m.quantity}${m.unit ? ' ' + m.unit : ''}` : ''}`)
      .join(', ')}.`)
  }

  const openIssues = issues.filter((i) => i.status !== 'resolved')
  if (openIssues.length > 0) {
    lines.push(
      `Points d'attention : ${openIssues
        .map((i) => `${typeLabel(i.type)} (${severityLabel(i.severity)}) — ${i.title}`)
        .join(' ; ')}.`
    )
  }

  if (report.incidents) lines.push(`Incidents : ${report.incidents.trim()}`)

  lines.push(`Coût total de la journée : ${money(totals.totalCost)}.`)

  return lines.join('\n')
}

/** Résumé client : ton positif, sans coûts internes. */
export function buildClientSummary(input: SummaryInput): string {
  const { report, timeEntries } = input
  const lines: string[] = []
  const title = input.projectTitle ? ` — ${input.projectTitle}` : ''

  lines.push(`Mise à jour de chantier${title}`)
  lines.push(`${frDate(report.report_date)}`)
  lines.push('')

  const crew = timeEntries.length
  if (crew > 0) {
    lines.push(
      `Notre équipe de ${crew} ${crew > 1 ? 'personnes' : 'personne'} était sur place aujourd'hui.`
    )
  }

  if (report.work_performed) {
    lines.push(`Travaux réalisés : ${report.work_performed.trim()}`)
  }

  if (report.progress_percent != null) {
    lines.push(`Le projet avance bien — environ ${report.progress_percent} % complété.`)
  }

  if (report.comments) {
    lines.push('')
    lines.push(report.comments.trim())
  }

  lines.push('')
  lines.push('Nous restons disponibles pour toute question. Merci de votre confiance.')

  return lines.join('\n')
}

function money(n: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

function typeLabel(t: string): string {
  const m: Record<string, string> = {
    delay: 'Retard',
    issue: 'Problème',
    risk: 'Risque',
    safety: 'Sécurité',
    quality: 'Qualité',
  }
  return m[t] ?? t
}

function severityLabel(s: string): string {
  const m: Record<string, string> = {
    low: 'faible',
    medium: 'moyen',
    high: 'élevé',
    critical: 'critique',
  }
  return m[s] ?? s
}
