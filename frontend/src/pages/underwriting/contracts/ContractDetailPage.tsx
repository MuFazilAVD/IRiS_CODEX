import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search, ShieldAlert, Upload } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { api } from '../../../api/client'
import { Breadcrumbs } from '../../../components/common/Breadcrumbs'
import { EmptyState } from '../../../components/common/EmptyState'
import { SectionPanel } from '../../../components/common/SectionPanel'
import { StatusBadge } from '../../../components/common/StatusBadge'
import { formatCurrency, formatRelativeDate } from '../../../utils/formatters'
import type {
  ContractAuditComplianceSection,
  ContractCalculationPayload,
  ContractComplianceDocument,
  ContractDetailPayload,
  ContractDetailsPerformancePayload,
  ContractMemberListPayload,
  ContractUploadMembersResponse,
} from '../../../types/api'
import { AuditTimeline, FieldGridForm, FieldGridReadOnly } from '../cedants/CedentSectionContent'
import { ContractAmendmentModal } from './ContractAmendmentModal'
import {
  actuarialBasisFields,
  calculationAggregationOptions,
  calculationGroupByOptions,
  calculationMetricOptions,
  contractDetailSections,
  contractSectionRouteMap,
  createEmptyComplianceDoc,
  economicTermsFields,
  masterDataFields,
  memberStatusOptions,
  operationalTermsFields,
  referencePoolFields,
  riskLimitsFields,
  type FieldConfig,
  type ContractEditableSectionKey,
  type ContractSectionKey,
} from './contractConfig'

const editableSections: Array<{ key: ContractEditableSectionKey; title: string; subtitle: string }> = [
  { key: 'master_data', title: 'Master Data', subtitle: 'Contract identifiers, structure, treaty references, and lifecycle status.' },
  { key: 'economic_terms', title: 'Economic Terms', subtitle: 'Notional, fixed and floating leg definitions, settlement settings, and collateral terms.' },
  { key: 'reference_pool', title: 'Reference Pool', subtitle: 'Population makeup, benefit profile, and data source references.' },
  { key: 'actuarial_basis', title: 'Actuarial Basis', subtitle: 'Tables, discount assumptions, improvement scales, and assumption set controls.' },
  { key: 'risk_limits', title: 'Risk & Limits', subtitle: 'Triggers, caps, deductible levels, and risk committee governance rules.' },
  { key: 'operational_terms', title: 'Operational Terms', subtitle: 'Servicing calendar, file cadence, and operating contacts.' },
  { key: 'compliance_docs', title: 'Compliance & Docs', subtitle: 'Document register aligned to legal, compliance, and onboarding controls.' },
]

const editableSectionKeys = new Set<ContractEditableSectionKey>(editableSections.map((section) => section.key))

interface RenderContractSectionProps {
  activeSection: ContractSectionKey
  busy: 'saving' | 'status' | 'uploading' | null
  calcAggregation: string
  calcFrom: string
  calcGroupBy: string
  calcMetric: string
  calcTo: string
  calculationQuery: ContractCalculationPayload | undefined
  detail: ContractDetailPayload
  editingSection: ContractEditableSectionKey | null
  filteredMembers: ContractMemberListPayload['items']
  memberGender: string
  memberList: ContractMemberListPayload | undefined
  memberSearch: string
  memberStatus: string
  performance: ContractDetailsPerformancePayload | null
  periods: string[]
  setDetail: Dispatch<SetStateAction<ContractDetailPayload | null>>
  onCalcAggregationChange: (value: string) => void
  onCalcFromChange: (value: string) => void
  onCalcGroupByChange: (value: string) => void
  onCalcMetricChange: (value: string) => void
  onCalcToChange: (value: string) => void
  onMemberGenderChange: (value: string) => void
  onMemberSearchChange: (value: string) => void
  onMemberStatusChange: (value: string) => void
  onOpenPopulation: () => void
  onOpenAmendment: () => void
  onUpdateField: (sectionKey: ContractEditableSectionKey, key: string, value: string | boolean) => void
}

