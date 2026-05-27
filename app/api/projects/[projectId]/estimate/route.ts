// app/api/projects/[projectId]/estimate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ projectId: string }> }

// ── Auth + membership helper ──────────────────────────────────────────────────

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
    return { user: null, membership: null, error: 'Non authentifié', status: 401 } as const
  }

  // Check project membership
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    // Also allow project owner directly
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single()

    if (!project || project.owner_id !== user.id) {
      return { user: null, membership: null, error: 'Accès refusé', status: 403 } as const
    }
  }

  // Clients cannot write
  if (requireWrite && membership?.role === 'client') {
    return { user: null, membership: null, error: 'Accès refusé', status: 403 } as const
  }

  // Also verify the user is entrepreneur or admin for write access
  if (requireWrite) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile && profile.role === 'client') {
      return { user: null, membership: null, error: 'Accès refusé', status: 403 } as const
    }
  }

  return { user, membership, error: null, status: 200 } as const
}

// ── GET /api/projects/[projectId]/estimate ────────────────────────────────────
// Returns all estimates for the project with their items, plus the most recent
// as currentEstimate.

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: estimates, error } = await supabase
    .from('estimates')
    .select(
      `id, title, status, work_type,
       subtotal, tax_gst, tax_qst, total,
       markup_percent, labor_cost, material_cost, equipment_cost,
       overhead_cost, discount_amount, notes, valid_until,
       sent_at, accepted_at, locale, created_at, updated_at,
       items:estimate_items(
         id, sort_order, category, description, quantity, unit,
         unit_price, total, is_optional, notes, created_at
       )`
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const list = estimates ?? []
  const currentEstimate = list.length > 0 ? list[0] : null

  return NextResponse.json({ estimates: list, currentEstimate })
}

// ── POST /api/projects/[projectId]/estimate ───────────────────────────────────
// Creates a new estimate with its line items.
//
// Body shape:
// {
//   title?: string
//   work_type: string
//   items: EstimateItem[]
//   subtotal: number
//   tax_gst: number
//   tax_qst: number
//   total: number
//   markup_percent: number
//   labor_cost: number
//   material_cost: number
//   notes?: string
// }

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const user = auth.user!

  let body: {
    title?: string
    work_type?: string
    items?: Array<{
      sort_order?: number
      category?: string
      description: string
      quantity?: number
      unit?: string
      unit_price?: number
      is_optional?: boolean
      notes?: string
    }>
    subtotal?: number
    tax_gst?: number
    tax_qst?: number
    total?: number
    markup_percent?: number
    labor_cost?: number
    material_cost?: number
    notes?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide' }, { status: 400 })
  }

  const workTypeAllowed = [
    'painting', 'roofing', 'siding', 'windows', 'doors',
    'inspection', 'insurance', 'cleaning', 'repair', 'other',
  ]
  if (body.work_type && !workTypeAllowed.includes(body.work_type)) {
    return NextResponse.json({ error: 'work_type invalide' }, { status: 422 })
  }

  // Create estimate record
  const { data: estimate, error: estimateError } = await supabase
    .from('estimates')
    .insert({
      project_id:      projectId,
      created_by:      user.id,
      title:           body.title ?? null,
      status:          'draft',
      work_type:       body.work_type ?? 'other',
      subtotal:        body.subtotal ?? 0,
      tax_gst:         body.tax_gst ?? 0,
      tax_qst:         body.tax_qst ?? 0,
      total:           body.total ?? 0,
      markup_percent:  body.markup_percent ?? 0,
      labor_cost:      body.labor_cost ?? 0,
      material_cost:   body.material_cost ?? 0,
      notes:           body.notes ?? null,
    })
    .select()
    .single()

  if (estimateError || !estimate) {
    return NextResponse.json(
      { error: estimateError?.message ?? 'Erreur création estimation' },
      { status: 500 }
    )
  }

  // Insert line items
  const items = body.items ?? []
  let insertedItems: unknown[] = []

  if (items.length > 0) {
    const categoryMap: Record<string, string> = {
      labor: 'labor', material: 'material', equipment: 'equipment',
      overhead: 'overhead', other: 'other',
      travail: 'labor', matériau: 'material', équipement: 'equipment', autre: 'other',
    }
    const unitMap: Record<string, string> = {
      sqft: 'sqft', sqm: 'sqm', lf: 'lf', each: 'each',
      hour: 'hour', day: 'day', lot: 'lot',
      'pi²': 'sqft', 'm²': 'sqm', pi: 'lf',
      unité: 'each', heure: 'hour', jour: 'day',
    }

    const rows = items.map((item, idx) => ({
      estimate_id:  estimate.id,
      sort_order:   item.sort_order ?? idx,
      category:     categoryMap[item.category ?? 'other'] ?? 'other',
      description:  item.description || '—',
      quantity:     item.quantity ?? 1,
      unit:         unitMap[item.unit ?? 'each'] ?? 'each',
      unit_price:   item.unit_price ?? 0,
      is_optional:  item.is_optional ?? false,
      notes:        item.notes ?? null,
    }))

    const { data: itemsData, error: itemsError } = await supabase
      .from('estimate_items')
      .insert(rows)
      .select()

    if (itemsError) {
      // Non-fatal: estimate was created, items failed — log and continue
      console.error('estimate_items insert error:', itemsError.message)
    } else {
      insertedItems = itemsData ?? []
    }
  }

  return NextResponse.json(
    { estimate: { ...estimate, items: insertedItems } },
    { status: 201 }
  )
}

