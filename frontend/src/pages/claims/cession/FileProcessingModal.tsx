import { Fragment, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Check, ChevronDown, ChevronRight, Download, Eye, FileUp, RefreshCw, Send, Sparkles, Upload, X } from 'lucide-react'
import {
  ArrowsClockwise,
  ArrowClockwise,
  CaretDown,
  CaretRight,
  ChartBar,
  CheckCircle,
  Cpu,
  FastForwardCircle,
  FileText,
  Files as FilesIcon,
  Flag,
  Handshake,
  ListChecks,
  MagnifyingGlass,
  PauseCircle,
  Path,
  ProhibitInset,
  Receipt,
  ShieldCheck,
  Sparkle as SparkleIcon,
  Target,
  Timer,
  TreeStructure,
  TrendUp,
  UploadSimple,
  WarningCircle,
  WarningDiamond,
} from '@phosphor-icons/react'
import { Link } from 'react-router-dom'

import { api } from '../../../api/client'
import { formatCurrency, formatRelativeDate } from '../../../utils/formatters'
import type {
  CedentListItem,
  ClaimsAuditEvent,
  ClaimsCessionDetailPayload,
  ClaimsCessionTestcase,
  ClaimsCessionTestcasePayload,
  ClaimsExceptionItem,
  ClaimsPipelineStageResponse,
  ClaimsUploadResponse,
  ClaimsWorkflowPayload,
  ClaimsWorklistScreeningSummary,
  ClaimsWorklistTask,
  ContractListItem,
} from '../../../types/api'

type ClaimsStep =
  | 'upload'
  | 'workflow'
  | 'detect-map'
  | 'validate'
  | 'exceptions'
  | 'clauses'
  | 'process'
  | 'summary'
  | 'screening'
  | 'files'
  | 'worklist'
  | 'audit'

type BackendClaimsStep =
  | 'upload'
  | 'detect'
  | 'map-contract'
  | 'validate'
  | 'exceptions'
  | 'clauses'
  | 'process'
  | 'summary'
  | 'files'
  | 'worklist'
  | 'audit'

type UploadMode = 'auto' | 'manual'
type ExceptionChoice = 'pending' | 'accept' | 'override' | 'manual'

type ModalNotice = {
  tone: 'success' | 'error'
  message: string
} | null

type ExceptionActionState = Record<
  string,
  {
    choice: ExceptionChoice
    manualValue: string
  }
>

interface FileProcessingModalProps {
  fileId?: string | null
  startInUpload?: boolean
  cedentOptions: CedentListItem[]
  contractOptions: ContractListItem[]
  onClose: () => void
  onRefresh: () => Promise<unknown> | void
}

interface CessionFileProcessingWorkflowProps extends FileProcessingModalProps {
  presentation?: 'modal' | 'page'
  backLabel?: string
  onFileCreated?: (fileId: string) => void
}

type StepDefinition = {
  id: ClaimsStep
  label: string
  icon: React.ElementType
}

type StepStatusEntry = {
  status: string
  label: string
  timestamp: string
  message?: string | null
}

const BASE_PIPELINE_STEPS: StepDefinition[] = [
  { id: 'upload', label: 'Upload', icon: UploadSimple },
  { id: 'workflow', label: 'Workflow', icon: TreeStructure },
  { id: 'detect-map', label: 'Detect & Map', icon: MagnifyingGlass },
  { id: 'validate', label: 'Anomalies', icon: WarningCircle },
  { id: 'exceptions', label: 'Resolutions', icon: Handshake },
  { id: 'clauses', label: 'Clauses', icon: FileText },
  { id: 'process', label: 'Process', icon: Cpu },
  { id: 'summary', label: 'Summary', icon: ChartBar },
  { id: 'screening', label: 'Sanction Screening', icon: ShieldCheck },
  { id: 'files', label: 'Files', icon: FilesIcon },
  { id: 'worklist', label: 'Worklist', icon: ListChecks },
  { id: 'audit', label: 'Audit', icon: Receipt },
]

const FILE_TYPE_OPTIONS = [
  'Pension Status',
  'Settlement',
  'Fixed Leg',
  'Mortality Report',
  'Spouse Events',
  'Activity Report',
  'Fee Schedule',
]

