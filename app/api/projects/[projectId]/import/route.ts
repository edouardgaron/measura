// app/api/projects/[projectId]/import/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ projectId: string }> }

type FacadeSide = 'front' | 'back' | 'left' | 'right' | 'roof' | 'other'
type SurfaceType = 'wall' | 'roof' | 'gable' | 'soffit' | 'fascia' | 'trim' | 'door' | 'window' | 'garage'

interface HoverSurface {
  facade_side: FacadeSide
  surface_type: SurfaceType
  label: string
  gross_area: number
  pitch?: number
}

function toNum(s: string): number {
  return parseFloat(s.replace(/,/g, ''))
}

function parseHoverText(text: string): HoverSurface[] {
  const results: HoverSurface[] = []
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  let section = ''
  let roofPitch: number | undefined

  for (const line of lines) {
    // Section detection
    if (/ROOF\s+SUMMARY/i.test(line)) { section = 'roof'; continue }
    if (/SIDING\s+PER\s+ELEVATION/i.test(line)) { section = 'siding'; continue }
    if (/^SOFFIT$/i.test(line)) { section = 'soffit'; continue }
    if (/^(WINDOWS?|OPENINGS?|FASCIA|TRIM|SUMMARY|ADDITIONAL\s+ITEMS?)$/i.test(line)) {
      section = ''
      continue
    }

    if (section === 'roof') {
      // Capture pitch (e.g. "6 / 12" or "6/12 pitch")
      const pitchMatch = line.match(/(\d+)\s*\/\s*12/)
      if (pitchMatch && !roofPitch) roofPitch = parseInt(pitchMatch[1])

      // Capture roof total: "Roof Facets  1,234  ft²" or "Total  1,234  ft²"
      const areaMatch = line.match(
        /(?:Roof\s+Facets?|Total\b)[^0-9]*([0-9,]+(?:\.\d+)?)\s*(?:ft[²2]|sq)/i
      )
      if (areaMatch && !results.find((r) => r.surface_type === 'roof')) {
        results.push({
          facade_side: 'roof',
          surface_type: 'roof',
          label: 'Toiture (Hover)',
          gross_area: toNum(areaMatch[1]),
          pitch: roofPitch,
        })
      }
    }

    if (section === 'siding') {
      const elevMap: Record<string, FacadeSide> = {
        front: 'front', avant: 'front',
        back: 'back', rear: 'back', arrière: 'back',
        left: 'left', gauche: 'left',
        right: 'right', droite: 'right',
      }
      // "Front   234   ft²" or "Front Total  234"
      const m = line.match(
        /^(Front|Back|Left|Right|Avant|Arrière|Gauche|Droite)(?:\s+Total)?\s+([0-9,]+(?:\.\d+)?)/i
      )
      if (m) {
        const side = elevMap[m[1].toLowerCase()]
        if (side) {
          results.push({
            facade_side: side,
            surface_type: 'wall',
            label: `${m[1]} (Hover)`,
            gross_area: toNum(m[2]),
          })
        }
      }
    }

    if (section === 'soffit') {
      // "Totals   123  ft²" or "Total   123  sq ft"
      const m = line.match(/^Totals?\b[^0-9]*([0-9,]+(?:\.\d+)?)\s*(?:ft[²2]|sq)/i)
      if (m) {
        results.push({
          facade_side: 'other',
          surface_type: 'soffit',
          label: 'Soffite (Hover)',
          gross_area: toNum(m[1]),
        })
        section = ''
      }
    }
  }

  // Backfill pitch onto roof surface if it was found after the area line
  const roofSurf = results.find((r) => r.surface_type === 'roof')
  if (roofSurf && roofPitch && !roofSurf.pitch) {
    roofSurf.pitch = roofPitch
  }

  return results
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role === 'client') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Données de formulaire invalides' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Fichier PDF manquant' }, { status: 422 })
  }

  let pdfText: string
  try {
    // Dynamic import avoids webpack bundling issues with pdf-parse's test file
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfModule = (await import('pdf-parse')) as any
    const pdfParse: (buf: Buffer) => Promise<{ text: string }> = pdfModule.default ?? pdfModule
    const buffer = Buffer.from(await file.arrayBuffer())
    const data = await pdfParse(buffer)
    pdfText = data.text
  } catch (err) {
    console.error('PDF parse error:', err)
    return NextResponse.json({ error: 'Impossible de lire le fichier PDF' }, { status: 422 })
  }

  const parsed = parseHoverText(pdfText)

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "Aucune mesure trouvée. Assurez-vous qu'il s'agit d'un rapport Hover PDF." },
      { status: 422 }
    )
  }

  const created: { label: string; area: number; unit: string }[] = []

  for (const surf of parsed) {
    const { error: insertError } = await supabase
      .from('surface_calculations')
      .insert({
        project_id: projectId,
        created_by: user.id,
        facade_side: surf.facade_side,
        surface_type: surf.surface_type,
        label: surf.label,
        gross_area: surf.gross_area,
        opening_area: 0,
        pitch: surf.pitch ?? null,
        unit: 'ft',
        loss_factor: 0.10,
        notes: 'Importé depuis rapport Hover PDF',
      })

    if (!insertError) {
      created.push({ label: surf.label, area: surf.gross_area, unit: 'ft²' })
    }
  }

  return NextResponse.json(
    {
      imported: created.length,
      surfaces: created,
      message: `${created.length} surface(s) importée(s) depuis le PDF Hover.`,
    },
    { status: created.length > 0 ? 201 : 422 }
  )
}
