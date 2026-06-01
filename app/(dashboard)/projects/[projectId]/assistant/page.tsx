// app/(dashboard)/projects/[projectId]/assistant/page.tsx
import { createClient } from '@/lib/supabase/server'
import { isAiConfigured } from '@/lib/ai/client'
import { detectGaps } from '@/lib/ai/assistant'
import { gatherProjectContext } from '@/lib/ai/gatherProjectContext'
import AssistantClient from './AssistantClient'

interface Props { params: Promise<{ projectId: string }> }

export default async function AssistantPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()
  const ctx = await gatherProjectContext(supabase, projectId)
  const gaps = ctx ? detectGaps(ctx) : []
  return <AssistantClient projectId={projectId} gaps={gaps} aiEnabled={isAiConfigured()} />
}
