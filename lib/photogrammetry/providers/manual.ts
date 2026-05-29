// lib/photogrammetry/providers/manual.ts
import type { PhotoTo3DProvider, Photo3DJob } from '../index'

export class ManualParametricProvider implements PhotoTo3DProvider {
  readonly name = 'Manuel paramétrique'
  readonly description = 'Modèle 3D basé sur dimensions manuelles'
  readonly requiresExternalAPI = false

  async createJob(projectId: string, photoIds: string[]): Promise<Photo3DJob> {
    return {
      id: `manual-${Date.now()}`,
      projectId,
      photoIds,
      status: 'completed',
      progress: 100,
      currentStep: 'Terminé',
      outputData: {
        provider: 'manual',
        message: 'Utilisez le formulaire de modèle 3D pour saisir les dimensions manuellement.',
        nextAction: 'open_model_form',
      },
      createdAt: new Date().toISOString(),
    }
  }

  async getJobStatus(jobId: string): Promise<Photo3DJob> {
    return {
      id: jobId,
      projectId: '',
      photoIds: [],
      status: 'completed',
      progress: 100,
      currentStep: 'Terminé',
      createdAt: new Date().toISOString(),
    }
  }

  async cancelJob(_jobId: string): Promise<void> {
    // Nothing to cancel for manual provider
  }
}
