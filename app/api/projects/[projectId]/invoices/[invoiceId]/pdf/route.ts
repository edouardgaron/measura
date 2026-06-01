// app/api/projects/[projectId]/invoices/[invoiceId]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/api/access'
import InvoiceTemplate from '@/components/invoice/InvoiceTemplate'
import type { Invoice, InvoiceItem } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ projectId: string; invoiceId: string }> }

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { projectId, invoiceId } = await params
  const supabase = await createClient()

  const auth = await requireProjectAccess(supabase, projectId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(id, sort_order, description, quantity, unit, unit_price, total)')
    .eq('id', invoiceId)
    .eq('project_id', projectId)
    .single()

  if (error || !invoice) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  // Entête compagnie
  const { data: project } = await supabase.from('projects').select('owner_id').eq('id', projectId).single()
  let companyName: string | undefined
  let companyLogo: string | undefined
  let companyPhone: string | undefined
  if (project) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, company_name, avatar_url, phone')
      .eq('id', project.owner_id)
      .single()
    companyName = prof?.company_name ?? prof?.full_name ?? undefined
    companyLogo = prof?.avatar_url ?? undefined
    companyPhone = prof?.phone ?? undefined
  }

  const items = ((invoice.items as InvoiceItem[]) ?? []).sort((a, b) => a.sort_order - b.sort_order)

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      React.createElement(InvoiceTemplate, {
        invoice: invoice as unknown as Invoice,
        items,
        companyName,
        companyLogo,
        companyPhone,
      }) as React.ReactElement<any>
    )
  } catch (e) {
    console.error('Invoice PDF render error:', e)
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF' }, { status: 500 })
  }

  const adminClient = await createAdminClient()
  const fileName = `invoices/${projectId}/${invoice.invoice_number}-${Date.now()}.pdf`
  const { error: storageError } = await adminClient.storage
    .from('reports')
    .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: false })

  if (!storageError) {
    await supabase.from('invoices').update({ pdf_storage_path: fileName, updated_at: new Date().toISOString() }).eq('id', invoiceId)
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="facture-${invoice.invoice_number}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    },
  })
}
