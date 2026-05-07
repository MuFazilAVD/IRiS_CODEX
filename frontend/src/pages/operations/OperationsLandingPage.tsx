import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { api } from '../../api/client'
import { Breadcrumbs } from '../../components/common/Breadcrumbs'
import { EmptyState } from '../../components/common/EmptyState'
import { PageHeader } from '../../components/common/PageHeader'
import type { OperationsPipelinesPayload } from '../../types/api'

export function OperationsLandingPage() {
  const navigate = useNavigate()
  const pipelinesQuery = useQuery({
    queryKey: ['operations-pipelines-landing'],
    queryFn: async () => (await api.get<OperationsPipelinesPayload>('/operations/pipelines')).data,
  })

  useEffect(() => {
    const firstPipeline = pipelinesQuery.data?.active_pipelines?.[0]
    if (firstPipeline) {
      navigate(`/operations/${firstPipeline.process_id}`, { replace: true })
    }
  }, [navigate, pipelinesQuery.data?.active_pipelines])

  if (pipelinesQuery.isLoading) {
    return <div className="panel-card">Loading operations workflows...</div>
  }

  if (pipelinesQuery.isError) {
    return (
      <EmptyState
        description="The active operations workflow list could not be loaded right now. Re-open the cession-files queue and try again."
        icon={<Activity className="h-5 w-5" />}
        title="Unable to load operations workflows"
      />
    )
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Claims Ops' }, { label: 'Operations' }]} />
      <PageHeader
        subtitle="Open an active workflow from the cession-file queue when no live pipeline is available for direct navigation."
        title="Operations"
      />
      <EmptyState
        description="There are no active Phase 8 pipeline workflows to open at the moment."
        icon={<Activity className="h-5 w-5" />}
        title="No active operations workflows"
      />
    </div>
  )
}
