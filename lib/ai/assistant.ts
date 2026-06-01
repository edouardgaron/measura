// lib/ai/assistant.ts
// ============================================================
// Contexte projet + détection d'oublis pour l'assistant IA construction.
// detectGaps est heuristique (toujours disponible) ; le contexte texte
// est injecté dans le prompt système de Claude.
// ============================================================

export interface ProjectContextData {
  title: string
  status: string
  unit: string
  address: string | null
  photoCount: number
  measurementCount: number
  surfaceCount: number
  coveredFacades: string[]            // façades ayant au moins une surface
  totalWallArea: number | null
  estimate: { status: string; total: number; hasHourLines: boolean } | null
  workOrderCount: number
  dailyReportCount: number
  openIssues: number
  hasClient: boolean
}

export interface Gap {
  level: 'info' | 'warning' | 'danger'
  title: string
  detail: string
}

const FACADES = ['front', 'back', 'left', 'right'] as const
const FACADE_LABELS: Record<string, string> = { front: 'avant', back: 'arrière', left: 'gauche', right: 'droite', roof: 'toit' }

export function detectGaps(ctx: ProjectContextData): Gap[] {
  const gaps: Gap[] = []

  if (ctx.photoCount === 0) gaps.push({ level: 'danger', title: 'Aucune photo', detail: 'Ajoutez des photos du bâtiment pour documenter le projet.' })
  else if (ctx.photoCount < 4) gaps.push({ level: 'warning', title: 'Peu de photos', detail: `${ctx.photoCount} photo(s) — 4 vues (avant, arrière, côtés) sont recommandées.` })

  if (ctx.measurementCount === 0 && ctx.surfaceCount === 0)
    gaps.push({ level: 'danger', title: 'Aucune mesure', detail: 'Prenez des mesures ou calculez les surfaces pour estimer le projet.' })

  const missing = FACADES.filter((f) => !ctx.coveredFacades.includes(f))
  if (ctx.surfaceCount > 0 && missing.length > 0 && missing.length < 4)
    gaps.push({ level: 'warning', title: 'Façades non mesurées', detail: `Aucune surface pour : ${missing.map((m) => FACADE_LABELS[m]).join(', ')}.` })

  if (!ctx.estimate) gaps.push({ level: 'warning', title: 'Aucune estimation', detail: 'Créez une estimation pour préparer la soumission.' })
  else if (ctx.estimate.status === 'draft') gaps.push({ level: 'info', title: 'Estimation en brouillon', detail: 'L’estimation n’a pas encore été envoyée au client.' })

  if (ctx.estimate && !ctx.estimate.hasHourLines)
    gaps.push({ level: 'info', title: 'Heures non estimées', detail: 'Ajoutez des lignes en heures pour activer la planification automatique et la rentabilité.' })

  if (ctx.estimate?.status === 'accepted' && ctx.workOrderCount === 0)
    gaps.push({ level: 'warning', title: 'Bon de travail manquant', detail: 'L’estimation est acceptée — générez un bon de travail pour l’équipe.' })

  if (!ctx.hasClient) gaps.push({ level: 'info', title: 'Aucun client invité', detail: 'Invitez le client au portail pour partager photos et soumission.' })

  if (gaps.length === 0) gaps.push({ level: 'info', title: 'Dossier complet', detail: 'Aucun oubli détecté — beau travail !' })

  return gaps
}

export function buildContextText(ctx: ProjectContextData): string {
  const e = ctx.estimate
  return `PROJET : ${ctx.title}
Statut : ${ctx.status} · Unités : ${ctx.unit}${ctx.address ? ` · Adresse : ${ctx.address}` : ''}
Photos : ${ctx.photoCount} · Mesures : ${ctx.measurementCount} · Surfaces calculées : ${ctx.surfaceCount}
Façades couvertes : ${ctx.coveredFacades.map((f) => FACADE_LABELS[f] ?? f).join(', ') || 'aucune'}
Surface murs totale : ${ctx.totalWallArea != null ? `${ctx.totalWallArea} ${ctx.unit}²` : '—'}
Estimation : ${e ? `${e.status}, total ${e.total} $, ${e.hasHourLines ? 'avec' : 'sans'} heures` : 'aucune'}
Bons de travail : ${ctx.workOrderCount} · Rapports journaliers : ${ctx.dailyReportCount} · Problèmes ouverts : ${ctx.openIssues}
Client invité : ${ctx.hasClient ? 'oui' : 'non'}`
}

export const ASSISTANT_SYSTEM = `Tu es un assistant expert en construction résidentielle et commerciale légère au Québec,
intégré au logiciel Measura utilisé par des entrepreneurs. Tu aides sur l'estimation, les matériaux, les méthodes,
le Code du bâtiment, la planification et la relation client.

Règles :
- Réponds en français québécois, de façon concise et concrète (listes courtes quand utile).
- Sers-toi du CONTEXTE PROJET fourni pour personnaliser tes réponses.
- Si on te montre des photos, décris ce que tu observes et signale les problèmes ou éléments manquants.
- N'invente pas de prix précis ni de mesures non fournies ; propose plutôt une méthode pour les obtenir.
- Pour des décisions à risque (structure, permis, sécurité), recommande la validation par un professionnel.`
