// app/(dashboard)/projects/[projectId]/profitability/page.tsx
import ProfitabilityClient from './ProfitabilityClient'

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function ProfitabilityPage({ params }: Props) {
  const { projectId } = await params
  return <ProfitabilityClient projectId={projectId} />
}
