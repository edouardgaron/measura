// lib/messaging/reminders.ts
// ============================================================
// Relances de paiement de factures (ChantierPro 360).
//  - sendInvoiceReminder : envoie une relance pour UNE facture (manuel/auto)
//  - processInvoiceReminders : balaie les factures en souffrance (cron)
//  - markOverdueInvoices : passe les factures échues non payées en 'overdue'
// Anti-spam : last_reminder_at + reminder_count (migration 018).
// ============================================================
import type { createClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/messaging/send'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

const CAD = (n: number) => (n || 0).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

const REMINDER_COOLDOWN_DAYS = 4   // délai mini entre deux relances d'une même facture
const MAX_REMINDERS = 4            // nb max de relances automatiques

interface InvoiceRow {
  id: string
  invoice_number: string
  status: string
  total: number
  amount_paid: number
  due_date: string | null
  issue_date: string
  client_name: string | null
  client_email: string | null
  share_token: string
  project_id: string
  created_by: string | null
  reminder_count: number | null
}

const INVOICE_COLS =
  'id, invoice_number, status, total, amount_paid, due_date, issue_date, client_name, client_email, share_token, project_id, created_by, reminder_count'

function reminderEmail(inv: InvoiceRow, companyName: string): { subject: string; body: string } {
  const balance = Math.max(Number(inv.total || 0) - Number(inv.amount_paid || 0), 0)
  const link = APP_URL() ? `${APP_URL()}/invoice/${inv.share_token}` : null
  const overdue = inv.due_date ? inv.due_date < new Date().toISOString().slice(0, 10) : false
  const subject = `${overdue ? 'Rappel — ' : ''}Facture ${inv.invoice_number} · solde ${CAD(balance)}`
  const lines = [
    `Bonjour${inv.client_name ? ` ${inv.client_name}` : ''},`,
    '',
    overdue
      ? `La facture ${inv.invoice_number} est échue. Le solde à payer est de ${CAD(balance)}.`
      : `Petit rappel concernant la facture ${inv.invoice_number}. Le solde à payer est de ${CAD(balance)}.`,
    inv.due_date ? `Date d'échéance : ${inv.due_date}.` : '',
    link ? `` : '',
    link ? `Consulter et payer la facture : ${link}` : 'Merci de procéder au paiement à votre meilleure convenance.',
    '',
    `Merci,`,
    companyName,
  ].filter((l) => l !== null)
  return { subject, body: lines.join('\n') }
}

/** Envoie une relance pour une facture donnée. Met à jour le compteur. */
export async function sendInvoiceReminder(
  supabase: SupabaseServer,
  invoiceId: string,
  opts: { companyName?: string } = {}
): Promise<{ ok: boolean; error?: string }> {
  const { data: inv } = await supabase.from('invoices').select(INVOICE_COLS).eq('id', invoiceId).single()
  if (!inv) return { ok: false, error: 'Facture introuvable' }
  const row = inv as unknown as InvoiceRow
  if (!row.client_email) return { ok: false, error: 'Aucun courriel client sur la facture.' }
  if (['paid', 'cancelled', 'draft'].includes(row.status)) return { ok: false, error: 'Facture non relançable (payée/brouillon/annulée).' }

  const companyName = opts.companyName ?? (await companyNameForProject(supabase, row.project_id))
  const { subject, body } = reminderEmail(row, companyName)
  const res = await sendMessage(supabase, {
    channel: 'email', to: row.client_email, subject, body,
    ownerId: row.created_by, projectId: row.project_id, isAutomated: true,
  })
  if (res.ok) {
    await supabase.from('invoices').update({
      last_reminder_at: new Date().toISOString(),
      reminder_count: (row.reminder_count ?? 0) + 1,
    }).eq('id', row.id)
  }
  return { ok: res.ok, error: res.error }
}

/** Passe en 'overdue' les factures échues non entièrement payées. */
export async function markOverdueInvoices(supabase: SupabaseServer): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('invoices')
    .update({ status: 'overdue' })
    .lt('due_date', today)
    .in('status', ['sent', 'partial'])
    .select('id')
  return (data ?? []).length
}

/** Balaie les factures en souffrance et envoie les relances dues (cron). */
export async function processInvoiceReminders(
  supabase: SupabaseServer,
  limit = 100
): Promise<{ overdue: number; reminded: number; failed: number }> {
  const overdue = await markOverdueInvoices(supabase)

  const today = new Date().toISOString().slice(0, 10)
  const cooldownIso = new Date(Date.now() - REMINDER_COOLDOWN_DAYS * 86_400_000).toISOString()

  // Candidates : envoyées/partielles/en retard, avec courriel, échéance passée.
  const { data: rows } = await supabase
    .from('invoices')
    .select(INVOICE_COLS + ', last_reminder_at')
    .in('status', ['sent', 'partial', 'overdue'])
    .not('client_email', 'is', null)
    .lt('due_date', today)
    .order('due_date', { ascending: true })
    .limit(limit)

  let reminded = 0, failed = 0
  for (const r of (rows ?? []) as unknown as (InvoiceRow & { last_reminder_at: string | null })[]) {
    const balance = Number(r.total || 0) - Number(r.amount_paid || 0)
    if (balance <= 0) continue
    if ((r.reminder_count ?? 0) >= MAX_REMINDERS) continue
    if (r.last_reminder_at && r.last_reminder_at > cooldownIso) continue // cooldown
    const res = await sendInvoiceReminder(supabase, r.id)
    if (res.ok) reminded++; else failed++
  }
  return { overdue, reminded, failed }
}