// ── PATCH /api/projects/[projectId]/estimate ──────────────────────────────────
// Updates the most recent draft estimate's status or replaces its items.
//
// Body shape:
// {
//   estimateId?: string      // if omitted, targets the latest draft
//   status?: string
//   items?: EstimateItem[]   // if provided, replaces all items
//   notes?: string
//   title?: string
// }

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const { projectId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId, true)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: {
    estimateId?: string
    status?: string
    items?: Array<{
      sort_order?: number
      category?: string
      description: string
      quantity?: number
      unit?: string
      unit_price?: number
      is_optional?: boolean
      notes?: string
    }>
    notes?: string
    title?: string
    subtotal?: number
    tax_gst?: number
    tax_qst?: number
    total?: number
    markup_percent?: number
    labor_cost?: number
    material_cost?: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide' }, { status: 400 })
  }

  // Resolve which estimate to update
  let estimateId = body.estimateId

  if (!estimateId) {
    const { data: latest } = await supabase
      .from('estimates')
      .select('id')
      .eq('project_id', projectId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!latest) {
      return NextResponse.json({ error: 'Aucune estimation brouillon trouvée' }, { status: 404 })
    }
    estimateId = latest.id
  }

  // Build update payload
  const statusAllowed = ['draft', 'sent', 'accepted', 'rejected', 'expired']
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.status && statusAllowed.includes(body.status)) {
    updatePayload.status = body.status
    if (body.status === 'sent')     updatePayload.sent_at = new Date().toISOString()
    if (body.status === 'accepted') updatePayload.accepted_at = new Date().toISOString()
  }
  if (body.title !== undefined)         updatePayload.title = body.title
  if (body.notes !== undefined)         updatePayload.notes = body.notes
  if (body.subtotal !== undefined)      updatePayload.subtotal = body.subtotal
  if (body.tax_gst !== undefined)       updatePayload.tax_gst = body.tax_gst
  if (body.tax_qst !== undefined)       updatePayload.tax_qst = body.tax_qst
  if (body.total !== undefined)         updatePayload.total = body.total
  if (body.markup_percent !== undefined) updatePayload.markup_percent = body.markup_percent
  if (body.labor_cost !== undefined)    updatePayload.labor_cost = body.labor_cost
  if (body.material_cost !== undefined) updatePayload.material_cost = body.material_cost

  const { data: updated, error: updateError } = await supabase
    .from('estimates')
    .update(updatePayload)
    .eq('id', estimateId)
    .eq('project_id', projectId)
    .select()
    .single()

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? 'Erreur mise à jour estimation' },
      { status: 500 }
    )
  }

  // Replace items if provided
  if (body.items !== undefined) {
    await supabase.from('estimate_items').delete().eq('estimate_id', estimateId)

    if (body.items.length > 0) {
      const categoryMap: Record<string, string> = {
        labor: 'labor', material: 'material', equipment: 'equipment',
        overhead: 'overhead', other: 'other',
        travail: 'labor', matériau: 'material', équipement: 'equipment', autre: 'other',
      }
      const unitMap: Record<string, string> = {
        sqft: 'sqft', sqm: 'sqm', lf: 'lf', each: 'each',
        hour: 'hour', day: 'day', lot: 'lot',
        'pi²': 'sqft', 'm²': 'sqm', pi: 'lf',
        unité: 'each', heure: 'hour', jour: 'day',
      }

      const rows = body.items.map((item, idx) => ({
        estimate_id: estimateId,
        sort_order:  item.sort_order ?? idx,
        category:    categoryMap[item.category ?? 'other'] ?? 'other',
        description: item.description || '—',
        quantity:    item.quantity ?? 1,
        unit:        unitMap[item.unit ?? 'each'] ?? 'each',
        unit_price:  item.unit_price ?? 0,
        is_optional: item.is_optional ?? false,
        notes:       item.notes ?? null,
      }))

      await supabase.from('estimate_items').insert(rows)
    }
  }

  return NextResponse.json({ estimate: updated })
}
