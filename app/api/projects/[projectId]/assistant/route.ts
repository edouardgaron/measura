// app/api/projects/[projectId]/assistant/route.ts
import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { getAnthropic, aiModel, isAiConfigured } from '@/lib/ai/client'
import { ASSISTANT_SYSTEM, buildContextText } from '@/lib/ai/assistant'
import { gatherProjectContext } from '@/lib/ai/gatherProjectContext'

type RouteContext = { params: Promise<{ projectId: string }> }

export const runtime = 'nodejs'
export const maxDuration = 60

interface ChatMsg { role: 'user' | 'assistant'; content: string }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()
  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: { messages?: ChatMsg[]; includePhotos?: boolean } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  const history = (body.messages ?? []).filter((m) => m.content?.trim()).slice(-12)
  if (history.length === 0) return NextResponse.json({ error: 'Aucun message' }, { status: 422 })

  const client = getAnthropic()
  if (!client) {
    return NextResponse.json({
      reply: "L'assistant IA n'est pas configuré (clé ANTHROPIC_API_KEY manquante). Consultez le panneau « Oublis détectés » à gauche pour les vérifications automatiques du projet.",
      aiEnabled: false,
    })
  }

  const ctx = await gatherProjectContext(supabase, projectId)
  const contextText = ctx ? buildContextText(ctx) : 'Contexte projet indisponible.'

  // Construit les messages SDK
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }))

  // Vision : joindre quelques photos au dernier message utilisateur
  if (body.includePhotos) {
    const { data: photos } = await supabase
      .from('photos')
      .select('storage_path')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .limit(6)

    const imageBlocks: Anthropic.ContentBlockParam[] = []
    for (const p of photos ?? []) {
      const { data: signed } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 3600)
      if (signed?.signedUrl) {
        imageBlocks.push({ type: 'image', source: { type: 'url', url: signed.signedUrl } })
      }
    }
    if (imageBlocks.length > 0) {
      const lastIdx = messages.length - 1
      const last = messages[lastIdx]
      const textPart: Anthropic.ContentBlockParam = { type: 'text', text: typeof last.content === 'string' ? last.content : '' }
      messages[lastIdx] = { role: 'user', content: [textPart, ...imageBlocks] }
    }
  }

  try {
    const res = await client.messages.create({
      model: aiModel(),
      max_tokens: 2000,
      thinking: { type: 'disabled' },
      system: [
        { type: 'text', text: ASSISTANT_SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `CONTEXTE PROJET\n${contextText}` },
      ],
      messages,
    })

    const reply = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    return NextResponse.json({ reply: reply || '(réponse vide)', aiEnabled: isAiConfigured() })
  } catch (e) {
    console.error('Assistant error:', e)
    return NextResponse.json({ error: 'Erreur de l’assistant IA' }, { status: 502 })
  }
}
