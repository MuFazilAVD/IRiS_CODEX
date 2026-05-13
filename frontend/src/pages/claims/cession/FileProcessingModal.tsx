import { Fragment, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Check, ChevronDown, ChevronRight, Download, Eye, FileUp, RefreshCw, Send, Sparkles, Upload, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { api } from '../../../api/client'
import { formatCurrency, formatRelativeDate } from '../../../utils/formatters'
import type {
  CedentListItem,
  ClaimsAuditEvent,
  ClaimsCessionDetailPayload,
  ClaimsExceptionItem,
  ClaimsPipelineStageResponse,
  ClaimsUploadResponse,
  ClaimsWorklistScreeningSummary,
  ClaimsWorklistTask,
  ContractListItem,
} from '../../../types/api'

type ClaimsStep =
  | 'upload'
  | 'detect-map'
  | 'validate'
  | 'exceptions'
  | 'clauses'
  | 'process'
  | 'summary'
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

const PIPELINE_STEPS: Array<{ id: ClaimsStep; label: string }> = [
  { id: 'upload', label: 'Upload' },
  { id: 'detect-map', label: 'Detect & Map' },
  { id: 'validate', label: 'Anomalies' },
  { id: 'exceptions', label: 'Resolutions' },
  { id: 'clauses', label: 'Clauses' },
  { id: 'process', label: 'Process' },
  { id: 'summary', label: 'Summary' },
  { id: 'files', label: 'Files' },
  { id: 'worklist', label: 'Worklist' },
  { id: 'audit', label: 'Audit' },
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

const SAMPLE_FILES: Array<{ name: string; content: string; type: string }> = [
  {
    name: 'northstar_status_2025Q1.csv',
    type: 'text/csv',
    content:
      'member_id,date_of_birth,gender,status,date_of_death,annual_pension,escalation_type,postcode\nPEN-0100234,1963-04-12,F,active,,12000,RPI,SW1A 1AA\nPEN-0100236,1954-07-23,F,active,,12774,RPI,SW1A 2BB\nPEN-0100238,1947-02-08,F,deceased,2025-01-18,13548,RPI,SW1A 3CC\nPEN-0100240,1941-11-30,F,active,,14322,RPI,SW1A 4DD\n',
  },
  {
    name: 'helvetia_mortality_apr2025.xlsx',
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content:
      'member_id,death_date,cause_code,verified_by\nHLV-000101,2025-03-04,NAT,Helvetia Admin\nHLV-000245,2025-03-18,UNK,\nHLV-000317,2025-03-20,NAT,Helvetia Admin\n',
  },
  {
    name: 'northstar_spouses_apr.csv',
    type: 'text/csv',
    content:
      'member_id,event_type,event_date,spouse_dob,spouse_gender,benefit_pct\nPEN-0100234,spouse_added,2025-03-11,1966-06-12,F,50\n',
  },
  {
    name: 'maple_activity_2025Q1.csv',
    type: 'text/csv',
    content: 'member_id,activity_code,effective_date\nMAP-000100,DEFER,2025-03-31\nMAP-000240,SPOUSE_CHANGE,2025-03-31\n',
  },
  {
    name: 'bavarian_fixed_leg_q1.csv',
    type: 'text/csv',
    content:
      'row_id,period,fixed_leg_amount,currency,fee_amount,value_date,contract_id\n100,Q1-2025,8914200,EUR,412300,2025-03-30,LSC-2025-002\n237,Q1-2025,8914200,EUR,412300,2025-03-30,LSC-2025-002\n374,Q1-2025,8914200,EUR,412300,2025-03-30,LSC-2025-002\n511,Q1-2025,8914200,EUR,412300,2025-03-30,LSC-2025-002\n',
  },
  {
    name: 'bavarian_settlement_2025Q1.csv',
    type: 'text/csv',
    content:
      'Calculation Period,Payment Date,Pensioner Movement,Applicable Indexation / Escalation,Fixed Leg,Floating Leg,Fee (Admin),Interest on Over/Underpayment from Prior Period,Net Settlement Amount,contract_id\nQ1 2025,2025-04-30,None,None,51200000,50980000,0,0,-220000,LSC-2025-002\n',
  },
  {
    name: 'boe_discount_curve_2025Q1.csv',
    type: 'text/csv',
    content: 'tenor,rate\n1Y,0.041\n5Y,0.037\n10Y,0.034\n',
  },
  {
    name: 'northstar_collateral_apr.csv',
    type: 'text/csv',
    content: 'account_id,threshold_amount,currency,report_date\nCOLL-1042,25000000,GBP,2025-03-31\n',
  },
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
  onFileCreated,
}: CessionFileProcessingWorkflowProps) {
  const [activeFileId, setActiveFileId] = useState<string | null>(fileId ?? null)
  const [selectedStep, setSelectedStep] = useState<ClaimsStep>(startInUpload ? 'upload' : 'detect-map')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadMode, setUploadMode] = useState<UploadMode>('auto')
  const [manualUploadFileType, setManualUploadFileType] = useState('Fixed Leg')
  const [detectFileType, setDetectFileType] = useState('Fixed Leg')
  const [detectCedentId, setDetectCedentId] = useState('')
  const [mappedContractId, setMappedContractId] = useState('')
  const [exceptionActions, setExceptionActions] = useState<ExceptionActionState>({})
  const [notice, setNotice] = useState<ModalNotice>(null)
  const [busy, setBusy] = useState(false)
  const [pendingManualType, setPendingManualType] = useState<string | null>(null)
  const [autoValidating, setAutoValidating] = useState(false)
  const [fileActionBusy, setFileActionBusy] = useState<string | null>(null)
  const [filePreview, setFilePreview] = useState<{ artifactId: string; filename: string; content: string } | null>(null)

  const initializedFileId = useRef<string | null>(null)

  const detailQuery = useQuery({
    queryKey: ['claims-cession-file-detail', activeFileId],
    queryFn: async () => (await api.get<ClaimsCessionDetailPayload>(`/claims/cession-files/${activeFileId}`)).data,
    enabled: Boolean(activeFileId),
  })

  useEffect(() => {
    setActiveFileId(fileId ?? null)
    if (startInUpload && !fileId) {
      setSelectedStep('upload')
    }
  }, [fileId, startInUpload])

  useEffect(() => {
    if (!detailQuery.data) {
      return
    }

    const detail = detailQuery.data
    if (initializedFileId.current !== detail.file_id) {
      initializedFileId.current = detail.file_id
      setSelectedStep(resolveVisibleStep(detail))
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
  const currentStep = activeFileId ? selectedStep : 'upload'

  useEffect(() => {
    if (!activeFileId || !detail || currentStep !== 'validate' || detail.stage !== 'clauses' || autoValidating) {
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
  }, [activeFileId, autoValidating, currentStep, detail, detailQuery])
  const actualCurrentStep = detail ? resolveVisibleStep(detail) : currentStep
  const visualCurrentStep = resolveVisualCurrentStep(actualCurrentStep, currentStep)
  const completedSteps = new Set<ClaimsStep>()
  const actualStepIndex = PIPELINE_STEPS.findIndex((step) => step.id === visualCurrentStep)
  if (detail?.stage === 'approved') {
    for (const step of PIPELINE_STEPS) {
      completedSteps.add(step.id)
    }
  } else if (actualStepIndex > 0) {
    for (const step of PIPELINE_STEPS.slice(0, actualStepIndex)) {
      completedSteps.add(step.id)
    }
  }

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
  const canContinue =
    !busy &&
    !autoValidating &&
    (currentStep !== 'upload' || Boolean(selectedFile)) &&
    validationReady &&
    (currentStep !== 'exceptions' ||
      ((detail?.exceptions.items.length ?? 0) !== 0 && pendingResolutionCount === 0 && invalidOverrideCount === 0))

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
        setSelectedStep(resolveVisibleStep(refreshed.data))
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
    setSelectedStep('detect-map')
    onFileCreated?.(data.file_id)
    await Promise.resolve(onRefresh())
    setNotice({
      tone: 'success',
      message: `${data.file_id} uploaded and moved into the detection stage.`,
    })
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
      setSelectedStep('worklist')
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

  function handleSelectSample(sampleName: string) {
    const sample = SAMPLE_FILES.find((item) => item.name === sampleName)
    if (!sample) {
      return
    }
    setSelectedFile(new File([sample.content], sample.name, { type: sample.type }))
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
            <div className="flex min-w-max items-center gap-2">
              {PIPELINE_STEPS.map((step, index) => {
                const isCurrent = currentStep === step.id
                const isComplete = completedSteps.has(step.id)
                return (
                  <div key={step.id} className="flex items-center gap-2">
                    <button
                      className={`rounded-full px-3.5 py-2 text-[12px] font-semibold transition ${
                        isCurrent
                          ? 'bg-iris-navy text-white'
                          : isComplete
                            ? 'bg-[#E8F8F5] text-[#117A65]'
                            : 'bg-[#F4F7FA] text-iris-text-secondary hover:bg-[#EAF1F6]'
                      }`}
                      onClick={() => {
                        if (activeFileId) {
                          setSelectedStep(step.id)
                        }
                      }}
                      type="button"
                    >
                      {isComplete ? '✓ ' : ''}
                      {step.label}
                    </button>
                    {index < PIPELINE_STEPS.length - 1 ? <span className="text-[#AAB7C4]">→</span> : null}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="min-h-[620px] bg-[#FAFBFC] px-4 py-5 md:px-6">
            {notice ? <NoticeBanner tone={notice.tone}>{notice.message}</NoticeBanner> : null}

            {detailQuery.isLoading && activeFileId ? <div className="panel-card">Loading file detail...</div> : null}

            {currentStep === 'upload' ? (
              <UploadStep
                manualUploadFileType={manualUploadFileType}
                selectedFile={selectedFile}
                uploadMode={uploadMode}
                onFilePicked={setSelectedFile}
                onManualUploadFileTypeChange={setManualUploadFileType}
                onSampleSelect={handleSelectSample}
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

            {detail && currentStep === 'summary' ? (
              <SummaryStep busy={busy} detail={detail} onApprove={() => void handleApprove()} />
            ) : null}

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

            {detail && currentStep === 'worklist' ? <WorklistStep items={detail.worklist.items} subtitle={detail.worklist.subtitle} title={detail.worklist.title} /> : null}

            {detail && currentStep === 'audit' ? <AuditStep items={detail.audit.items} subtitle={detail.audit.subtitle} title={detail.audit.title} /> : null}
          </div>

          <div className="flex items-center justify-between border-t border-[#E5EBF0] bg-white px-6 py-4">
            <button className="btn-secondary" onClick={onClose} type="button">
              Save & Close
            </button>

            <div className="flex items-center gap-2">
              {currentStep === 'summary' ? (
                <button className="btn-secondary" disabled={busy} onClick={() => setSelectedStep('process')} type="button">
                  <RefreshCw className="h-4 w-4" />
                  Back to Process
                </button>
              ) : null}
              {currentStep === 'files' ? (
                <button className="btn-secondary" disabled={busy} onClick={() => setSelectedStep('summary')} type="button">
                  <RefreshCw className="h-4 w-4" />
                  Back to Summary
                </button>
              ) : null}

              <button className="btn-primary" disabled={!canContinue} onClick={() => void handleContinue()} type="button">
                {busy ? 'Working...' : currentStep === 'audit' ? 'Finish' : 'Continue'}
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
              <div className="flex min-w-max items-center gap-2">
                {PIPELINE_STEPS.map((step, index) => {
                  const isCurrent = currentStep === step.id
                  const isComplete = completedSteps.has(step.id)
                  return (
                    <div key={step.id} className="flex items-center gap-2">
                      <button
                        className={`rounded-full px-3.5 py-2 text-[12px] font-semibold transition ${
                          isCurrent
                            ? 'bg-iris-navy text-white'
                            : isComplete
                              ? 'bg-[#E8F8F5] text-[#117A65]'
                              : 'bg-[#F4F7FA] text-iris-text-secondary hover:bg-[#EAF1F6]'
                        }`}
                        onClick={() => {
                          if (activeFileId) {
                            setSelectedStep(step.id)
                          }
                        }}
                        type="button"
                      >
                        {isComplete ? '✓ ' : ''}
                        {step.label}
                      </button>
                      {index < PIPELINE_STEPS.length - 1 ? <span className="text-[#AAB7C4]">→</span> : null}
                    </div>
                  )
                })}
              </div>
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
                uploadMode={uploadMode}
                onFilePicked={setSelectedFile}
                onManualUploadFileTypeChange={setManualUploadFileType}
                onSampleSelect={handleSelectSample}
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

            {detail && currentStep === 'summary' ? (
              <SummaryStep busy={busy} detail={detail} onApprove={() => void handleApprove()} />
            ) : null}

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

            {detail && currentStep === 'worklist' ? <WorklistStep items={detail.worklist.items} subtitle={detail.worklist.subtitle} title={detail.worklist.title} /> : null}

            {detail && currentStep === 'audit' ? <AuditStep items={detail.audit.items} subtitle={detail.audit.subtitle} title={detail.audit.title} /> : null}
          </div>

          <div className="flex items-center justify-between border-t border-[#E5EBF0] bg-white px-6 py-4">
            <button className="btn-secondary" onClick={onClose} type="button">
              {currentStep === 'audit' ? 'Close' : 'Cancel'}
            </button>

            <div className="flex items-center gap-2">
              {currentStep === 'summary' ? (
                <button className="btn-secondary" disabled={busy} onClick={() => setSelectedStep('process')} type="button">
                  <RefreshCw className="h-4 w-4" />
                  Back to Process
                </button>
              ) : null}
              {currentStep === 'files' ? (
                <button className="btn-secondary" disabled={busy} onClick={() => setSelectedStep('summary')} type="button">
                  <RefreshCw className="h-4 w-4" />
                  Back to Summary
                </button>
              ) : null}

              <button className="btn-primary" disabled={!canContinue} onClick={() => void handleContinue()} type="button">
                {busy ? 'Working...' : currentStep === 'audit' ? 'Finish' : 'Continue'}
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
  uploadMode,
  onFilePicked,
  onManualUploadFileTypeChange,
  onSampleSelect,
  onUploadModeChange,
}: {
  manualUploadFileType: string
  selectedFile: File | null
  uploadMode: UploadMode
  onFilePicked: (file: File | null) => void
  onManualUploadFileTypeChange: (value: string) => void
  onSampleSelect: (sampleName: string) => void
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
          <p className="text-[14px] font-semibold text-iris-text-primary">Drop file here, or pick a sample below</p>
          <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-md border border-iris-border bg-white px-3.5 py-2 text-[13px] font-semibold text-iris-text-primary hover:bg-[#F8FAFC]">
            <FileUp className="h-4 w-4" />
            Choose local file
            <input
              accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
              className="hidden"
              onChange={(event) => onFilePicked(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <p className="text-[12px] text-iris-text-secondary">{selectedFile ? `${selectedFile.name} · ${formatCount(selectedFile.size)} bytes` : 'No file selected yet.'}</p>
        </div>

        <div className="mt-6 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {SAMPLE_FILES.map((sample) => (
            <button
              key={sample.name}
              className="rounded-xl border border-[#D9E3EA] bg-[#FBFCFD] px-3 py-3 text-left text-[13px] font-medium text-iris-text-primary transition hover:border-[#8FB9D4] hover:bg-[#F3F8FB]"
              onClick={() => onSampleSelect(sample.name)}
              type="button"
            >
              {sample.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <UploadOptionCard
          active={uploadMode === 'auto'}
          subtitle="Primary route from the screenshot. IRiS will classify the file type and cedant in the next step."
          title="AI Auto-Detect"
          onSelect={() => onUploadModeChange('auto')}
        />
        <UploadOptionCard
          active={uploadMode === 'manual'}
          subtitle="Manual path from the screenshot. Pick the file type now and IRiS will carry it into detection."
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
                {['Sev', 'Row', 'Field', 'Issue', 'Current', 'AI Suggested Value', 'Reference', 'Action'].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {label}
                  </th>
                ))}
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
                    <td className="px-4 py-3 text-iris-text-secondary">{item.clause_reference}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <ActionChoiceButton active={state.choice === 'accept'} label="Accept" onClick={() => updateChoice(item.exception_id, 'accept')} />
                        <ActionChoiceButton active={state.choice === 'override'} label="Override" onClick={() => updateChoice(item.exception_id, 'override')} />
                        <ActionChoiceButton active={state.choice === 'manual'} label="Manual" onClick={() => updateChoice(item.exception_id, 'manual')} />
                      </div>
                      {state.choice === 'accept' ? <div className="mt-2 text-[12px] text-[#117A65]">Accept selected for this resolution.</div> : null}
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
      <SectionHeading title="Processing Summary" subtitle="Business impact, resolutions, IRiS insights" />
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
            {reconciliation.settlement_id} Â· {reconciliation.calculation_period} Â· {reconciliation.expected_source}
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
        <MetricLine label="Watchlists" value={summary.watchlists_screened.length ? summary.watchlists_screened.join(' · ') : 'OFAC · FinCEN'} />
        <MetricLine label="Confidence" value={summary.confidence_pct !== null ? `${summary.confidence_pct}%` : '—'} />
        <MetricLine label="Analysis" value={summary.analysis_label || 'Completed'} />
        <MetricLine label="Recommended Action" value={summary.recommended_action || 'Review case'} />
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

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      <p className="mt-1.5 text-[14px] font-semibold text-iris-text-primary">{value}</p>
    </div>
  )
}

function KpiCard({
  accent,
  title,
  value,
}: {
  accent: 'neutral' | 'teal'
  title: string
  value: string
}) {
  return (
    <div className={`rounded-[22px] border bg-white px-5 py-5 shadow-sm ${accent === 'teal' ? 'border-[#8FD7D2]' : 'border-[#D9E3EA]'}`}>
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">{title}</p>
      <p className={`mt-3 text-[30px] font-bold ${accent === 'teal' ? 'text-[#117A65]' : 'text-iris-text-primary'}`}>{value}</p>
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
              : item.resolution === 'accepted' || item.resolution === 'pending'
                ? 'accept'
                : 'accept',
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

function resolveVisualCurrentStep(actualCurrentStep: ClaimsStep, currentStep: ClaimsStep) {
  const postProcessSteps: ClaimsStep[] = ['summary', 'files', 'worklist', 'audit']
  if (postProcessSteps.includes(actualCurrentStep) && postProcessSteps.includes(currentStep)) {
    const actualIndex = postProcessSteps.indexOf(actualCurrentStep)
    const currentIndex = postProcessSteps.indexOf(currentStep)
    return currentIndex > actualIndex ? currentStep : actualCurrentStep
  }
  return actualCurrentStep
}

function resolveVisibleStep(detail: ClaimsCessionDetailPayload | undefined): ClaimsStep {
  if (!detail) {
    return 'upload'
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

function formatSettlementDecision(value: string) {
  return value === 'accept' ? 'Recommend Approve' : 'Review Required'
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`
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
