import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { api } from '../../../api/client'
import type { CedentsListPayload, ContractsListPayload } from '../../../types/api'
import { CessionFileProcessingWorkflow } from './FileProcessingModal'

export function CessionFileProcessingPage() {
  const { fileId } = useParams<{ fileId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const returnTo = normalizeReturnTo(searchParams.get('returnTo'))
  const backLabel = returnTo === '/worklist' ? 'Back to Worklist' : 'Back to Cession Files'

  const cedentsQuery = useQuery({
    queryKey: ['claims-cession-cedents'],
    queryFn: async () =>
      (
        await api.get<CedentsListPayload>('/underwriting/cedents', {
          params: { status: 'all', page: 1, page_size: 100 },
        })
      ).data,
  })

  const contractsQuery = useQuery({
    queryKey: ['claims-cession-contracts'],
    queryFn: async () =>
      (
        await api.get<ContractsListPayload>('/underwriting/contracts', {
          params: { status: 'all', page: 1, page_size: 200 },
        })
      ).data,
  })

  return (
    <CessionFileProcessingWorkflow
      backLabel={backLabel}
      cedentOptions={cedentsQuery.data?.items ?? []}
      contractOptions={contractsQuery.data?.items ?? []}
      fileId={fileId ?? null}
      onClose={() => navigate(returnTo)}
      onFileCreated={(nextFileId) => navigate(buildWorkflowRoute(nextFileId, returnTo), { replace: true })}
      onRefresh={() => undefined}
      presentation="page"
      startInUpload={!fileId}
    />
  )
}

function normalizeReturnTo(value: string | null) {
  if (!value || !value.startsWith('/')) {
    return '/claims/cession-files'
  }
  return value
}

function buildWorkflowRoute(fileId: string, returnTo: string) {
  const params = new URLSearchParams()
  if (returnTo !== '/claims/cession-files') {
    params.set('returnTo', returnTo)
  }

  const query = params.toString()
  return query ? `/claims/cession-files/${fileId}?${query}` : `/claims/cession-files/${fileId}`
}
