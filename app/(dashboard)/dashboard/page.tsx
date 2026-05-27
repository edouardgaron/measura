// app/(dashboard)/dashboard/page.tsx
import * as React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  FolderOpen,
  Activity,
  CheckCircle2,
  Users,
  Plus,
  ArrowRight,
  Calculator,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils/format'
import type { Project, ProjectStatus } from '@/lib/supabase/types'

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  bgColor: string
}

function StatCard({ title, value, icon: Icon, iconColor, bgColor }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">{title}</p>
            <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
              {value}
            </p>
          </div>
          <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${bgColor}`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Skeleton loading states ──────────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-12" />
                </div>
                <Skeleton className="h-12 w-12 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Recent projects row ──────────────────────────────────────────────────────

function ProjectRow({ project }: { project: Project }) {
  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {project.title}
        </p>
        <p className="text-xs text-neutral-500 mt-0.5">
          {project.address_city
            ? `${project.address_city}${project.address_province ? `, ${project.address_province}` : ''}`
            : 'Adresse non spécifiée'}{' '}
          · {formatDate(project.created_at)}
        </p>
      </div>
      <div className="flex items-center gap-3 ml-4 shrink-0">
        <StatusBadge status={project.status} />
        <ArrowRight className="h-4 w-4 text-neutral-300 group-hover:text-blue-500 transition-colors" />
      </div>
    </Link>
  )
}

// ─── Main content (async) ─────────────────────────────────────────────────────

async function DashboardContent() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch counts by status
  const statuses: ProjectStatus[] = ['draft', 'photos_pending', 'measuring', 'review', 'completed', 'archived']

  const { data: allProjects } = await supabase
    .from('projects')
    .select('id, status')
    .eq('owner_id', user.id)

  const counts = (allProjects ?? []).reduce<Record<string, number>>(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1
      return acc
    },
    {}
  )

  const totalProjects = allProjects?.length ?? 0
  const activeProjects = statuses
    .filter((s) => s !== 'completed' && s !== 'archived' && s !== 'draft')
    .reduce((sum, s) => sum + (counts[s] ?? 0), 0)
  const completedProjects = counts['completed'] ?? 0

  // Fetch distinct client count (members with role 'client')
  const { count: clientCount } = await supabase
    .from('project_members')
    .select('email', { count: 'exact', head: true })
    .eq('role', 'client')
    .in(
      'project_id',
      (allProjects ?? []).map((p) => p.id)
    )

  // Fetch estimates sent or accepted
  const { count: estimatesCount } = await supabase
    .from('estimates')
    .select('id', { count: 'exact', head: true })
    .in('project_id', (allProjects ?? []).map((p) => p.id))
    .in('status', ['sent', 'accepted'])

  // Fetch last 5 projects with full data
  const { data: recentProjects } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(5)

  // Fetch display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .single()

  const displayName =
    profile?.full_name ??
    profile?.company_name ??
    user.user_metadata?.full_name ??
    'là'

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Bienvenue, {displayName} 👋
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Voici un aperçu de vos projets de mesure.
          </p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button size="md" className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Nouveau projet
          </Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          title="Total projets"
          value={totalProjects}
          icon={FolderOpen}
          iconColor="text-blue-600"
          bgColor="bg-blue-50 dark:bg-blue-900/20"
        />
        <StatCard
          title="Projets actifs"
          value={activeProjects}
          icon={Activity}
          iconColor="text-amber-600"
          bgColor="bg-amber-50 dark:bg-amber-900/20"
        />
        <StatCard
          title="Terminés"
          value={completedProjects}
          icon={CheckCircle2}
          iconColor="text-green-600"
          bgColor="bg-green-50 dark:bg-green-900/20"
        />
        <StatCard
          title="Clients"
          value={clientCount ?? 0}
          icon={Users}
          iconColor="text-purple-600"
          bgColor="bg-purple-50 dark:bg-purple-900/20"
        />
        <StatCard
          title="Estimations envoyées"
          value={estimatesCount ?? 0}
          icon={Calculator}
          iconColor="text-orange-600"
          bgColor="bg-orange-50 dark:bg-orange-900/20"
        />
      </div>

      {/* Recent projects */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>Projets récents</CardTitle>
            <Link
              href="/dashboard/projects"
              className="text-sm text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              Voir tous
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentProjects && recentProjects.length > 0 ? (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {recentProjects.map((project) => (
                <ProjectRow key={project.id} project={project as Project} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="h-10 w-10 text-neutral-300 mb-3" />
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Aucun projet pour l'instant
              </p>
              <p className="text-xs text-neutral-500 mt-1 mb-4">
                Créez votre premier projet pour commencer.
              </p>
              <Link href="/dashboard/projects/new">
                <Button size="sm" className="gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  Nouveau projet
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <React.Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </React.Suspense>
  )
}
