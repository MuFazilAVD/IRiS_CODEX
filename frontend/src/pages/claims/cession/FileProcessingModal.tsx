import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, FileUp, RefreshCw, Sparkles, Upload, X } from 'lucide-react'

import { api } from '../../../api/client'
import { formatCurrency, formatRelativeDate } from '../../../utils/formatters'
import type {
  CedentListItem,
  ClaimsAuditEvent,
  ClaimsCessionDetailPayload,
  ClaimsExceptionItem,
  ClaimsPipelineStageResponse,
  ClaimsUploadResponse,
  ClaimsWorklistTask,
  ContractListItem,
} from '../../../types/api'

type ClaimsStep =
  | 'upload'
  | 'detect'
  | 'map-contract'
  | 'clauses'
  | 'validate'
  | 'exceptions'
  | 'process'
  | 'summary'
  | 'worklist'
  | 'audit'

type UploadMode = 'auto' | 'manual'
type ExceptionChoice = 'accept' | 'override' | 'manual'

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

const PIPELINE_STEPS: Array<{ id: ClaimsStep; label: string }> = [
  { id: 'upload', label: 'Upload' },
  { id: 'detect', label: 'Detect' },
  { id: 'map-contract', label: 'Map Contract' },
  { id: 'clauses', label: 'Clauses' },
  { id: 'validate', label: 'Validate' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'process', label: 'Process' },
  { id: 'summary', label: 'Summary' },
  { id: 'worklist', label: 'Worklist' },
  { id: 'audit', label: 'Audit' },
]