export function CessionFileProcessingWorkflow({
  fileId,
  startInUpload = false,
  cedentOptions,
  contractOptions,
  onClose,
  onRefresh,
  presentation = 'page',
  backLabel = 'Back to Cession Files',
}: CessionFileProcessingWorkflowProps) {
  const [activeFileId, setActiveFileId] = useState<string | null>(fileId ?? null)
  const [selectedStep, setSelectedStep] = useState<ClaimsStep>(fileId && !startInUpload ? 'workflow' : 'upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadMode, setUploadMode] = useState<UploadMode>('auto')
  const [manualUploadFileType, setManualUploadFileType] = useState('Fixed Leg')
  const [detectFileType, setDetectFileType] = useState('Fixed Leg')
  const [detectCedentId, setDetectCedentId] = useState('')
  const [mappedContractId, setMappedContractId] = useState('')
  const [exceptionActions, setExceptionActions] = useState<ExceptionActionState>({})
  const [notice, setNotice] = useState<ModalNotice>(null)
  const [busy, setBusy] = useState(false)
  const [testcaseBusy, setTestcaseBusy] = useState<string | null>(null)
  const [pendingManualType, setPendingManualType] = useState<string | null>(null)
  const [autoValidating, setAutoValidating] = useState(false)
  const [fileActionBusy, setFileActionBusy] = useState<string | null>(null)
  const [filePreview, setFilePreview] = useState<{ artifactId: string; filename: string; content: string } | null>(null)

  const initializedFileId = useRef<string | null>(null)

  const detailQuery = useQuery({
    queryKey: ['claims-cession-file-detail', activeFileId],
    queryFn: async () => (await api.get<ClaimsCessionDetailPayload>(`/claims/cession-files/${activeFileId}`)).data,
    enabled: Boolean(activeFileId),
    refetchInterval: (query) => {
      const nextDetail = query.state.data as ClaimsCessionDetailPayload | undefined
      const status = nextDetail?.workflow?.status
      return activeFileId && status && status !== 'completed' ? 3000 : false
    },
  })

  const testcaseQuery = useQuery({
    queryKey: ['claims-cession-upload-testcases'],
    queryFn: async () => (await api.get<ClaimsCessionTestcasePayload>('/claims/cession-files/testcases')).data,
    staleTime: 60_000,
  })

  useEffect(() => {
    setActiveFileId(fileId ?? null)
    if (!fileId) {
      setSelectedStep('upload')
      return
    }
    setSelectedStep(startInUpload ? 'upload' : 'workflow')
  }, [fileId, startInUpload])

  useEffect(() => {
    if (!detailQuery.data) {
      return
    }

    const detail = detailQuery.data
    if (initializedFileId.current !== detail.file_id) {
      initializedFileId.current = detail.file_id
      setSelectedStep(detail.workflow && !startInUpload ? 'workflow' : resolveVisibleStep(detail))
      setDetectFileType(pendingManualType ?? detail.detection.file_type)
      setDetectCedentId(detail.detection.cedent_id ?? '')
      setMappedContractId(detail.contract_mapping.contract_id)
      setExceptionActions(buildExceptionState(detail.exceptions.items))
      setPendingManualType(null)
      return
    }

    if (!Object.keys(exceptionActions).length && detail.exceptions.items.length) {
      setExceptionActions(buildExceptionState(detail.exceptions.items))
    }
  }, [detailQuery.data, exceptionActions, pendingManualType])

  const detail = detailQuery.data
  const workflow = detail?.workflow
  const currentStep = activeFileId ? selectedStep : 'upload'
  const currentStepAgent = workflow ? getWorkflowAgentForStep(workflow, currentStep) : null
  const workflowPausedAgent = workflow?.agents.find((agent) => agent.status === 'awaiting_approval' || agent.status === 'failed') ?? null
  const screeningTask = detail ? getScreeningTask(detail) : null
  const worklistItems = detail ? detail.worklist.items.filter((item) => item.wl_id !== screeningTask?.wl_id) : []
  const pipelineSteps = buildPipelineSteps()

  useEffect(() => {
    if (workflow || !activeFileId || !detail || currentStep !== 'validate' || detail.stage !== 'clauses' || autoValidating) {
      return
    }

    let cancelled = false

    async function hydrateValidationStep() {
      setAutoValidating(true)
      try {
        await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/validate`, {})
        const refreshed = await detailQuery.refetch()
        if (cancelled) {
          return
        }
        setExceptionActions(buildExceptionState(refreshed.data?.exceptions.items ?? []))
      } catch (caughtError: unknown) {
        if (cancelled) {
          return
        }
        setNotice({
          tone: 'error',
          message: extractErrorMessage(caughtError) ?? 'Unable to load anomalies right now.',
        })
      } finally {
        if (!cancelled) {
          setAutoValidating(false)
        }
      }
    }

    void hydrateValidationStep()

    return () => {
      cancelled = true
    }
  }, [activeFileId, autoValidating, currentStep, detail, detailQuery, workflow])
  const actualCurrentStep = detail ? resolveVisibleStep(detail) : currentStep
  const visualCurrentStep = resolveVisualCurrentStep(actualCurrentStep, currentStep, pipelineSteps)
  const completedSteps = buildCompletedSteps(detail, pipelineSteps, visualCurrentStep)
  const stepStatusMap = buildStepStatusMap(detail, pipelineSteps, visualCurrentStep)

  const visibleContracts = contractOptions.filter((item) => !detectCedentId || item.cedent_id === detectCedentId)
  useEffect(() => {
    if (!visibleContracts.length) {
      return
    }
    if (!visibleContracts.some((item) => item.contract_id === mappedContractId)) {
      setMappedContractId(visibleContracts[0].contract_id)
    }
  }, [mappedContractId, visibleContracts])
  const pendingResolutionCount = detail ? countPendingResolutionActions(detail.exceptions.items, exceptionActions) : 0
  const invalidOverrideCount = detail ? countInvalidOverrideActions(detail.exceptions.items, exceptionActions) : 0
  const validationReady = currentStep !== 'validate' || (!autoValidating && detail?.stage !== 'clauses')
  const canContinue = workflow
    ? !busy &&
      (currentStep === 'upload'
        ? Boolean(selectedFile)
        : currentStep === 'workflow'
          ? Boolean(workflowPausedAgent) || workflow.status === 'completed'
        : currentStep === 'detect-map'
          ? true
          : currentStep === 'exceptions'
            ? (detail?.exceptions.items.length ?? 0) !== 0 && pendingResolutionCount === 0 && invalidOverrideCount === 0
            : Boolean(currentStepAgent && ['awaiting_approval', 'failed'].includes(currentStepAgent.status)))
    : !busy &&
      !autoValidating &&
      (currentStep !== 'upload' || Boolean(selectedFile)) &&
      validationReady &&
      (currentStep !== 'exceptions' ||
        ((detail?.exceptions.items.length ?? 0) !== 0 && pendingResolutionCount === 0 && invalidOverrideCount === 0))
  const primaryActionLabel = workflow
    ? currentStep === 'upload'
      ? 'Continue'
      : currentStep === 'workflow'
        ? workflowPausedAgent
          ? workflowPausedAgent.review_label
          : workflow.status === 'completed'
            ? 'Finish'
            : 'Workflow Running'
      : currentStep === 'detect-map'
        ? 'Save & Resume'
      : currentStep === 'exceptions'
          ? 'Apply Resolutions'
          : currentStepAgent && ['awaiting_approval', 'failed'].includes(currentStepAgent.status)
            ? 'Approve & Resume'
            : currentStep === 'audit'
              ? 'Finish'
              : 'Continue'
    : currentStep === 'audit'
      ? 'Finish'
      : 'Continue'

  function openWorkflowStep(step: ClaimsStep) {
    setSelectedStep(step)
  }

  async function approveWorkflowAgent(agentKey: string, notes: string) {
    if (!activeFileId) {
      return
    }
    await api.post(`/claims/cession-files/${activeFileId}/workflow/agents/${agentKey}/approve`, {
      notes,
    })
    await Promise.all([detailQuery.refetch(), Promise.resolve(onRefresh())])
    openWorkflowStep('workflow')
  }

  async function handleContinue() {
    setNotice(null)
    setBusy(true)

    try {
      if (!activeFileId && currentStep === 'upload') {
        await handleUpload()
        return
      }

      if (!activeFileId) {
        return
      }

      if (workflow) {
        if (currentStep === 'workflow') {
          if (workflowPausedAgent) {
            openWorkflowStep(normalizeWorkflowStepId(workflowPausedAgent.review_step_id))
            return
          }
          if (workflow.status === 'completed') {
            await Promise.resolve(onRefresh())
            onClose()
          }
          return
        }

        if (currentStep === 'detect-map') {
          const contractOverrideId = visibleContracts.some((item) => item.contract_id === mappedContractId) ? mappedContractId : null
          await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/detect`, {
            override_file_type: detectFileType || null,
            override_cedent_id: detectCedentId || null,
          })
          await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/map-contract`, {
            override_contract_id: contractOverrideId,
          })
          if (currentStepAgent && ['awaiting_approval', 'failed'].includes(currentStepAgent.status)) {
            await approveWorkflowAgent('mapping', 'Detection and contract mapping were reviewed and approved.')
          } else {
            await Promise.all([detailQuery.refetch(), Promise.resolve(onRefresh())])
            openWorkflowStep('workflow')
          }
          return
        }

        if (currentStep === 'exceptions') {
          if (pendingResolutionCount > 0) {
            setNotice({
              tone: 'error',
              message: 'Choose an action for every resolution item before continuing.',
            })
            return
          }
          if (invalidOverrideCount > 0) {
            setNotice({
              tone: 'error',
              message: 'Enter a manual override value for every item marked Override before continuing.',
            })
            return
          }
          const payload = buildExceptionResolutionPayload(detail?.exceptions.items ?? [], exceptionActions)
          await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/process-exceptions`, {
            exception_resolutions: payload,
          })
          const refreshed = await detailQuery.refetch()
          setExceptionActions(buildExceptionState(refreshed.data?.exceptions.items ?? []))
          await Promise.resolve(onRefresh())
          openWorkflowStep('workflow')
          return
        }

        if (currentStepAgent && ['awaiting_approval', 'failed'].includes(currentStepAgent.status)) {
          await approveWorkflowAgent(
            currentStepAgent.key,
            `${currentStepAgent.agent_name} was reviewed in the cession workflow screen and approved to continue.`,
          )
          return
        }

        openWorkflowStep('workflow')
        return
      }

      if (currentStep === 'detect-map') {
        const contractOverrideId = visibleContracts.some((item) => item.contract_id === mappedContractId) ? mappedContractId : null
        await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/detect`, {
          override_file_type: detectFileType || null,
          override_cedent_id: detectCedentId || null,
        })
        await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/map-contract`, {
          override_contract_id: contractOverrideId,
        })
        await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/validate`, {})
        const refreshed = await detailQuery.refetch()
        setDetectFileType(refreshed.data?.detection.file_type ?? detectFileType)
        setDetectCedentId(refreshed.data?.detection.cedent_id ?? detectCedentId)
        setMappedContractId(refreshed.data?.contract_mapping.contract_id ?? mappedContractId)
        setExceptionActions(buildExceptionState(refreshed.data?.exceptions.items ?? []))
        await Promise.resolve(onRefresh())
        setSelectedStep('validate')
        return
      }

      if (currentStep === 'validate') {
        const nextExceptions = detail?.exceptions.items ?? []
        setExceptionActions(buildExceptionState(nextExceptions))
        setSelectedStep(nextExceptions.length ? 'exceptions' : 'clauses')
        return
      }

      if (currentStep === 'exceptions') {
        if (pendingResolutionCount > 0) {
          setNotice({
            tone: 'error',
            message: 'Choose an action for every resolution item before continuing.',
          })
          return
        }
        if (invalidOverrideCount > 0) {
          setNotice({
            tone: 'error',
            message: 'Enter a manual override value for every item marked Override before continuing.',
          })
          return
        }
        const payload = buildExceptionResolutionPayload(detail?.exceptions.items ?? [], exceptionActions)
        await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/process-exceptions`, {
          exception_resolutions: payload,
        })
        const refreshed = await detailQuery.refetch()
        setExceptionActions(buildExceptionState(refreshed.data?.exceptions.items ?? []))
        setSelectedStep(resolveVisibleStep(refreshed.data))
        return
      }

      if (currentStep === 'clauses') {
        await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/clauses`, {})
        const refreshed = await detailQuery.refetch()
        setSelectedStep(resolveVisibleStep(refreshed.data))
        return
      }

      if (currentStep === 'process') {
        await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/process`, {})
        await Promise.all([detailQuery.refetch(), Promise.resolve(onRefresh())])
        setSelectedStep('summary')
        return
      }

      if (currentStep === 'summary') {
        setSelectedStep(screeningTask ? 'screening' : detail?.downstream_files.items.length ? 'files' : 'worklist')
        return
      }

      if (currentStep === 'screening') {
        setSelectedStep(detail?.downstream_files.items.length ? 'files' : 'worklist')
        return
      }

      if (currentStep === 'files') {
        setSelectedStep('worklist')
        return
      }

      if (currentStep === 'worklist') {
        setSelectedStep('audit')
        return
      }

      if (currentStep === 'audit') {
        await Promise.resolve(onRefresh())
        onClose()
      }
    } catch (caughtError: unknown) {
      setNotice({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to continue this pipeline step right now.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile)
    if (uploadMode === 'manual') {
      formData.append('file_type', manualUploadFileType)
    }
    const { data } = await api.post<ClaimsUploadResponse>('/claims/cession-files/upload', formData)
    setActiveFileId(data.file_id)
    initializedFileId.current = null
    setPendingManualType(uploadMode === 'manual' ? manualUploadFileType : null)
    setSelectedStep('workflow')
    await Promise.resolve(onRefresh())
    setNotice({
      tone: 'success',
      message: `${data.file_id} uploaded and the autonomous workflow started immediately.`,
    })
  }

  async function handlePickTestcaseFile(testcase: ClaimsCessionTestcase) {
    setTestcaseBusy(buildTestcaseActionKey('select', testcase.filename))
    setNotice(null)
    try {
      const response = await api.get<Blob>(testcase.download_url, {
        responseType: 'blob',
      })
      const contentType = response.data.type || testcase.content_type
      setSelectedFile(new File([response.data], testcase.filename, { type: contentType }))
    } catch (caughtError: unknown) {
      setNotice({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to load that backend testcase right now.',
      })
    } finally {
      setTestcaseBusy(null)
    }
  }

  async function handleDownloadTestcaseFile(testcase: ClaimsCessionTestcase) {
    setTestcaseBusy(buildTestcaseActionKey('download', testcase.filename))
    setNotice(null)
    try {
      const response = await api.get<Blob>(testcase.download_url, {
        responseType: 'blob',
      })
      downloadBlob(response.data, testcase.filename)
    } catch (caughtError: unknown) {
      setNotice({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to download that backend testcase right now.',
      })
    } finally {
      setTestcaseBusy(null)
    }
  }

  async function handleApprove() {
    if (!activeFileId) {
      return
    }

    setBusy(true)
    setNotice(null)
    try {
      await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/approve`, {})
      await Promise.all([detailQuery.refetch(), Promise.resolve(onRefresh())])
      setSelectedStep('worklist')
      setNotice({
        tone: 'success',
        message: `${activeFileId} approved and moved to the final audit view.`,
      })
    } catch (caughtError: unknown) {
      setNotice({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to approve this processing run right now.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handlePushFiles() {
    if (!activeFileId) {
      return
    }

    setFileActionBusy('push')
    setNotice(null)
    try {
      await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/files`, {})
      await Promise.all([detailQuery.refetch(), Promise.resolve(onRefresh())])
      if (workflow) {
        openWorkflowStep('workflow')
      } else {
        setSelectedStep('worklist')
      }
      setNotice({
        tone: 'success',
        message: 'Downstream files pushed to SFTP and released to Reports.',
      })
    } catch (caughtError: unknown) {
      setNotice({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to push downstream files right now.',
      })
    } finally {
      setFileActionBusy(null)
    }
  }

  async function handleDownloadArtifact(artifactId: string, filename: string) {
    if (!activeFileId) {
      return
    }

    setFileActionBusy(`download:${artifactId}`)
    try {
      const response = await api.get<Blob>(`/claims/cession-files/${activeFileId}/settlement-artifacts/${artifactId}/download`, {
        responseType: 'blob',
      })
      downloadBlob(response.data, filename)
    } catch (caughtError: unknown) {
      setNotice({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to download this downstream file.',
      })
    } finally {
      setFileActionBusy(null)
    }
  }

  async function handlePreviewArtifact(artifactId: string, filename: string) {
    if (!activeFileId) {
      return
    }

    setFileActionBusy(`preview:${artifactId}`)
    try {
      const response = await api.get<Blob>(`/claims/cession-files/${activeFileId}/settlement-artifacts/${artifactId}/download`, {
        responseType: 'blob',
      })
      setFilePreview({
        artifactId,
        filename,
        content: await response.data.text(),
      })
    } catch (caughtError: unknown) {
      setNotice({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to preview this downstream file.',
      })
    } finally {
      setFileActionBusy(null)
    }
  }

  const isPage = presentation === 'page'
  const showBetaHeader = Boolean(detail && detail.file_type !== 'Settlement')
  const betaSuffix = showBetaHeader ? ' (beta)' : ''
  const pageTitle = activeFileId && detail ? `${detail.file_id} · ${detail.filename}${betaSuffix}` : 'New Cession File'
  const pageSubtitle = activeFileId && detail ? `${detail.cedent} · ${detail.file_type} · ${formatCount(detail.records)} records` : 'Upload + AI-assisted ingestion pipeline'

  if (isPage) {
    return (
      <div className="cession-compact pb-6">
        <div className="mb-5 border-b border-[#E5EBF0] pb-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
              <button className="btn-secondary w-fit" onClick={onClose} type="button">
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[28px] font-bold leading-tight text-iris-text-primary">{pageTitle}</h1>
                  {detail ? <PipelineStageBadge stage={detail.stage} /> : null}
                </div>
                <p className="mt-1.5 text-[13px] text-iris-text-secondary">{pageSubtitle}</p>
              </div>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-lg border border-[#D7E1E8] bg-white shadow-sm">
          <div className="overflow-x-auto border-t border-[#E5EBF0] bg-white px-4 py-3 md:px-6">
            <PipelineStepper
              activeFileId={activeFileId}
              actualCurrentStep={actualCurrentStep}
              completedSteps={completedSteps}
              currentStep={currentStep}
              stepStatusMap={stepStatusMap}
              steps={pipelineSteps}
              onOpenStep={openWorkflowStep}
            />
          </div>

          <div className="min-h-[620px] bg-[#FAFBFC] px-4 py-5 md:px-6">
            {notice ? <NoticeBanner tone={notice.tone}>{notice.message}</NoticeBanner> : null}

            {detailQuery.isLoading && activeFileId ? <div className="panel-card">Loading file detail...</div> : null}

            {currentStep === 'upload' ? (
              <UploadStep
                manualUploadFileType={manualUploadFileType}
                selectedFile={selectedFile}
                testcaseBusy={testcaseBusy}
                testcaseError={testcaseQuery.isError ? 'Unable to load backend testcase quick access right now.' : null}
                testcaseItems={testcaseQuery.data?.items ?? []}
                testcaseLoading={testcaseQuery.isLoading}
                uploadMode={uploadMode}
                onFilePicked={setSelectedFile}
                onManualUploadFileTypeChange={setManualUploadFileType}
                onPickTestcase={handlePickTestcaseFile}
                onDownloadTestcase={handleDownloadTestcaseFile}
                onUploadModeChange={setUploadMode}
              />
            ) : null}

            {detail && currentStep === 'detect-map' ? (
              <DetectAndMapStep
                cedentOptions={cedentOptions}
                detectCedentId={detectCedentId}
                detectFileType={detectFileType}
                detail={detail}
                contractOptions={visibleContracts}
                mappedContractId={mappedContractId}
                onCedentChange={setDetectCedentId}
                onFileTypeChange={setDetectFileType}
                onContractChange={setMappedContractId}
              />
            ) : null}

            {detail && workflow && currentStep === 'workflow' ? (
              <WorkflowOrchestrationStep
                busy={busy}
                detail={detail}
                onApproveAgent={(agentKey) => void approveWorkflowAgent(agentKey, 'Workflow review approved from the workflow step.')}
                onOpenAgent={(step) => openWorkflowStep(step)}
              />
            ) : null}

            {detail && currentStep === 'validate' ? <ValidateStep detail={detail} /> : null}

            {detail && currentStep === 'exceptions' ? (
              <ExceptionsStep
                detail={detail}
                exceptionActions={exceptionActions}
                onExceptionActionsChange={setExceptionActions}
              />
            ) : null}

            {detail && currentStep === 'clauses' ? <ClausesStep detail={detail} /> : null}
            {detail && currentStep === 'process' ? <ProcessStep detail={detail} /> : null}

            {detail && currentStep === 'summary' ? <SummaryStep busy={busy} detail={detail} onApprove={() => void handleApprove()} /> : null}

            {screeningTask && currentStep === 'screening' ? <ScreeningStep item={screeningTask} /> : null}

            {detail && currentStep === 'files' ? (
              <FilesStep
                busyAction={fileActionBusy}
                payload={detail.downstream_files}
                preview={filePreview}
                onDownload={(artifactId, filename) => void handleDownloadArtifact(artifactId, filename)}
                onPreview={(artifactId, filename) => void handlePreviewArtifact(artifactId, filename)}
                onPush={() => void handlePushFiles()}
              />
            ) : null}

            {detail && currentStep === 'worklist' ? <WorklistStep items={worklistItems} subtitle={detail.worklist.subtitle} title={detail.worklist.title} /> : null}

            {detail && currentStep === 'audit' ? <AuditStep items={detail.audit.items} subtitle={detail.audit.subtitle} title={detail.audit.title} /> : null}
          </div>

          <div className="flex items-center justify-between border-t border-[#E5EBF0] bg-white px-6 py-4">
            <button className="btn-secondary" onClick={onClose} type="button">
              Save & Close
            </button>

            <div className="flex items-center gap-2">
              {workflow && currentStep !== 'upload' && currentStep !== 'workflow' ? (
                <button className="btn-secondary" disabled={busy} onClick={() => openWorkflowStep('workflow')} type="button">
                  <RefreshCw className="h-4 w-4" />
                  Back to Workflow
                </button>
              ) : null}
              {!workflow && currentStep === 'summary' ? (
                <button className="btn-secondary" disabled={busy} onClick={() => setSelectedStep('process')} type="button">
                  <RefreshCw className="h-4 w-4" />
                  Back to Process
                </button>
              ) : null}
              {!workflow && currentStep === 'screening' ? (
                <button className="btn-secondary" disabled={busy} onClick={() => setSelectedStep('summary')} type="button">
                  <RefreshCw className="h-4 w-4" />
                  Back to Summary
                </button>
              ) : null}
              {!workflow && currentStep === 'files' ? (
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => setSelectedStep(screeningTask ? 'screening' : 'summary')}
                  type="button"
                >
                  <RefreshCw className="h-4 w-4" />
                  Back to {screeningTask ? 'Screening' : 'Summary'}
                </button>
              ) : null}

              <button className="btn-primary" disabled={!canContinue} onClick={() => void handleContinue()} type="button">
                {busy ? 'Working...' : primaryActionLabel}
              </button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  const modalTitle = activeFileId ? `Cession File Processing${betaSuffix}` : 'New Cession File'
  const fileSubtitle = detail
    ? `${detail.file_id} · ${detail.filename} · ${detail.cedent} · ${detail.file_type} · ${formatCount(detail.records)} records`
    : 'Upload + AI-assisted ingestion pipeline'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px]" onClick={onClose} />
      <div className="cession-compact fixed inset-3 z-50 overflow-hidden rounded-[24px] border border-[#D8E2EA] bg-white shadow-[0_24px_70px_rgba(13,27,42,0.24)]">
        <div className="flex h-full flex-col">
          <div className="border-b border-[#E5EBF0] bg-[linear-gradient(180deg,#FBFCFD_0%,#F4F7FA_100%)] px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-[24px] font-bold text-iris-text-primary">{modalTitle}</h2>
                  {detail ? <PipelineStageBadge stage={detail.stage} /> : null}
                </div>
                <p className="mt-2 text-[13px] text-iris-text-secondary">Upload + AI-assisted ingestion pipeline</p>
                <p className="mt-1 text-[12px] text-iris-text-muted">{fileSubtitle}</p>
              </div>

              <button
                className="rounded-full border border-[#D7E2EA] p-2 text-iris-text-secondary transition hover:bg-[#F4F7FA]"
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 overflow-x-auto">
              <PipelineStepper
                activeFileId={activeFileId}
                actualCurrentStep={actualCurrentStep}
                completedSteps={completedSteps}
                currentStep={currentStep}
                stepStatusMap={stepStatusMap}
                steps={pipelineSteps}
                onOpenStep={openWorkflowStep}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#FAFBFC] px-6 py-5">
            {notice ? (
              <NoticeBanner tone={notice.tone}>{notice.message}</NoticeBanner>
            ) : null}

            {detailQuery.isLoading && activeFileId ? (
              <div className="panel-card">Loading file detail...</div>
            ) : null}

            {currentStep === 'upload' ? (
              <UploadStep
                manualUploadFileType={manualUploadFileType}
                selectedFile={selectedFile}
                testcaseBusy={testcaseBusy}
                testcaseError={testcaseQuery.isError ? 'Unable to load backend testcase quick access right now.' : null}
                testcaseItems={testcaseQuery.data?.items ?? []}
                testcaseLoading={testcaseQuery.isLoading}
                uploadMode={uploadMode}
                onFilePicked={setSelectedFile}
                onManualUploadFileTypeChange={setManualUploadFileType}
                onPickTestcase={handlePickTestcaseFile}
                onDownloadTestcase={handleDownloadTestcaseFile}
                onUploadModeChange={setUploadMode}
              />
            ) : null}

            {detail && currentStep === 'detect-map' ? (
              <DetectAndMapStep
                cedentOptions={cedentOptions}
                detectCedentId={detectCedentId}
                detectFileType={detectFileType}
                detail={detail}
                contractOptions={visibleContracts}
                mappedContractId={mappedContractId}
                onCedentChange={setDetectCedentId}
                onFileTypeChange={setDetectFileType}
                onContractChange={setMappedContractId}
              />
            ) : null}

            {detail && workflow && currentStep === 'workflow' ? (
              <WorkflowOrchestrationStep
                busy={busy}
                detail={detail}
                onApproveAgent={(agentKey) => void approveWorkflowAgent(agentKey, 'Workflow review approved from the workflow step.')}
                onOpenAgent={(step) => openWorkflowStep(step)}
              />
            ) : null}

            {detail && currentStep === 'validate' ? <ValidateStep detail={detail} /> : null}

            {detail && currentStep === 'exceptions' ? (
              <ExceptionsStep
                detail={detail}
                exceptionActions={exceptionActions}
                onExceptionActionsChange={setExceptionActions}
              />
            ) : null}

            {detail && currentStep === 'clauses' ? <ClausesStep detail={detail} /> : null}
            {detail && currentStep === 'process' ? <ProcessStep detail={detail} /> : null}

            {detail && currentStep === 'summary' ? <SummaryStep busy={busy} detail={detail} onApprove={() => void handleApprove()} /> : null}

            {screeningTask && currentStep === 'screening' ? <ScreeningStep item={screeningTask} /> : null}

            {detail && currentStep === 'files' ? (
              <FilesStep
                busyAction={fileActionBusy}
                payload={detail.downstream_files}
                preview={filePreview}
                onDownload={(artifactId, filename) => void handleDownloadArtifact(artifactId, filename)}
                onPreview={(artifactId, filename) => void handlePreviewArtifact(artifactId, filename)}
                onPush={() => void handlePushFiles()}
              />
            ) : null}

            {detail && currentStep === 'worklist' ? <WorklistStep items={worklistItems} subtitle={detail.worklist.subtitle} title={detail.worklist.title} /> : null}

            {detail && currentStep === 'audit' ? <AuditStep items={detail.audit.items} subtitle={detail.audit.subtitle} title={detail.audit.title} /> : null}
          </div>

          <div className="flex items-center justify-between border-t border-[#E5EBF0] bg-white px-6 py-4">
            <button className="btn-secondary" onClick={onClose} type="button">
              {currentStep === 'audit' ? 'Close' : 'Cancel'}
            </button>

            <div className="flex items-center gap-2">
              {workflow && currentStep !== 'upload' && currentStep !== 'workflow' ? (
                <button className="btn-secondary" disabled={busy} onClick={() => openWorkflowStep('workflow')} type="button">
                  <RefreshCw className="h-4 w-4" />
                  Back to Workflow
                </button>
              ) : null}
              {!workflow && currentStep === 'summary' ? (
                <button className="btn-secondary" disabled={busy} onClick={() => setSelectedStep('process')} type="button">
                  <RefreshCw className="h-4 w-4" />
                  Back to Process
                </button>
              ) : null}
              {!workflow && currentStep === 'screening' ? (
                <button className="btn-secondary" disabled={busy} onClick={() => setSelectedStep('summary')} type="button">
                  <RefreshCw className="h-4 w-4" />
                  Back to Summary
                </button>
              ) : null}
              {!workflow && currentStep === 'files' ? (
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => setSelectedStep(screeningTask ? 'screening' : 'summary')}
                  type="button"
                >
                  <RefreshCw className="h-4 w-4" />
                  Back to {screeningTask ? 'Screening' : 'Summary'}
                </button>
              ) : null}

              <button className="btn-primary" disabled={!canContinue} onClick={() => void handleContinue()} type="button">
                {busy ? 'Working...' : primaryActionLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export function FileProcessingModal(props: FileProcessingModalProps) {
  return <CessionFileProcessingWorkflow {...props} presentation="modal" />
}

function UploadStep({
  manualUploadFileType,
  selectedFile,
  testcaseBusy,
  testcaseError,
  testcaseItems,
  testcaseLoading,
  uploadMode,
  onFilePicked,
  onManualUploadFileTypeChange,
  onPickTestcase,
  onDownloadTestcase,
  onUploadModeChange,
}: {
  manualUploadFileType: string
  selectedFile: File | null
  testcaseBusy: string | null
  testcaseError: string | null
  testcaseItems: ClaimsCessionTestcase[]
  testcaseLoading: boolean
  uploadMode: UploadMode
  onFilePicked: (file: File | null) => void
  onManualUploadFileTypeChange: (value: string) => void
  onPickTestcase: (testcase: ClaimsCessionTestcase) => void
  onDownloadTestcase: (testcase: ClaimsCessionTestcase) => void
  onUploadModeChange: (value: UploadMode) => void
}) {
  return (
    <div className="space-y-5">
      <SectionHeading title="Upload Cedant File" subtitle="Manual or SFTP-staged. Choose AI auto-detection or pick file type explicitly." />

      <div className="rounded-[22px] border border-dashed border-[#AFC7D8] bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-[#EBF5FB] p-4 text-iris-blue">
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-[14px] font-semibold text-iris-text-primary">Drop file here or choose a backend testcase below</p>
          <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-md border border-iris-border bg-white px-3.5 py-2 text-[13px] font-semibold text-iris-text-primary hover:bg-[#F8FAFC]">
            <FileUp className="h-4 w-4" />
            Choose local file
              <input
                accept=".csv,.txt,.xlsx,.xlsm,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
                className="hidden"
                onChange={(event) => onFilePicked(event.target.files?.[0] ?? null)}
                type="file"
              />
          </label>
          <p className="text-[12px] text-iris-text-secondary">{selectedFile ? `${selectedFile.name} · ${formatCount(selectedFile.size)} bytes` : 'No file selected yet.'}</p>
          <div className="w-full max-w-5xl">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {testcaseItems.map((testcase) => {
                const isActive = selectedFile?.name === testcase.filename
                return (
                  <div
                    key={testcase.filename}
                    className={`cursor-pointer rounded-xl border px-4 py-3 text-left text-[13px] font-medium transition ${
                      isActive
                        ? 'border-iris-blue bg-[#F3F8FB] text-iris-text-primary'
                        : 'border-[#D9E3EA] bg-white text-iris-text-primary hover:bg-[#F8FAFC]'
                    }`}
                    onClick={() => onPickTestcase(testcase)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onPickTestcase(testcase)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate">{testcase.filename}</p>
                        <p className="mt-1 text-[11px] font-normal text-iris-text-secondary">{formatCount(testcase.size_bytes)} bytes</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          aria-label={`Download ${testcase.filename}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D9E3EA] bg-white text-iris-text-secondary transition hover:bg-[#F4F7FA] hover:text-iris-text-primary"
                          disabled={Boolean(testcaseBusy)}
                          onClick={(event) => {
                            event.stopPropagation()
                            onDownloadTestcase(testcase)
                          }}
                          type="button"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {/* <p className="mt-3 text-[12px] text-iris-text-secondary">
                      {isSelecting ? 'Loading testcase...' : isDownloading ? 'Downloading testcase...' : 'Click anywhere on this card to select the file.'}
                    </p> */}
                  </div>
                )
              })}
            </div>
            {testcaseLoading ? <p className="mt-3 text-[12px] text-iris-text-secondary">Loading testcase quick access...</p> : null}
            {testcaseError ? <p className="mt-3 text-[12px] text-[#922B21]">{testcaseError}</p> : null}
            {!testcaseLoading && !testcaseItems.length && !testcaseError ? (
              <p className="mt-3 text-[12px] text-iris-text-secondary">No testcase files were found in <span className="font-mono">backend/testcases</span>.</p>
            ) : null}
          </div>
          {/* <div className="mt-3 rounded-xl border border-[#D9E3EA] bg-[#FBFCFD] px-4 py-3 text-left">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Quick Access Source</p>
            <p className="mt-2 text-[13px] text-iris-text-primary">Quick-access buttons now mirror the current files in <span className="font-mono">backend/testcases</span>, so Claims Ops tests against the updated backend set instead of stale sample names.</p>
          </div> */}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <UploadOptionCard
          active={uploadMode === 'auto'}
          subtitle="IRiS will classify the file type and cedant in the next step."
          title="AI Auto-Detect"
          onSelect={() => onUploadModeChange('auto')}
        />
        <UploadOptionCard
          active={uploadMode === 'manual'}
          subtitle="Pick the file type now and IRiS will carry it into detection."
          title="Manual File Type"
          onSelect={() => onUploadModeChange('manual')}
        >
          <select className="field-input mt-4" value={manualUploadFileType} onChange={(event) => onManualUploadFileTypeChange(event.target.value)}>
            {FILE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </UploadOptionCard>
      </div>
    </div>
  )
}

function DetectAndMapStep({
  cedentOptions,
  contractOptions,
  detectCedentId,
  detectFileType,
  detail,
  mappedContractId,
  onCedentChange,
  onFileTypeChange,
  onContractChange,
}: {
  cedentOptions: CedentListItem[]
  contractOptions: ContractListItem[]
  detectCedentId: string
  detectFileType: string
  detail: ClaimsCessionDetailPayload
  mappedContractId: string
  onCedentChange: (value: string) => void
  onFileTypeChange: (value: string) => void
  onContractChange: (value: string) => void
}) {
  const mapping = detail.contract_mapping
  const selectedContract = contractOptions.find((item) => item.contract_id === mappedContractId)
  const preview = selectedContract
    ? {
        contract_id: selectedContract.contract_id,
        contract_name: selectedContract.contract_name,
        version: selectedContract.version,
        matching_basis: `Manual preview: ${selectedContract.cedent_name} + File Type "${detail.file_type}" + Period ${mapping.period}`,
        confidence: selectedContract.contract_id === mapping.contract_id ? mapping.confidence : 1,
        notional: selectedContract.notional,
        currency: selectedContract.currency,
        fixed_leg_rate_pct: selectedContract.fixed_rate * 100,
        floating_leg: selectedContract.floating_definition || mapping.floating_leg,
        lives_covered: selectedContract.lives_count,
        inception_date: selectedContract.inception_date ?? '',
        maturity_date: selectedContract.maturity_date ?? '',
        status: selectedContract.status,
      }
    : mapping

  return (
    <div className="space-y-6">
      <SectionHeading title="AI Detection & Contract Mapping" subtitle="Review IRiS file detection, cedant identification, and mapped contract before validation." />

      <div className="grid gap-4 xl:grid-cols-2">
        <SelectionCard
          confidence={detail.detection.file_type_confidence}
          subtitle="File Type"
          value={detail.detection.file_type}
        >
          <select className="field-input mt-4" value={detectFileType} onChange={(event) => onFileTypeChange(event.target.value)}>
            {FILE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </SelectionCard>
        <SelectionCard
          confidence={detail.detection.cedent_confidence}
          subtitle="Cedant"
          value={detail.detection.cedent}
        >
          <select className="field-input mt-4" value={detectCedentId} onChange={(event) => onCedentChange(event.target.value)}>
            {cedentOptions.map((option) => (
              <option key={option.cedent_id} value={option.cedent_id}>
                {option.legal_entity_name}
              </option>
            ))}
          </select>
        </SelectionCard>
      </div>

      <div className="rounded-[20px] border border-[#B8E2E0] bg-[#F4FBFB] px-5 py-4 text-[13px] text-iris-text-primary">
        <div className="mb-2 flex items-center gap-2 font-semibold text-[#117A65]">
          <Sparkles className="h-4 w-4" />
          IRiS reasoning
        </div>
        <p>{detail.detection.iris_reasoning}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
        <select className="field-input" value={mappedContractId} onChange={(event) => onContractChange(event.target.value)}>
          {contractOptions.map((option) => (
            <option key={option.contract_id} value={option.contract_id}>
              {option.contract_id} ({option.version})
            </option>
          ))}
        </select>
        <div className="field-input bg-[#F8FAFC]">{preview.version}</div>
        <div className="field-input bg-[#F8FAFC]">{mapping.period}</div>
      </div>

      <div className="rounded-[22px] border border-[#D8E3EA] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[18px] font-bold text-iris-text-primary">
              {preview.contract_id} - {preview.contract_name}
            </p>
            <p className="mt-1 text-[13px] text-iris-text-secondary">{preview.matching_basis}</p>
          </div>
          <span className="rounded-full bg-[#E8F8F5] px-3 py-1 text-[12px] font-semibold text-[#117A65]">
            {formatConfidence(preview.confidence)} confidence
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricLine label="Notional" value={compactCurrency(preview.notional, preview.currency)} />
          <MetricLine label="Fixed leg" value={`${preview.fixed_leg_rate_pct.toFixed(2)}%`} />
          <MetricLine label="Floating leg" value={preview.floating_leg} />
          <MetricLine label="Lives covered" value={formatCount(preview.lives_covered)} />
          <MetricLine label="Inception" value={preview.inception_date} />
          <MetricLine label="Maturity" value={preview.maturity_date} />
          <MetricLine label="Status" value={titleCase(preview.status)} />
          <MetricLine label="Currency" value={preview.currency} />
        </div>
      </div>
    </div>
  )
}

function ClausesStep({ detail }: { detail: ClaimsCessionDetailPayload }) {
  return (
    <div className="space-y-5">
      <SectionHeading title={detail.clauses.title} subtitle={detail.clauses.subtitle} />
      <div className="overflow-hidden rounded-[22px] border border-[#D9E3EA] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F7F9FB]">
              <tr>
                {['Ref', 'Clause', 'Category', 'Description', 'Active'].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.clauses.clauses_checked.map((item) => (
                <tr key={item.clause_id} className="border-t border-[#EEF2F5]">
                  <td className="px-4 py-3 font-mono text-iris-blue">{item.clause_id}</td>
                  <td className="px-4 py-3 font-medium text-iris-text-primary">{item.clause_title}</td>
                  <td className="px-4 py-3 text-iris-text-secondary">{item.category}</td>
                  <td className="px-4 py-3 text-iris-text-secondary">{item.description}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#E8F8F5] px-2.5 py-1 text-[12px] font-semibold text-[#117A65]">
                      <span className="h-2 w-2 rounded-full bg-[#2ECC71]" />
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ValidateStep({ detail }: { detail: ClaimsCessionDetailPayload }) {
  const validation = detail.validation

  return (
    <div className="space-y-5">
      <SectionHeading title="Detected Anomalies" subtitle={`${formatCount(validation.records)} records · ${validation.columns_mapped} columns auto-mapped`} />

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryChip label="Records" value={formatCount(validation.records)} />
        <SummaryChip label="Critical errors" tone="critical" value={formatCount(validation.critical_errors)} />
        <SummaryChip label="Warnings" tone="warning" value={formatCount(validation.warnings)} />
        <SummaryChip label="Informational" tone="info" value={formatCount(validation.informational)} />
      </div>

      <div className="overflow-hidden rounded-[22px] border border-[#D9E3EA] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F7F9FB]">
              <tr>
                {['Sev', 'Row', 'Field', 'Issue', 'Current', 'Reference'].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {validation.issues.map((item) => (
                <tr key={`${item.row}-${item.field}-${item.issue}`} className="border-t border-[#EEF2F5]">
                  <td className="px-4 py-3">
                    <SeverityPill severity={item.severity} />
                  </td>
                  <td className="px-4 py-3 font-mono text-iris-blue">{item.row}</td>
                  <td className="px-4 py-3">{item.field}</td>
                  <td className="px-4 py-3 text-iris-text-secondary">{item.issue}</td>
                  <td className="px-4 py-3">{item.current_value ?? '—'}</td>
                  <td className="px-4 py-3 text-iris-text-secondary">
                    {item.clause_reference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ExceptionsStep({
  detail,
  exceptionActions,
  onExceptionActionsChange,
}: {
  detail: ClaimsCessionDetailPayload
  exceptionActions: ExceptionActionState
  onExceptionActionsChange: (value: ExceptionActionState) => void
}) {
  function updateChoice(exceptionId: string, choice: ExceptionChoice) {
    onExceptionActionsChange({
      ...exceptionActions,
      [exceptionId]: {
        choice,
        manualValue: choice === 'accept' ? '' : exceptionActions[exceptionId]?.manualValue ?? '',
      },
    })
  }

  function updateManualValue(exceptionId: string, manualValue: string) {
    onExceptionActionsChange({
      ...exceptionActions,
      [exceptionId]: {
        choice: 'override',
        manualValue,
      },
    })
  }

  function acceptAllCriticalFixes() {
    const nextState = { ...exceptionActions }
    for (const item of detail.exceptions.items) {
      nextState[item.exception_id] = { choice: 'accept', manualValue: '' }
    }
    onExceptionActionsChange(nextState)
  }

  return (
    <div className="space-y-5">
      <SectionHeading title={detail.exceptions.title} subtitle={detail.exceptions.subtitle} />

      <div className="flex flex-wrap gap-3">
        <SummaryChip label="Critical" tone="critical" value={formatCount(detail.exceptions.critical)} />
        <SummaryChip label="Warnings" tone="warning" value={formatCount(detail.exceptions.warnings)} />
        <SummaryChip label="Informational" tone="info" value={formatCount(detail.exceptions.informational)} />
      </div>

      <div className="overflow-hidden rounded-[22px] border border-[#D9E3EA] bg-white shadow-sm">
        <div className="flex items-center justify-end border-b border-[#EEF2F5] px-4 py-3">
          <button className="btn-primary" onClick={acceptAllCriticalFixes} type="button">
            Accept All Fixes
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F7F9FB]">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Sev</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Row</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Field</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Issue</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Current</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">AI Suggested Value</th>
                <th className="min-w-[280px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Action</th>
              </tr>
            </thead>
            <tbody>
              {detail.exceptions.items.map((item) => {
                const state = exceptionActions[item.exception_id] ?? { choice: 'pending' as ExceptionChoice, manualValue: '' }
                return (
                  <tr key={item.exception_id} className="border-t border-[#EEF2F5] align-top">
                    <td className="px-4 py-3">
                      <SeverityPill severity={item.severity} />
                    </td>
                    <td className="px-4 py-3 font-mono text-iris-blue">{item.row}</td>
                    <td className="px-4 py-3">{item.field}</td>
                    <td className="px-4 py-3 text-iris-text-secondary">{item.issue}</td>
                    <td className="px-4 py-3">{item.current_value ?? '—'}</td>
                    <td className="px-4 py-3 text-iris-text-secondary">
                      {item.ai_suggestion ? (
                        <div>
                          <div className="font-medium text-iris-text-primary">{item.ai_suggestion}</div>
                          <div className="mt-1 text-[12px] text-[#117A65]">{formatConfidence(item.ai_confidence)} confidence</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="min-w-[280px] px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <ActionChoiceButton active={state.choice === 'accept'} label="Accept" onClick={() => updateChoice(item.exception_id, 'accept')} />
                        <ActionChoiceButton active={state.choice === 'override'} label="Override" onClick={() => updateChoice(item.exception_id, 'override')} />
                        <ActionChoiceButton active={state.choice === 'manual'} label="Manual" onClick={() => updateChoice(item.exception_id, 'manual')} />
                      </div>
                      {state.choice === 'accept' ? <div className="mt-2 text-[12px] text-[#117A65]">AI suggestion selected.</div> : null}
                      {state.choice === 'manual' ? <div className="mt-2 text-[12px] text-iris-text-secondary">Marked for manual follow-up.</div> : null}
                      {state.choice === 'override' ? (
                        <input
                          className="field-input mt-3"
                          placeholder="Enter manual override"
                          value={state.manualValue}
                          onChange={(event) => updateManualValue(item.exception_id, event.target.value)}
                        />
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ScreeningStep({ item }: { item: ClaimsWorklistTask }) {
  const summary = item.screening_summary
  const isAutoCleared = summary?.workflow_status === 'auto_cleared'
  const assignedValue = isAutoCleared ? 'Not required' : item.assigned_person ?? 'Unassigned'
  const workflowStatusLabel = summary?.status ?? (isAutoCleared ? 'Auto-Cleared' : 'Pending')
  const confidenceValue = summary?.confidence_pct !== null && summary?.confidence_pct !== undefined ? `${summary.confidence_pct}%` : '--'
  const sourceCards = buildScreeningSourceCards(summary)
  const watchlistsValue = summary?.watchlists_screened.length ? summary.watchlists_screened.join(' · ') : 'OFAC · FinCEN'
  const matchedWatchlistsValue = summary?.matched_watchlists.length ? summary.matched_watchlists.join(' · ') : 'None retained'
  const decisionPanelClass = isAutoCleared ? 'border-[#C7EED8] bg-[#F0FFF6]' : 'border-[#F8D7A6] bg-[#FFF8EF]'
  const statusBadgeClass = isAutoCleared
    ? 'border-[#C7EED8] bg-[#F0FFF6] text-[#1E8449]'
    : 'border-[#F8D7A6] bg-[#FFF8EF] text-[#AF601A]'
  const entityName = summary?.entity_name ?? 'Cedent'
  const decisionTitle = isAutoCleared ? 'Cleared for settlement release' : 'Compliance hold remains active'
  const decisionCopy = isAutoCleared
    ? 'OFAC and FinCEN screening completed without a remaining compliance hold. IRiS has recorded the final screening rationale below.'
    : 'A retained sanctions signal still needs human-in-the-loop review. Keep the compliance hold in place until the assigned analyst closes the case.'
  const routeValue = isAutoCleared ? 'Straight-through release' : 'Compliance analyst review'

  return (
    <div className="space-y-5">
      <SectionHeading title="Sanction Screening" subtitle="Current sanctions-screening result for the linked cession-file release." />

      <div className="overflow-hidden rounded-[26px] border border-[#D9E3EA] bg-white shadow-sm">
        <div className="border-b border-[#EEF2F5] bg-[linear-gradient(135deg,#F7FBFD_0%,#FFFFFF_52%,#F5FBF8_100%)] px-5 py-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                <span>Settlement release screening</span>
                <span>·</span>
                <span className="font-mono text-iris-blue">{item.wl_id}</span>
              </div>
              <div>
                <p className="text-[24px] font-bold leading-tight text-iris-text-primary">{entityName}</p>
                <p className="mt-2 max-w-3xl text-[13px] leading-6 text-iris-text-secondary">{summary?.headline ?? item.description ?? decisionCopy}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-iris-text-secondary">
                <span className="rounded-full bg-white/90 px-3 py-1">{item.type}</span>
                <span className="rounded-full bg-white/90 px-3 py-1">{titleCase(item.team)}</span>
                <span className="rounded-full bg-white/90 px-3 py-1">{watchlistsValue}</span>
              </div>
            </div>

            <div className={`min-w-[280px] rounded-[22px] border px-5 py-4 shadow-sm ${decisionPanelClass}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${statusBadgeClass}`}>{workflowStatusLabel}</span>
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[12px] font-semibold text-[#B9770E]">{titleCase(item.priority)} priority</span>
              </div>
              <p className="mt-4 text-[18px] font-semibold text-iris-text-primary">{decisionTitle}</p>
              <p className="mt-2 text-[13px] leading-6 text-iris-text-secondary">{decisionCopy}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-b border-[#EEF2F5] px-5 py-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricLine label="Watchlists Screened" value={watchlistsValue} />
          <MetricLine label="Raw Match Output" value={matchedWatchlistsValue} />
          <MetricLine label="IRiS Confidence" value={confidenceValue} />
          <MetricLine label={isAutoCleared ? 'Release Path' : 'Review Route'} value={routeValue} />
        </div>

        <div className="space-y-4 border-b border-[#EEF2F5] px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sourceCards.map((source) => (
              <ScreeningSourceCard key={source.name} detail={source.detail} name={source.name} result={source.result} tone={source.tone} />
            ))}
            <div className="rounded-[20px] border border-[#D9E3EA] bg-white px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[18px] font-semibold text-iris-text-primary">Raw Match</p>
                  <p className="mt-1 text-[12px] text-iris-text-secondary">Retained watchlist output</p>
                </div>
                <span className="rounded-full border border-[#F8D7A6] bg-[#FFF8EF] px-2.5 py-1 text-[12px] font-semibold text-[#AF601A]">
                  {summary?.matched_watchlists.length ? 'Retained' : 'No match'}
                </span>
              </div>
              <p className="mt-4 text-[13px] leading-6 text-iris-text-primary">
                {summary?.raw_findings_summary ?? 'No raw watchlist findings are available for this screening case.'}
              </p>
              {summary?.candidate_name || summary?.candidate_list ? (
                <div className="mt-4 rounded-2xl bg-[#F7F9FB] px-4 py-3 text-[13px] text-iris-text-secondary">
                  <span className="font-semibold text-iris-text-primary">Top candidate:</span>{' '}
                  {summary?.candidate_name ? summary.candidate_name : 'No retained candidate'}
                  {summary?.candidate_list ? ` · ${summary.candidate_list}` : ''}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[20px] border border-[#B8E2E0] bg-[#F4FBFB] px-5 py-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#117A65]">
              <Sparkles className="h-4 w-4" />
              IRiS Analysis
            </div>
            <p className="mt-3 text-[14px] leading-6 text-iris-text-primary">{summary?.iris_findings_summary ?? item.description}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <MetricLine label="Recommended Action" value={summary?.recommended_action ?? 'Review case'} />
              <MetricLine label="Assigned Compliance" value={assignedValue} />
              <MetricLine
                label="Case Reference"
                value={
                  summary?.screening_ref ? (
                    <Link className="text-iris-blue underline decoration-[#B9D3E6] underline-offset-4 transition hover:text-[#155A82]" to={`/compliance/sanctions/${summary.screening_ref}`}>
                      {summary.screening_ref}
                    </Link>
                  ) : (
                    item.wl_id
                  )
                }
              />
              <MetricLine label="Analysis Label" value={summary?.analysis_label ?? 'IRiS decision engine'} />
              <MetricLine label="SLA" value={item.sla} />
            </div>
            {item.target_url && item.target_label ? (
              <div className="mt-4">
                <Link className="inline-flex items-center rounded-full bg-[#F4F7FA] px-3 py-1.5 text-[12px] font-semibold text-iris-text-secondary transition hover:bg-[#EAF1F6]" to={item.target_url}>
                  {item.target_label}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProcessStep({ detail }: { detail: ClaimsCessionDetailPayload }) {
  return (
    <div className="space-y-5">
      <SectionHeading title={detail.process.title} subtitle={detail.process.subtitle} />
      <div className="rounded-[22px] border border-[#D6DEE5] bg-white p-5 shadow-sm">
        <p className="text-[15px] font-semibold text-iris-text-primary">Engine plan</p>
        <div className="mt-3 space-y-2 text-[13px] text-iris-text-secondary">
          {detail.process.engine_plan.map((item) => (
            <p key={item}>• {item}</p>
          ))}
        </div>
      </div>
      <div className="rounded-[22px] border border-[#B8E2E0] bg-[#F4FBFB] px-5 py-4 text-[13px] text-iris-text-primary">
        <div className="mb-2 flex items-center gap-2 font-semibold text-[#117A65]">
          <Sparkles className="h-4 w-4" />
          IRiS AI
        </div>
        <p>{detail.process.iris_note}</p>
      </div>
    </div>
  )
}

function WorkflowOrchestrationStep({
  busy,
  detail,
  onApproveAgent,
  onOpenAgent,
}: {
  busy: boolean
  detail: ClaimsCessionDetailPayload
  onApproveAgent: (agentKey: string) => void
  onOpenAgent: (step: ClaimsStep) => void
}) {
  const workflow = detail.workflow
  const pausedAgent = workflow.agents.find((agent) => agent.status === 'awaiting_approval' || agent.status === 'failed') ?? null
  const currentAgent = workflow.agents.find((agent) => agent.key === workflow.current_agent_key) ?? null
  const workflowSummary = workflow.results
  const screeningSummary = getScreeningTask(detail)?.screening_summary ?? null
  const defaultExpandedAgent = pausedAgent?.key ?? currentAgent?.key ?? workflow.agents[0]?.key ?? null
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>(() =>
    defaultExpandedAgent ? { [defaultExpandedAgent]: true } : {},
  )

  useEffect(() => {
    if (defaultExpandedAgent) {
      setExpandedAgents((current) => (current[defaultExpandedAgent] ? current : { ...current, [defaultExpandedAgent]: true }))
    }
  }, [defaultExpandedAgent])

  const workflowInsight = buildWorkflowInsight(detail, pausedAgent, currentAgent, screeningSummary)
  const startedTimestamp = resolveWorkflowStartedTimestamp(workflow)

  return (
    <div className="space-y-4">
      <div
        className={`overflow-hidden rounded-[24px] border shadow-sm ${
          workflowSummary.success
            ? 'border-[#C7EED8] bg-[#F0FFF6]'
            : workflow.status === 'awaiting_approval' || workflow.status === 'failed'
              ? 'border-[#F4D8A6] bg-[#FFF9EF]'
              : 'border-[#D6E4F0] bg-[#F7FBFF]'
        }`}
      >
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-iris-text-primary">
              <TreeStructure className="h-4 w-4" weight="duotone" />
              Workflow Orchestration
            </span>
            <span className={workflowStatusBadgeClass(workflow.status)}>
              {formatWorkflowStatusLabel(workflow.status)} · {workflow.pct_complete}%
            </span>
          </div>
          <h2 className="mt-4 text-[22px] font-bold leading-tight text-iris-text-primary">{workflowSummary.message}</h2>
          <p className="mt-2 text-[13px] leading-6 text-iris-text-secondary">
            {pausedAgent
              ? `${pausedAgent.agent_name} is paused for review. Open the related pipeline step or approve from the accordion below to resume orchestration.`
              : currentAgent
                ? `${currentAgent.agent_name} is executing now. The stepper and agent stack below will continue to update in place.`
                : 'All workflow agents finished successfully and the cession processing run is complete.'}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <WorkflowDetailTile label="Contract" value={workflowSummary.contract_id ?? detail.contract_id ?? 'Pending mapping'} />
            <WorkflowDetailTile label="Workflow Period" value={workflowSummary.reporting_period || detail.contract_mapping.period || 'Pending period'} />
          </div>

          <div className="mt-4 rounded-[18px] border border-[#B8E2E0] bg-white/75 px-4 py-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#117A65]">
              <SparkleIcon className="h-4 w-4" weight="fill" />
              Workflow Insight
            </div>
            <p className="mt-2 text-[13px] leading-6 text-iris-text-secondary">{workflowInsight}</p>
          </div>

          {pausedAgent ? (
            <div className="mt-4 rounded-[18px] border border-[#F4D8A6] bg-white/75 px-4 py-3 text-[13px] text-[#8A6120]">
              {pausedAgent.state_message ?? `${pausedAgent.agent_name} requires review before the workflow can continue.`}
            </div>
          ) : null}
        </div>

        <div className="flex h-full flex-col justify-center border-t border-white/75 px-5 py-5 xl:border-l xl:border-t-0">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-iris-text-primary">
            <Path className="h-4 w-4" weight="duotone" />
            Live Orchestration Monitor
          </div>
          <div className="mt-4 space-y-3 text-[13px] text-iris-text-secondary">
            <MonitorRow label="Current Agent" value={currentAgent?.agent_name ?? 'Workflow complete'} />
            <MonitorRow label="Pause State" value={pausedAgent ? `${pausedAgent.agent_name} awaiting review` : 'No active pauses'} />
            <MonitorRow label="Started" value={startedTimestamp ? formatRelativeDate(startedTimestamp) : '—'} />
            <MonitorRow label="Completed" value={workflowSummary.completion_timestamp ? formatRelativeDate(workflowSummary.completion_timestamp) : 'In progress'} />
          </div>

        </div>
      </div>
      </div>

      <div className="space-y-3">
        {workflow.agents.map((agent) => {
          const expanded = Boolean(expandedAgents[agent.key])
          const stepDefinition = BASE_PIPELINE_STEPS.find((step) => step.id === normalizeWorkflowStepId(agent.step_id))
          const StepIcon = stepDefinition?.icon ?? TreeStructure
          const skipMeta = agent.status === 'skipped' ? skippedStateMeta(agent) : null
          const SkipIcon = skipMeta?.icon
          const outcomeMeta = agentOutcomeMeta(agent)
          const showApprove = agent.awaiting_approval && agent.key !== 'resolution'
          return (
            <article key={agent.key} className="overflow-hidden rounded-[24px] border border-[#D9E3EA] bg-white shadow-sm">
              <button
                className="w-full px-5 py-5 text-left transition hover:bg-[#FBFCFD]"
                onClick={() =>
                  setExpandedAgents((current) => ({
                    ...current,
                    [agent.key]: !current[agent.key],
                  }))
                }
                type="button"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#DCE6ED] bg-[#F8FAFC] text-[#205375]">
                        <StepIcon className="h-5 w-5" weight="duotone" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">{agent.step_label}</p>
                          {skipMeta && SkipIcon ? (
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${skipMeta.className}`}>
                              <SkipIcon className="h-3.5 w-3.5" weight="fill" />
                              {skipMeta.label}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-2 truncate text-[18px] font-bold text-iris-text-primary">{agent.agent_name}</h3>
                        <p className="mt-1 text-[13px] leading-6 text-iris-text-secondary">
                          {agent.state_message ?? agent.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={workflowStatusBadgeClass(agent.status)}>{formatWorkflowStatusLabel(agent.status)}</span>
                      {expanded ? <CaretDown className="h-4 w-4 text-iris-text-secondary" weight="bold" /> : <CaretRight className="h-4 w-4 text-iris-text-secondary" weight="bold" />}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <AgentMetricChip icon={TrendUp} value={agent.confidence_score !== null ? formatConfidence(agent.confidence_score) : 'Confidence —'} />
                    <AgentMetricChip icon={Target} value={`Threshold ${Math.round(agent.confidence_threshold * 100)}%`} />
                    <AgentMetricChip icon={Timer} value={formatExecutionTime(agent.execution_time_ms)} />
                    <AgentMetricChip icon={ArrowClockwise} value={`${Math.max(agent.attempts - 1, 0)} retry${Math.max(agent.attempts - 1, 0) === 1 ? '' : 'ies'}`} />
                    <AgentMetricChip
                      icon={agent.hitl_required ? PauseCircle : CheckCircle}
                      tone={agent.hitl_required ? 'warning' : 'positive'}
                      value={agent.hitl_required ? 'HITL required' : 'No HITL pause'}
                    />
                    <AgentMetricChip icon={outcomeMeta.icon} tone={outcomeMeta.tone} value={outcomeMeta.label} />
                  </div>
                </div>
              </button>

              {expanded ? (
                <div className="border-t border-[#E8EEF3] px-5 py-5">
                  <WorkflowAgentOutput agent={agent} detail={detail} screeningSummary={screeningSummary} />

                  {agent.warnings.length ? (
                    <div className="mt-4 rounded-[18px] border border-[#F4D8A6] bg-[#FFF9EF] px-4 py-4 text-[13px] text-[#8A6120]">
                      {agent.warnings.map((warning) => (
                        <p key={`${agent.key}-${warning}`}>{warning}</p>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="btn-secondary" onClick={() => onOpenAgent(normalizeWorkflowStepId(agent.review_step_id))} type="button">
                      {agent.review_label}
                    </button>
                    {agent.review_url ? (
                      <Link className="btn-secondary" to={agent.review_url}>
                        Open Detail
                      </Link>
                    ) : null}
                    {showApprove ? (
                      <button className="btn-primary" disabled={busy} onClick={() => onApproveAgent(agent.key)} type="button">
                        Approve & Resume
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function SummaryStep({
  busy,
  detail,
  onApprove,
}: {
  busy: boolean
  detail: ClaimsCessionDetailPayload
  onApprove: () => void
}) {
  const isSettlementFile = detail.summary.file_type === 'Settlement'

  return (
    <div className="space-y-5">
      <SectionHeading title="Processing Summary" subtitle="Business impact, resolutions, and IRiS insights" />
      {!isSettlementFile ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <KpiCard accent="neutral" title="Liability Impact" value={signedCompactCurrency(detail.summary.liability_impact ?? 0, detail.summary.settlement_impact?.currency ?? 'EUR')} />
          <KpiCard
            accent="teal"
            title="Fixed Leg Recomputed"
            value={detail.summary.fixed_leg_recomputed ? signedCompactCurrency(detail.summary.fixed_leg_recomputed, detail.summary.settlement_impact?.currency ?? 'EUR') : '—'}
          />
        </div>
      ) : null}

      {isSettlementFile && detail.summary.settlement_reconciliation ? (
        <SettlementReconciliationPanel reconciliation={detail.summary.settlement_reconciliation} />
      ) : null}

      <div className="rounded-[22px] border border-[#B8E2E0] bg-[#F4FBFB] px-5 py-4 text-[13px] text-iris-text-primary">
        <div className="mb-2 flex items-center gap-2 font-semibold text-[#117A65]">
          <Sparkles className="h-4 w-4" />
          IRiS Insights
        </div>
        <p>{detail.summary.insight}</p>
      </div>

      {!isSettlementFile ? (
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary bg-[#1E8449] hover:bg-[#229954]" disabled={busy || detail.stage === 'approved'} onClick={onApprove} type="button">
            <Check className="h-4 w-4" />
            Approve
          </button>
          <button className="btn-secondary opacity-60" disabled type="button">
            Reprocess
          </button>
          <button className="btn-secondary opacity-60" disabled type="button">
            Rollback
          </button>
          <button className="btn-secondary opacity-60" disabled type="button">
            Escalate
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SettlementReconciliationPanel({
  reconciliation,
}: {
  reconciliation: NonNullable<ClaimsCessionDetailPayload['summary']['settlement_reconciliation']>
}) {
  const decisionTone = reconciliation.decision === 'accept' ? 'bg-[#E8F6EF] text-[#117A65]' : 'bg-[#FEF5E7] text-[#B9770E]'
  const rows: Array<[string, number, number]> = [
    ['Fixed Leg', reconciliation.uploaded.fixed_leg, reconciliation.system.fixed_leg],
    ['Floating Leg', reconciliation.uploaded.floating_leg, reconciliation.system.floating_leg],
    ['Fee', reconciliation.uploaded.fee, reconciliation.system.fee],
    ['Prior Interest', reconciliation.uploaded.interest_prior_period, reconciliation.system.interest_prior_period],
    ['Net Settlement', reconciliation.uploaded.net_settlement_amount, reconciliation.system.net_settlement_amount],
  ]

  return (
    <div className="rounded-[22px] border border-[#D6DEE5] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-iris-text-primary">Settlement Reconciliation</p>
          <p className="mt-1 text-[12px] text-iris-text-secondary">
            {reconciliation.settlement_id}
            {' \u00b7 '}
            {reconciliation.calculation_period}
            {' \u00b7 '}
            {reconciliation.expected_source}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${decisionTone}`}>{formatSettlementDecision(reconciliation.decision)}</span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-[13px]">
          <thead className="bg-[#F7F9FB]">
            <tr>
              {['Measure', 'Uploaded', 'IRiS', 'Delta'].map((label) => (
                <th key={label} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, uploaded, system]) => {
              const delta = uploaded - system
              return (
                <tr key={label} className="border-t border-[#EEF2F5]">
                  <td className="px-3 py-2 font-medium text-iris-text-primary">{label}</td>
                  <td className="px-3 py-2 text-iris-text-secondary">{formatCurrency(uploaded, reconciliation.currency)}</td>
                  <td className="px-3 py-2 text-iris-text-secondary">{formatCurrency(system, reconciliation.currency)}</td>
                  <td className={delta === 0 ? 'px-3 py-2 text-iris-text-secondary' : 'px-3 py-2 font-medium text-[#B9770E]'}>
                    {formatCurrency(delta, reconciliation.currency)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border border-[#E5EBF0] bg-[#FAFBFC] px-4 py-3 text-[13px] text-iris-text-secondary">
        {reconciliation.mismatches.length ? reconciliation.mismatches.map((item) => <p key={`${item.field}-${item.issue_type}`}>{item.message}</p>) : <p>All settlement values match exactly.</p>}
      </div>
    </div>
  )
}

function FilesStep({
  busyAction,
  payload,
  preview,
  onDownload,
  onPreview,
  onPush,
}: {
  busyAction: string | null
  payload: ClaimsCessionDetailPayload['downstream_files']
  preview: { artifactId: string; filename: string; content: string } | null
  onDownload: (artifactId: string, filename: string) => void
  onPreview: (artifactId: string, filename: string) => void
  onPush: () => void
}) {
  const previewTable = preview ? csvPreview(preview.content) : null

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeading title={payload.title} subtitle={payload.subtitle} />
        <button className="btn-primary w-fit" disabled={!payload.items.length || payload.pushed || busyAction === 'push'} onClick={onPush} type="button">
          <Send className="h-4 w-4" />
          {payload.pushed ? 'Pushed to SFTP' : busyAction === 'push' ? 'Pushing...' : 'Push to SFTP'}
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="overflow-hidden rounded-[22px] border border-[#D9E3EA] bg-white shadow-sm">
          <div className="border-b border-[#EEF2F5] bg-[#F7F9FB] px-4 py-3">
            <p className="text-[13px] font-semibold text-iris-text-primary">Generated files</p>
            <p className="mt-1 text-[12px] text-iris-text-secondary">Review the cash tracker and GRDR load form before release.</p>
          </div>
          <div className="divide-y divide-[#EEF2F5]">
            {payload.items.length ? (
              payload.items.map((item) => (
                <div key={item.artifact_id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-iris-text-primary">{item.report_type}</p>
                    <p className="mt-1 font-mono text-[12px] text-iris-text-secondary">{item.filename}</p>
                    <p className="mt-1 text-[12px] text-iris-text-muted">
                      {item.period} · {item.format.toUpperCase()} · generated {formatRelativeDate(item.generated_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary" disabled={busyAction === `preview:${item.artifact_id}`} onClick={() => onPreview(item.artifact_id, item.filename)} type="button">
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                    <button className="btn-secondary" disabled={busyAction === `download:${item.artifact_id}`} onClick={() => onDownload(item.artifact_id, item.filename)} type="button">
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-[13px] text-iris-text-secondary">No downstream files are available for this processing run.</div>
            )}
          </div>
        </div>

        <div className="rounded-[22px] border border-[#D9E3EA] bg-white p-5 shadow-sm">
          <p className="text-[15px] font-semibold text-iris-text-primary">Preview</p>
          <p className="mt-1 text-[12px] text-iris-text-secondary">
            {preview ? preview.filename : 'Select View to inspect the file contents before pushing.'}
          </p>
          {previewTable ? (
            <div className="mt-4 max-h-[360px] overflow-auto rounded-xl border border-[#E5EBF0]">
              <table className="min-w-full text-[12px]">
                <thead className="sticky top-0 bg-[#F7F9FB]">
                  <tr>
                    {previewTable.headers.map((header) => (
                      <th key={header} className="whitespace-nowrap px-3 py-2 text-left font-semibold text-iris-text-secondary">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewTable.rows.map((row, index) => (
                    <tr key={`${preview?.artifactId ?? 'preview'}-${index}`} className="border-t border-[#EEF2F5]">
                      {previewTable.headers.map((header) => (
                        <td key={header} className="whitespace-nowrap px-3 py-2 text-iris-text-secondary">
                          {row[header] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-[#C9D6E0] bg-[#FAFBFC] px-4 py-10 text-center text-[13px] text-iris-text-secondary">
              File preview will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WorklistStep({
  items,
  subtitle,
  title,
}: {
  items: ClaimsWorklistTask[]
  subtitle: string
  title: string
}) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      <SectionHeading title={title} subtitle={subtitle} />
      <div className="overflow-hidden rounded-[22px] border border-[#D9E3EA] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F7F9FB]">
              <tr>
                {['Task', 'Type', 'Team', 'Assigned', 'Status', 'Priority', 'SLA', 'Details'].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((item) => {
                  const isExpanded = expandedTaskId === item.wl_id
                  const canExpand = Boolean(item.description || item.screening_summary)
                  return (
                    <Fragment key={item.wl_id}>
                      <tr className="border-t border-[#EEF2F5] align-top">
                        <td className="px-4 py-3">
                          <Link className="font-medium text-iris-text-primary transition hover:text-iris-blue" to={item.target_url ?? `/worklist/${item.wl_id}`}>
                            {item.task}
                          </Link>
                          <div className="mt-1">
                            <Link className="font-mono text-[12px] text-iris-blue transition hover:text-iris-navy" to={`/worklist/${item.wl_id}`}>
                              {item.wl_id}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-iris-text-secondary">{item.type}</td>
                        <td className="px-4 py-3 text-iris-text-secondary">{titleCase(item.team)}</td>
                        <td className="px-4 py-3 text-iris-text-secondary">{item.assigned_person ?? 'Unassigned'}</td>
                        <td className="px-4 py-3">
                          <WorklistStatusPill item={item} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-[#FEF5E7] px-2.5 py-1 text-[12px] font-semibold text-[#B9770E]">{titleCase(item.priority)}</span>
                        </td>
                        <td className="px-4 py-3 text-iris-text-secondary">{item.sla}</td>
                        <td className="px-4 py-3">
                          {canExpand ? (
                            <button
                              className="inline-flex items-center gap-2 rounded-full bg-[#F4F7FA] px-3 py-1.5 text-[12px] font-semibold text-iris-text-secondary transition hover:bg-[#EAF1F6]"
                              onClick={() => setExpandedTaskId(isExpanded ? null : item.wl_id)}
                              type="button"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {isExpanded ? 'Hide' : 'Expand'}
                            </button>
                          ) : (
                            <span className="text-[12px] text-iris-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="border-t border-[#EEF2F5] bg-[#FAFBFC]">
                          <td className="px-4 py-4" colSpan={8}>
                            <WorklistTaskExpandedDetail item={item} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })
              ) : (
                <tr>
                  <td className="px-4 py-6 text-iris-text-secondary" colSpan={8}>
                    No worklist items were created for this processing run.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function WorklistTaskExpandedDetail({ item }: { item: ClaimsWorklistTask }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E5EBF0] bg-white px-4 py-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Task Summary</p>
        <p className="mt-2 text-[13px] text-iris-text-primary">{item.description || 'No additional task summary is available for this worklist item.'}</p>
        {item.target_url && item.target_label ? (
          <div className="mt-3">
            <Link className="inline-flex items-center rounded-full bg-[#F4F7FA] px-3 py-1.5 text-[12px] font-semibold text-iris-text-secondary transition hover:bg-[#EAF1F6]" to={item.target_url}>
              {item.target_label}
            </Link>
          </div>
        ) : null}
      </div>

      {item.screening_summary ? <ScreeningSummaryPanel summary={item.screening_summary} /> : null}
    </div>
  )
}

function WorklistStatusPill({ item }: { item: ClaimsWorklistTask }) {
  const label = item.status_label ?? formatWorklistTaskStatus(item.status ?? 'open')
  const toneClass =
    item.status_tone === 'positive'
      ? 'border-[#BCE1C7] bg-[#EAF7EF] text-[#1E8449]'
      : item.status_tone === 'warning'
        ? 'border-[#F8D7A6] bg-[#FFF5E8] text-[#AF601A]'
        : item.status_tone === 'negative'
          ? 'border-[#F4C8C9] bg-[#FFF1F1] text-[#922B21]'
          : 'border-[#D8E0E8] bg-[#F7F9FB] text-[#41566B]'

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold ${toneClass}`}>{label}</span>
}

function ScreeningSummaryPanel({ summary }: { summary: ClaimsWorklistScreeningSummary }) {
  const toneClass =
    summary.tone === 'positive'
      ? 'border-[#C7EED8] bg-[#F0FFF6] text-[#1E8449]'
      : summary.tone === 'warning'
        ? 'border-[#F9E79F] bg-[#FEF9E7] text-[#9A7D0A]'
        : summary.tone === 'negative'
          ? 'border-[#F5C6CB] bg-[#FDEDEC] text-[#922B21]'
          : 'border-[#D9E3EA] bg-white text-iris-text-primary'

  return (
    <div className="rounded-xl border border-[#E5EBF0] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#EEF2F5] px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Sanctions Screening Summary</p>
          <p className="mt-2 text-[15px] font-semibold text-iris-text-primary">{summary.headline}</p>
          <p className="mt-1 text-[13px] text-iris-text-secondary">{summary.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {summary.status ? <span className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${toneClass}`}>{summary.status}</span> : null}
          <Link className="inline-flex items-center rounded-full bg-[#F4F7FA] px-3 py-1.5 text-[12px] font-semibold text-iris-text-secondary transition hover:bg-[#EAF1F6]" to={`/compliance/sanctions/${summary.screening_ref}`}>
            {summary.screening_ref}
          </Link>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricLine label="Watchlists Screened" value={summary.watchlists_screened.length ? summary.watchlists_screened.join(' · ') : 'OFAC · FinCEN'} />
        <MetricLine label="Raw Matches" value={summary.matched_watchlists.length ? summary.matched_watchlists.join(' · ') : 'None'} />
        <MetricLine label="Confidence" value={summary.confidence_pct !== null ? `${summary.confidence_pct}%` : '—'} />
        <MetricLine label="Recommended Action" value={summary.recommended_action || 'Review case'} />
      </div>

      <div className="grid gap-3 border-t border-[#EEF2F5] px-4 py-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E5EBF0] bg-[#FAFBFC] px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Raw Watchlist Finding</p>
          <p className="mt-2 text-[13px] text-iris-text-primary">{summary.raw_findings_summary}</p>
        </div>
        <div className="rounded-xl border border-[#E5EBF0] bg-[#FAFBFC] px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">IRiS AI Finding</p>
          <p className="mt-2 text-[13px] text-iris-text-primary">{summary.iris_findings_summary}</p>
        </div>
      </div>

      {summary.candidate_name || summary.candidate_list ? (
        <div className="border-t border-[#EEF2F5] px-4 py-4 text-[13px] text-iris-text-secondary">
          <span className="font-semibold text-iris-text-primary">Top candidate:</span>{' '}
          {summary.candidate_name ? `${summary.candidate_name}` : 'No retained candidate'}
          {summary.candidate_list ? ` · ${summary.candidate_list}` : ''}
        </div>
      ) : null}
    </div>
  )
}

function ScreeningSourceCard({
  detail,
  name,
  result,
  tone,
}: {
  detail: string
  name: string
  result: string
  tone: 'positive' | 'warning' | 'neutral'
}) {
  const badgeClass =
    tone === 'positive'
      ? 'border-[#C7EED8] bg-[#F0FFF6] text-[#1E8449]'
      : tone === 'warning'
        ? 'border-[#F8D7A6] bg-[#FFF8EF] text-[#AF601A]'
        : 'border-[#D9E3EA] bg-[#F7F9FB] text-[#41566B]'

  return (
    <div className="rounded-[20px] border border-[#D9E3EA] bg-white px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[18px] font-semibold text-iris-text-primary">{name}</p>
          <p className="mt-1 text-[12px] text-iris-text-secondary">Provider output</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${badgeClass}`}>{result}</span>
      </div>
      <p className="mt-4 text-[13px] text-iris-text-primary">{detail}</p>
    </div>
  )
}

function AuditStep({
  items,
  subtitle,
  title,
}: {
  items: ClaimsAuditEvent[]
  subtitle: string
  title: string
}) {
  return (
    <div className="space-y-5">
      <SectionHeading title={title} subtitle={subtitle} />
      <div className="overflow-hidden rounded-[22px] border border-[#D9E3EA] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F7F9FB]">
              <tr>
                {['Timestamp', 'Actor', 'Type', 'Action', 'Detail'].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.timestamp}-${item.action}`} className="border-t border-[#EEF2F5]">
                  <td className="px-4 py-3 text-iris-text-secondary">{formatRelativeDate(item.timestamp)}</td>
                  <td className="px-4 py-3 font-medium text-iris-text-primary">{item.actor}</td>
                  <td className="px-4 py-3 text-iris-text-secondary">{item.type}</td>
                  <td className="px-4 py-3 text-iris-text-primary">{item.action}</td>
                  <td className="px-4 py-3 text-iris-text-secondary">{item.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h3 className="text-[22px] font-bold text-iris-text-primary">{title}</h3>
      <p className="mt-1.5 text-[13px] text-iris-text-secondary">{subtitle}</p>
    </div>
  )
}

function PipelineStepper({
  activeFileId,
  actualCurrentStep,
  completedSteps,
  currentStep,
  stepStatusMap,
  steps,
  onOpenStep,
}: {
  activeFileId: string | null
  actualCurrentStep: ClaimsStep
  completedSteps: Set<ClaimsStep>
  currentStep: ClaimsStep
  stepStatusMap: Partial<Record<ClaimsStep, StepStatusEntry>>
  steps: StepDefinition[]
  onOpenStep: (step: ClaimsStep) => void
}) {
  return (
    <div className="flex min-w-max items-center gap-0">
      {steps.map((step, index) => {
        const stepState = stepStatusMap[step.id]
        const stepStatus = stepState?.status ?? (completedSteps.has(step.id) ? 'completed' : 'pending')
        const nextStatus =
          index < steps.length - 1
            ? stepStatusMap[steps[index + 1].id]?.status ?? (completedSteps.has(steps[index + 1].id) ? 'completed' : 'pending')
            : null
        const StepIcon = step.icon
        const StatusIcon = resolveStepperStateIcon(stepStatus, stepState?.message)
        const statusMeta = stepStatus === 'skipped' ? skippedStateMetaFromMessage(stepState?.message) : null

        return (
          <Fragment key={step.id}>
            <button
              className={workflowStepperButtonClass(stepStatus, currentStep === step.id, actualCurrentStep === step.id)}
              disabled={!activeFileId}
              onClick={() => activeFileId && onOpenStep(step.id)}
              type="button"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/80">
                <StepIcon className="h-4 w-4" weight={stepStatus === 'running' ? 'fill' : 'duotone'} />
              </span>
              <span>{step.label}</span>
              {StatusIcon ? (
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                    stepStatus === 'completed'
                      ? 'bg-[#D8F4E4] text-[#1E8449]'
                      : stepStatus === 'awaiting_approval'
                        ? 'bg-[#FDECC8] text-[#9A6A14]'
                        : stepStatus === 'failed'
                          ? 'bg-[#FAD9D7] text-[#B33C31]'
                          : stepStatus === 'skipped'
                            ? 'bg-[#EEF2F6] text-[#627282]'
                            : 'bg-white/20 text-current'
                  }`}
                  title={statusMeta?.label ?? formatWorkflowStatusLabel(stepStatus)}
                >
                  <StatusIcon className={stepStatus === 'running' ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} weight="fill" />
                </span>
              ) : null}
            </button>
            {nextStatus ? <div className={workflowConnectorClass(stepStatus, nextStatus)} /> : null}
          </Fragment>
        )
      })}
    </div>
  )
}

function AgentMetricChip({
  icon: Icon,
  tone = 'neutral',
  value,
}: {
  icon: React.ElementType
  tone?: 'neutral' | 'positive' | 'warning' | 'negative'
  value: string
}) {
  const toneClass =
    tone === 'positive'
      ? 'border-[#CDEBD9] bg-[#F0FFF6] text-[#1E8449]'
      : tone === 'warning'
        ? 'border-[#F4D8A6] bg-[#FFF9EF] text-[#8A6120]'
        : tone === 'negative'
          ? 'border-[#F3C7C5] bg-[#FEF1F0] text-[#B33C31]'
          : 'border-[#DCE6ED] bg-[#F8FAFC] text-iris-text-primary'

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-semibold ${toneClass}`}>
      <Icon className="h-4 w-4" weight="fill" />
      {value}
    </span>
  )
}

function WorkflowDetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#E5EBF0] bg-[#FAFBFC] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      <p className="mt-2 text-[14px] font-semibold text-iris-text-primary">{value}</p>
    </div>
  )
}

function WorkflowEmptyOutput({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#CAD5DF] bg-[#FAFBFC] px-4 py-5 text-[13px] text-iris-text-secondary">
      {children}
    </div>
  )
}

function WorkflowAgentOutput({
  agent,
  detail,
  screeningSummary,
}: {
  agent: ClaimsWorkflowPayload['agents'][number]
  detail: ClaimsCessionDetailPayload
  screeningSummary: ClaimsWorklistScreeningSummary | null
}) {
  const reviewWorklistItems = detail.worklist.items.filter((item) => !item.screening_summary)
  const hasExecuted = hasWorkflowAgentExecuted(agent)

  if (!hasExecuted && agent.status === 'running') {
    return <WorkflowEmptyOutput>{agent.agent_name} is executing now. Live output will populate here as soon as the agent publishes it.</WorkflowEmptyOutput>
  }

  if (!hasExecuted && agent.status === 'pending') {
    return <WorkflowEmptyOutput>{agent.agent_name} has not started yet. The orchestration engine will populate this row when the workflow reaches this step.</WorkflowEmptyOutput>
  }

  if (agent.key === 'mapping') {
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[20px] border border-[#D9E3EA] bg-[#FAFBFC] p-4">
          <p className="text-[14px] font-semibold text-iris-text-primary">Detection</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <WorkflowDetailTile label="File Type" value={`${detail.detection.file_type} · ${formatConfidence(detail.detection.file_type_confidence)}`} />
            <WorkflowDetailTile label="Cedent" value={`${detail.detection.cedent} · ${formatConfidence(detail.detection.cedent_confidence)}`} />
          </div>
          <div className="mt-3 rounded-[16px] border border-[#D9E3EA] bg-white px-4 py-3 text-[13px] leading-6 text-iris-text-secondary">
            {detail.detection.iris_reasoning}
          </div>
        </div>
        <div className="rounded-[20px] border border-[#D9E3EA] bg-[#FAFBFC] p-4">
          <p className="text-[14px] font-semibold text-iris-text-primary">Contract & Treaty Mapping</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <WorkflowDetailTile label="Contract" value={`${detail.contract_mapping.contract_id} (${detail.contract_mapping.version})`} />
            <WorkflowDetailTile label="Period" value={detail.contract_mapping.period} />
            <WorkflowDetailTile label="Lives Covered" value={formatCount(detail.contract_mapping.lives_covered)} />
            <WorkflowDetailTile label="Expected Fixed Leg" value={formatCurrency(detail.contract_mapping.expected_fixed_leg, detail.contract_mapping.currency)} />
          </div>
          <div className="mt-3 rounded-[16px] border border-[#D9E3EA] bg-white px-4 py-3 text-[13px] leading-6 text-iris-text-secondary">
            {detail.contract_mapping.matching_basis}
          </div>
        </div>
      </div>
    )
  }

  if (agent.key === 'anomaly_detection') {
    const issues = detail.validation.issues
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <WorkflowDetailTile label="Records" value={formatCount(detail.validation.records)} />
          <WorkflowDetailTile label="Critical" value={formatCount(detail.validation.critical_errors)} />
          <WorkflowDetailTile label="Warnings" value={formatCount(detail.validation.warnings)} />
          <WorkflowDetailTile label="Informational" value={formatCount(detail.validation.informational)} />
        </div>
        {issues.length ? (
          <div className="overflow-x-auto rounded-[20px] border border-[#D9E3EA] bg-white">
            <table className="min-w-full text-[13px]">
              <thead className="bg-[#F7F9FB]">
                <tr>
                  {['Severity', 'Row', 'Field', 'Issue', 'Suggestion'].map((label) => (
                    <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={`${issue.row}-${issue.field}-${issue.issue}`} className="border-t border-[#EEF2F5]">
                    <td className="px-4 py-3">
                      <SeverityPill severity={issue.severity} />
                    </td>
                    <td className="px-4 py-3 text-iris-text-secondary">{issue.row}</td>
                    <td className="px-4 py-3 font-medium text-iris-text-primary">{issue.field}</td>
                    <td className="px-4 py-3 text-iris-text-secondary">{issue.issue}</td>
                    <td className="px-4 py-3 text-iris-text-secondary">
                      {issue.ai_suggestion ? `${issue.ai_suggestion} · ${formatConfidence(issue.ai_confidence)}` : 'No AI suggestion'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <WorkflowEmptyOutput>No anomaly findings were raised for this upload.</WorkflowEmptyOutput>
        )}
      </div>
    )
  }

  if (agent.key === 'resolution') {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <WorkflowDetailTile label="Unresolved" value={formatCount(detail.exceptions.unresolved)} />
          <WorkflowDetailTile label="Resolved" value={formatCount(detail.summary.exceptions_resolved)} />
          <WorkflowDetailTile label="Manual Overrides" value={formatCount(detail.summary.exceptions_overridden)} />
        </div>
        {detail.exceptions.items.length ? (
          <div className="overflow-x-auto rounded-[20px] border border-[#D9E3EA] bg-white">
            <table className="min-w-full text-[13px]">
              <thead className="bg-[#F7F9FB]">
                <tr>
                  {['Severity', 'Row', 'Field', 'Current', 'AI Suggestion', 'Resolution'].map((label) => (
                    <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.exceptions.items.map((item) => (
                  <tr key={item.exception_id} className="border-t border-[#EEF2F5]">
                    <td className="px-4 py-3">
                      <SeverityPill severity={item.severity} />
                    </td>
                    <td className="px-4 py-3 text-iris-text-secondary">{item.row}</td>
                    <td className="px-4 py-3 font-medium text-iris-text-primary">{item.field}</td>
                    <td className="px-4 py-3 text-iris-text-secondary">{item.current_value ?? '—'}</td>
                    <td className="px-4 py-3 text-iris-text-secondary">
                      {item.ai_suggestion ? `${item.ai_suggestion} · ${formatConfidence(item.ai_confidence)}` : 'Manual review'}
                    </td>
                    <td className="px-4 py-3 text-iris-text-primary">{formatExceptionResolutionLabel(item.resolution)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <WorkflowEmptyOutput>No anomaly resolutions were required for this workflow.</WorkflowEmptyOutput>
        )}
      </div>
    )
  }

  if (agent.key === 'clause_validation') {
    return (
      <div className="overflow-x-auto rounded-[20px] border border-[#D9E3EA] bg-white">
        <table className="min-w-full text-[13px]">
          <thead className="bg-[#F7F9FB]">
            <tr>
              {['Ref', 'Clause', 'Category', 'Description', 'State'].map((label) => (
                <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.clauses.clauses_checked.map((clause) => (
              <tr key={clause.clause_id} className="border-t border-[#EEF2F5]">
                <td className="px-4 py-3 font-medium text-iris-text-primary">{clause.clause_id}</td>
                <td className="px-4 py-3 text-iris-text-primary">{clause.clause_title}</td>
                <td className="px-4 py-3 text-iris-text-secondary">{clause.category}</td>
                <td className="px-4 py-3 text-iris-text-secondary">{clause.description}</td>
                <td className="px-4 py-3 text-iris-text-primary">{titleCase(clause.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (agent.key === 'processing') {
    if (detail.summary.file_type === 'Settlement' && detail.summary.settlement_reconciliation && hasExecuted) {
      return <SettlementReconciliationPanel reconciliation={detail.summary.settlement_reconciliation} />
    }

    const populationChanges = detail.summary.population_changes
      ? Object.entries(detail.summary.population_changes).map(([key, value]) => ({
          label: humanizeWorkflowField(key),
          value: formatCount(value),
        }))
      : []

    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {detail.summary.liability_impact !== null ? (
            <WorkflowDetailTile
              label="Liability Impact"
              value={signedCompactCurrency(detail.summary.liability_impact, detail.summary.settlement_impact?.currency ?? detail.contract_mapping.currency)}
            />
          ) : null}
          {detail.summary.fixed_leg_recomputed !== null ? (
            <WorkflowDetailTile
              label="Fixed Leg Recomputed"
              value={formatCurrency(detail.summary.fixed_leg_recomputed, detail.summary.settlement_impact?.currency ?? detail.contract_mapping.currency)}
            />
          ) : null}
          {detail.summary.net_settlement_amount !== null ? (
            <WorkflowDetailTile
              label="Net Settlement"
              value={formatCurrency(detail.summary.net_settlement_amount, detail.summary.settlement_impact?.currency ?? detail.contract_mapping.currency)}
            />
          ) : null}
          <WorkflowDetailTile label="Worklist Items" value={formatCount(detail.summary.worklist_items_created)} />
        </div>
        {populationChanges.length ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {populationChanges.map((item) => (
              <WorkflowDetailTile key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  if (agent.key === 'results') {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <WorkflowDetailTile label="Readiness" value={workflowReadinessLabel(detail.workflow.results.settlement_readiness_status)} />
          <WorkflowDetailTile label="Anomalies" value={formatCount(detail.workflow.results.anomalies_detected)} />
          <WorkflowDetailTile label="Files" value={formatCount(detail.workflow.results.generated_files_count)} />
          <WorkflowDetailTile label="Audit Events" value={formatCount(detail.workflow.results.audit_events_count)} />
        </div>
        <div className="rounded-[20px] border border-[#D9E3EA] bg-[#FAFBFC] px-4 py-4 text-[13px] leading-6 text-iris-text-secondary">
          {detail.workflow.results.message}
        </div>
      </div>
    )
  }

  if (agent.key === 'sanction_screening') {
    if (!screeningSummary) {
      return <WorkflowEmptyOutput>No sanctions screening case was required for this workflow.</WorkflowEmptyOutput>
    }

    const sourceCards = buildScreeningSourceCards(screeningSummary)
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sourceCards.map((item) => (
            <div key={item.name} className="rounded-[18px] border border-[#D9E3EA] bg-[#FAFBFC] px-4 py-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{item.name}</p>
              <p className="mt-2 text-[15px] font-semibold text-iris-text-primary">{item.result}</p>
              <p className="mt-2 text-[13px] leading-6 text-iris-text-secondary">{item.detail}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[20px] border border-[#D9E3EA] bg-white px-4 py-4">
            <p className="text-[14px] font-semibold text-iris-text-primary">Raw Findings</p>
            <p className="mt-2 text-[13px] leading-6 text-iris-text-secondary">{screeningSummary.raw_findings_summary}</p>
          </div>
          <div className="rounded-[20px] border border-[#D9E3EA] bg-white px-4 py-4">
            <p className="text-[14px] font-semibold text-iris-text-primary">IRiS Analysis</p>
            <p className="mt-2 text-[13px] leading-6 text-iris-text-secondary">{screeningSummary.iris_findings_summary}</p>
          </div>
        </div>
      </div>
    )
  }

  if (agent.key === 'file_generation') {
    return detail.downstream_files.items.length ? (
      <div className="grid gap-3">
        {detail.downstream_files.items.map((item) => (
          <div key={item.artifact_id} className="rounded-[18px] border border-[#D9E3EA] bg-[#FAFBFC] px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-iris-text-primary">{item.report_type}</p>
                <p className="mt-1 font-mono text-[12px] text-iris-text-secondary">{item.filename}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-iris-text-secondary">
                {item.published ? 'Released' : 'Ready to Push'}
              </span>
            </div>
            <p className="mt-2 text-[13px] text-iris-text-secondary">
              {item.period} · {item.format.toUpperCase()} · generated {formatRelativeDate(item.generated_at)}
            </p>
          </div>
        ))}
      </div>
    ) : (
      <WorkflowEmptyOutput>No downstream files were generated for this workflow.</WorkflowEmptyOutput>
    )
  }

  if (agent.key === 'worklist') {
    return reviewWorklistItems.length ? (
      <div className="overflow-x-auto rounded-[20px] border border-[#D9E3EA] bg-white">
        <table className="min-w-full text-[13px]">
          <thead className="bg-[#F7F9FB]">
            <tr>
              {['Task', 'Team', 'Assigned', 'Priority', 'SLA'].map((label) => (
                <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reviewWorklistItems.map((item) => (
              <tr key={item.wl_id} className="border-t border-[#EEF2F5]">
                <td className="px-4 py-3">
                  <p className="font-medium text-iris-text-primary">{item.task}</p>
                  <p className="mt-1 font-mono text-[12px] text-iris-text-secondary">{item.wl_id}</p>
                </td>
                <td className="px-4 py-3 text-iris-text-secondary">{titleCase(item.team)}</td>
                <td className="px-4 py-3 text-iris-text-secondary">{item.assigned_person ?? 'Unassigned'}</td>
                <td className="px-4 py-3 text-iris-text-primary">{titleCase(item.priority)}</td>
                <td className="px-4 py-3 text-iris-text-secondary">{item.sla}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <WorkflowEmptyOutput>No downstream worklist routing was required for this workflow.</WorkflowEmptyOutput>
    )
  }

  if (agent.key === 'audit') {
    return (
      <div className="overflow-x-auto rounded-[20px] border border-[#D9E3EA] bg-white">
        <table className="min-w-full text-[13px]">
          <thead className="bg-[#F7F9FB]">
            <tr>
              {['Timestamp', 'Actor', 'Action', 'Detail'].map((label) => (
                <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.audit.items.slice(0, 6).map((item) => (
              <tr key={`${item.timestamp}-${item.action}`} className="border-t border-[#EEF2F5]">
                <td className="px-4 py-3 text-iris-text-secondary">{formatRelativeDate(item.timestamp)}</td>
                <td className="px-4 py-3 font-medium text-iris-text-primary">{item.actor}</td>
                <td className="px-4 py-3 text-iris-text-primary">{item.action}</td>
                <td className="px-4 py-3 text-iris-text-secondary">{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return agent.key_outputs.length ? (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {agent.key_outputs.map((item) => (
        <WorkflowDetailTile key={`${agent.key}-${item.label}`} label={item.label} value={item.value === null ? '—' : String(item.value)} />
      ))}
    </div>
  ) : (
    <WorkflowEmptyOutput>{agent.output_summary ?? agent.state_message ?? 'No workflow output is available yet for this agent.'}</WorkflowEmptyOutput>
  )
}

function UploadOptionCard({
  active,
  children,
  subtitle,
  title,
  onSelect,
}: {
  active: boolean
  children?: React.ReactNode
  subtitle: string
  title: string
  onSelect: () => void
}) {
  return (
    <button
      className={`rounded-[22px] border p-5 text-left shadow-sm transition ${
        active ? 'border-iris-blue bg-[#F3F8FB]' : 'border-[#D9E3EA] bg-white hover:bg-[#FBFCFD]'
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[16px] font-semibold text-iris-text-primary">{title}</p>
          <p className="mt-2 text-[13px] text-iris-text-secondary">{subtitle}</p>
        </div>
        <span className={`mt-1 h-3 w-3 rounded-full ${active ? 'bg-iris-blue' : 'bg-[#CAD5DF]'}`} />
      </div>
      {children}
    </button>
  )
}

function SelectionCard({
  confidence,
  subtitle,
  value,
  children,
}: {
  confidence: number
  subtitle: string
  value: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[22px] border border-[#D9E3EA] bg-white p-5 shadow-sm">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">{subtitle}</p>
      <p className="mt-4 text-[20px] font-bold text-iris-text-primary">{value}</p>
      <p className="mt-1 text-[12px] text-[#117A65]">{formatConfidence(confidence)} confidence</p>
      {children}
    </div>
  )
}

function SummaryChip({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'critical' | 'warning' | 'info'
}) {
  const toneClass =
    tone === 'critical'
      ? 'border-[#F5C6CB] bg-[#FDEDEC] text-[#922B21]'
      : tone === 'warning'
        ? 'border-[#F9E79F] bg-[#FEF9E7] text-[#9A7D0A]'
        : tone === 'info'
          ? 'border-[#AED6F1] bg-[#EBF5FB] text-[#1A5276]'
          : 'border-[#D9E3EA] bg-white text-iris-text-primary'

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</div>
      <div className="mt-1 text-[18px] font-bold">{value}</div>
    </div>
  )
}

function MetricLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      <div className="mt-1.5 text-[14px] font-semibold text-iris-text-primary">{value}</div>
    </div>
  )
}

function MonitorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#EEF2F5] pb-3 last:border-b-0 last:pb-0">
      <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</span>
      <span className="text-right text-[13px] font-medium text-iris-text-primary">{value}</span>
    </div>
  )
}

function KpiCard({
  accent,
  title,
  value,
}: {
  accent: 'neutral' | 'teal' | 'blue' | 'warning'
  title: string
  value: string
}) {
  const borderClass =
    accent === 'teal'
      ? 'border-[#8FD7D2]'
      : accent === 'blue'
        ? 'border-[#D3E4F2]'
        : accent === 'warning'
          ? 'border-[#F4D8A6]'
          : 'border-[#D9E3EA]'
  const valueClass =
    accent === 'teal'
      ? 'text-[#117A65]'
      : accent === 'blue'
        ? 'text-[#155A82]'
        : accent === 'warning'
          ? 'text-[#8A6120]'
          : 'text-iris-text-primary'
  return (
    <div className={`rounded-[22px] border bg-white px-5 py-5 shadow-sm ${borderClass}`}>
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">{title}</p>
      <p className={`mt-3 text-[30px] font-bold ${valueClass}`}>{value}</p>
    </div>
  )
}

function SeverityPill({ severity }: { severity: string }) {
  const normalized = severity.toLowerCase()
  const classes =
    normalized === 'critical'
      ? 'bg-[#FDEDEC] text-[#922B21]'
      : normalized === 'warning'
        ? 'bg-[#FEF5E7] text-[#B9770E]'
        : 'bg-[#EBF5FB] text-[#1A5276]'

  return <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${classes}`}>{titleCase(severity)}</span>
}

function ActionChoiceButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
        active ? 'bg-iris-navy text-white' : 'bg-[#F4F7FA] text-iris-text-secondary hover:bg-[#EAF1F6]'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

function NoticeBanner({
  tone,
  children,
}: {
  tone: 'success' | 'error'
  children: React.ReactNode
}) {
  return (
    <div
      className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] ${
        tone === 'success'
          ? 'border-[#C7EED8] bg-[#F0FFF6] text-[#1E8449]'
          : 'border-[#F5C6CB] bg-[#FDEDEC] text-[#922B21]'
      }`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function PipelineStageBadge({ stage }: { stage: string }) {
  const normalized = stage.toLowerCase()
  const classes: Record<string, string> = {
    uploaded: 'bg-[#EEF1F4] text-[#566573]',
    detected: 'bg-[#EBF5FB] text-[#1A5276]',
    mapped: 'bg-[#EBF5FB] text-[#1A5276]',
    clauses: 'bg-[#EBF5FB] text-[#1A5276]',
    validated: 'bg-[#E8F8F5] text-[#117A65]',
    exceptions: 'bg-[#FDEDEC] text-[#922B21]',
    processing: 'bg-[#EBF5FB] text-[#1A5276]',
    processed: 'bg-[#E8F8F5] text-[#117A65]',
    approved: 'bg-[#D5F5E3] text-[#1E8449]',
    rejected: 'bg-[#FDEDEC] text-[#922B21]',
  }
  const label = normalized === 'validated' ? 'Anomalies' : normalized === 'exceptions' ? 'Resolutions' : titleCase(stage)
  return <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${classes[normalized] ?? 'bg-[#EEF1F4] text-[#566573]'}`}>{label}</span>
}

function buildExceptionState(items: ClaimsExceptionItem[]): ExceptionActionState {
  return Object.fromEntries(
    items.map((item) => [
      item.exception_id,
      {
        choice:
          item.resolution === 'overridden'
            ? 'override'
            : item.resolution === 'rejected'
              ? 'manual'
              : item.resolution === 'accepted'
                ? 'accept'
                : 'pending',
        manualValue: item.resolution === 'overridden' ? item.current_value ?? '' : '',
      },
    ]),
  )
}

function buildExceptionResolutionPayload(items: ClaimsExceptionItem[], state: ExceptionActionState) {
  return items.map((item) => {
    const itemState = state[item.exception_id] ?? { choice: 'pending' as ExceptionChoice, manualValue: '' }
    if (itemState.choice === 'override') {
      return {
        exception_id: item.exception_id,
        resolution: 'overridden',
        override_value: itemState.manualValue,
      }
    }
    if (itemState.choice === 'manual') {
      return {
        exception_id: item.exception_id,
        resolution: 'rejected',
        override_value: null,
      }
    }
    return {
      exception_id: item.exception_id,
      resolution: 'accepted',
      override_value: null,
    }
  })
}

function countPendingResolutionActions(items: ClaimsExceptionItem[], state: ExceptionActionState) {
  return items.filter((item) => (state[item.exception_id]?.choice ?? 'pending') === 'pending').length
}

function countInvalidOverrideActions(items: ClaimsExceptionItem[], state: ExceptionActionState) {
  return items.filter((item) => {
    const itemState = state[item.exception_id]
    return itemState?.choice === 'override' && !itemState.manualValue.trim()
  }).length
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function buildTestcaseActionKey(action: 'select' | 'download', filename: string) {
  return `${action}:${filename}`
}

function csvPreview(content: string) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim()).slice(0, 6)
  if (lines.length < 2) {
    return null
  }
  const headers = parseCsvLine(lines[0]).slice(0, 8)
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
  return { headers, rows }
}

function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let quoted = false
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === ',' && !quoted) {
      values.push(current)
      current = ''
      continue
    }
    current += char
  }
  values.push(current)
  return values
}

function resolveVisualCurrentStep(
  actualCurrentStep: ClaimsStep,
  currentStep: ClaimsStep,
  pipelineSteps: StepDefinition[],
) {
  const postProcessSteps = pipelineSteps
    .map((step) => step.id)
    .filter((step): step is ClaimsStep => ['summary', 'screening', 'files', 'worklist', 'audit'].includes(step))
  if (postProcessSteps.includes(actualCurrentStep) && postProcessSteps.includes(currentStep)) {
    const actualIndex = postProcessSteps.indexOf(actualCurrentStep)
    const currentIndex = postProcessSteps.indexOf(currentStep)
    return currentIndex > actualIndex ? currentStep : actualCurrentStep
  }
  return actualCurrentStep
}

function buildPipelineSteps() {
  return [...BASE_PIPELINE_STEPS]
}

function buildCompletedSteps(
  detail: ClaimsCessionDetailPayload | undefined,
  pipelineSteps: StepDefinition[],
  visualCurrentStep: ClaimsStep,
) {
  if (detail?.workflow) {
    const completedSteps = new Set<ClaimsStep>()
    for (const item of detail.workflow.stepper) {
      const normalizedStep = normalizeWorkflowStepId(item.stage)
      if (item.status === 'completed' || item.status === 'skipped') {
        completedSteps.add(normalizedStep)
      }
    }
    if (detail.workflow.status === 'completed') {
      completedSteps.add('workflow')
    }
    return completedSteps
  }

  const completedSteps = new Set<ClaimsStep>()
  const currentIndex = pipelineSteps.findIndex((step) => step.id === visualCurrentStep)
  const hasDownstreamFiles = Boolean(detail?.downstream_files.items.length)

  const shouldMarkComplete = (stepId: ClaimsStep) => stepId !== 'files' || hasDownstreamFiles

  if (detail?.stage === 'approved') {
    for (const step of pipelineSteps) {
      if (shouldMarkComplete(step.id)) {
        completedSteps.add(step.id)
      }
    }
    return completedSteps
  }

  if (currentIndex > 0) {
    for (const step of pipelineSteps.slice(0, currentIndex)) {
      if (shouldMarkComplete(step.id)) {
        completedSteps.add(step.id)
      }
    }
  }

  return completedSteps
}

function buildStepStatusMap(
  detail: ClaimsCessionDetailPayload | undefined,
  pipelineSteps: StepDefinition[],
  visualCurrentStep: ClaimsStep,
) {
  if (detail?.workflow) {
    const agentMap = Object.fromEntries(
      detail.workflow.agents.map((agent) => [normalizeWorkflowStepId(agent.step_id), agent]),
    ) as Partial<Record<ClaimsStep, ClaimsWorkflowPayload['agents'][number]>>

    return {
      ...(Object.fromEntries(
        detail.workflow.stepper.map((item) => {
          const normalizedStep = normalizeWorkflowStepId(item.stage)
          return [
            normalizedStep,
            {
              status: item.status,
              label: item.label,
              timestamp: item.timestamp,
              message: agentMap[normalizedStep]?.state_message ?? null,
            },
          ]
        }),
      ) as Partial<Record<ClaimsStep, StepStatusEntry>>),
      workflow: {
        status: detail.workflow.status === 'running' ? 'monitoring' : detail.workflow.status,
        label: 'Workflow',
        timestamp: detail.workflow.updated_at ?? detail.workflow.started_at ?? '',
        message: detail.workflow.paused_reason ?? detail.workflow.final_message ?? detail.workflow.results.message,
      },
    }
  }

  return Object.fromEntries(
    pipelineSteps.map((step, index) => {
      const currentIndex = pipelineSteps.findIndex((item) => item.id === visualCurrentStep)
      const status = index < currentIndex ? 'completed' : step.id === visualCurrentStep ? 'running' : 'pending'
      return [
        step.id,
        {
          status,
          label: step.label,
          timestamp: '',
          message: null,
        },
      ]
    }),
  ) as Partial<Record<ClaimsStep, StepStatusEntry>>
}

function getScreeningTask(detail: ClaimsCessionDetailPayload | undefined) {
  return detail?.worklist.items.find((item) => Boolean(item.screening_summary)) ?? null
}

function resolveVisibleStep(detail: ClaimsCessionDetailPayload | undefined): ClaimsStep {
  if (!detail) {
    return 'upload'
  }

  if (detail.workflow?.current_step_id) {
    return normalizeWorkflowStepId(detail.workflow.current_step_id)
  }

  const backendStep = detail.current_step as BackendClaimsStep
  const clausesCompleted = detail.stage_history.some((item) => item.stage === 'clauses')

  if (backendStep === 'upload') {
    return 'upload'
  }
  if (backendStep === 'detect' || backendStep === 'map-contract') {
    return 'detect-map'
  }
  if (backendStep === 'validate') {
    return 'validate'
  }
  if (backendStep === 'exceptions') {
    return 'exceptions'
  }
  if (backendStep === 'clauses') {
    return detail.stage === 'clauses' ? 'validate' : 'clauses'
  }
  if (backendStep === 'process') {
    return clausesCompleted ? 'process' : 'clauses'
  }
  if (backendStep === 'summary') {
    return 'summary'
  }
  if (backendStep === 'files') {
    return 'files'
  }
  if (backendStep === 'worklist') {
    return 'worklist'
  }
  if (backendStep === 'audit') {
    return 'audit'
  }
  return 'upload'
}

function normalizeWorkflowStepId(stepId: string): ClaimsStep {
  if (stepId === 'workflow') {
    return 'workflow'
  }
  if (stepId === 'detect' || stepId === 'map-contract') {
    return 'detect-map'
  }
  if (stepId === 'screening') {
    return 'screening'
  }
  return (stepId as ClaimsStep) || 'upload'
}

function workflowAgentKeyForStep(step: ClaimsStep): string | null {
  if (step === 'workflow') {
    return null
  }
  if (step === 'detect-map') {
    return 'mapping'
  }
  if (step === 'validate') {
    return 'anomaly_detection'
  }
  if (step === 'exceptions') {
    return 'resolution'
  }
  if (step === 'clauses') {
    return 'clause_validation'
  }
  if (step === 'process') {
    return 'processing'
  }
  if (step === 'summary') {
    return 'results'
  }
  if (step === 'screening') {
    return 'sanction_screening'
  }
  if (step === 'files') {
    return 'file_generation'
  }
  if (step === 'worklist') {
    return 'worklist'
  }
  if (step === 'audit') {
    return 'audit'
  }
  return null
}

function getWorkflowAgentForStep(workflow: ClaimsWorkflowPayload, step: ClaimsStep) {
  const agentKey = workflowAgentKeyForStep(step)
  return workflow.agents.find((agent) => agent.key === agentKey) ?? null
}

function workflowStepperButtonClass(status: string, isSelected: boolean, isRunning: boolean) {
  const baseClass = 'inline-flex items-center gap-2 rounded-full border px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap transition disabled:cursor-default disabled:opacity-70'
  const toneClass =
    status === 'completed'
      ? 'border-[#C7EED8] bg-[#E8F8F5] text-[#117A65]'
      : status === 'monitoring'
        ? 'border-[#C8DCEB] bg-white text-[#205375] hover:bg-[#F7FBFF]'
      : status === 'awaiting_approval'
        ? 'border-[#F4D8A6] bg-[#FEF5E7] text-[#B9770E]'
        : status === 'failed'
          ? 'border-[#F3C7C5] bg-[#FDEDEC] text-[#922B21]'
          : status === 'skipped'
            ? 'border-dashed border-[#CAD5DF] bg-[#F8FAFC] text-iris-text-secondary hover:bg-[#F1F5F8]'
            : isRunning || status === 'running'
              ? 'border-iris-navy bg-iris-navy text-white'
              : 'border-[#D9E3EA] bg-[#F4F7FA] text-iris-text-secondary hover:bg-[#EAF1F6]'
  const focusClass = isSelected ? ' ring-2 ring-[#B9D3E6] ring-offset-2' : ''
  return `${baseClass} ${toneClass}${focusClass}`
}

function workflowConnectorClass(currentStatus: string, nextStatus: string) {
  const baseClass = 'mx-2 h-0 w-6 border-t'
  const toneClass =
    currentStatus === 'failed' || nextStatus === 'failed'
      ? 'border-[#F3C7C5]'
      : currentStatus === 'awaiting_approval' || nextStatus === 'awaiting_approval'
        ? 'border-[#F4D8A6]'
        : currentStatus === 'skipped' || nextStatus === 'skipped'
          ? 'border-dashed border-[#CAD5DF]'
          : currentStatus === 'completed' || currentStatus === 'monitoring' || currentStatus === 'running'
            ? 'border-[#B9DCCD]'
            : 'border-[#D9E3EA]'
  return `${baseClass} ${toneClass}`
}

function resolveStepperStateIcon(status: string, message?: string | null) {
  if (status === 'completed') {
    return CheckCircle
  }
  if (status === 'awaiting_approval') {
    return PauseCircle
  }
  if (status === 'failed') {
    return WarningDiamond
  }
  if (status === 'skipped') {
    return skippedStateMetaFromMessage(message).icon
  }
  if (status === 'running' || status === 'monitoring') {
    return ArrowsClockwise
  }
  return null
}

function workflowStatusBadgeClass(status: string) {
  const baseClass = 'rounded-full border px-3 py-1.5 text-[12px] font-semibold'
  const toneClass =
    status === 'completed'
      ? 'border-[#C7EED8] bg-[#F0FFF6] text-[#1E8449]'
      : status === 'monitoring'
        ? 'border-[#C8DCEB] bg-[#F7FBFF] text-[#155A82]'
      : status === 'awaiting_approval'
        ? 'border-[#F4D8A6] bg-[#FFF9EF] text-[#8A6120]'
        : status === 'failed'
          ? 'border-[#F5C6CB] bg-[#FDEDEC] text-[#922B21]'
          : status === 'skipped'
            ? 'border-[#D7E2EA] bg-[#F8FAFC] text-iris-text-secondary'
            : status === 'running'
              ? 'border-[#D3E4F2] bg-[#F7FBFF] text-[#155A82]'
              : 'border-[#D7E2EA] bg-[#F8FAFC] text-iris-text-secondary'
  return `${baseClass} ${toneClass}`
}

function formatWorkflowStatusLabel(status: string) {
  if (status === 'monitoring') {
    return 'Monitoring'
  }
  if (status === 'awaiting_approval') {
    return 'Awaiting Approval'
  }
  if (status === 'running') {
    return 'Running'
  }
  if (status === 'completed') {
    return 'Completed'
  }
  if (status === 'skipped') {
    return 'Skipped'
  }
  if (status === 'failed') {
    return 'Failed'
  }
  return titleCase(status)
}

function formatExecutionTime(value: number | null) {
  if (!value && value !== 0) {
    return 'Time —'
  }
  if (value < 1000) {
    return `${value} ms`
  }
  return `${(value / 1000).toFixed(1)} s`
}

function hasWorkflowAgentExecuted(agent: ClaimsWorkflowPayload['agents'][number]) {
  return ['completed', 'awaiting_approval', 'failed', 'skipped'].includes(agent.status)
}

function hasWorkflowAgentStarted(agent: ClaimsWorkflowPayload['agents'][number]) {
  return agent.status !== 'pending'
}

function buildWorkflowInsight(
  detail: ClaimsCessionDetailPayload,
  pausedAgent: ClaimsWorkflowPayload['agents'][number] | null,
  currentAgent: ClaimsWorkflowPayload['agents'][number] | null,
  screeningSummary: ClaimsWorklistScreeningSummary | null,
) {
  const workflow = detail.workflow
  const workflowSummary = workflow.results

  if (workflow.status === 'completed' && workflowSummary.insight) {
    return workflowSummary.insight
  }

  const focusAgent =
    pausedAgent ??
    currentAgent ??
    [...workflow.agents].reverse().find((agent) => hasWorkflowAgentStarted(agent)) ??
    null

  if (!focusAgent) {
    return 'recommendation: upload confirmed; IRiS is preparing the first workflow checks.'
  }

  if (focusAgent.status === 'running') {
    return workflowInFlightInsight(focusAgent)
  }

  if (focusAgent.status === 'failed') {
    return focusAgent.error_message ?? focusAgent.state_message ?? 'recommendation: workflow escalation is required before processing can continue.'
  }

  return workflowAgentInsight(focusAgent, detail, screeningSummary) ?? workflowSummary.insight
}

function resolveWorkflowStartedTimestamp(workflow: ClaimsWorkflowPayload) {
  if (workflow.started_at) {
    return workflow.started_at
  }

  const candidateTimestamps = workflow.agents
    .flatMap((agent) => [agent.started_at, agent.completed_at, agent.updated_at])
    .concat(
      workflow.stepper
        .filter((item) => item.stage !== 'upload')
        .map((item) => item.timestamp),
    )
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())

  return candidateTimestamps[0] ?? null
}

function workflowInFlightInsight(agent: ClaimsWorkflowPayload['agents'][number]) {
  switch (agent.key) {
    case 'mapping':
      return 'recommendation: IRiS is classifying the upload and mapping the treaty context.'
    case 'anomaly_detection':
      return 'recommendation: IRiS is validating the uploaded rows and compiling anomaly findings.'
    case 'resolution':
      return 'recommendation: IRiS is applying high-confidence anomaly fixes and routing the remaining items for review.'
    case 'clause_validation':
      return 'recommendation: IRiS is checking the mapped file against the applicable contract clauses.'
    case 'processing':
      return 'recommendation: IRiS is executing the downstream processing logic and comparing the uploaded values with IRiS.'
    case 'results':
      return 'recommendation: IRiS is compiling the workflow summary and business impact.'
    case 'sanction_screening':
      return 'recommendation: IRiS is evaluating sanctions sources and release readiness.'
    case 'file_generation':
      return 'recommendation: IRiS is generating downstream settlement artifacts.'
    case 'worklist':
      return 'recommendation: IRiS is routing downstream tasks to the owning teams.'
    case 'audit':
      return 'recommendation: IRiS is finalizing the workflow audit trail.'
    default:
      return 'recommendation: workflow orchestration is in progress.'
  }
}

function workflowAgentInsight(
  agent: ClaimsWorkflowPayload['agents'][number],
  detail: ClaimsCessionDetailPayload,
  screeningSummary: ClaimsWorklistScreeningSummary | null,
) {
  switch (agent.key) {
    case 'mapping':
      return `recommendation: mapping confirmed ${detail.detection.cedent} to ${
        detail.contract_mapping.contract_id || 'the target contract'
      } for ${detail.contract_mapping.period}.`
    case 'anomaly_detection':
      if (!detail.validation.critical_errors && !detail.validation.warnings && !detail.validation.informational) {
        return 'recommendation: no anomalies detected; continue to the next agent.'
      }
      return `recommendation: review ${formatCount(detail.validation.critical_errors)} critical, ${formatCount(
        detail.validation.warnings,
      )} warning and ${formatCount(detail.validation.informational)} informational finding(s) before processing continues.`
    case 'resolution':
      if (detail.exceptions.unresolved > 0) {
        return `recommendation: approve or override the remaining ${formatCount(detail.exceptions.unresolved)} anomaly resolution(s) before orchestration resumes.`
      }
      return 'recommendation: all anomaly resolutions were applied automatically; continue to clause validation.'
    case 'clause_validation':
      if (detail.clauses.flagged_count > 0) {
        return `recommendation: review ${formatCount(detail.clauses.flagged_count)} flagged clause control(s) before execution.`
      }
      return 'recommendation: clause validation passed; continue to processing.'
    case 'processing': {
      const reconciliation = detail.summary.settlement_reconciliation
      if (reconciliation?.decision === 'review') {
        return 'recommendation: review the settlement reconciliation outcome before release.'
      }
      if (detail.summary.file_type === 'Settlement' && reconciliation?.decision === 'accept') {
        return 'recommendation: processing verified the uploaded fixed, floating and net values against IRiS.'
      }
      return 'recommendation: processing completed and the mapped cession data is ready for summary compilation.'
    }
    case 'results':
      return 'recommendation: workflow summary and business impact are ready for downstream review.'
    case 'sanction_screening':
      if (!screeningSummary) {
        return 'recommendation: no sanctions screening case was required for this workflow.'
      }
      if (screeningSummary.workflow_status === 'auto_cleared') {
        return 'recommendation: sanctions screening auto-cleared; continue to file generation.'
      }
      return 'recommendation: compliance review is required before the workflow can continue.'
    case 'file_generation':
      if (detail.downstream_files.items.length > 0) {
        return `recommendation: review ${formatCount(detail.downstream_files.items.length)} generated downstream file(s) before release.`
      }
      return 'recommendation: no downstream files were required for this workflow.'
    case 'worklist':
      if (detail.worklist.items.length > 0) {
        return `recommendation: ${formatCount(detail.worklist.items.length)} worklist task(s) were created and routed to the owning teams.`
      }
      return 'recommendation: no downstream worklist tasks were required for this run.'
    case 'audit':
      return `recommendation: ${formatCount(detail.audit.items.length)} audit event(s) captured; workflow history is ready for review.`
    default:
      return agent.state_message ?? agent.output_summary ?? null
  }
}

function skippedStateMeta(agent: ClaimsWorkflowPayload['agents'][number]) {
  return skippedStateMetaFromMessage(`${agent.state_message ?? ''} ${agent.output_summary ?? ''}`)
}

function skippedStateMetaFromMessage(message?: string | null) {
  const normalized = `${message ?? ''}`.toLowerCase()
  if (normalized.includes('disabled') || normalized.includes('bypass')) {
    return {
      label: 'Bypassed',
      icon: ProhibitInset,
      className: 'border-[#D7E2EA] bg-[#F8FAFC] text-[#5F6F7E]',
    }
  }
  if (normalized.includes('auto-cleared') || normalized.includes('auto-applied') || normalized.includes('auto-resolved')) {
    return {
      label: 'Auto-Resolved',
      icon: FastForwardCircle,
      className: 'border-[#CDEBD9] bg-[#F0FFF6] text-[#1E8449]',
    }
  }
  if (normalized.includes('fallback') || normalized.includes('condition')) {
    return {
      label: 'Conditional Skip',
      icon: Path,
      className: 'border-[#E2E8EF] bg-[#F8FAFC] text-[#627282]',
    }
  }
  return {
    label: 'Not Required',
    icon: Path,
    className: 'border-[#E2E8EF] bg-[#F8FAFC] text-[#627282]',
  }
}

function agentOutcomeMeta(agent: ClaimsWorkflowPayload['agents'][number]) {
  if (agent.status === 'completed') {
    return { icon: CheckCircle, label: 'Completed', tone: 'positive' as const }
  }
  if (agent.status === 'awaiting_approval') {
    return { icon: PauseCircle, label: 'Review queued', tone: 'warning' as const }
  }
  if (agent.status === 'failed') {
    return { icon: WarningDiamond, label: 'Escalated', tone: 'negative' as const }
  }
  if (agent.status === 'skipped') {
    const meta = skippedStateMeta(agent)
    return { icon: meta.icon, label: meta.label, tone: 'neutral' as const }
  }
  if (agent.status === 'running') {
    return { icon: ArrowsClockwise, label: 'Running', tone: 'neutral' as const }
  }
  return { icon: Flag, label: 'Queued', tone: 'neutral' as const }
}

function humanizeWorkflowField(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function workflowReadinessLabel(value: string) {
  return value || 'In Progress'
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatWorklistTaskStatus(value: string) {
  if (value === 'open') {
    return 'Not Started'
  }
  return titleCase(value)
}

function formatExceptionResolutionLabel(value: string) {
  if (value === 'accepted') {
    return 'Accepted'
  }
  if (value === 'overridden') {
    return 'Overridden'
  }
  if (value === 'rejected') {
    return 'Manual Review'
  }
  return 'Pending'
}

function formatSettlementDecision(value: string) {
  return value === 'accept' ? 'Recommend Approve' : 'Review Required'
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`
}

function buildScreeningSourceCards(summary: ClaimsWorklistScreeningSummary | null | undefined) {
  const isAutoCleared = summary?.workflow_status === 'auto_cleared'
  const screenedWatchlists = new Set((summary?.watchlists_screened ?? []).map((item) => normalizeWatchlistName(item)))
  const matchedWatchlists = new Set((summary?.matched_watchlists ?? []).map((item) => normalizeWatchlistName(item)))

  return ['OFAC', 'FinCEN'].map((name) => {
    const wasScreened = screenedWatchlists.has(name)
    const hasRetainedMatch = matchedWatchlists.has(name)

    if (!wasScreened) {
      return {
        name,
        result: 'Not Run',
        detail: `${name} was not included in the current cession-file screening run.`,
        tone: 'neutral' as const,
      }
    }

    if (!hasRetainedMatch) {
      return {
        name,
        result: 'Cleared',
        detail: `${name} completed with no retained watchlist match for this cedent.`,
        tone: 'positive' as const,
      }
    }

    if (isAutoCleared) {
      return {
        name,
        result: 'Raw Match Reviewed',
        detail: `${name} surfaced a raw watchlist overlap, and IRiS auto-cleared it after case analysis.`,
        tone: 'warning' as const,
      }
    }

    return {
      name,
      result: 'Pending Review',
      detail: `${name} returned a retained match that is still awaiting compliance disposition.`,
      tone: 'warning' as const,
    }
  })
}

function normalizeWatchlistName(value: string) {
  const normalized = value.trim().toUpperCase()
  if (normalized.startsWith('OFAC')) {
    return 'OFAC'
  }
  if (normalized.startsWith('FINCEN')) {
    return 'FinCEN'
  }
  return value.trim()
}

function compactCurrency(value: number, currency: string) {
  if (Math.abs(value) >= 1_000_000_000) {
    return `${currency} ${(value / 1_000_000_000).toFixed(0)}M`
  }
  return formatCurrency(value, currency)
}

function signedCompactCurrency(value: number, currency: string) {
  const prefix = value > 0 ? '+' : value < 0 ? '-' : ''
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000) {
    return `${prefix}${currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `}${(absolute / 1_000_000).toFixed(2)}M`
  }
  return `${prefix}${formatCurrency(absolute, currency)}`
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-GB').format(value)
}

function extractErrorMessage(caughtError: unknown) {
  const maybeMessage = caughtError as { response?: { data?: { details?: string } } }
  return maybeMessage.response?.data?.details
}
