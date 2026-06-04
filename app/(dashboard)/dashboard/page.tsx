// app/(dashboard)/dashboard/page.tsx
// ============================================================
// Tableau de bord KPI — ChantierPro 360.
// Vue d'ensemble opérationnelle + financière : chantiers, soumissions,
// conversion, revenus encaissés du mois, factures impayées/en retard,
// valeur signée. Owner-scopé (cohérent avec le reste de l'app).
// ============================================================
import * as React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  FolderOpen, Activity, CheckCircle2, Plus, ArrowRight, Calculator,
  DollarSign, Receipt, TrendingUp, AlertTriangle, FileSignature, Wallet,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils/format'
import { APP_NAME } from '@/lib/brand'
import { getLocale } from '@/lib/i18n/server'
import { makeT } from '@/lib/i18n'
import type { Project } from '@/lib/supabase/types'

const CAD = (n: number) =>
  (n || 0).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })

// ─── KPI card ───────────────────────────────────────────────────────────────
interface KpiProps {
  title: string
  value: string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  bgColor: string
  href?: string
}
function Kpi({ title, value, sub, icon: Icon, iconColor, bgColor, href }: KpiProps) {
  const inner = (
    <Card className={href ? 'transition-colors hover:border-neutral-300 dark:hover:border-neutral-700' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{title}</p>
            <p className="mt-1 truncate text-2xl font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bgColor}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-7 w-16" /></div>
              <Skeleton className="h-11 w-11 rounded-xl" />
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  )
}

function ProjectRow({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="group flex items-center justify-between rounded-lg px-2 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{project.title}</p>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          {project.address_city ? `${project.address_city}${project.address_province ? `, ${project.address_province}` : ''}` : 'Adresse non spécifiée'} · {formatDate(project.created_at)}
        </p>
      </div>
      <div className="ml-4 flex shrink-0 items-center gap-3">
        <StatusBadge status={project.status} />
        <ArrowRight className="h-4 w-4 text-neutral-300 transition-colors group-hover:text-neutral-900 dark:text-neutral-600 dark:group-hover:text-neutral-100" />
      </div>
    </Link>
  )
}

async function DashboardContent() {
  const supabase = await createClient()
  const T = makeT(await getLocale())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: allProjects } = await supabase
    .from('projects').select('id, status').eq('owner_id', user.id)
  const projectIds = (allProjects ?? []).map((p) => p.id)
  const counts = (allProjects ?? []).reduce<Record<string, number>>((a, p) => { a[p.status] = (a[p.status] ?? 0) + 1; return a }, {})
  const totalProjects = projectIds.length
  const activeProjects = (counts['photos_pending'] ?? 0) + (counts['measuring'] ?? 0) + (counts['review'] ?? 0)
  const completedProjects = counts['completed'] ?? 0

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const monthIso = monthStart.toISOString()
  const todayIso = new Date().toISOString().slice(0, 10)

  // Requêtes parallèles (vides si aucun projet)
  const empty = { data: [] as Record<string, unknown>[] }
  const [estimatesRes, invoicesRes, paymentsRes, recentRes, profileRes] = projectIds.length
    ? await Promise.all([
        supabase.from('estimates').select('status, total, accepted_at, created_at').in('project_id', projectIds),
        supabase.from('invoices').select('status, total, amount_paid, due_date').in('project_id', projectIds),
        supabase.from('payments').select('amount, paid_at, status').in('project_id', projectIds),
        supabase.from('projects').select('*').eq('owner_id', user.id).order('updated_at', { ascending: false }).limit(6),
        supabase.from('profiles').select('full_name, company_name').eq('id', user.id).single(),
      ])
    : [empty, empty, empty, empty, { data: null }]

  const estimates = (estimatesRes.data ?? []) as { status: string; total: number; accepted_at: string | null; created_at: string }[]
  const invoices = (invoicesRes.data ?? []) as { status: string; total: number; amount_paid: number; due_date: string | null }[]
  const payments = (paymentsRes.data ?? []) as { amount: number; paid_at: string | null; status: string }[]

  // Soumissions / conversion
  const sentLike = new Set(['sent', 'accepted', 'refused', 'expired'])
  const estimatesSent = estimates.filter((e) => sentLike.has(e.status)).length
  const estimatesAccepted = estimates.filter((e) => e.status === 'accepted').length
  const conversion = estimatesSent > 0 ? Math.round((estimatesAccepted / estimatesSent) * 100) : 0
  const signedThisMonth = estimates
    .filter((e) => e.status === 'accepted' && (e.accepted_at ?? e.created_at) >= monthIso)
    .reduce((s, e) => s + Number(e.total || 0), 0)

  // Factures
  const openInv = invoices.filter((i) => !['paid', 'draft', 'cancelled'].includes(i.status))
  const unpaidTotal = openInv.reduce((s, i) => s + Math.max(Number(i.total || 0) - Number(i.amount_paid || 0), 0), 0)
  const overdue = openInv.filter((i) => i.due_date && i.due_date < todayIso)
  const overdueTotal = overdue.reduce((s, i) => s + Math.max(Number(i.total || 0) - Number(i.amount_paid || 0), 0), 0)

  // Revenus encaissés (mois) — paiements reçus ce mois-ci
  const revenueMonth = payments
    .filter((p) => p.paid_at && p.paid_at >= monthIso && !['failed', 'cancelled', 'refunded'].includes(p.status))
    .reduce((s, p) => s + Number(p.amount || 0), 0)
  const collectedAll = payments
    .filter((p) => p.paid_at && !['failed', 'cancelled', 'refunded'].includes(p.status))
    .reduce((s, p) => s + Number(p.amount || 0), 0)

  const profile = profileRes.data as { full_name?: string; company_name?: string } | null
  const displayName = profile?.full_name ?? profile?.company_name ?? user.user_metadata?.full_name ?? 'là'
  const recentProjects = (recentRes.data ?? []) as Project[]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{T('dash.welcome')}, {displayName} 👋</h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{T('dash.subtitle', { app: APP_NAME })}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/clients"><Button variant="outline" size="md" className="gap-2"><FileSignature className="h-4 w-4" />{T('common.newClient')}</Button></Link>
          <Link href="/projects/new"><Button size="md" className="gap-2"><Plus className="h-4 w-4" />{T('common.newProject')}</Button></Link>
        </div>
      </div>

      {/* Finances */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">{T('dash.finance')}</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi title={T('dash.revenueMonth')} value={CAD(revenueMonth)} sub={T('dash.collectedLife', { v: CAD(collectedAll) })} icon={DollarSign} iconColor="text-emerald-600 dark:text-emerald-400" bgColor="bg-emerald-50 dark:bg-emerald-950/30" />
          <Kpi title={T('dash.signedMonth')} value={CAD(signedThisMonth)} sub={T('dash.acceptedCount', { n: estimatesAccepted })} icon={TrendingUp} iconColor="text-neutral-700 dark:text-neutral-300" bgColor="bg-neutral-100 dark:bg-neutral-800" />
          <Kpi title={T('dash.unpaid')} value={CAD(unpaidTotal)} sub={T('dash.openInvoices', { n: openInv.length })} icon={Receipt} iconColor="text-amber-600 dark:text-amber-400" bgColor="bg-amber-50 dark:bg-amber-950/30" />
          <Kpi title={T('dash.overdue')} value={CAD(overdueTotal)} sub={T('dash.overdueInvoices', { n: overdue.length })} icon={AlertTriangle} iconColor="text-red-600 dark:text-red-400" bgColor="bg-red-50 dark:bg-red-950/30" />
        </div>
      </div>

      {/* Opérations */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">{T('dash.operations')}</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi title={T('dash.activeJobs')} value={String(activeProjects)} sub={T('dash.totalCount', { n: totalProjects })} icon={Activity} iconColor="text-orange-600 dark:text-orange-400" bgColor="bg-orange-50 dark:bg-orange-950/30" href="/projects" />
          <Kpi title={T('dash.completedJobs')} value={String(completedProjects)} icon={CheckCircle2} iconColor="text-emerald-600 dark:text-emerald-400" bgColor="bg-emerald-50 dark:bg-emerald-950/30" />
          <Kpi title={T('dash.estimatesSent')} value={String(estimatesSent)} sub={T('dash.acceptedShort', { n: estimatesAccepted })} icon={Calculator} iconColor="text-violet-600 dark:text-violet-400" bgColor="bg-violet-50 dark:bg-violet-950/30" />
          <Kpi title={T('dash.conversion')} value={`${conversion} %`} sub={T('dash.conversionSub')} icon={Wallet} iconColor="text-neutral-700 dark:text-neutral-300" bgColor="bg-neutral-100 dark:bg-neutral-800" />
        </div>
      </div>

      {/* Recent projects */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>{T('dash.recentProjects')}</CardTitle>
            <Link href="/projects" className="rounded text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-100">{T('common.viewAll')}</Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentProjects.length > 0 ? (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {recentProjects.map((p) => <ProjectRow key={p.id} project={p} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="mb-3 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{T('dash.noProjects')}</p>
              <p className="mb-4 mt-1 text-xs text-neutral-500 dark:text-neutral-400">{T('dash.noProjectsSub')}</p>
              <Link href="/projects/new"><Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />{T('common.newProject')}</Button></Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <React.Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </React.Suspense>
  )
}