// ── Propositions (soumissions) ───────────────────────────────────────────────

interface ProposalRow {
  id: string
  share_token: string
  title: string | null
  message: string | null
  client_name: string | null
  client_email: string | null
  valid_until: string | null
  status: string
  project_id: string
  created_by: string | null
  reminder_count: number | null
}
const PROPOSAL_COLS =
  'id, share_token, title, message, client_name, client_email, valid_until, status, project_id, created_by, reminder_count'

/** Envoie une proposition (ou sa relance) par courriel au client. */
export async function sendProposalEmail(
  supabase: SupabaseServer,
  proposalId: string,
  opts: { isReminder?: boolean; companyName?: string } = {}
): Promise<{ ok: boolean; error?: string }> {
  const { data: p } = await supabase.from('proposals').select(PROPOSAL_COLS).eq('id', proposalId).single()
  if (!p) return { ok: false, error: 'Proposition introuvable' }
  const row = p as unknown as ProposalRow
  if (!row.client_email) return { ok: false, error: 'Aucun courriel client sur la proposition.' }

  const companyName = opts.companyName ?? (await companyNameForProject(supabase, row.project_id))
  const link = APP_URL() ? `${APP_URL()}/proposal/${row.share_token}` : null
  const title = row.title || 'Proposition de services'
  const subject = opts.isReminder ? `Rappel — ${title}` : title
  const body = [
    `Bonjour${row.client_name ? ` ${row.client_name}` : ''},`,
    '',
    opts.isReminder
      ? `Petit rappel : votre proposition « ${title} » est en attente de votre réponse.`
      : (row.message || `Voici notre proposition « ${title} ».`),
    row.valid_until ? `Cette proposition est valide jusqu'au ${row.valid_until}.` : '',
    '',
    link ? `Consulter, choisir une option et signer : ${link}` : 'Veuillez nous revenir à votre meilleure convenance.',
    '',
    'Merci,',
    companyName,
  ].filter(Boolean).join('\n')

  const res = await sendMessage(supabase, {
    channel: 'email', to: row.client_email, subject, body,
    ownerId: row.created_by, projectId: row.project_id, isAutomated: !!opts.isReminder,
  })
  if (res.ok && opts.isReminder) {
    await supabase.from('proposals').update({
      last_reminder_at: new Date().toISOString(),
      reminder_count: (row.reminder_count ?? 0) + 1,
    }).eq('id', row.id)
  }
  return { ok: res.ok, error: res.error }
}

/** Relance les soumissions envoyées/vues non signées (cron). */
export async function processProposalReminders(
  supabase: SupabaseServer,
  limit = 100
): Promise<{ reminded: number; failed: number }> {
  const sinceIso = new Date(Date.now() - 3 * 86_400_000).toISOString() // envoyée il y a ≥ 3 j
  const cooldownIso = new Date(Date.now() - REMINDER_COOLDOWN_DAYS * 86_400_000).toISOString()

  const { data: rows } = await supabase
    .from('proposals')
    .select(PROPOSAL_COLS + ', sent_at, last_reminder_at')
    .in('status', ['sent', 'viewed'])
    .not('client_email', 'is', null)
    .lt('sent_at', sinceIso)
    .order('sent_at', { ascending: true })
    .limit(limit)

  let reminded = 0, failed = 0
  for (const r of (rows ?? []) as unknown as (ProposalRow & { last_reminder_at: string | null })[]) {
    if ((r.reminder_count ?? 0) >= MAX_REMINDERS) continue
    if (r.last_reminder_at && r.last_reminder_at > cooldownIso) continue
    const res = await sendProposalEmail(supabase, r.id, { isReminder: true })
    if (res.ok) reminded++; else failed++
  }
  return { reminded, failed }
}

async function companyNameForProject(supabase: SupabaseServer, projectId: string): Promise<string> {
  try {
    const { data: p } = await supabase.from('projects').select('owner_id').eq('id', projectId).single()
    if (p?.owner_id) {
      const { data: prof } = await supabase.from('profiles').select('company_name, full_name').eq('id', p.owner_id).single()
      return prof?.company_name ?? prof?.full_name ?? 'ChantierPro 360'
    }
  } catch { /* ignore */ }
  return 'ChantierPro 360'
}