export function ContractDetailPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [activeSection, setActiveSection] = useState<ContractSectionKey>('master_data')
  const [editingSection, setEditingSection] = useState<ContractEditableSectionKey | null>(null)
  const [detail, setDetail] = useState<ContractDetailPayload | null>(null)
  const [busy, setBusy] = useState<'saving' | 'status' | 'uploading' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [amendmentOpen, setAmendmentOpen] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberStatus, setMemberStatus] = useState('all')
  const [memberGender, setMemberGender] = useState('all')
  const [calcMetric, setCalcMetric] = useState('settlement_variance')
  const [calcAggregation, setCalcAggregation] = useState('sum')
  const [calcGroupBy, setCalcGroupBy] = useState('per_quarter')
  const [calcFrom, setCalcFrom] = useState('Q1 2024')
  const [calcTo, setCalcTo] = useState('Q1 2025')

  const detailQuery = useQuery({
    queryKey: ['contract-detail', id],
    queryFn: async () => (await api.get<ContractDetailPayload>(`/underwriting/contracts/${id}`)).data,
    enabled: Boolean(id),
  })

  const performanceQuery = useQuery({
    queryKey: ['contract-performance', id],
    queryFn: async () => (await api.get<ContractDetailsPerformancePayload>(`/underwriting/contracts/${id}/details-performance`)).data,
    enabled: Boolean(id),
  })

  const memberListQuery = useQuery({
    queryKey: ['contract-members', id, memberStatus],
    queryFn: async () =>
      (
        await api.get<ContractMemberListPayload>(`/underwriting/contracts/${id}/member-list`, {
          params: { status: memberStatus, page: 1, page_size: 10 },
        })
      ).data,
    enabled: Boolean(id),
  })

  const calculationQuery = useQuery({
    queryKey: ['contract-calculations', id, calcMetric, calcAggregation, calcGroupBy, calcFrom, calcTo],
    queryFn: async () =>
      (
        await api.get<ContractCalculationPayload>(`/underwriting/contracts/${id}/calculations`, {
          params: { metric: calcMetric, aggregation: calcAggregation, group_by: calcGroupBy, from: calcFrom, to: calcTo },
        })
      ).data,
    enabled: Boolean(id),
  })

  useEffect(() => {
    if (detailQuery.data) {
      setDetail(detailQuery.data)
    }
  }, [detailQuery.data])

  useEffect(() => {
    const periods = performanceQuery.data?.settlement_history.map((row) => row.period) ?? []
    if (!periods.length) {
      return
    }
    if (!periods.includes(calcFrom)) {
      setCalcFrom(periods[0])
    }
    if (!periods.includes(calcTo)) {
      setCalcTo(periods[periods.length - 1])
    }
  }, [performanceQuery.data, calcFrom, calcTo])

  const performance = performanceQuery.data ?? detail?.details_performance ?? null
  const activeEditableSection = isEditableSection(activeSection) ? activeSection : null
  const periods = performance?.settlement_history.map((row) => row.period) ?? []
  const memberRows = memberListQuery.data?.items ?? []
  const filteredMembers = useMemo(() => {
    const normalizedSearch = memberSearch.trim().toLowerCase()
    return memberRows.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        [item.member_id, item.name, item.status, item.last_verified].join(' ').toLowerCase().includes(normalizedSearch)
      const matchesGender = memberGender === 'all' || item.gender.toLowerCase() === memberGender.toLowerCase()
      return matchesSearch && matchesGender
    })
  }, [memberGender, memberRows, memberSearch])

  async function handleSaveSection(sectionKey: ContractEditableSectionKey) {
    if (!detail) {
      return
    }

    setBusy('saving')
    setError(null)
    setSuccess(null)
    try {
      await api.patch(`/underwriting/contracts/${detail.contract_id}/${contractSectionRouteMap[sectionKey]}`, detail[sectionKey] as unknown)
      await Promise.all([detailQuery.refetch(), performanceQuery.refetch()])
      setEditingSection(null)
      setSuccess(`${editableSectionTitle(sectionKey)} saved.`)
    } catch (caughtError: unknown) {
      setError(extractErrorMessage(caughtError) ?? 'Unable to save this contract section right now.')
    } finally {
      setBusy(null)
    }
  }

  function handleCancelEdit() {
    if (detailQuery.data) {
      setDetail(detailQuery.data)
    }
    setEditingSection(null)
    setError(null)
    setSuccess(null)
  }

  async function handleTerminate() {
    if (!detail || detail.status === 'terminated') {
      return
    }

    setBusy('status')
    setError(null)
    setSuccess(null)
    try {
      await api.patch(`/underwriting/contracts/${detail.contract_id}/master-data`, {
        ...detail.master_data,
        status: 'terminated',
      })
      await detailQuery.refetch()
      setSuccess('Contract marked as terminated.')
    } catch (caughtError: unknown) {
      setError(extractErrorMessage(caughtError) ?? 'Unable to update contract status.')
    } finally {
      setBusy(null)
    }
  }

  async function handleUploadMembers(file: File | null) {
    if (!detail || !file) {
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    setBusy('uploading')
    setError(null)
    setSuccess(null)
    try {
      const { data } = await api.post<ContractUploadMembersResponse>(`/underwriting/contracts/${detail.contract_id}/upload-members`, formData)
      await Promise.all([detailQuery.refetch(), memberListQuery.refetch()])
      setSuccess(`${data.filename ?? 'File'} uploaded. ${data.message}`)
    } catch (caughtError: unknown) {
      setError(extractErrorMessage(caughtError) ?? 'Unable to upload the members file.')
    } finally {
      setBusy(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function updateObjectSection(sectionKey: ContractEditableSectionKey, key: string, value: string | boolean) {
    setDetail((currentDetail) => {
      if (!currentDetail) {
        return currentDetail
      }
      const nextDetail = structuredClone(currentDetail)
      const section = nextDetail[sectionKey] as unknown as Record<string, unknown>
      section[key] = value
      return nextDetail
    })
  }

  if (detailQuery.isLoading || !detail) {
    return <div className="rounded-xl border border-iris-border bg-white px-5 py-6 text-iris-text-secondary shadow-sm">Loading contract detail...</div>
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Underwriting' },
          { label: 'Contracts', to: '/underwriting/contracts' },
          { label: detail.contract_id },
        ]}
      />

      <Link className="mb-4 inline-flex items-center gap-2 text-[13px] font-medium text-iris-blue hover:underline" to="/underwriting/contracts">
        <ArrowLeft className="h-4 w-4" />
        Back to Contracts
      </Link>

      <div className="rounded-[24px] border border-iris-border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[30px] font-bold leading-tight text-iris-text-primary">{detail.contract_name}</h1>
              <StatusBadge status={detail.status}>{titleCase(detail.status)}</StatusBadge>
              <span className="inline-flex rounded bg-[#F4F9FD] px-2.5 py-1 text-[11px] font-semibold text-iris-blue">{detail.version}</span>
            </div>
            <p className="mt-2 text-[13px] text-iris-text-secondary">
              {detail.contract_id} · {detail.cedent_name} · {formatCurrency(detail.notional, detail.currency)} ·{' '}
              {detail.lives_count.toLocaleString('en-GB')} lives
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
              ref={fileInputRef}
              className="hidden"
              type="file"
              onChange={(event) => void handleUploadMembers(event.target.files?.[0] ?? null)}
            />
            <button className="btn-secondary" onClick={() => navigate(`/claims/settlements?contract_id=${detail.contract_id}`)} type="button">
              Settle Period
            </button>
            <button className="btn-primary" onClick={() => setAmendmentOpen(true)} type="button">
              Add Amendment
            </button>
            <button className="btn-secondary" disabled={busy !== null} onClick={() => fileInputRef.current?.click()} type="button">
              <Upload className="h-4 w-4" />
              Upload Members
            </button>
            <button className="btn-secondary" disabled={busy !== null || detail.status === 'terminated'} onClick={() => void handleTerminate()} type="button">
              <ShieldAlert className="h-4 w-4" />
              Terminate
            </button>
          </div>
        </div>
      </div>

      {performance ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {performance.overview_metrics.map((item) => (
            <OverviewMetricChip key={item.label} change={item.change} label={item.label} tone={item.tone} value={item.value} />
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        <SectionPanel
          action={renderSectionAction({
            activeEditableSection,
            activeSection,
            busy,
            editingSection,
            onCancel: handleCancelEdit,
            onEdit: setEditingSection,
            onOpenAmendment: () => setAmendmentOpen(true),
            onSave: handleSaveSection,
          })}
          activeKey={activeSection}
          onSelect={(key) => {
            setActiveSection(key as ContractSectionKey)
            setEditingSection(null)
            setError(null)
            setSuccess(null)
          }}
          sections={contractDetailSections}
          subtitle={sectionSubtitle(activeSection)}
          title={sectionHeading(activeSection)}
        >
          {renderContractSection({
            activeSection,
            busy,
            calcAggregation,
            calcFrom,
            calcGroupBy,
            calcMetric,
            calcTo,
            calculationQuery: calculationQuery.data,
            detail,
            editingSection,
            filteredMembers,
            memberGender,
            memberList: memberListQuery.data,
            memberSearch,
            memberStatus,
            performance,
            periods,
            setDetail,
            onCalcAggregationChange: setCalcAggregation,
            onCalcFromChange: setCalcFrom,
            onCalcGroupByChange: setCalcGroupBy,
            onCalcMetricChange: setCalcMetric,
            onCalcToChange: setCalcTo,
            onMemberGenderChange: setMemberGender,
            onMemberSearchChange: setMemberSearch,
            onMemberStatusChange: setMemberStatus,
            onOpenPopulation: () =>
              navigate(
                `/underwriting/population?contract_id=${detail.contract_id}${detail.cedent_id ? `&cedent_id=${detail.cedent_id}` : ''}`,
              ),
            onOpenAmendment: () => setAmendmentOpen(true),
            onUpdateField: updateObjectSection,
          })}
        </SectionPanel>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-[#F5C6CB] bg-[#FDEDEC] px-4 py-3 text-[13px] text-[#922B21]">{error}</div> : null}
      {success ? <div className="mt-4 rounded-xl border border-[#D5F5E3] bg-[#F0FFF4] px-4 py-3 text-[13px] text-[#1E8449]">{success}</div> : null}

      <ContractAmendmentModal
        contractId={detail.contract_id}
        open={amendmentOpen}
        onClose={() => setAmendmentOpen(false)}
        onSubmitted={() => {
          void detailQuery.refetch()
          setSuccess('Amendment submitted for approval.')
        }}
      />
    </div>
  )
}

function renderContractSection({
  activeSection,
  busy,
  calcAggregation,
  calcFrom,
  calcGroupBy,
  calcMetric,
  calcTo,
  calculationQuery,
  detail,
  editingSection,
  filteredMembers,
  memberGender,
  memberList,
  memberSearch,
  memberStatus,
  performance,
  periods,
  setDetail,
  onCalcAggregationChange,
  onCalcFromChange,
  onCalcGroupByChange,
  onCalcMetricChange,
  onCalcToChange,
  onMemberGenderChange,
  onMemberSearchChange,
  onMemberStatusChange,
  onOpenPopulation,
  onOpenAmendment,
  onUpdateField,
}: RenderContractSectionProps) {
  switch (activeSection) {
    case 'master_data':
    case 'economic_terms':
    case 'reference_pool':
    case 'actuarial_basis':
    case 'risk_limits':
    case 'operational_terms':
    case 'compliance_docs':
      return (
        <ContractEditableSectionContent
          busy={busy}
          detail={detail}
          editingSection={editingSection}
          sectionKey={activeSection}
          setDetail={setDetail}
          onUpdateField={onUpdateField}
        />
      )
    case 'audit_approval':
      return <AuditTimeline events={detail.audit_approval} />
    case 'details_performance':
      return (
        <div className="space-y-5">
          <OverviewTab performance={performance} />
          <PerformanceSummarySection currency={detail.currency} performance={performance} />
        </div>
      )
    case 'member_list':
      return (
        <MemberPopulationTab
          contractId={detail.contract_id}
          detail={detail}
          filteredMembers={filteredMembers}
          memberGender={memberGender}
          memberList={memberList}
          memberSearch={memberSearch}
          memberStatus={memberStatus}
          memberSummary={memberList?.summary ?? detail.member_population}
          onMemberGenderChange={onMemberGenderChange}
          onMemberSearchChange={onMemberSearchChange}
          onMemberStatusChange={onMemberStatusChange}
          onOpenPopulation={onOpenPopulation}
        />
      )
    case 'file_templates':
      return <FileTemplatesSection detail={detail} performance={performance} />
    case 'amendments':
      return <AmendmentsTab detail={detail} onOpenAmendment={onOpenAmendment} />
    case 'calculations':
      return (
        <CalculationsSection
          calcAggregation={calcAggregation}
          calcFrom={calcFrom}
          calcGroupBy={calcGroupBy}
          calcMetric={calcMetric}
          calcTo={calcTo}
          calculationQuery={calculationQuery}
          periods={periods}
          onCalcAggregationChange={onCalcAggregationChange}
          onCalcFromChange={onCalcFromChange}
          onCalcGroupByChange={onCalcGroupByChange}
          onCalcMetricChange={onCalcMetricChange}
          onCalcToChange={onCalcToChange}
        />
      )
    case 'audit_compliance':
      return <AuditComplianceSection auditCompliance={detail.audit_compliance} />
  }
}

function renderSectionAction({
  activeEditableSection,
  activeSection,
  busy,
  editingSection,
  onCancel,
  onEdit,
  onOpenAmendment,
  onSave,
}: {
  activeEditableSection: ContractEditableSectionKey | null
  activeSection: ContractSectionKey
  busy: 'saving' | 'status' | 'uploading' | null
  editingSection: ContractEditableSectionKey | null
  onCancel: () => void
  onEdit: Dispatch<SetStateAction<ContractEditableSectionKey | null>>
  onOpenAmendment: () => void
  onSave: (section: ContractEditableSectionKey) => Promise<void>
}) {
  if (activeEditableSection) {
    if (editingSection === activeEditableSection) {
      return (
        <>
          <button className="btn-secondary" disabled={busy !== null} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="btn-primary" disabled={busy !== null} onClick={() => void onSave(activeEditableSection)} type="button">
            Save
          </button>
        </>
      )
    }

    return (
      <button className="btn-secondary" onClick={() => onEdit(activeEditableSection)} type="button">
        View / Edit
      </button>
    )
  }

  if (activeSection === 'amendments') {
    return (
      <button className="btn-primary" onClick={onOpenAmendment} type="button">
        Add Amendment
      </button>
    )
  }

  return null
}

function ContractEditableSectionContent({
  busy,
  detail,
  editingSection,
  sectionKey,
  setDetail,
  onUpdateField,
}: {
  busy: 'saving' | 'status' | 'uploading' | null
  detail: ContractDetailPayload
  editingSection: ContractEditableSectionKey | null
  sectionKey: ContractEditableSectionKey
  setDetail: Dispatch<SetStateAction<ContractDetailPayload | null>>
  onUpdateField: (sectionKey: ContractEditableSectionKey, key: string, value: string | boolean) => void
}) {
  const isEditing = editingSection === sectionKey

  return (
    <div className="space-y-5">
      <PanelCard subtitle={editableSectionSubtitle(sectionKey)} title={editableSectionInnerHeading(sectionKey)}>
        {sectionKey === 'compliance_docs' ? (
          isEditing ? (
            <ContractComplianceDocsEditor
              items={detail.compliance_docs}
              onChange={(items) => setDetail((current) => (current ? { ...current, compliance_docs: items } : current))}
            />
          ) : (
            <ContractComplianceDocsReadOnly items={detail.compliance_docs} />
          )
        ) : isEditing ? (
          <FieldGridForm
            fields={fieldsForSection(sectionKey)}
            onChange={(key, value) => onUpdateField(sectionKey, key, value)}
            values={toRecord(detail[sectionKey] as unknown)}
          />
        ) : (
          <div className="space-y-4">
            {sectionKey === 'economic_terms' && detail.economic_terms.is_locked ? (
              <div className="rounded-xl border border-[#F9E79F] bg-[#FEF9E7] px-4 py-3 text-[13px] text-[#7D6608]">
                Economic terms are locked after inception.
              </div>
            ) : null}
            <FieldGridReadOnly fields={fieldsForSection(sectionKey)} values={toRecord(detail[sectionKey] as unknown)} />
          </div>
        )}
      </PanelCard>

      {sectionKey === 'compliance_docs' ? <ClausesTable clauses={detail.contract_clauses} /> : null}
      {sectionKey !== 'compliance_docs' && busy === 'saving' && isEditing ? (
        <p className="text-[12px] text-iris-text-secondary">Saving follows the existing contract section API.</p>
      ) : null}
    </div>
  )
}

function OverviewTab({ performance }: { performance: ContractDetailsPerformancePayload | null }) {
  if (!performance) {
    return <p className="text-[13px] text-iris-text-secondary">Overview insights are loading...</p>
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-5">
          <PanelCard subtitle="Timeline of recent events" title="Recent Operational Trace">
            <div className="space-y-3">
              {performance.operational_trace.length ? (
                performance.operational_trace.map((item, index) => (
                  <div key={`${item.timestamp}-${index}`} className="rounded-xl border border-[#EEF2F5] bg-[#FAFBFC] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[14px] font-semibold text-iris-text-primary">{item.title}</p>
                      <span className="text-[12px] text-iris-text-muted">{formatRelativeDate(item.timestamp)}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-iris-text-secondary">
                      {item.actor} · {titleCase(item.status)}
                    </p>
                    <p className="mt-2 text-[13px] text-iris-text-secondary">{item.description}</p>
                  </div>
                ))
              ) : (
                <EmptyState
                  compact
                  description="Operational trace entries will appear as claims servicing and compliance events are recorded."
                  title="No operational trace is available"
                />
              )}
            </div>
          </PanelCard>

          <PanelCard subtitle="Trend stability, ingestion integrity, and servicing posture" title="Vitality Indices">
            <div className="grid gap-3 md:grid-cols-3">
              {performance.vitality_indices.map((item) => (
                <div key={item.label} className="rounded-xl border border-[#EEF2F5] bg-[#FAFBFC] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{item.label}</p>
                  <p className={`mt-3 text-[20px] font-bold ${toneClass(item.tone)}`}>{item.value}</p>
                  <p className="mt-2 text-[13px] text-iris-text-secondary">{item.caption}</p>
                </div>
              ))}
            </div>
          </PanelCard>
        </div>

        <PanelCard subtitle="IRiS AI insight text" title="Decision Intelligence">
          <p className="text-[18px] font-semibold text-iris-text-primary">{performance.decision_intelligence.headline}</p>
          <p className="mt-3 text-[13px] leading-6 text-iris-text-secondary">{performance.decision_intelligence.insight}</p>
          <div className="mt-4 space-y-2">
            {performance.decision_intelligence.supporting_points.map((point) => (
              <div key={point} className="rounded-xl bg-[#F8FAFC] px-3 py-3 text-[13px] text-iris-text-secondary">
                {point}
              </div>
            ))}
          </div>
        </PanelCard>
      </div>

    </div>
  )
}

function PerformanceSummarySection({
  performance,
  currency,
}: {
  performance: ContractDetailsPerformancePayload | null
  currency: string
}) {
  if (!performance) {
    return null
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 xl:grid-cols-6">
        {performance.headline_metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-iris-border bg-[#FAFBFC] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{metric.label}</p>
            <p className={`mt-3 text-[21px] font-bold ${toneClass(metric.accent)}`}>{metric.value}</p>
            {metric.subtitle ? <p className="mt-2 text-[12px] text-iris-text-secondary">{metric.subtitle}</p> : null}
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {performance.summary_cards.map((card) => (
          <PanelCard key={card.title} title={card.title}>
            <div className="space-y-2">
              {card.items.map((item) => (
                <div key={`${card.title}-${item.label}`} className="flex items-start justify-between gap-4 text-[13px]">
                  <span className="text-iris-text-secondary">{item.label}</span>
                  <span className="font-medium text-iris-text-primary">{item.value}</span>
                </div>
              ))}
            </div>
          </PanelCard>
        ))}
      </div>

      <PanelCard subtitle={`Cumulative net variance ${formatCurrency(performance.cumulative_net_variance, currency)}`} title="Settlement Tracker">
        <SettlementHistoryTable currency={currency} rows={performance.settlement_history} />
      </PanelCard>
    </div>
  )
}

function CalculationsSection({
  calcAggregation,
  calcFrom,
  calcGroupBy,
  calcMetric,
  calcTo,
  calculationQuery,
  periods,
  onCalcAggregationChange,
  onCalcFromChange,
  onCalcGroupByChange,
  onCalcMetricChange,
  onCalcToChange,
}: {
  calcAggregation: string
  calcFrom: string
  calcGroupBy: string
  calcMetric: string
  calcTo: string
  calculationQuery: ContractCalculationPayload | undefined
  periods: string[]
  onCalcAggregationChange: (value: string) => void
  onCalcFromChange: (value: string) => void
  onCalcGroupByChange: (value: string) => void
  onCalcMetricChange: (value: string) => void
  onCalcToChange: (value: string) => void
}) {
  return (
    <PanelCard subtitle="Ad-hoc calculation view powered by the underwriting calculation endpoint" title="Calculation Engine">
      <div className="grid gap-3 lg:grid-cols-5">
        <select className="field-input" value={calcMetric} onChange={(event) => onCalcMetricChange(event.target.value)}>
          {calculationMetricOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select className="field-input" value={calcAggregation} onChange={(event) => onCalcAggregationChange(event.target.value)}>
          {calculationAggregationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select className="field-input" value={calcGroupBy} onChange={(event) => onCalcGroupByChange(event.target.value)}>
          {calculationGroupByOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select className="field-input" value={calcFrom} onChange={(event) => onCalcFromChange(event.target.value)}>
          {periods.map((period) => (
            <option key={period} value={period}>
              {period}
            </option>
          ))}
        </select>
        <select className="field-input" value={calcTo} onChange={(event) => onCalcToChange(event.target.value)}>
          {periods.map((period) => (
            <option key={period} value={period}>
              {period}
            </option>
          ))}
        </select>
      </div>

      {calculationQuery ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <OverviewMetricChip label="Result" tone="positive" value={formatCalculationValue(calculationQuery.result_value, calculationQuery.metric, calculationQuery.currency)} />
            <OverviewMetricChip label="Grouping" tone="default" value={titleCase(calculationQuery.group_by.replaceAll('_', ' '))} />
            <OverviewMetricChip label="Period Window" tone="default" value={`${calculationQuery.from} -> ${calculationQuery.to}`} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-iris-border">
            <table className="min-w-full text-[13px]">
              <thead className="bg-[#F8F9FA]">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Period</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Value</th>
                </tr>
              </thead>
              <tbody>
                {calculationQuery.breakdown.map((row) => (
                  <tr key={row.period} className="border-t border-[#EEF2F5]">
                    <td className="px-4 py-3 text-iris-text-primary">{row.period}</td>
                    <td className="px-4 py-3 text-iris-text-primary">{formatCalculationValue(row.value, calculationQuery.metric, calculationQuery.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </PanelCard>
  )
}

function MemberPopulationTab({
  contractId,
  detail,
  memberList,
  memberSummary,
  filteredMembers,
  memberSearch,
  memberStatus,
  memberGender,
  onMemberSearchChange,
  onMemberStatusChange,
  onMemberGenderChange,
  onOpenPopulation,
}: {
  contractId: string
  detail: ContractDetailPayload
  memberList: ContractMemberListPayload | undefined
  memberSummary: ContractDetailPayload['member_population']
  filteredMembers: ContractMemberListPayload['items']
  memberSearch: string
  memberStatus: string
  memberGender: string
  onMemberSearchChange: (value: string) => void
  onMemberStatusChange: (value: string) => void
  onMemberGenderChange: (value: string) => void
  onOpenPopulation: () => void
}) {
  const sampleCount = filteredMembers.length
  const memberDisplayTotal = memberList?.display_total ?? memberSummary.total_members
  const currentPage = memberList?.page ?? 1
  const totalPages = memberList?.total_pages ?? 1

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <OverviewMetricChip label="Total Members" tone="default" value={memberSummary.total_members.toLocaleString('en-GB')} />
        <OverviewMetricChip label="Active Members" tone="positive" value={memberSummary.active_members.toLocaleString('en-GB')} />
        <OverviewMetricChip label="Deferred Members" tone="warning" value={memberSummary.deferred_members.toLocaleString('en-GB')} />
        <OverviewMetricChip label="Last Verified" tone="default" value={memberSummary.last_verified_date} />
      </div>

      <PanelCard
        action={
          <button className="btn-secondary" onClick={onOpenPopulation} type="button">
            Open Population Screen
          </button>
        }
        subtitle={`${detail.cedent_name} · ${contractId}`}
        title="Member Population"
      >
        <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(2,minmax(0,1fr))]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-iris-text-muted" />
            <input className="field-input pl-9" placeholder="Search member, status, or verification date" value={memberSearch} onChange={(event) => onMemberSearchChange(event.target.value)} />
          </label>
          <select className="field-input" value={memberStatus} onChange={(event) => onMemberStatusChange(event.target.value)}>
            {memberStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className="field-input" value={memberGender} onChange={(event) => onMemberGenderChange(event.target.value)}>
            <option value="all">All Genders</option>
            <option value="m">Male</option>
            <option value="f">Female</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-iris-border">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F8F9FA]">
              <tr>
                {['Member ID', 'Name', 'Age', 'Gender', 'Annuity', 'Status', 'Last Verified'].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length ? (
                filteredMembers.map((item) => (
                  <tr key={item.member_id} className="border-t border-[#EEF2F5]">
                    <td className="px-4 py-3 font-mono text-[12px] font-semibold text-iris-blue">{item.member_id}</td>
                    <td className="px-4 py-3 text-iris-text-primary">{item.name}</td>
                    <td className="px-4 py-3 text-iris-text-primary">{item.age}</td>
                    <td className="px-4 py-3 text-iris-text-primary">{item.gender}</td>
                    <td className="px-4 py-3 text-iris-text-primary">{formatCurrency(item.annuity_amount, item.currency)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status}>{titleCase(item.status)}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-iris-text-secondary">{item.last_verified}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6" colSpan={7}>
                    <EmptyState compact description="Try widening the status or gender filters to see the member population again." title="No members matched this view" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-iris-border bg-[#F8F9FA] px-4 py-3 text-[12px] text-iris-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {sampleCount.toLocaleString('en-GB')} sample members from {memberDisplayTotal.toLocaleString('en-GB')} covered lives.
          </p>
          <div className="flex items-center gap-2">
            <button className="btn-secondary cursor-not-allowed opacity-60" disabled type="button">
              Previous
            </button>
            <span className="rounded-full border border-iris-border bg-white px-4 py-2 font-semibold text-iris-text-primary">
              Page {currentPage.toLocaleString('en-GB')} of {totalPages.toLocaleString('en-GB')}
            </span>
            <button className="btn-secondary cursor-not-allowed opacity-60" disabled type="button">
              Next
            </button>
          </div>
        </div>
      </PanelCard>
    </div>
  )
}

function FileTemplatesSection({
  detail,
  performance,
}: {
  detail: ContractDetailPayload
  performance: ContractDetailsPerformancePayload | null
}) {
  return (
    <div className="space-y-5">
      <PanelCard subtitle={`${detail.file_templates.length} template(s) linked for ongoing exchange`} title="File Templates">
        <div className="overflow-x-auto rounded-xl border border-iris-border">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F8F9FA]">
              <tr>
                {['File Type', 'Template', 'Frequency', 'Format', 'Active'].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.file_templates.length ? (
                detail.file_templates.map((item) => (
                  <tr key={item.id} className="border-t border-[#EEF2F5]">
                    <td className="px-4 py-3 text-iris-text-primary">{item.file_type}</td>
                    <td className="px-4 py-3 text-iris-text-primary">{item.template_name}</td>
                    <td className="px-4 py-3 text-iris-text-secondary">{item.frequency}</td>
                    <td className="px-4 py-3 text-iris-text-secondary">{item.format}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.is_active ? 'active' : 'inactive'}>{item.is_active ? 'Active' : 'Inactive'}</StatusBadge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-iris-text-secondary" colSpan={5}>
                    No file templates are linked to this contract.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PanelCard>

      <PanelCard subtitle="Linked references and source artifacts" title="Technical Vault">
        <div className="grid gap-3 md:grid-cols-2">
          {(performance?.technical_vault ?? []).length ? (
            performance?.technical_vault.map((item) => (
              <div key={item.label} className="rounded-xl border border-[#EEF2F5] bg-[#FAFBFC] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{item.label}</p>
                <p className="mt-2 text-[14px] font-semibold text-iris-text-primary">{item.value}</p>
                <p className="mt-1 text-[12px] text-iris-text-secondary">{titleCase(item.kind)}</p>
              </div>
            ))
          ) : (
            <EmptyState compact description="Technical references will appear when linked source artifacts are available." title="No vault references are available" />
          )}
        </div>
      </PanelCard>
    </div>
  )
}

function AmendmentsTab({ detail, onOpenAmendment }: { detail: ContractDetailPayload; onOpenAmendment: () => void }) {
  return (
    <PanelCard
      action={
        <button className="btn-primary" onClick={onOpenAmendment} type="button">
          Add Amendment
        </button>
      }
      subtitle={`${detail.contract_id} protocol change history`}
      title="Amendments"
    >
      <div className="space-y-3">
        {detail.amendments.length ? (
          detail.amendments.map((item) => (
            <div key={item.id} className="rounded-xl border border-[#EEF2F5] bg-[#FAFBFC] px-4 py-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold text-iris-text-primary">{item.type}</p>
                    <StatusBadge status={item.status}>{titleCase(item.status)}</StatusBadge>
                    <span className="text-[12px] text-iris-text-muted">{item.version}</span>
                  </div>
                  <p className="mt-2 text-[13px] text-iris-text-secondary">{item.summary}</p>
                </div>
                <div className="text-[12px] text-iris-text-secondary">
                  <div>Submitted {item.submitted}</div>
                  <div className="mt-1">Effective {item.effective}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.changed_sections.map((section) => (
                  <span key={section} className="rounded-full bg-[#EEF4F8] px-2.5 py-1 text-[11px] font-semibold text-iris-blue">
                    {titleCase(section.replaceAll('_', ' '))}
                  </span>
                ))}
              </div>
            </div>
          ))
        ) : (
          <EmptyState compact description="Protocol changes submitted through the amendment flow will appear here." title="No amendments recorded yet" />
        )}
      </div>
    </PanelCard>
  )
}

function AuditComplianceSection({ auditCompliance }: { auditCompliance: ContractAuditComplianceSection }) {
  return (
    <div className="space-y-5">
      <PanelCard subtitle="Checklist used for operational and compliance readiness" title="Compliance Checklist">
        <div className="space-y-3">
          {auditCompliance.checklist.length ? (
            auditCompliance.checklist.map((item) => (
              <div key={item.control} className="rounded-xl border border-[#EEF2F5] bg-[#FAFBFC] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[14px] font-semibold text-iris-text-primary">{item.control}</p>
                  <StatusBadge status={item.status}>{titleCase(item.status)}</StatusBadge>
                </div>
                <p className="mt-1 text-[12px] text-iris-text-secondary">
                  {item.owner} · due {item.due_date}
                </p>
                <p className="mt-2 text-[13px] text-iris-text-secondary">{item.notes}</p>
              </div>
            ))
          ) : (
            <EmptyState compact description="Checklist items appear here as the contract moves through compliance controls." title="No compliance checklist items are recorded" />
          )}
        </div>
      </PanelCard>

      <PanelCard subtitle="Detailed access and servicing trail" title="Compliance Trail">
        <div className="overflow-x-auto rounded-xl border border-iris-border">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F8F9FA]">
              <tr>
                {['Timestamp', 'Actor', 'Type', 'Action', 'Detail'].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditCompliance.audit_trail.length ? (
                auditCompliance.audit_trail.map((item, index) => (
                  <tr key={`${item.timestamp}-${index}`} className="border-t border-[#EEF2F5]">
                    <td className="px-4 py-3 text-iris-text-secondary">{item.timestamp}</td>
                    <td className="px-4 py-3 text-iris-text-primary">{item.actor}</td>
                    <td className="px-4 py-3 text-iris-text-secondary">{item.type}</td>
                    <td className="px-4 py-3 text-iris-text-primary">{item.action}</td>
                    <td className="px-4 py-3 text-iris-text-secondary">{item.detail}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-iris-text-secondary" colSpan={5}>
                    No compliance trail entries are available for this contract.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PanelCard>
    </div>
  )
}

function SettlementHistoryTable({
  rows,
  currency,
}: {
  rows: ContractDetailsPerformancePayload['settlement_history']
  currency: string
}) {
  const sortedRows = [...rows].sort((left, right) => quarterPeriodSortValue(right.period) - quarterPeriodSortValue(left.period))

  return (
    <div className="overflow-x-auto rounded-xl border border-iris-border">
      <table className="min-w-full text-[13px]">
        <thead className="bg-[#F8F9FA]">
          <tr>
            {['Quarter', 'Expected Deaths', 'Actual Deaths', 'A/E', 'Fixed Leg', 'Floating Leg', 'Net', 'Status'].map((label) => (
              <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length ? (
            sortedRows.map((row) => (
              <tr key={row.period} className={`border-t border-[#EEF2F5] ${row.status === 'pending' ? 'bg-[#FCFBF7]' : ''}`}>
                <td className={`px-4 py-3 text-iris-text-primary ${row.status === 'pending' ? 'border-l-2 border-[#E5D9BE]' : ''}`}>{row.period}</td>
                <td className="px-4 py-3 text-iris-text-primary">{row.expected_deaths}</td>
                <td className="px-4 py-3 text-iris-text-primary">{row.actual_deaths}</td>
                <td className="px-4 py-3 text-iris-text-primary">{row.status === 'pending' ? '-' : row.ae_ratio.toFixed(3)}</td>
                <td className="px-4 py-3 text-iris-text-primary">{formatCurrency(row.fixed_leg, currency)}</td>
                <td className="px-4 py-3 text-iris-text-primary">{formatCurrency(row.floating_leg, currency)}</td>
                <td className={`px-4 py-3 font-semibold ${row.net_settled >= 0 ? 'text-[#117A65]' : 'text-[#922B21]'}`}>
                  {formatSignedCurrency(row.net_settled, currency)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status}>{titleCase(row.status)}</StatusBadge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-4 py-6 text-iris-text-secondary" colSpan={8}>
                Settlement history is not available yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function ContractComplianceDocsEditor({
  items,
  onChange,
}: {
  items: ContractComplianceDocument[]
  onChange: (items: ContractComplianceDocument[]) => void
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-iris-border">
        <table className="min-w-full text-[13px]">
          <thead className="bg-[#F8F9FA]">
            <tr>
              {['Type', 'Name', 'Date', 'Status', 'File', ''].map((label) => (
                <th key={label} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.doc_name}-${index}`} className="border-t border-[#EEF2F5]">
                <td className="px-3 py-2.5">
                  <input className="field-input" value={item.doc_type} onChange={(event) => updateListItem(items, index, 'doc_type', event.target.value, onChange)} />
                </td>
                <td className="px-3 py-2.5">
                  <input className="field-input" value={item.doc_name} onChange={(event) => updateListItem(items, index, 'doc_name', event.target.value, onChange)} />
                </td>
                <td className="px-3 py-2.5">
                  <input className="field-input" type="date" value={item.doc_date} onChange={(event) => updateListItem(items, index, 'doc_date', event.target.value, onChange)} />
                </td>
                <td className="px-3 py-2.5">
                  <input className="field-input" value={item.status} onChange={(event) => updateListItem(items, index, 'status', event.target.value, onChange)} />
                </td>
                <td className="px-3 py-2.5">
                  <input className="field-input" value={item.file_name} onChange={(event) => updateListItem(items, index, 'file_name', event.target.value, onChange)} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button className="btn-secondary" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} type="button">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn-secondary" onClick={() => onChange([...items, createEmptyComplianceDoc()])} type="button">
        + Add Document
      </button>
    </div>
  )
}

function ContractComplianceDocsReadOnly({ items }: { items: ContractComplianceDocument[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-iris-border">
      <table className="min-w-full text-[13px]">
        <thead className="bg-[#F8F9FA]">
          <tr>
            {['Type', 'Name', 'Date', 'Status', 'Actions'].map((label) => (
              <th key={label} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length ? (
            items.map((item, index) => (
              <tr key={`${item.doc_name}-${index}`} className="border-t border-[#EEF2F5]">
                <td className="px-3 py-2.5">{item.doc_type || '-'}</td>
                <td className="px-3 py-2.5">{item.doc_name || '-'}</td>
                <td className="px-3 py-2.5">{item.doc_date || '-'}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={item.status}>{titleCase(item.status)}</StatusBadge>
                </td>
                <td className="px-3 py-2.5 text-iris-blue">{item.file_name || 'No file linked'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-5 text-iris-text-secondary" colSpan={5}>
                No compliance documents recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function ClausesTable({ clauses }: { clauses: ContractDetailPayload['contract_clauses'] }) {
  return (
    <PanelCard title="Clauses">
      <div className="overflow-x-auto rounded-xl border border-iris-border">
        <table className="min-w-full text-[13px]">
          <thead className="bg-[#F8F9FA]">
            <tr>
              {['ID', 'Category', 'Clause', 'Summary & Citation', 'Applies to Transactions'].map((label) => (
                <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clauses.map((item) => (
              <tr key={item.clause_id} className="border-t border-[#EEF2F5] align-top">
                <td className="px-4 py-3 font-mono text-[12px] font-semibold text-iris-blue">{item.clause_id}</td>
                <td className="px-4 py-3 text-iris-text-secondary">{item.category}</td>
                <td className="px-4 py-3 font-medium text-iris-text-primary">{item.clause_title}</td>
                <td className="px-4 py-3 text-iris-text-secondary">{item.summary_citation}</td>
                <td className="px-4 py-3 text-iris-text-secondary">{item.applies_to_transactions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelCard>
  )
}

function PanelCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-[22px] border border-iris-border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[18px] font-bold text-iris-text-primary">{title}</p>
          {subtitle ? <p className="mt-1 text-[13px] text-iris-text-secondary">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function OverviewMetricChip({
  label,
  value,
  change,
  tone,
}: {
  label: string
  value: string
  change?: string
  tone: 'default' | 'positive' | 'negative' | 'warning'
}) {
  return (
    <div className="rounded-[22px] border border-iris-border bg-white px-5 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      <p className={`mt-3 text-[24px] font-bold ${toneClass(tone)}`}>{value}</p>
      {change ? <p className="mt-2 text-[12px] text-iris-text-secondary">{change}</p> : null}
    </div>
  )
}

function fieldsForSection(sectionKey: ContractEditableSectionKey): FieldConfig[] {
  switch (sectionKey) {
    case 'master_data':
      return masterDataFields
    case 'economic_terms':
      return economicTermsFields
    case 'reference_pool':
      return referencePoolFields
    case 'actuarial_basis':
      return actuarialBasisFields
    case 'risk_limits':
      return riskLimitsFields
    case 'operational_terms':
      return operationalTermsFields
    case 'compliance_docs':
      return []
  }
}

function editableSectionTitle(sectionKey: ContractEditableSectionKey) {
  return editableSections.find((section) => section.key === sectionKey)?.title ?? titleCase(sectionKey.replaceAll('_', ' '))
}

function editableSectionSubtitle(sectionKey: ContractEditableSectionKey) {
  return editableSections.find((section) => section.key === sectionKey)?.subtitle ?? ''
}

function editableSectionInnerHeading(sectionKey: ContractEditableSectionKey) {
  switch (sectionKey) {
    case 'master_data':
      return 'Contract Identification'
    case 'economic_terms':
      return 'Economic Terms'
    case 'reference_pool':
      return 'Reference Pool'
    case 'actuarial_basis':
      return 'Actuarial Basis'
    case 'risk_limits':
      return 'Risk & Limits'
    case 'operational_terms':
      return 'Operational Terms'
    case 'compliance_docs':
      return 'Compliance Documents'
  }
}

function sectionHeading(sectionKey: ContractSectionKey) {
  switch (sectionKey) {
    case 'audit_approval':
      return 'Audit & Approval'
    case 'details_performance':
      return 'Details & Performance'
    case 'member_list':
      return 'Member List'
    case 'file_templates':
      return 'File Templates'
    case 'amendments':
      return 'Amendments'
    case 'calculations':
      return 'Calculations'
    case 'audit_compliance':
      return 'Audit & Compliance'
    default:
      return editableSectionTitle(sectionKey)
  }
}

function sectionSubtitle(sectionKey: ContractSectionKey) {
  switch (sectionKey) {
    case 'audit_approval':
      return 'Timeline of approvals and material contract changes.'
    case 'details_performance':
      return 'Operational intelligence, settlement history, and performance summaries.'
    case 'member_list':
      return 'Current covered-life register scoped to this contract.'
    case 'file_templates':
      return 'Agreed exchange templates and linked source references.'
    case 'amendments':
      return 'Versioned protocol changes and approval progress.'
    case 'calculations':
      return 'Run settlement and A/E aggregations for this contract.'
    case 'audit_compliance':
      return 'Checklist controls and detailed compliance trail entries.'
    default:
      return editableSectionSubtitle(sectionKey)
  }
}

function isEditableSection(sectionKey: ContractSectionKey): sectionKey is ContractEditableSectionKey {
  return editableSectionKeys.has(sectionKey as ContractEditableSectionKey)
}

function formatSignedCurrency(value: number, currency: string) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatCurrency(Math.abs(value), currency)}`
}

function formatCalculationValue(value: number, metric: string, currency: string) {
  return metric === 'ae_ratio' ? value.toFixed(3) : formatCurrency(value, currency)
}

function quarterPeriodSortValue(period: string) {
  const match = /^Q([1-4])\s+(\d{4})$/i.exec(period.trim())
  if (!match) {
    return Number.MIN_SAFE_INTEGER
  }

  return Number.parseInt(match[2], 10) * 10 + Number.parseInt(match[1], 10)
}

function toneClass(tone: string) {
  if (tone === 'positive') {
    return 'text-[#117A65]'
  }
  if (tone === 'negative') {
    return 'text-[#922B21]'
  }
  if (tone === 'warning' || tone === 'danger') {
    return 'text-[#AF601A]'
  }
  return 'text-iris-text-primary'
}

function toRecord(value: unknown) {
  return value as Record<string, unknown>
}

function updateListItem(
  items: ContractComplianceDocument[],
  index: number,
  key: keyof ContractComplianceDocument,
  value: string,
  onChange: (items: ContractComplianceDocument[]) => void,
) {
  const next = [...items]
  next[index] = { ...next[index], [key]: value }
  onChange(next)
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function extractErrorMessage(caughtError: unknown) {
  if (typeof caughtError !== 'object' || caughtError === null || !('response' in caughtError)) {
    return null
  }

  const response = (caughtError as { response?: { data?: { detail?: string; error?: string } } }).response
  return response?.data?.detail ?? response?.data?.error ?? null
}
