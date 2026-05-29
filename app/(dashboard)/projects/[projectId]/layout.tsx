// app/(dashboard)/projects/[projectId]/layout.tsx
import Link from 'next/link'
import {
  ArrowLeft,
  LayoutDashboard,
  Camera,
  Ruler,
  Box,
  FileText,
  Settings,
  Calculator,
  CheckSquare,
  Palette,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { ProjectStatus } from '@/lib/supabase/types'
import ProjectTabNav from './ProjectTabNav'
import ProjectHeaderActions from '@/components/projects/ProjectHeaderActions'

interface Props {
  children: React.ReactNode
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

const STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  photos_pending: 'bg-yellow-100 text-yellow-800',
  measuring: 'bg-blue-100 text-blue-800',
  review: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  archived: 'bg-red-100 text-red-800',
}

export default async function ProjectLayout({ children, params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, title, address_line1, address_city, address_province, status')
    .eq('id', projectId)
    .single()

  if (error || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Projet introuvable</h1>
          <p className="mt-2 text-gray-500">
            Ce projet n&apos;existe pas ou vous n&apos;y avez pas accès.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    )
  }

  const addressParts = [
    project.address_line1,
    project.address_city,
    project.address_province,
  ].filter(Boolean)
  const address = addressParts.join(', ')

  const tabs = [
    { label: 'Aperçu', href: `/projects/${projectId}`, icon: LayoutDashboard, segment: null },
    { label: 'Photos', href: `/projects/${projectId}/photos`, icon: Camera, segment: 'photos' },
    { label: 'Mesures', href: `/projects/${projectId}/measurements`, icon: Ruler, segment: 'measurements' },
    { label: 'Estimation', href: `/projects/${projectId}/estimate`, icon: Calculator, segment: 'estimate' },
    { label: 'Tâches', href: `/projects/${projectId}/tasks`, icon: CheckSquare, segment: 'tasks' },
    { label: 'Design', href: `/projects/${projectId}/design`, icon: Palette, segment: 'design' },
    { label: 'Modèle 3D', href: `/projects/${projectId}/model`, icon: Box, segment: 'model' },
    { label: 'Rapport', href: `/projects/${projectId}/report`, icon: FileText, segment: 'report' },
    { label: 'Paramètres', href: `/projects/${projectId}/settings`, icon: Settings, segment: 'settings' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Project Header */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 py-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              aria-label="Retour aux projets"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold text-gray-900">
                  {project.title}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_COLORS[project.status as ProjectStatus]
                  }`}
                >
                  {STATUS_LABELS[project.status as ProjectStatus]}
                </span>
              </div>
              {address && (
                <p className="mt-0.5 truncate text-sm text-gray-500">{address}</p>
              )}
            </div>

            <ProjectHeaderActions projectId={projectId} projectTitle={project.title} />
          </div>

          {/* Tab Navigation — client component for active-state detection */}
          <ProjectTabNav tabs={tabs} />
        </div>
      </div>

      {/* Page Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
