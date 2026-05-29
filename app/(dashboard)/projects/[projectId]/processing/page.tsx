// app/(dashboard)/projects/[projectId]/processing/page.tsx
'use client'

import { use, useEffect, useState, useCallback, type ReactNode } from 'react'
import { Cpu, Play, Settings2, Trash2, Loader2, AlertCircle, CheckCircle2, Clock, AlertTriangle, Zap } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

type JobType =
  | 'photo_quality_analysis'
  | 'photo_grouping'
  | 'manual_model_generation'
  | 'ai_model_generation'
  | 'measurement_extraction'
  | 'pdf_generation'

type JobStatus = 'queued' | 'processing' | 'needs_user_input' | 'completed' | 'failed'

interface ProcessingJob {
  id: string
  project_id: string
  type: JobType
  status: JobStatus
  progress: number
  current_step: string | null
  error_message: string | null
  input_data: Record<string, unknown> | null
  output_data: Record<string, unknown> | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

interface Props {
  params: Promise<{ projectId: string }>
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const JOB_TYPE_LABELS: Record<JobType, string> = {
  photo_quality_analysis: 'Analyse qualité photos',
  photo_grouping: 'Organisation des photos',
  manual_model_generation: 'Génération modèle manuel',
  ai_model_generation: 'Génération modèle IA',
  measurement_extraction: 'Extraction des mesures',
  pdf_generation: 'Génération PDF',
}

const JOB_TYPE_DESCRIPTIONS: Record<JobType, string> = {
  photo_quality_analysis: 'Vérifie la résolution, la luminosité et la netteté de chaque photo.',
  photo_grouping: 'Organise les photos par façade et par vue.',
  manual_model_generation: 'Ouvre le formulaire de saisie manuelle des dimensions.',
  ai_model_generation: 'Génère un modèle 3D à partir des photos par photogrammétrie.',
  measurement_extraction: 'Extrait les mesures calibrées depuis les photos annotées.',
  pdf_generation: 'Génère un rapport PDF complet du projet.',
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JobStatus }) {
  const config: Record<JobStatus, { label: string; className: string; icon: ReactNode }> = {
    queued: {
      label: 'En attente',
      className: 'bg-gray-100 text-gray-700',
      icon: <Clock className="h-3 w-3" />,
    },
    processing: {
      label: 'En cours',
      className: 'bg-blue-100 text-blue-700',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    needs_user_input: {
      label: 'Action requise',
      className: 'bg-yellow-100 text-yellow-700',
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    completed: {
      label: 'Terminé',
      className: 'bg-green-100 text-green-700',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    failed: {
      label: 'Échoué',
      className: 'bg-red-100 text-red-700',
      icon: <AlertCircle className="h-3 w-3" />,
    },
  }

  const { label, className, icon } = config[status]

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {icon}
      {label}
    </span>
  )
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  onDelete,
}: {
  job: ProcessingJob
  onDelete: (id: string) => void
}) {
  const createdAgo = formatDistanceToNow(new Date(job.created_at), {
    addSuffix: true,
    locale: fr,
  })

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <Cpu className="h-4 w-4 text-blue-600" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">
              {JOB_TYPE_LABELS[job.type]}
            </p>
            <StatusBadge status={job.status} />
          </div>

          {job.current_step && (
            <p className="mt-0.5 text-xs text-gray-500">{job.current_step}</p>
          )}

          {job.error_message && (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {job.error_message}
            </p>
          )}

          {/* Progress bar */}
          {(job.status === 'processing' || job.status === 'queued') ? (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              <p className="mt-0.5 text-xs text-gray-400">{job.progress}%</p>
            </div>
          ) : null}

          {/* Output message */}
          {job.output_data?.message ? (
            <p className="mt-1 text-xs text-gray-600">
              {String(job.output_data.message)}
            </p>
          ) : null}

          {/* Timestamps */}
          <p className="mt-2 text-xs text-gray-400">Créé {createdAgo}</p>
        </div>

        {/* Delete button */}
        <button
          onClick={() => onDelete(job.id)}
          className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Supprimer"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProcessingPage({ params }: Props) {
  const { projectId } = use(params)
  const [jobs, setJobs] = useState<ProcessingJob[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<JobType | null>(null)

  const loadJobs = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/processing`)
    if (res.ok) {
      const data = await res.json() as { jobs: ProcessingJob[] }
      setJobs(data.jobs ?? [])
    }
  }, [projectId])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await loadJobs()
      setLoading(false)
    }
    void init()
  }, [loadJobs])

  async function createJob(type: JobType): Promise<ProcessingJob | null> {
    setCreating(type)
    try {
      const res = await fetch(`/api/projects/${projectId}/processing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      if (!res.ok) return null
      const data = await res.json() as { job: ProcessingJob }
      return data.job
    } finally {
      setCreating(null)
    }
  }

  async function patchJob(
    jobId: string,
    update: Partial<Pick<ProcessingJob, 'status' | 'progress' | 'current_step' | 'output_data' | 'error_message'>>
  ): Promise<ProcessingJob | null> {
    const res = await fetch(`/api/projects/${projectId}/processing`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: jobId, ...update }),
    })
    if (!res.ok) return null
    const data = await res.json() as { job: ProcessingJob }
    return data.job
  }

  async function handleAnalyzePhotos() {
    const job = await createJob('photo_quality_analysis')
    if (!job) return
    setJobs((prev) => [job, ...prev])
  }

  async function handleManualModel() {
    const job = await createJob('manual_model_generation')
    if (!job) return

    // Immediately complete with link to model page
    const updated = await patchJob(job.id, {
      status: 'completed',
      progress: 100,
      current_step: 'Terminé',
      output_data: {
        message: 'Utilisez le formulaire de modèle 3D pour saisir les dimensions manuellement.',
        nextAction: 'open_model_form',
        modelUrl: `/projects/${projectId}/model`,
      },
    })

    setJobs((prev) => [updated ?? { ...job, status: 'completed', progress: 100 }, ...prev])
  }

  async function handleDeleteJob(jobId: string) {
    if (!confirm('Supprimer cette tâche ?')) return
    const res = await fetch(
      `/api/projects/${projectId}/processing/${jobId}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      setJobs((prev) => prev.filter((j) => j.id !== jobId))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Cpu className="h-5 w-5 text-blue-600" />
            Pipeline de traitement
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Gérez l&apos;analyse des photos et la génération du modèle 3D.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void handleAnalyzePhotos()}
            disabled={creating !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {creating === 'photo_quality_analysis' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Analyser les photos
          </button>

          <button
            onClick={() => void handleManualModel()}
            disabled={creating !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {creating === 'manual_model_generation' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Settings2 className="h-4 w-4" />
            )}
            Générer modèle manuel
          </button>
        </div>
      </div>

      {/* Job list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
          <Zap className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">Aucune tâche de traitement</p>
          <p className="mt-1 max-w-xs text-xs text-gray-500">
            Utilisez les boutons ci-dessus pour lancer une analyse de photos ou générer un modèle 3D.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
            {(Object.entries(JOB_TYPE_DESCRIPTIONS) as [JobType, string][]).map(
              ([type, description]) => (
                <div
                  key={type}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <p className="text-xs font-semibold text-gray-700">
                    {JOB_TYPE_LABELS[type]}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{description}</p>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onDelete={(id) => void handleDeleteJob(id)} />
          ))}
        </div>
      )}
    </div>
  )
}
