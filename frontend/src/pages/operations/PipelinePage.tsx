import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, OctagonPause } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../../api/client'
import { Breadcrumbs } from '../../components/common/Breadcrumbs'
import { EmptyState } from '../../components/common/EmptyState'
import { useUiStore } from '../../store/uiStore'
import type {
  OperationsAIDecisionPayload,
  OperationsCalculationsPayload,
  OperationsNormalizationPayload,
  OperationsOutcomePayload,
  OperationsPipelinePayload,
  OperationsScreeningPayload,
  OperationsStepId,
  OperationsVariancePayload,
} from '../../types/api'
import { formatRelativeDate } from '../../utils/formatters'
import { PipelineLeftNav } from './PipelineLeftNav'
import { AIDecisionStep } from './steps/AIDecisionStep'
import { CalculationsStep } from './steps/CalculationsStep'
import { NormalizationStep } from './steps/NormalizationStep'
import { OutcomeStep } from './steps/OutcomeStep'
import { ScreeningStep } from './steps/ScreeningStep'
import { VarianceAnalysisStep } from './steps/VarianceAnalysisStep'

export function PipelinePage() {
  const { processId = '' } = useParams()
  const navigate = useNavigate()
  const pushToast = useUiStore((state) => state.pushToast)
  const [selectedStep, setSelectedStep] = useState<OperationsStepId>('normalization')
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const pipelineQuery = useQuery({
    queryKey: ['operations-pipeline', processId],
    queryFn: async () => (await api.get<OperationsPipelinePayload>(`/operations/pipelines/${processId}`)).data,
    enabled: Boolean(processId),
  })

  useEffect(() => {
    if (pipelineQuery.data?.current_step_id) {
      setSelectedStep(pipelineQuery.data.current_step_id)
    }
  }, [pipelineQuery.data?.current_step_id])

  const normalizationQuery = useQuery({
    queryKey: ['operations-pipeline-normalization', processId],
    queryFn: async () => (await api.get<OperationsNormalizationPayload>(`/operations/pipelines/${processId}/normalization`)).data,
    enabled: Boolean(processId) && selectedStep === 'normalization',
  })

  const calculationsQuery = useQuery({
    queryKey: ['operations-pipeline-calculations', processId],
    queryFn: async () => (await api.get<OperationsCalculationsPayload>(`/operations/pipelines/${processId}/calculations`)).data,
    enabled: Boolean(processId) && selectedStep === 'calculations',
  })

  const varianceQuery = useQuery({
    queryKey: ['operations-pipeline-variance', processId],
    queryFn: async () => (await api.get<OperationsVariancePayload>(`/operations/pipelines/${processId}/variance`)).data,
    enabled: Boolean(processId) && selectedStep === 'variance_analysis',
  })

  const screeningQuery = useQuery({
    queryKey: ['operations-pipeline-screening', processId],
    queryFn: async () => (await api.get<OperationsScreeningPayload>(`/operations/pipelines/${processId}/screening`)).data,
    enabled: Boolean(processId) && selectedStep === 'screening',
  })

  const aiDecisionQuery = useQuery({
    queryKey: ['operations-pipeline-ai-decision', processId],
    queryFn: async () => (await api.get<OperationsAIDecisionPayload>(`/operations/pipelines/${processId}/ai-decision`)).data,
    enabled: Boolean(processId) && selectedStep === 'ai_decision',
  })

  const outcomeQuery = useQuery({
    queryKey: ['operations-pipeline-outcome', processId],
    queryFn: async () => (await api.get<OperationsOutcomePayload>(`/operations/pipelines/${processId}/outcome`)).data,
    enabled: Boolean(processId) && selectedStep === 'outcome',
  })

  async function refetchActiveStep(stepId: OperationsStepId) {
    if (stepId === 'normalization') {
      await normalizationQuery.refetch()
      return
    }
    if (stepId === 'calculations') {
      await calculationsQuery.refetch()
      return
    }
    if (stepId === 'variance_analysis') {
      await varianceQuery.refetch()
      return
    }
    if (stepId === 'screening') {
      await screeningQuery.refetch()
      return
    }
    if (stepId === 'ai_decision') {
      await aiDecisionQuery.refetch()
      return
    }
    await outcomeQuery.refetch()
  }

  async function advancePipeline(stepId: OperationsStepId, action = 'approve') {
    setBusyAction(`${stepId}:${action}`)
    try {
      await api.post(`/operations/pipelines/${processId}/advance`, {
        current_step: stepId,
        action,
        notes: null,
      })
      await Promise.all([pipelineQuery.refetch(), refetchActiveStep(stepId)])
      pushToast({ tone: 'success', message: `${titleCase(stepId)} updated with ${titleCase(action)}.` })
    } catch (caughtError: unknown) {
      pushToast({ tone: 'error', message: extractErrorMessage(caughtError) ?? 'Unable to advance this pipeline right now.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function abortPipeline() {
    setBusyAction('abort')
    try {
      await api.post(`/operations/pipelines/${processId}/abort`, { reason: 'Aborted from the operations pipeline view' })
      pushToast({ tone: 'warning', message: `${processId} was aborted and removed from the active workflow list.` })
      navigate('/claims/cession-files')
    } catch (caughtError: unknown) {
      pushToast({ tone: 'error', message: extractErrorMessage(caughtError) ?? 'Unable to abort this pipeline.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function resolveScreening(screeningRef: string, action: string) {
    setBusyAction(`screening:${action}`)
    try {
      await api.post(`/operations/pipelines/${processId}/screening/resolve`, {
        screening_ref: screeningRef,
        action,
        notes: null,
      })
      await screeningQuery.refetch()
      await pipelineQuery.refetch()
      pushToast({ tone: 'success', message: `${screeningRef} updated with ${titleCase(action)}.` })
    } catch (caughtError: unknown) {
      pushToast({ tone: 'error', message: extractErrorMessage(caughtError) ?? 'Unable to resolve this screening hit.' })
    } finally {
      setBusyAction(null)
    }
  }

  if (pipelineQuery.isLoading) {
    return <div className="panel-card">Loading operations pipeline...</div>
  }

  if (pipelineQuery.isError || !pipelineQuery.data) {
    return (
      <EmptyState
        description="The operations pipeline could not be loaded. Return to the queue and open the workflow again."
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Unable to load this pipeline"
      />
    )
  }

  const pipeline = pipelineQuery.data
  const isApproved = outcomeQuery.data?.final_status.toLowerCase() === 'approved'
  const showAdvanceButton = selectedStep !== 'outcome'

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Operations', to: '/claims/cession-files' }, { label: pipeline.filename }]} />
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          {/* <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-iris-text-muted">Operations Pipeline</p> */}
          <h1 className="text-[28px] font-bold leading-tight text-iris-text-primary">{pipeline.filename}</h1>
          <p className="mt-1.5 text-[13px] text-iris-text-secondary">
            {pipeline.cedent} · {pipeline.period ?? 'Current Period'} · {pipeline.process_id}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showAdvanceButton ? (
            <button className="btn-primary" disabled={busyAction !== null} onClick={() => void advancePipeline(selectedStep)} type="button">
              {busyAction?.startsWith(selectedStep) ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              Next Phase
            </button>
          ) : null}
          {!showAdvanceButton && isApproved ? (
            <button className="btn-primary bg-[#117A65] hover:bg-[#14866F]" onClick={() => navigate('/claims/cession-files')} type="button">
              <CheckCircle2 className="h-4 w-4" />
              Workflow Complete +
            </button>
          ) : null}
          <button className="btn-secondary" disabled={busyAction !== null} onClick={() => void abortPipeline()} type="button">
            <OctagonPause className="h-4 w-4" />
            Abort Process
          </button>
        </div>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <InfoChip label="Cedent" value={pipeline.cedent} />
        <InfoChip label="Current Step" value={pipeline.current_step} />
        <InfoChip label="Priority" value={pipeline.priority} />
        <InfoChip label="Received" value={formatRelativeDate(pipeline.received_at)} />
        <InfoChip label="Pipeline Health" value={pipeline.pipeline_health} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <PipelineLeftNav
          currentStepId={selectedStep}
          filename={pipeline.filename}
          health={pipeline.pipeline_health}
          onSelect={setSelectedStep}
          processId={pipeline.process_id}
          steps={pipeline.steps}
        />

        <section className="rounded-[24px] border border-iris-border bg-white p-6 shadow-sm">
          {selectedStep === 'normalization' && normalizationQuery.data ? <NormalizationStep payload={normalizationQuery.data} /> : null}
          {selectedStep === 'calculations' && calculationsQuery.data ? <CalculationsStep payload={calculationsQuery.data} /> : null}
          {selectedStep === 'variance_analysis' && varianceQuery.data ? <VarianceAnalysisStep busy={busyAction !== null} onAction={(action) => void advancePipeline('variance_analysis', action)} payload={varianceQuery.data} /> : null}
          {selectedStep === 'screening' && screeningQuery.data ? (
            <ScreeningStep
              busy={busyAction !== null}
              onResolve={(screeningRef, action) => void resolveScreening(screeningRef, action)}
              payload={screeningQuery.data}
              processId={pipeline.process_id}
            />
          ) : null}
          {selectedStep === 'ai_decision' && aiDecisionQuery.data ? <AIDecisionStep busy={busyAction !== null} onAction={(action) => void advancePipeline('ai_decision', action)} payload={aiDecisionQuery.data} /> : null}
          {selectedStep === 'outcome' && outcomeQuery.data ? <OutcomeStep busy={busyAction !== null} onAction={(action) => void advancePipeline('outcome', action)} payload={outcomeQuery.data} /> : null}

          {activeQueryForStep(selectedStep, {
            normalization: normalizationQuery.isLoading,
            calculations: calculationsQuery.isLoading,
            variance_analysis: varianceQuery.isLoading,
            screening: screeningQuery.isLoading,
            ai_decision: aiDecisionQuery.isLoading,
            outcome: outcomeQuery.isLoading,
          }) ? <div className="panel-card">Loading step details...</div> : null}
        </section>
      </div>
    </div>
  )
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[#D9E3EA] bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-iris-text-muted">{label}</p>
      <p className="mt-2 text-[15px] font-semibold text-iris-text-primary">{value}</p>
    </div>
  )
}

function activeQueryForStep(
  stepId: OperationsStepId,
  state: Record<OperationsStepId, boolean>,
) {
  return state[stepId]
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function extractErrorMessage(caughtError: unknown) {
  const maybeMessage = caughtError as { response?: { data?: { details?: string } } }
  return maybeMessage.response?.data?.details
}
