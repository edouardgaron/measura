// lib/photogrammetry/providers/mock-ai.ts
import type { PhotoTo3DProvider, Photo3DJob } from '../index'

interface MockJobState {
  job: Photo3DJob
  callCount: number
}

const STEPS = [
  { progress: 20, label: 'Chargement des photos' },
  { progress: 40, label: 'Détection des points clés' },
  { progress: 60, label: 'Reconstruction nuage de points' },
  { progress: 80, label: 'Génération du maillage' },
  { progress: 100, label: 'Optimisation du modèle' },
]

// In-memory store for mock job states
const jobStore = new Map<string, MockJobState>()

export class MockAIProvider implements PhotoTo3DProvider {
  readonly name = 'IA simulée (demo)'
  readonly description = 'Simulation d\'un pipeline de photogrammétrie par IA'
  readonly requiresExternalAPI = false

  async createJob(projectId: string, photoIds: string[]): Promise<Photo3DJob> {
    const jobId = `mock-ai-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const now = new Date().toISOString()

    const job: Photo3DJob = {
      id: jobId,
      projectId,
      photoIds,
      status: 'processing',
      progress: 0,
      currentStep: 'Démarrage...',
      createdAt: now,
    }

    jobStore.set(jobId, { job, callCount: 0 })

    return job
  }

  async getJobStatus(jobId: string): Promise<Photo3DJob> {
    const state = jobStore.get(jobId)
    if (!state) {
      return {
        id: jobId,
        projectId: '',
        photoIds: [],
        status: 'failed',
        progress: 0,
        currentStep: 'Tâche introuvable',
        errorMessage: 'Job non trouvé',
        createdAt: new Date().toISOString(),
      }
    }

    // Each call advances by one step
    const stepIndex = Math.min(state.callCount, STEPS.length - 1)
    const step = STEPS[stepIndex]

    state.callCount += 1

    const isComplete = state.callCount >= STEPS.length

    const updatedJob: Photo3DJob = {
      ...state.job,
      progress: step.progress,
      currentStep: step.label,
      status: isComplete ? 'completed' : 'processing',
      outputData: isComplete
        ? {
            provider: 'mock-ai',
            message: 'Modèle 3D généré avec succès (simulation).',
            nextAction: 'open_model_form',
            pointCount: Math.floor(Math.random() * 50000) + 10000,
            faceCount: Math.floor(Math.random() * 20000) + 5000,
          }
        : undefined,
    }

    state.job = updatedJob
    jobStore.set(jobId, state)

    return updatedJob
  }

  async cancelJob(jobId: string): Promise<void> {
    const state = jobStore.get(jobId)
    if (state) {
      state.job = { ...state.job, status: 'failed', currentStep: 'Annulé' }
      jobStore.set(jobId, state)
    }
  }
}
