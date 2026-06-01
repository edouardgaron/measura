// lib/ai/client.ts
// ============================================================
// Initialisation paresseuse du client Anthropic (serveur only).
// Renvoie null si ANTHROPIC_API_KEY n'est pas configurée — les
// fonctionnalités IA basculent alors sur un repli heuristique.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'

let cached: Anthropic | null = null

export function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null
  if (cached) return cached
  cached = new Anthropic({ apiKey: key })
  return cached
}

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

/** Modèle par défaut (surchargeable via ANTHROPIC_MODEL). */
export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'
}
