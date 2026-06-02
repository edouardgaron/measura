// app/(dashboard)/projects/page.tsx
import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Search, SlidersHorizontal, Camera, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils/format'
import type { Project, ProjectStatus } from '@/lib/supabase/types'

// --- Status filter labels -----------------------------------------------------

const STATUS_LABELS: Record<ProjectStatus | 'all', string> = {
  all: 'Tous',
  draft: 'Brouillon',
  photos_pending: 'Photos nécessaires',
  measuring: 'En mesure',
  review: 'En révision',
  completed: 'Complete',
  archived: 'Archivé',
}

type ProjectWithPhotos = Project & {
  photos?: { storage_path: string; sort_order: number }[] | null
}

// --- Project card (Hover-style photo tile) ------------------------------------

function ProjectCard({
  project,
  coverUrl,
}: {
  project: ProjectWithPhotos
  coverUrl: string | null
}) {
  const subtitle =
    project.address_line1 ||
    [project.address_city, project.address_province].filter(Boolean).join(', ')

  return (
    <Link href={`/projects/${project.id}`} className="group flex flex-col gap-3">
      {/* Photo */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-neutral-100">
        <span className="absolute left-3 top-3 z-10">
          <StatusBadge status={project.status} />
        </span>
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={project.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            <Camera className="h-12 w-12" strokeWidth={1.25} />
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="px-0.5">
        <h3 className="truncate text-[15px] font-semibold text-neutral-900 group-hover:underline">
          {project.title}
        </h3>
        {subtitle && (
          <p className="truncate text-sm text-neutral-500">{subtitle}</p>
        )}
        <p className="mt-0.5 text-xs text-neutral-400">{formatDate(project.created_at)}</p>
      </div>
    </Link>
  )
}

// --- Filter pills -------------------------------------------------------------

function FilterPills({
  currentStatus,
  query,
}: {
  currentStatus: string
  query?: string
}) {
  const statuses: Array<ProjectStatus | 'all'> = [
    'all',
    'photos_pending',
    'measuring',
    'review',
    'completed',
  ]
  const qs = (status: string) => {
    const params = new URLSearchParams()
    if (status !== 'all') params.set('status', status)
    if (query) params.set('q', query)
    const s = params.toString()
    return s ? `/projects?${s}` : '/projects'
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer">
      {statuses.map((status) => {
        const isActive = currentStatus === status
        return (
          <Link
            key={status}
            href={qs(status)}
            aria-current={isActive ? 'true' : undefined}
            className={[
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
            ].join(' ')}
          >
            {STATUS_LABELS[status]}
          </Link>
        )
      })}
    </div>
  )
}

// --- Page ---------------------------------------------------------------------

interface ProjectsPageProps {
  searchParams: Promise<{ status?: string; q?: string }>
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { status: statusParam, q } = await searchParams
  const activeStatus = statusParam ?? 'all'
  const query = q?.trim() || undefined

  let dbQuery = supabase
    .from('projects')
    .select('*, photos(storage_path, sort_order)')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false })

  if (activeStatus !== 'all') {
    dbQuery = dbQuery.eq('status', activeStatus)
  }

  if (query) {
    dbQuery = dbQuery.or(
      `title.ilike.%${query}%,address_line1.ilike.%${query}%,address_city.ilike.%${query}%`
    )
  }

  const { data: projects } = await dbQuery

  const coverUrl = (project: ProjectWithPhotos): string | null => {
    const photos = project.photos ?? []
    if (photos.length === 0) return null
    const cover = [...photos].sort((a, b) => a.sort_order - b.sort_order)[0]
    return supabase.storage.from('photos').getPublicUrl(cover.storage_path).data.publicUrl
  }

  const list = (projects ?? []) as ProjectWithPhotos[]

  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      {/* Search + filter toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <form action="/projects" method="get" className="flex items-center gap-3">
          {activeStatus !== 'all' && (
            <input type="hidden" name="status" value={activeStatus} />
          )}
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              name="q"
              defaultValue={query ?? ''}
              placeholder="Rechercher une propriété, adresse ou nom"
              className="h-11 w-full rounded-full border border-transparent bg-neutral-100 pl-11 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-100 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-200"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtres
          </button>
        </form>

        <FilterPills currentStatus={activeStatus} query={query} />
      </div>

      {/* Grid */}
      {list.length > 0 ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((project) => (
            <ProjectCard key={project.id} project={project} coverUrl={coverUrl(project)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 py-24 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <Camera className="h-7 w-7" strokeWidth={1.25} />
          </div>
          <p className="text-base font-semibold text-neutral-900">
            {query || activeStatus !== 'all'
              ? 'Aucun projet ne correspond'
              : "Aucun projet pour l'instant"}
          </p>
          <p className="mb-6 mt-1 text-sm text-neutral-500">
            {query || activeStatus !== 'all'
              ? 'Essayez un autre filtre ou une autre recherche.'
              : 'Créez votre premier projet pour commencer à prendre des mesures.'}
          </p>
          <Link
            href="/projects/new"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" />
            Nouveau projet
          </Link>
        </div>
      )}
    </div>
  )
}
