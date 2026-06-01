// app/(dashboard)/projects/[projectId]/plans/page.tsx
import PlansClient from './PlansClient'

interface Props { params: Promise<{ projectId: string }> }

export default async function PlansPage({ params }: Props) {
  const { projectId } = await params
  return <PlansClient projectId={projectId} />
}
