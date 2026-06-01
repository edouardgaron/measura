// app/api/projects/[projectId]/ai-photo-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import { getAnthropic, aiModel } from '@/lib/ai/client'

type RouteContext = { params: Promise<{ projectId: string }> }
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()
  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const client = getAnthropic()
  if (!client) {
    return NextResponse.json({ analysis: null, error: 'Analyse IA non disponible (ANTHROPIC_API_KEY manquante).' }, { status: 200 })
  }

  const { data: photos } = await supabase
    .from('photos').select('storage_path').eq('project_id', projectId).order('sort_order', { ascending: true }).limit(6)
  if (!photos || photos.length === 0) {
    return NextResponse.json({ analysis: null, error: 'Aucune photo à analyser.' }, { status: 422 })
  }

  const images: Anthropic.ContentBlockParam[] = []
  for (const p of photos) {
    const { data } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 3600)
    if (data?.signedUrl) images.push({ type: 'image', source: { type: 'url', url: data.signedUrl } })
  }
  if (images.length === 0) return NextResponse.json({ analysis: null, error: 'Photos inaccessibles.' }, { status: 500 })

  try {
    const res = await client.messages.create({
      model: aiModel(),
      max_tokens: 1500,
      thinking: { type: 'disabled' },
      system: [{
        type: 'text',
        text: `Tu es un inspecteur en bâtiment au Québec. Analyse les photos d'un bâtiment et fournis : (1) les matériaux visibles (revêtement, toiture, fenêtres), (2) les dommages ou points d'attention (fissures, pourriture, usure, infiltration), (3) des recommandations. Réponds en français, en listes courtes par section. Reste factuel et signale ce qui doit être confirmé sur place.`,
        cache_control: { type: 'ephemeral' },
      }],
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Analyse ces photos du bâtiment.' }, ...images] }],
    })
    const analysis = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim()
    return NextResponse.json({ analysis: analysis || '(aucune analyse)' })
  } catch (e) {
    console.error('Photo analysis error:', e)
    return NextResponse.json({ analysis: null, error: 'Erreur d’analyse IA' }, { status: 502 })
  }
}
