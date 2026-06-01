// app/api/projects/[projectId]/work-orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildWorkOrderDraft, workTypeLabel } from '@/lib/work-order/builder'
import type {
  EstimateItem,
  EstimateMaterial,
  EstimateWorkType,
  Measurement,
  SurfaceCalculation,
} from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ projectId: string }> }

// ── Auth + membership helper (même logique que la route estimate) ─────────────
async function requireProjectAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  requireWrite = false
) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { user: null, error: 'Non authentifié', status: 401 } as const
  }

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single()

    if (!project || project.owner_id !== user.id) {
      return { user: null, error: 'Accès refusé', status: 403 } as const
    }
  }

  if (requireWrite && membership?.role === 'client') {
    return { user: null, error: 'Accès refusé', status: 403 } as const
  }

  return { user, error: null, status: 200 } as const
}

function formatAddress(p: {
  address_line1: string | null
  address_city: string | null
  address_province: string | null
  address_postal: string | null
}): string | null {
  const parts = [p.address_line1, p.address_city, p.address_province, p.address_postal].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

// ── GET — liste des bons de travail du projet ─────────────────────────────────
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ workOrders: data ?? [] })
}

// ── POST — génère un nouveau bon de travail depuis les données du projet ──────
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const user = auth.user!

  let body: { estimateId?: string; title?: string; scheduledDate?: string; crewLead?: string } = {}
  try {
    body = await request.json()
  } catch {
    /* defaults */
  }

  // ── Projet (snapshot client + adresse) ──
  const { data: project, error: projError } = await supabase
    .from('projects')
    .select('id, title, company_id, address_line1, address_city, address_province, address_postal')
    .eq('id', projectId)
    .single()

  if (projError || !project) {
    return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
  }

  // ── Estimation (explicite ou la plus récente acceptée/envoyée/brouillon) ──
  let estimateQuery = supabase
    .from('estimates')
    .select(
      `id, work_type,
       items:estimate_items(id, sort_order, category, description, quantity, unit, unit_price, total, is_optional, notes, created_at),
       materials:estimate_materials(id, description, quantity, unit, unit_cost, total_cost, waste_factor,
         material:materials_catalog(id, name, brand, category, unit))`
    )
    .eq('project_id', projectId)

  if (body.estimateId) {
    estimateQuery = estimateQuery.eq('id', body.estimateId)
  }

  const { data: estimateRows } = await estimateQuery
    .order('created_at', { ascending: false })
    .limit(1)

  const estimate = estimateRows && estimateRows.length > 0 ? estimateRows[0] : null
  const workType = (estimate?.work_type as EstimateWorkType | null) ?? 'other'

  // ── Surfaces + mesures ──
  const { data: surfaces } = await supabase
    .from('surface_calculations')
    .select('*')
    .eq('project_id', projectId)

  const { data: measurements } = await supabase
    .from('measurements')
    .select('*')
    .eq('project_id', projectId)

  // ── Construire le brouillon intelligent ──
  const draft = buildWorkOrderDraft({
    workType,
    estimateItems: (estimate?.items as unknown as EstimateItem[]) ?? [],
    estimateMaterials: (estimate?.materials as unknown as EstimateMaterial[]) ?? [],
    surfaces: (surfaces as SurfaceCalculation[]) ?? [],
    measurements: (measurements as Measurement[]) ?? [],
  })

  // ── Client snapshot (proposition la plus récente, sinon membre client) ──
  const { data: proposal } = await supabase
    .from('proposals')
    .select('client_name')
    .eq('project_id', projectId)
    .not('client_name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: clientMember } = await supabase
    .from('project_members')
    .select('email')
    .eq('project_id', projectId)
    .eq('role', 'client')
    .limit(1)
    .maybeSingle()

  // ── Photos de référence (avant / élévations) ──
  const { data: refPhotos } = await supabase
    .from('photos')
    .select('id, photo_category, facade_label, sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .limit(6)

  const photoIds = (refPhotos ?? []).map((p) => p.id)

  // ── Numéro de bon de travail (séquentiel par projet) ──
  const { count } = await supabase
    .from('work_orders')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  const woNumber = (count ?? 0) + 1

  const title = body.title ?? `Bon de travail — ${workTypeLabel(workType)}`

  const { data: workOrder, error: insertError } = await supabase
    .from('work_orders')
    .insert({
      project_id: projectId,
      estimate_id: estimate?.id ?? null,
      company_id: project.company_id ?? null,
      created_by: user.id,
      wo_number: woNumber,
      title,
      status: 'draft',
      work_type: workType,
      client_name: proposal?.client_name ?? clientMember?.email ?? null,
      client_phone: null,
      client_email: clientMember?.email ?? null,
      site_address: formatAddress(project),
      scheduled_date: body.scheduledDate ?? null,
      crew_lead: body.crewLead ?? null,
      crew_members: null,
      estimated_hours: null,
      products: draft.products,
      instructions: draft.instructions,
      checklist: draft.checklist,
      measurements_summary: draft.measurements_summary,
      photo_ids: photoIds,
      notes: null,
      locale: 'fr',
    })
    .select('*')
    .single()

  if (insertError || !workOrder) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Erreur création du bon de travail' },
      { status: 500 }
    )
  }

  return NextResponse.json({ workOrder }, { status: 201 })
}
