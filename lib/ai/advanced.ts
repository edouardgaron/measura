// lib/ai/advanced.ts
// ============================================================
// IA avancée : suggestion d'estimation à partir des surfaces/mesures.
// Claude (tool use structuré) si configuré, sinon repli heuristique.
// ============================================================

import { aiModel, getAnthropic } from '@/lib/ai/client'
import type { SurfaceCalculation } from '@/lib/supabase/types'

export interface EstimateLineSuggestion {
  description: string
  category: 'labor' | 'material' | 'equipment' | 'other'
  quantity: number
  unit: string
  unit_price: number
}
export interface EstimateSuggestion {
  items: EstimateLineSuggestion[]
  source: 'ai' | 'heuristic'
  note?: string
}

// Taux indicatifs (CAD) par type de travaux et de surface — repli heuristique.
const RATES: Record<string, { labor: number; material: number }> = {
  painting: { labor: 2.5, material: 1.2 },
  siding: { labor: 5, material: 6 },
  roofing: { labor: 4, material: 4.5 },
  default: { labor: 3, material: 2.5 },
}

export function heuristicEstimate(surfaces: SurfaceCalculation[], workType: string): EstimateSuggestion {
  const rate = RATES[workType] ?? RATES.default
  const items: EstimateLineSuggestion[] = []
  let totalArea = 0
  for (const s of surfaces) {
    const area = s.net_area ?? s.gross_area ?? 0
    if (area <= 0) continue
    totalArea += area
  }
  if (totalArea > 0) {
    items.push({ description: `Main d'œuvre — ${workType}`, category: 'labor', quantity: Math.round(totalArea), unit: 'sqft', unit_price: rate.labor })
    items.push({ description: `Matériaux — ${workType}`, category: 'material', quantity: Math.round(totalArea), unit: 'sqft', unit_price: rate.material })
  } else {
    items.push({ description: `Forfait ${workType}`, category: 'labor', quantity: 1, unit: 'lot', unit_price: 0 })
  }
  return { items, source: 'heuristic', note: 'Estimation indicative basée sur les surfaces mesurées et des taux moyens. Ajustez selon vos prix.' }
}

const TOOL = {
  name: 'suggest_estimate',
  description: 'Propose des lignes d’estimation structurées pour un projet de construction.',
  input_schema: {
    type: 'object' as const,
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            category: { type: 'string', enum: ['labor', 'material', 'equipment', 'other'] },
            quantity: { type: 'number' },
            unit: { type: 'string' },
            unit_price: { type: 'number' },
          },
          required: ['description', 'category', 'quantity', 'unit', 'unit_price'],
        },
      },
      note: { type: 'string' },
    },
    required: ['items'],
  },
}

export async function generateEstimateSuggestion(args: {
  surfaces: SurfaceCalculation[]
  workType: string
  unit: string
  companyName?: string | null
}): Promise<EstimateSuggestion> {
  const client = getAnthropic()
  if (!client) return heuristicEstimate(args.surfaces, args.workType)

  const surfaceText = args.surfaces
    .map((s) => `- ${s.surface_type ?? 'surface'} (${s.facade_side ?? '?'}) : ${s.net_area ?? s.gross_area ?? 0} ${s.unit ?? args.unit}²`)
    .join('\n') || 'Aucune surface calculée.'

  try {
    const res = await client.messages.create({
      model: aiModel(),
      max_tokens: 1500,
      thinking: { type: 'disabled' },
      system: [{
        type: 'text',
        text: `Tu es un estimateur en construction résidentielle au Québec. À partir des surfaces et du type de travaux, propose des lignes d'estimation réalistes (main d'œuvre + matériaux), en dollars canadiens, prix unitaires du marché québécois. N'invente pas de surfaces non fournies. Réponds via l'outil suggest_estimate.`,
        cache_control: { type: 'ephemeral' },
      }],
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'suggest_estimate' },
      messages: [{ role: 'user', content: `Type de travaux : ${args.workType}\nUnité : ${args.unit}\nSurfaces :\n${surfaceText}` }],
    })
    const block = res.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') return heuristicEstimate(args.surfaces, args.workType)
    const out = block.input as { items?: EstimateLineSuggestion[]; note?: string }
    if (!out.items || out.items.length === 0) return heuristicEstimate(args.surfaces, args.workType)
    return { items: out.items, source: 'ai', note: out.note }
  } catch (e) {
    console.error('generateEstimateSuggestion error:', e)
    return heuristicEstimate(args.surfaces, args.workType)
  }
}
