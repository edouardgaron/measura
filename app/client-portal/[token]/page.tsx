// app/client-portal/[token]/page.tsx
import Link from 'next/link'
import {
  Camera, ArrowRight, MapPin, AlertCircle, CheckCircle2, Circle,
  FileSignature, Receipt, ImageIcon,
} from 'lucide-react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ProjectStatus } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ token: string }>
}

const PROGRESS_STEPS: { key: ProjectStatus; label: string }[] = [
  { key: 'draft', label: 'Création' },
  { key: 'photos_pending', label: 'Photos' },
  { key: 'measuring', label: 'Mesures' },
  { key: 'review', label: 'Révision' },
  { key: 'completed', label: 'Terminé' },
]
const money = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n ?? 0)

export default async function ClientPortalPage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('project_members')
    .select('id, email, project_id, project:projects(title, address_line1, address_city, address_province, status)')
    .eq('invite_token', token)
    .eq('role', 'client')
    .single()

  if (!member) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h1 className="text-xl font-bold text-gray-900">Lien invalide</h1>
          <p className="mt-2 text-sm text-gray-500">Ce lien est invalide ou a expiré. Contactez votre entrepreneur.</p>
        </div>
      </div>
    )
  }

  const projectRaw = Array.isArray(member.project) ? member.project[0] : member.project
  const project = projectRaw as unknown as { title: string; address_line1: string | null; address_city: string | null; address_province: string | null; status: ProjectStatus } | null
  const projectId = member.project_id as string
  const addressParts = [project?.address_line1, project?.address_city, project?.address_province].filter(Boolean)

  // Enrichissement via client admin (portail public, scopé au projet validé)
  const admin = await createAdminClient()
  const [photosRes, proposalRes, invoiceRes] = await Promise.all([
    admin.from('photos').select('id, storage_path').eq('project_id', projectId).order('sort_order', { ascending: true }).limit(8),
    admin.from('proposals').select('share_token, status, title').eq('project_id', projectId).in('status', ['sent', 'viewed', 'accepted']).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('invoices').select('share_token, status, total, amount_paid, invoice_number').eq('project_id', projectId).in('status', ['sent', 'partial', 'paid', 'overdue']).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const photos = (photosRes.data ?? []).map((p) => admin.storage.from('photos').getPublicUrl(p.storage_path).data.publicUrl)
  const proposal = proposalRes.data as { share_token: string; status: string; title: string | null } | null
  const invoice = invoiceRes.data as { share_token: string; status: string; total: number; amount_paid: number; invoice_number: string } | null

  const currentStepIdx = Math.max(0, PROGRESS_STEPS.findIndex((s) => s.key === project?.status))
  const isCompleted = project?.status === 'completed' || project?.status === 'archived'

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-50">
      <header className="border-b border-white/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600"><Camera className="h-4 w-4 text-white" /></div>
            <span className="font-bold text-gray-900">Measura</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
        {/* Projet */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Votre projet</h1>
          <div className="mt-4 rounded-xl bg-blue-50 p-4">
            <p className="font-semibold text-blue-900">{project?.title}</p>
            {addressParts.length > 0 && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-blue-700"><MapPin className="h-3.5 w-3.5 shrink-0" />{addressParts.join(', ')}</p>
            )}
          </div>
        </div>

        {/* Progression */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Suivi du projet</h2>
          <ol className="space-y-3">
            {PROGRESS_STEPS.map((step, i) => {
              const done = isCompleted || i < currentStepIdx
              const current = !isCompleted && i === currentStepIdx
              return (
                <li key={step.key} className="flex items-center gap-3">
                  {done ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : current ? <Circle className="h-5 w-5 fill-blue-100 text-blue-500" /> : <Circle className="h-5 w-5 text-gray-300" />}
                  <span className={`text-sm ${done ? 'text-gray-500 line-through' : current ? 'font-semibold text-blue-700' : 'text-gray-400'}`}>{step.label}</span>
                </li>
              )
            })}
          </ol>
        </div>

        {/* Proposition à signer */}
        {proposal && (
          <Link href={`/proposal/${proposal.share_token}`} className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm hover:border-indigo-400">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100"><FileSignature className="h-5 w-5 text-indigo-600" /></div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{proposal.status === 'accepted' ? 'Proposition acceptée' : 'Proposition à examiner'}</p>
              <p className="text-sm text-gray-500">{proposal.title ?? 'Voir la soumission'}{proposal.status !== 'accepted' ? ' — cliquez pour signer' : ''}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400" />
          </Link>
        )}

        {/* Facture à payer */}
        {invoice && (
          <Link href={`/invoice/${invoice.share_token}`} className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm hover:border-emerald-400">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100"><Receipt className="h-5 w-5 text-emerald-600" /></div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{invoice.status === 'paid' ? 'Facture payée' : 'Facture à payer'}</p>
              <p className="text-sm text-gray-500">{invoice.invoice_number} · {invoice.status === 'paid' ? money(invoice.total) : `Solde ${money(invoice.total - invoice.amount_paid)}`}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400" />
          </Link>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900"><ImageIcon className="h-4 w-4 text-gray-400" /> Photos du projet</h2>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
              ))}
            </div>
          </div>
        )}

        {/* Déposer photos */}
        <Link href={`/client-portal/${token}/upload`} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95">
          <Camera className="h-5 w-5" /> Déposer des photos <ArrowRight className="h-5 w-5" />
        </Link>

        <p className="pb-8 text-center text-xs text-gray-400">Vos données sont sécurisées et utilisées uniquement pour ce projet.</p>
      </main>
    </div>
  )
}
