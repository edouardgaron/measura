// lib/photogrammetry/index.ts

export interface Photo3DJob {
  id: string
  projectId: string
  photoIds: string[]
  status: 'queued' | 'processing' | 'needs_user_input' | 'completed' | 'failed'
  progress: number
  currentStep: string
  outputData?: Record<string, unknown>
  errorMessage?: string
  createdAt: string
}

export interface PhotoTo3DProvider {
  readonly name: string
  readonly description: string
  readonly requiresExternalAPI: boolean
  createJob(projectId: string, photoIds: string[]): Promise<Photo3DJob>
  getJobStatus(jobId: string): Promise<Photo3DJob>
  cancelJob(jobId: string): Promise<void>
}

export { ManualParametricProvider } from './providers/manual'
// Provider mock retiré — reconstruction réelle : lib/photogrammetry/reconstruct.ts (paramétrique)
// + lib/photogrammetry/providers/external.ts (dense).
