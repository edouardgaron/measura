// app/(dashboard)/projects/[projectId]/page.tsx
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  Camera,
  Sparkles,
  Ruler,
  LayoutGrid,
  FileText,
  Box,
  Home,
  PanelsTopLeft,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function ProjectOverviewPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select(
      `id, title, address_line1, address_city, address_province, address_postal,
       status, created_at,
       photos(id, storage_path, sort_order)`
    )
    .eq('id', projectId)
    .single()

  if (!project) notFound()

  const { count: measurementsCount } = await supabase
    .from('measurements')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  const { count: surfacesCount } = await supabase
    .from('surfaces')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  const { data: estimateData } = await supabase
    .from('estimates')
    .select('id, status')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const photos = (project.photos as { id: string; storage_path: string; sort_order: number }[] | null) ?? []
  const sortedPhotos = [...photos].sort((a, b) => a.sort_order - b.sort_order)
  const photoCount = photos.length
  const measureCount = measurementsCount ?? 0
  const surfaceCount = surfacesCount ?? 0

  const getPhotoUrl = (storagePath: string) =>
    supabase.storage.from('photos').getPublicUrl(storagePath).data.publicUrl

  const coverUrl = sortedPhotos[0] ? getPhotoUrl(sortedPhotos[0].storage_path) : null
  const thumb = (i: number) =>
    sortedPhotos[i] ? getPhotoUrl(sortedPhotos[i].storage_path) : null

  const addressParts = [
    project.address_line1,
    project.address_city,
    project.address_province,
    project.address_postal,
  ].filter(Boolean)

  const createdDate = new Date(project.created_at).toLocaleDateString('fr-CA')
  const jobNo = project.id.replace(/-/g, '').slice(0, 8).toUpperCase()

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-10">
      {/* Hero */}
      <div className="pt-2 text-center">
        <h2 className="text-balance text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl">
          {project.title}
        </h2>
        {addressParts.length > 0 && (
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">{addressParts.join(', ')}</p>
        )}
        <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">Créé le {createdDate}</p>
        <p className="text-sm text-neutral-400 dark:text-neutral-500">No de travail : {jobNo}</p>
      </div>

      {/* Three panels */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Design 2D */}
        <Panel title="Design en 2D">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt="Aperçu de la propriété"
                fill
                sizes="(max-width: 1024px) 100vw, 33vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-neutral-300 dark:text-neutral-600">
                <Camera className="h-10 w-10" strokeWidth={1.25} />
              </div>
            )}
            <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100">
              <Sparkles className="h-4 w-4" />
            </span>
          </div>
          <PanelButton href={`/projects/${projectId}/design`}>
            Commencer le design en 2D
          </PanelButton>
        </Panel>

        {/* Design 3D */}
        <Panel title="Design en 3D">
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => {
              const url = thumb(i)
              return (
                <div
                  key={i}
                  className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl ${
                    url
                      ? 'bg-neutral-100 dark:bg-neutral-800'
                      : 'border border-dashed border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50'
                  }`}
                >
                  {url ? (
                    <Image
                      src={url}
                      alt={`Vue ${i + 1}`}
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                  ) : (
                    <Home className="h-6 w-6 text-neutral-300 dark:text-neutral-600" strokeWidth={1.25} />
                  )}
                </div>
              )
            })}
          </div>
          <PanelButton href={`/projects/${projectId}/model`}>
            Commencer le design en 3D
          </PanelButton>
        </Panel>

        {/* Mesures */}
        <Panel title="Mesures">
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              icon={<LayoutGrid className="h-4 w-4" />}
              value={surfaceCount}
              label="Surfaces"
              href={`/projects/${projectId}/measurements`}
            />
            <StatTile
              icon={<Ruler className="h-4 w-4" />}
              value={measureCount}
              label="Mesures"
              href={`/projects/${projectId}/measurements`}
            />
            <StatTile
              icon={<Camera className="h-4 w-4" />}
              value={photoCount}
              label="Photos"
              href={`/projects/${projectId}/photos`}
            />
            <StatTile
              icon={<PanelsTopLeft className="h-4 w-4" />}
              value={estimateData ? 'Voir' : '—'}
              label="Extérieur complet"
              href={`/projects/${projectId}/report`}
              muted
            />
          </div>
          <div className="mt-auto flex gap-3 pt-4">
            <Link
              href={`/projects/${projectId}/model`}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-neutral-100 text-sm font-medium text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              <Box className="h-4 w-4" />
              3D
            </Link>
            <Link
              href={`/projects/${projectId}/report`}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-neutral-100 text-sm font-medium text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              <FileText className="h-4 w-4" />
              PDF
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* --- Sub-components --- */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-900">
      <h3 className="text-center text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
      {children}
    </section>
  )
}

function PanelButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-auto inline-flex h-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
    >
      {children}
    </Link>
  )
}

function StatTile({
  icon,
  value,
  label,
  href,
  muted,
}: {
  icon: React.ReactNode
  value: React.ReactNode
  label: string
  href: string
  muted?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col gap-1 rounded-xl p-4 transition-colors ${
        muted
          ? 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700'
          : 'bg-white hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700'
      }`}
    >
      <span className="text-neutral-400 dark:text-neutral-500">{icon}</span>
      <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{value}</span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
    </Link>
  )
}
