// app/(dashboard)/projects/page.tsx
import * as React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Plus,
  FolderOpen,
  MapPin,
  Calendar,
  MoreHorizontal,
  Eye,
  Pencil,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDate } from '@/lib/utils/format'
import type { Project, ProjectStatus } from '@/lib/supabase/types'

// --- Status filter labels -----------------------------------------------------

const STATUS_LABELS: Record<ProjectStatus | 'all', string> = {
  all: 'Tous',
  draft: 'Brouillon',
  photos_pending: 'Photos requises',
  measuring: 'En mesure',
  review: 'En révision',
  completed: 'Terminé',
  archived: 'Archivé',
}

// --- Building type labels -----------------------------------------------------

const BUILDING_TYPE_LABELS: Record<string, string> = {
  residential: 'Résidentiel',
  commercial: 'Commercial',
  industrial: 'Industriel',
}

// --- Project card -------------------------------------------------------------

function ProjectCard({ project }: { project: Project }) {
  const address = [project.address_city, project.address_province]
    .filter(Boolean)
    .join(', ')

  const buildingType = (project as unknown as { building_type?: string }).building_type

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow duration-200">
      <CardContent className="pt-5 flex flex-col flex-1 gap-3">
        {/* Top row: title + actions menu */}
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/projects/${project.id}`}
            className="flex-1 min-w-0 group"
          >
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
              {project.title}
            </h3>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Options du projet"
                className="shrink-0 rounded p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem asChild>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Eye className="h-4 w-4" />
                  Voir
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`/projects/${project.id}/edit`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Pencil className="h-4 w-4" />
                  Modifier
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Building type badge */}
        {buildingType && (
          <Badge variant="secondary" className="w-fit text-xs">
            {BUILDING_TYPE_LABELS[buildingType] ?? buildingType}
          </Badge>
        )}

        {/* Address */}
        {address && (
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{address}</span>
          </div>
        )}

        {/* Footer: status + date */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <StatusBadge status={project.status} />
          <div className="flex items-center gap-1 text-xs text-neutral-400">
            <Calendar className="h-3 w-3" />
            {formatDate(project.created_at)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Status filter bar (client island) ---------------------------------------
// Since this is a server page, filters are passed via searchParams.

interface FilterBarProps {
  currentStatus: string
  counts: Record<string, number>
}

function FilterBar({ currentStatus, counts }: FilterBarProps) {
  const statuses: Array<ProjectStatus | 'all'> = [
    'all',
    'draft',
    'photos_pending',
    'measuring',
    'review',
    'completed',
    'archived',
  ]

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
      {statuses.map((status) => {
        const count = status === 'all'
          ? Object.values(counts).reduce((a, b) => a + b, 0)
          : (counts[status] ?? 0)
        const isActive = currentStatus === status

        return (
          <Link
            key={status}
            href={status === 'all' ? '/projects' : `/projects?status=${status}`}
            aria-current={isActive ? 'true' : undefined}
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700',
            ].join(' ')}
          >
            {STATUS_LABELS[status]}
            <span
              className={[
                'rounded-full px-1.5 py-0.5 text-xs leading-none',
                isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400',
              ].join(' ')}
            >
              {count}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

// --- Page ---------------------------------------------------------------------

interface ProjectsPageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { status: statusParam } = await searchParams
  const activeStatus = statusParam ?? 'all'

  // Build query
  let query = supabase
    .from('projects')
    .select('*')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false })

  if (activeStatus !== 'all') {
    query = query.eq('status', activeStatus)
  }

  const { data: projects } = await query

  // Count all projects by status (for filter badges)
  const { data: allProjects } = await supabase
    .from('projects')
    .select('id, status')
    .eq('owner_id', user.id)

  const counts = (allProjects ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Mes projets
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {allProjects?.length ?? 0} projet{(allProjects?.length ?? 0) !== 1 ? 's' : ''} au total
          </p>
        </div>
        <Link href="/projects/new">
          <Button size="md" className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Nouveau projet
          </Button>
        </Link>
      </div>

      {/* Filter bar */}
      <FilterBar currentStatus={activeStatus} counts={counts} />

      {/* Project grid */}
      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project as Project} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 py-20 text-center">
          <FolderOpen className="h-12 w-12 text-neutral-300 mb-4" />
          <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">
            {activeStatus === 'all'
              ? "Aucun projet pour l'instant"
              : `Aucun projet avec le statut « ${STATUS_LABELS[activeStatus as ProjectStatus]} »`}
          </p>
          <p className="text-sm text-neutral-500 mt-1 mb-5">
            {activeStatus === 'all'
              ? 'Créez votre premier projet pour commencer à prendre des mesures.'
              : 'Essayez un autre filtre ou créez un nouveau projet.'}
          </p>
          <Link href="/projects/new">
            <Button size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Nouveau projet
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
