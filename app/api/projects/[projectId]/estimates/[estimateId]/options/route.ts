// app/api/projects/[projectId]/estimates/[estimateId]/options/route.ts
// Options de soumission (paliers Économique/Standard/Premium).
// GET : liste · PUT : remplace l'ensemble des options de l'estimation.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'

type RouteContext = { params: Promise<{ projectId: string; estimateId: string }> }
const TIERS = ['economy', 'standard', 'premium']

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { projectId, estimateId } = await params
  const supabase = await createClient()
  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await supabase
    .from('quote_options').select('*').eq('estimate_id', estimateId).order('sort_order', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ options: data ?? [] })
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { projectId, estimateId } = await params
  const supabase = await createClient()
  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // L'estimation doit appartenir au projet
  const { data: est } = await supabase
    .from('estimates').select('id').eq('id', estimateId).eq('project_id', projectId).maybeSingle()
  if (!est) return NextResponse.json({ error: 'Soumission introuvable' }, { status: 404 })

  let body: { options?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }
  const optionsIn = Array.isArray(body.options) ? (body.options as Record<string, unknown>[]) : []

  const rows = optionsIn
    .filter((o) => TIERS.includes(String(o.tier)))
    .map((o, i) => ({
      estimate_id: estimateId,
      tier: String(o.tier),
      name: (o.name as string) || null,
      description: (o.description as string) || null,
      features: Array.isArray(o.features) ? o.features : [],
      total: Number(o.total ?? 0) || 0,
      is_recommended: o.is_recommended === true,
      sort_order: typeof o.sort_order === 'number' ? o.sort_order : i,
    }))

  // Remplace l'ensemble des options de l'estimation.
  const { error: delErr } = await supabase.from('quote_options').delete().eq('estimate_id', estimateId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (rows.length === 0) return NextResponse.json({ options: [] })

  const { data, error: insErr } = await supabase.from('quote_options').insert(rows).select()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ options: data ?? [] })
}
