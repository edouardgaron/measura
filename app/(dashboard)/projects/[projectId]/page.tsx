// app/(dashboard)/projects/[projectId]/page.tsx
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  Camera,
  Ruler,
  FileText,
  UserPlus,
  StickyNote,
  CheckCircle2,
  Circle,
  Building2,
  Calculator,
  CheckSquare,
  Palette,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { ProjectStatus, UnitSystem } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ projectId: string }>
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Brouillon',
  photos_pending: 'Photos requises',
  measuring: 'En mesure',
  review: 'En révision',
  completed: 'Terminé',
  archived: 'Archivé',
}

const UNIT_LABELS: Record<UnitSystem, string> = {
  metric: 'Métrique (m / cm)',
  imperial: 'Impérial (ft / in)',
}

export default async function ProjectOverviewPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select(
      `id, title, address_line1, address_city, address_province, address_postal, address_country,
       status, unit_system, notes, created_at, updated_at,
       members:project_members(id, email, role, invite_accepted_at, profile:profiles(full_name, avatar_url)),
       photos(id, storage_path, facade_label, sort_order)`
    )
    .eq('id', projectId)
    .single()

  if (!project) notFound()

  const { count: measurementsCount } = await supabase
    .from('measurements')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  const { count: reportsCount } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  const { count: tasksTotal } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  const { count: tasksDone } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('status', 'done')

  const { data: estimateData } = await supabase
    .from('estimates')
    .select('id, status, total')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const photos = (project.photos as { id: string; storage_path: string; facade_label: string | null; sort_order: number }[] | null) ?? []
  const members = (project.members as { id: string; email: string; role: string; invite_accepted_at: string | null }[] | null) ?? []
  const photoCount = photos.length
  const measureCount = measurementsCount ?? 0
  const reportCount = reportsCount ?? 0

  const tasksCount = tasksTotal ?? 0
  const tasksDoneCount = tasksDone ?? 0

  const clientMember = members.find((m) => m.role === 'client')

  const addressParts = [
    project.address_line1,
    project.address_city,
    project.address_province,
    project.address_postal,
  ].filter(Boolean)

  const firstFourPhotos = [...photos]
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 4)

  const getPhotoUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('photos').getPublicUrl(storagePath)
    return data.publicUrl
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{project.title}</h2>
              {addressParts.length > 0 && (
                <p className="text-sm text-gray-500">{addressParts.join(', ')}</p>
              )}
            </div>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Statut</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {STATUS_LABELS[project.status as ProjectStatus]}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Système d&apos;unités</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {UNIT_LABELS[project.unit_system as UnitSystem] ?? project.unit_system}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Créé le</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(project.created_at).toLocaleDateString('fr-CA')}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Modifié le</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(project.updated_at).toLocaleDateString('fr-CA')}
            </dd>
          </div>
        </dl>
      </div>

      {/* Progress Tracker */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">Progression</h3>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <ProgressItem
            icon={<Camera className="h-5 w-5" />}
            label="Photos"
            value={photoCount}
            total={4}
            suffix="/ 4 recommandées"
            href={`/projects/${projectId}/photos`}
            color="blue"
          />
          <ProgressItem
            icon={<Ruler className="h-5 w-5" />}
            label="Mesures"
            value={measureCount}
            href={`/projects/${projectId}/measurements`}
            color="purple"
          />
          <ProgressItem
            icon={<Calculator className="h-5 w-5" />}
            label="Estimations"
            value={estimateData ? 1 : 0}
            href={`/projects/${projectId}/estimate`}
            color="orange"
            badge={estimateData ? estimateData.status : undefined}
          />
          <ProgressItem
            icon={<CheckSquare className="h-5 w-5" />}
            label="Tâches"
            value={tasksDoneCount}
            total={tasksCount || undefined}
            suffix={tasksCount > 0 ? `/ ${tasksCount} total` : undefined}
            href={`/projects/${projectId}/tasks`}
            color="teal"
          />
          <ProgressItem
            icon={<Palette className="h-5 w-5" />}
            label="Design"
            value={0}
            href={`/projects/${projectId}/design`}
            color="pink"
          />
          <ProgressItem
            icon={<FileText className="h-5 w-5" />}
            label="Rapports"
            value={reportCount}
            href={`/projects/${projectId}/report`}
            color="green"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickAction
          href={`/projects/${projectId}/settings#invite`}
          icon={<UserPlus className="h-5 w-5" />}
          label="Inviter le client"
          description="Envoyer un lien de dépôt de photos"
          color="blue"
        />
        <QuickAction
          href={`/projects/${projectId}/measurements`}
          icon={<Ruler className="h-5 w-5" />}
          label="Prendre mesures"
          description="Annoter et mesurer les photos"
          color="purple"
        />
        <QuickAction
          href={`/projects/${projectId}/estimate`}
          icon={<Calculator className="h-5 w-5" />}
          label="Créer estimation"
          description="Calculer surfaces et préparer un devis"
          color="orange"
        />
        <QuickAction
          href={`/projects/${projectId}/tasks`}
          icon={<CheckSquare className="h-5 w-5" />}
          label="Gérer tâches"
          description="Suivre l'avancement du chantier"
          color="teal"
        />
        <QuickAction
          href={`/projects/${projectId}/design`}
          icon={<Palette className="h-5 w-5" />}
          label="Choisir couleurs"
          description="Visualiser les matériaux et couleurs"
          color="pink"
        />
        <QuickAction
          href={`/projects/${projectId}/report`}
          icon={<FileText className="h-5 w-5" />}
          label="Générer rapport"
          description="Créer un rapport PDF du projet"
          color="green"
        />
      </div>

      {/* Client Info */}
      {clientMember && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 text-base font-semibold text-gray-900">Client invité</h3>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
              {clientMember.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{clientMember.email}</p>
              <p className="text-xs text-gray-500">
                {clientMember.invite_accepted_at
                  ? `Accepté le ${new Date(clientMember.invite_accepted_at).toLocaleDateString('fr-CA')}`
                  : 'Invitation en attente'}
              </p>
            </div>
            <div className="ml-auto">
              {clientMember.invite_accepted_at ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <Circle className="h-5 w-5 text-gray-300" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photos Thumbnail Grid */}
      {firstFourPhotos.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Photos récentes</h3>
            <Link
              href={`/projects/${projectId}/photos`}
              className="text-sm text-blue-600 hover:underline"
            >
              Voir toutes ({photoCount})
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {firstFourPhotos.map((photo) => (
              <Link
                key={photo.id}
                href={`/projects/${projectId}/photos`}
                className="group relative aspect-video overflow-hidden rounded-lg bg-gray-100"
              >
                <Image
                  src={getPhotoUrl(photo.storage_path)}
                  alt={photo.facade_label ?? 'Photo'}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
                {photo.facade_label && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                    {photo.facade_label}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {project.notes && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <StickyNote className="h-4 w-4 text-gray-400" />
            <h3 className="text-base font-semibold text-gray-900">Notes</h3>
          </div>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{project.notes}</p>
        </div>
      )}
    </div>
  )
}

/* --- Sub-components --- */

function ProgressItem({
  icon,
  label,
  value,
  total,
  suffix,
  href,
  color,
  badge,
}: {
  icon: React.ReactNode
  label: string
  value: number
  total?: number
  suffix?: string
  href: string
  color: 'blue' | 'purple' | 'green' | 'orange' | 'teal' | 'pink'
  badge?: string
}) {
  const colorClasses = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   bar: 'bg-blue-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', bar: 'bg-purple-500' },
    green:  { bg: 'bg-green-50',  text: 'text-green-600',  bar: 'bg-green-500' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', bar: 'bg-orange-500' },
    teal:   { bg: 'bg-teal-50',   text: 'text-teal-600',   bar: 'bg-teal-500' },
    pink:   { bg: 'bg-pink-50',   text: 'text-pink-600',   bar: 'bg-pink-500' },
  }
  const c = colorClasses[color]
  const pct = total ? Math.min((value / total) * 100, 100) : 0

  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg border border-gray-100 p-4 hover:bg-gray-50 transition-colors"
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.bg} ${c.text}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {badge && (
          <span className="inline-block rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 capitalize">
            {badge}
          </span>
        )}
        {suffix && <p className="text-xs text-gray-400">{suffix}</p>}
        {total !== undefined && total > 0 && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    </Link>
  )
}

function QuickAction({
  href,
  icon,
  label,
  description,
  color,
}: {
  href: string
  icon: React.ReactNode
  label: string
  description: string
  color: 'blue' | 'purple' | 'green' | 'orange' | 'teal' | 'pink'
}) {
  const colorClasses = {
    blue:   'bg-blue-600 hover:bg-blue-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    green:  'bg-green-600 hover:bg-green-700',
    orange: 'bg-orange-500 hover:bg-orange-600',
    teal:   'bg-teal-600 hover:bg-teal-700',
    pink:   'bg-pink-500 hover:bg-pink-600',
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl p-4 text-white transition-colors ${colorClasses[color]}`}
    >
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-xs opacity-80">{description}</p>
      </div>
    </Link>
  )
}