const FILE_TYPE_OPTIONS = [
  'Pension Status',
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

export function FileProcessingModal({
  fileId,
  startInUpload = false,
  cedentOptions,
  contractOptions,
  onClose,
  onRefresh,
}: FileProcessingModalProps) {
  const [activeFileId, setActiveFileId] = useState<string | null>(fileId ?? null)
  const [selectedStep, setSelectedStep] = useState<ClaimsStep>(startInUpload ? 'upload' : 'detect')
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
      setSelectedStep(detail.current_step as ClaimsStep)
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
  const completedSteps = new Set<ClaimsStep>()

  if (detail) {
    for (const item of detail.stage_history) {
      const step = mapHistoryStageToStep(item.stage)
      if (step) {
        completedSteps.add(step)
      }
    }
    if (detail.stage === 'approved') {
      for (const step of PIPELINE_STEPS) {
        completedSteps.add(step.id)
      }
    }
  }

  const visibleContracts = contractOptions.filter((item) => !detectCedentId || item.cedent_id === detectCedentId)
  const canContinue =
    !busy &&
    (currentStep !== 'upload' || Boolean(selectedFile)) &&
    (currentStep !== 'exceptions' || detail?.exceptions.items.length !== 0)

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

      if (currentStep === 'detect') {
        await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/detect`, {
          override_file_type: detectFileType || null,
          override_cedent_id: detectCedentId || null,
        })
        await Promise.all([detailQuery.refetch(), Promise.resolve(onRefresh())])
        setSelectedStep('map-contract')
        return
      }

      if (currentStep === 'map-contract') {
        await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/map-contract`, {
          override_contract_id: mappedContractId || null,
        })
        await Promise.all([detailQuery.refetch(), Promise.resolve(onRefresh())])
        setSelectedStep('clauses')
        return
      }

      if (currentStep === 'clauses') {
        await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/clauses`, {})
        await detailQuery.refetch()
        setSelectedStep('validate')
        return
      }

      if (currentStep === 'validate') {
        await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/validate`, {})
        const refreshed = await detailQuery.refetch()
        setExceptionActions(buildExceptionState(refreshed.data?.exceptions.items ?? []))
        setSelectedStep('exceptions')
        return
      }

      if (currentStep === 'exceptions') {
        const payload = buildExceptionResolutionPayload(detail?.exceptions.items ?? [], exceptionActions)
        await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/process-exceptions`, {
          exception_resolutions: payload,
        })
        await detailQuery.refetch()
        setSelectedStep('process')
        return
      }

      if (currentStep === 'process') {
        await api.post<ClaimsPipelineStageResponse>(`/claims/cession-files/${activeFileId}/pipeline/process`, {})
        await Promise.all([detailQuery.refetch(), Promise.resolve(onRefresh())])
        setSelectedStep('summary')
        return
      }

      if (currentStep === 'summary') {
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
    const { data } = await api.post<ClaimsUploadResponse>('/claims/cession-files/upload', formData)
    setActiveFileId(data.file_id)
    initializedFileId.current = null
    setPendingManualType(uploadMode === 'manual' ? manualUploadFileType : null)
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

  function handleSelectSample(sampleName: string) {
    const sample = SAMPLE_FILES.find((item) => item.name === sampleName)
    if (!sample) {
      return
    }
    setSelectedFile(new File([sample.content], sample.name, { type: sample.type }))
  }

  const modalTitle = activeFileId ? 'Cession File Processing' : 'New Cession File'
  const fileSubtitle = detail
    ? `${detail.file_id} · ${detail.filename} · ${detail.cedent} · ${detail.file_type} · ${formatCount(detail.records)} records`
    : 'Upload + AI-assisted ingestion pipeline'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-3 z-50 overflow-hidden rounded-[24px] border border-[#D8E2EA] bg-white shadow-[0_24px_70px_rgba(13,27,42,0.24)]">
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

            {detail && currentStep === 'detect' ? (
              <DetectStep
                cedentOptions={cedentOptions}
                detectCedentId={detectCedentId}
                detectFileType={detectFileType}
                detail={detail}
                onCedentChange={setDetectCedentId}
                onFileTypeChange={setDetectFileType}
              />
            ) : null}

            {detail && currentStep === 'map-contract' ? (
              <MapContractStep
                contractOptions={visibleContracts}
                detail={detail}
                mappedContractId={mappedContractId}
                onContractChange={setMappedContractId}
              />
            ) : null}

            {detail && currentStep === 'clauses' ? <ClausesStep detail={detail} /> : null}
            {detail && currentStep === 'validate' ? <ValidateStep detail={detail} /> : null}

            {detail && currentStep === 'exceptions' ? (
              <ExceptionsStep
                detail={detail}
                exceptionActions={exceptionActions}
                onExceptionActionsChange={setExceptionActions}
              />
            ) : null}

            {detail && currentStep === 'process' ? <ProcessStep detail={detail} /> : null}

            {detail && currentStep === 'summary' ? (
              <SummaryStep busy={busy} detail={detail} onApprove={() => void handleApprove()} />
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

function DetectStep({
  cedentOptions,
  detectCedentId,
  detectFileType,
  detail,
  onCedentChange,
  onFileTypeChange,
}: {
  cedentOptions: CedentListItem[]
  detectCedentId: string
  detectFileType: string
  detail: ClaimsCessionDetailPayload
  onCedentChange: (value: string) => void
  onFileTypeChange: (value: string) => void
}) {
  return (
    <div className="space-y-5">
      <SectionHeading title="AI Classification & Cedant Identification" subtitle="Review and override IRiS detection if needed." />
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
    </div>
  )
}

function MapContractStep({
  contractOptions,
  detail,
  mappedContractId,
  onContractChange,
}: {
  contractOptions: ContractListItem[]
  detail: ClaimsCessionDetailPayload
  mappedContractId: string
  onContractChange: (value: string) => void
}) {
  const mapping = detail.contract_mapping
  const selectedContract = contractOptions.find((item) => item.contract_id === mappedContractId)

  return (
    <div className="space-y-5">
      <SectionHeading title="Contract & Treaty Mapping" subtitle="Auto-mapped by cedant + period. Override below if required." />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
        <select className="field-input" value={mappedContractId} onChange={(event) => onContractChange(event.target.value)}>
          {contractOptions.map((option) => (
            <option key={option.contract_id} value={option.contract_id}>
              {option.contract_id} ({option.version})
            </option>
          ))}
        </select>
        <div className="field-input bg-[#F8FAFC]">{selectedContract?.version ?? mapping.version}</div>
        <div className="field-input bg-[#F8FAFC]">{mapping.period}</div>
      </div>

      <div className="rounded-[22px] border border-[#D8E3EA] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[18px] font-bold text-iris-text-primary">
              {mapping.contract_id} — {selectedContract?.contract_name ?? mapping.contract_name}
            </p>
            <p className="mt-1 text-[13px] text-iris-text-secondary">{mapping.matching_basis}</p>
          </div>
          <span className="rounded-full bg-[#E8F8F5] px-3 py-1 text-[12px] font-semibold text-[#117A65]">
            {formatConfidence(mapping.confidence)} confidence
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricLine label="Notional" value={compactCurrency(mapping.notional, mapping.currency)} />
          <MetricLine label="Fixed leg" value={`${mapping.fixed_leg_rate_pct.toFixed(2)}%`} />
          <MetricLine label="Floating leg" value={mapping.floating_leg} />
          <MetricLine label="Lives covered" value={formatCount(mapping.lives_covered)} />
          <MetricLine label="Inception" value={mapping.inception_date} />
          <MetricLine label="Maturity" value={mapping.maturity_date} />
          <MetricLine label="Status" value={titleCase(mapping.status)} />
          <MetricLine label="Currency" value={mapping.currency} />
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
      <SectionHeading title="Data Validation Results" subtitle={`${formatCount(validation.records)} records · ${validation.columns_mapped} columns auto-mapped`} />

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
                {['Sev', 'Row', 'Field', 'Issue', 'Current', 'AI Suggestion'].map((label) => (
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
                    <span className="font-medium text-iris-text-primary">{item.ai_suggestion ?? '—'}</span>
                    <span className="ml-2 text-[12px]">conf {Math.round(item.ai_confidence * 100)}%</span>
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
        manualValue: exceptionActions[exceptionId]?.manualValue ?? '',
      },
    })
  }

  function updateManualValue(exceptionId: string, manualValue: string) {
    onExceptionActionsChange({
      ...exceptionActions,
      [exceptionId]: {
        choice: 'manual',
        manualValue,
      },
    })
  }

  function resolveCriticalWithAi() {
    const nextState = { ...exceptionActions }
    for (const item of detail.exceptions.items) {
      if (item.severity === 'critical') {
        nextState[item.exception_id] = { choice: 'accept', manualValue: '' }
      }
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
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F7F9FB]">
              <tr>
                {['Sev', 'Row', 'Field', 'Issue', 'Current', 'AI suggestion', 'Action'].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.exceptions.items.map((item) => {
                const state = exceptionActions[item.exception_id] ?? { choice: 'accept' as ExceptionChoice, manualValue: '' }
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
                      <span className="font-medium text-iris-text-primary">{item.ai_suggestion ?? '—'}</span>
                      <div className="mt-1 text-[12px]">{item.clause_reference}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <ActionChoiceButton active={state.choice === 'accept'} label="Accept" onClick={() => updateChoice(item.exception_id, 'accept')} />
                        <ActionChoiceButton active={state.choice === 'override'} label="Override" onClick={() => updateChoice(item.exception_id, 'override')} />
                        <ActionChoiceButton active={state.choice === 'manual'} label="Manual" onClick={() => updateChoice(item.exception_id, 'manual')} />
                      </div>
                      {state.choice === 'manual' ? (
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

      <button className="btn-secondary" onClick={resolveCriticalWithAi} type="button">
        Resolve All Critical with AI suggestions
      </button>
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
  return (
    <div className="space-y-5">
      <SectionHeading title="Processing Summary" subtitle="Business impact, exceptions, IRiS insights" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <KpiCard accent="neutral" title="Liability Impact" value={signedCompactCurrency(detail.summary.liability_impact ?? 0, detail.summary.settlement_impact?.currency ?? 'EUR')} />
        <KpiCard
          accent="teal"
          title="Fixed Leg Recomputed"
          value={detail.summary.fixed_leg_recomputed ? signedCompactCurrency(detail.summary.fixed_leg_recomputed, detail.summary.settlement_impact?.currency ?? 'EUR') : '—'}
        />
      </div>

      <div className="rounded-[22px] border border-[#B8E2E0] bg-[#F4FBFB] px-5 py-4 text-[13px] text-iris-text-primary">
        <div className="mb-2 flex items-center gap-2 font-semibold text-[#117A65]">
          <Sparkles className="h-4 w-4" />
          IRiS Insights
        </div>
        <p>{detail.summary.insight}</p>
      </div>

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
  return (
    <div className="space-y-5">
      <SectionHeading title={title} subtitle={subtitle} />
      <div className="overflow-hidden rounded-[22px] border border-[#D9E3EA] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F7F9FB]">
              <tr>
                {['Task', 'Type', 'Team', 'Priority', 'SLA'].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((item) => (
                  <tr key={item.wl_id} className="border-t border-[#EEF2F5]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-iris-text-primary">{item.task}</div>
                      <div className="mt-1 font-mono text-[12px] text-iris-blue">{item.wl_id}</div>
                    </td>
                    <td className="px-4 py-3 text-iris-text-secondary">{item.type}</td>
                    <td className="px-4 py-3 text-iris-text-secondary">{titleCase(item.team)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#FEF5E7] px-2.5 py-1 text-[12px] font-semibold text-[#B9770E]">{titleCase(item.priority)}</span>
                    </td>
                    <td className="px-4 py-3 text-iris-text-secondary">{item.sla}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-iris-text-secondary" colSpan={5}>
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
  return <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${classes[normalized] ?? 'bg-[#EEF1F4] text-[#566573]'}`}>{titleCase(stage)}</span>
}

function buildExceptionState(items: ClaimsExceptionItem[]): ExceptionActionState {
  return Object.fromEntries(
    items.map((item) => [
      item.exception_id,
      {
        choice: item.resolution === 'overridden' ? 'manual' : item.resolution === 'rejected' ? 'override' : 'accept',
        manualValue: item.resolution === 'overridden' ? item.current_value ?? '' : '',
      },
    ]),
  )
}

function buildExceptionResolutionPayload(items: ClaimsExceptionItem[], state: ExceptionActionState) {
  return items.map((item) => {
    const itemState = state[item.exception_id] ?? { choice: 'accept' as ExceptionChoice, manualValue: '' }
    if (itemState.choice === 'manual') {
      return {
        exception_id: item.exception_id,
        resolution: 'overridden',
        override_value: itemState.manualValue,
      }
    }
    if (itemState.choice === 'override') {
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

function mapHistoryStageToStep(stage: string): ClaimsStep | null {
  const stageMap: Record<string, ClaimsStep> = {
    uploaded: 'upload',
    detecting: 'detect',
    detected: 'detect',
    mapped: 'map-contract',
    clauses: 'clauses',
    validated: 'validate',
    exceptions: 'exceptions',
    processing: 'process',
    processed: 'summary',
    approved: 'audit',
  }
  return stageMap[stage] ?? null
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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
