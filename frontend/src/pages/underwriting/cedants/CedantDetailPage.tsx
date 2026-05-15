import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowLeft, Pencil, ShieldAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { api } from '../../../api/client'
import { Breadcrumbs } from '../../../components/common/Breadcrumbs'
import { SectionPanel } from '../../../components/common/SectionPanel'
import { StatusBadge } from '../../../components/common/StatusBadge'
import { formatCurrency, formatCurrencyCompact } from '../../../utils/formatters'
import type {
  CedentCalculationContract,
  CedentCalculationQuarterRow,
  CedentCalculationsSummary,
  CedentDetailPayload,
  CedentStatusResponse,
} from '../../../types/api'
import {
  AuditTimeline,
  BeneficiaryRulesEditor,
  BeneficiaryRulesReadOnly,
  FieldGridForm,
  FieldGridReadOnly,
  KeyContactsEditor,
  KeyContactsReadOnly,
  RegulatoryDocsEditor,
  RegulatoryDocsReadOnly,
  SanctionScreeningPanel,
} from './CedentSectionContent'
import {
  actuarialPreferencesFields,
  cedentDetailSections,
  complianceKycFields,
  contractReadinessFields,
  financialTreasuryFields,
  legalEntityFields,
  operationalConnectivityFields,
  pensionSchemeFields,
  populationExposureFields,
  sectionRouteMap,
  type CedentEditableSectionKey,
  type CedentSectionKey,
} from './cedentConfig'

const editableSections = new Set<CedentEditableSectionKey>([
  'legal_entity',
  'pension_scheme',
  'key_contacts',
  'financial_treasury',
  'contract_readiness',
  'population_exposure',
  'compliance_kyc',
  'regulatory_docs',
  'operational_connectivity',
  'actuarial_preferences',
  'access_beneficiary_rules',
])

const cedentCalculationMetricOptions = [
  { label: 'Net Settlements', value: 'net_settlements' },
  { label: 'Fixed Leg', value: 'fixed_leg' },
  { label: 'Floating Leg', value: 'floating_leg' },
  { label: 'A/E Ratio', value: 'ae_ratio' },
  { label: 'Active Pensioners', value: 'active_pensioners' },
] as const

const cedentCalculationAggregationOptions = [
  { label: 'Sum', value: 'sum' },
  { label: 'Average', value: 'avg' },
  { label: 'Minimum', value: 'min' },
  { label: 'Maximum', value: 'max' },
] as const

type CedentCalculationMetricKey = (typeof cedentCalculationMetricOptions)[number]['value']
type CedentCalculationAggregationKey = (typeof cedentCalculationAggregationOptions)[number]['value']

interface CedentCalculationView {
  availableQuarters: string[]
  availableContracts: Array<{ label: string; value: string }>
  selectedContracts: CedentCalculationContract[]
  filteredQuarters: string[]
  resultValue: number
  resultCurrency: string
  resultLabel: string
  quarterRows: Array<{ quarter: string; sum: number; min: number; max: number; contracts: number }>
  contractRows: Array<{ contract_id: string; quarterValues: Record<string, number>; total: number }>
  pensionerRows: Array<{ quarter: string; total_lives: number; delta_previous: number; mortality_rate: number }>
}

export function CedantDetailPage() {
  const { id = '' } = useParams()
  const [activeSection, setActiveSection] = useState<CedentSectionKey>('legal_entity')
  const [editingSection, setEditingSection] = useState<CedentEditableSectionKey | null>(null)
  const [detail, setDetail] = useState<CedentDetailPayload | null>(null)
  const [screeningFilter, setScreeningFilter] = useState<'all' | 'OFAC' | 'FinCEN'>('all')
  const [calculationMetric, setCalculationMetric] = useState<CedentCalculationMetricKey>('net_settlements')
  const [calculationAggregation, setCalculationAggregation] = useState<CedentCalculationAggregationKey>('sum')
  const [calculationFrom, setCalculationFrom] = useState('')
  const [calculationTo, setCalculationTo] = useState('')
  const [calculationContract, setCalculationContract] = useState('all')
  const [busy, setBusy] = useState<'saving' | 'screening' | 'status' | null>(null)
  const [busySource, setBusySource] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const detailQuery = useQuery({
    queryKey: ['cedent-detail', id],
    queryFn: async () => (await api.get<CedentDetailPayload>(`/underwriting/cedents/${id}`)).data,
    enabled: Boolean(id),
  })

  useEffect(() => {
    if (detailQuery.data) {
      setDetail(detailQuery.data)
    }
  }, [detailQuery.data])

  useEffect(() => {
    if (!detailQuery.data) {
      return
    }

    const calculations = detailQuery.data.calculations
    setCalculationMetric(isCedentCalculationMetric(calculations.default_metric) ? calculations.default_metric : 'net_settlements')
    setCalculationAggregation(isCedentCalculationAggregation(calculations.default_aggregation) ? calculations.default_aggregation : 'sum')
    setCalculationFrom(calculations.default_from)
    setCalculationTo(calculations.default_to)
    setCalculationContract(calculations.default_contract || 'all')
  }, [detailQuery.data])

  const calculationView = useMemo(
    () =>
      detail
        ? buildCedentCalculationView({
            calculations: detail.calculations,
            metric: calculationMetric,
            aggregation: calculationAggregation,
            from: calculationFrom,
            to: calculationTo,
            contractFilter: calculationContract,
          })
        : null,
    [calculationAggregation, calculationContract, calculationFrom, calculationMetric, calculationTo, detail],
  )

  const editableActiveSection = isEditableSection(activeSection) ? activeSection : null

  async function handleSaveSection() {
    if (!detail || !editableActiveSection) {
      return
    }

    setBusy('saving')
    setError(null)
    try {
      await api.patch(`/underwriting/cedents/${detail.cedent_id}/${sectionRouteMap[editableActiveSection]}`, detail[editableActiveSection])
      const { data } = await api.get<CedentDetailPayload>(`/underwriting/cedents/${detail.cedent_id}`)
      setDetail(data)
      setEditingSection(null)
    } catch {
      setError('Unable to save this section right now.')
    } finally {
      setBusy(null)
    }
  }

  function handleCancelEdit() {
    if (detailQuery.data) {
      setDetail(detailQuery.data)
    }
    setEditingSection(null)
  }

  async function handleStatusChange(nextStatus: 'active' | 'inactive') {
    if (!detail) {
      return
    }

    const promptLabel = nextStatus === 'inactive' ? 'Enter a reason for deactivation' : 'Enter a reason for reactivation'
    const reason = window.prompt(promptLabel, nextStatus === 'inactive' ? 'Operational hold pending review' : 'Compliance approval received')
    if (!reason) {
      return
    }

    setBusy('status')
    setError(null)
    try {
      const { data } = await api.patch<CedentStatusResponse>(`/underwriting/cedents/${detail.cedent_id}/status`, {
        status: nextStatus,
        reason,
      })
      setDetail((currentDetail) => (currentDetail ? { ...currentDetail, status: data.status } : currentDetail))
      await detailQuery.refetch()
    } catch {
      setError('Unable to update cedant status.')
    } finally {
      setBusy(null)
    }
  }

  async function handleTriggerScreening(sources: string[]) {
    if (!detail) {
      return
    }

    setBusy('screening')
    setBusySource(sources.length > 1 ? 'ALL' : sources[0])
    setError(null)
    try {
      await api.post(`/underwriting/cedents/${detail.cedent_id}/sanction-screening`, { sources })
      const { data } = await api.get<CedentDetailPayload>(`/underwriting/cedents/${detail.cedent_id}`)
      setDetail(data)
    } catch {
      setError('Unable to trigger sanction screening.')
    } finally {
      setBusy(null)
      setBusySource(null)
    }
  }

  function updateObjectSection(sectionKey: CedentEditableSectionKey, key: string, value: string | boolean) {
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
    return <div className="rounded-xl border border-iris-border bg-white px-5 py-6 text-iris-text-secondary shadow-sm">Loading cedant detail...</div>
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Underwriting' },
          { label: 'Cedants', to: '/underwriting/cedants' },
          { label: detail.legal_entity_name },
        ]}
      />

      <Link className="mb-4 inline-flex items-center gap-2 text-[13px] font-medium text-iris-blue hover:underline" to="/underwriting/cedants">
        <ArrowLeft className="h-4 w-4" />
        Back to Cedants
      </Link>

      <div className="mb-6 rounded-xl border border-iris-border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[28px] font-bold leading-tight text-iris-text-primary">{detail.legal_entity_name}</h1>
              <StatusBadge status={detail.status}>{titleCase(detail.status)}</StatusBadge>
              <StatusBadge status={detail.screening_status}>Screening: {titleCase(detail.screening_status)}</StatusBadge>
            </div>
            <p className="mt-2 text-[13px] text-iris-text-secondary">
              {detail.cedent_id} - {displayCedantCountryCode(detail.country)} - {detail.contracts_count} contract(s) - AUM {formatMoney(detail.aum, detail.aum_currency)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className={detail.status === 'inactive' ? 'btn-primary' : 'btn-secondary'}
              disabled={busy !== null}
              onClick={() => void handleStatusChange(detail.status === 'inactive' ? 'active' : 'inactive')}
              type="button"
            >
              <ShieldAlert className="h-4 w-4" />
              {detail.status === 'inactive' ? 'Reactivate ->' : 'Deactivate'}
            </button>
            {editableActiveSection ? (
              editingSection === editableActiveSection ? (
                <>
                  <button className="btn-secondary" disabled={busy !== null} onClick={handleCancelEdit} type="button">
                    Cancel
                  </button>
                  <button className="btn-primary" disabled={busy !== null} onClick={() => void handleSaveSection()} type="button">
                    Save
                  </button>
                </>
              ) : (
                <button className="btn-primary" onClick={() => setEditingSection(editableActiveSection)} type="button">
                  <Pencil className="h-4 w-4" />
                  View / Edit
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>

      <SectionPanel
        action={null}
        activeKey={activeSection}
        onSelect={(key) => {
          setActiveSection(key as CedentSectionKey)
          setEditingSection(null)
          setError(null)
        }}
        sections={cedentDetailSections}
        subtitle={sectionSubtitle(activeSection)}
        title={sectionTitle(activeSection)}
      >
        {renderSection({
          activeSection,
          busy,
          busySource,
          calculationAggregation,
          calculationContract,
          calculationFrom,
          calculationMetric,
          calculationTo,
          calculationView,
          detail,
          editingSection,
          screeningFilter,
          setCalculationAggregation,
          setCalculationContract,
          setCalculationFrom,
          setCalculationMetric,
          setCalculationTo,
          setDetail,
          setScreeningFilter,
          updateObjectSection,
          onTriggerScreening: handleTriggerScreening,
        })}
      </SectionPanel>

      {error ? <div className="mt-4 rounded-xl border border-[#F5C6CB] bg-[#FDEDEC] px-4 py-3 text-[13px] text-[#922B21]">{error}</div> : null}
    </div>
  )
}

function renderSection({
  activeSection,
  busy,
  busySource,
  calculationAggregation,
  calculationContract,
  calculationFrom,
  calculationMetric,
  calculationTo,
  calculationView,
  detail,
  editingSection,
  screeningFilter,
  setCalculationAggregation,
  setCalculationContract,
  setCalculationFrom,
  setCalculationMetric,
  setCalculationTo,
  setDetail,
  setScreeningFilter,
  updateObjectSection,
  onTriggerScreening,
}: {
  activeSection: CedentSectionKey
  busy: 'saving' | 'screening' | 'status' | null
  busySource: string | null
  calculationAggregation: CedentCalculationAggregationKey
  calculationContract: string
  calculationFrom: string
  calculationMetric: CedentCalculationMetricKey
  calculationTo: string
  calculationView: CedentCalculationView | null
  detail: CedentDetailPayload
  editingSection: CedentEditableSectionKey | null
  screeningFilter: 'all' | 'OFAC' | 'FinCEN'
  setCalculationAggregation: Dispatch<SetStateAction<CedentCalculationAggregationKey>>
  setCalculationContract: Dispatch<SetStateAction<string>>
  setCalculationFrom: Dispatch<SetStateAction<string>>
  setCalculationMetric: Dispatch<SetStateAction<CedentCalculationMetricKey>>
  setCalculationTo: Dispatch<SetStateAction<string>>
  setDetail: Dispatch<SetStateAction<CedentDetailPayload | null>>
  setScreeningFilter: Dispatch<SetStateAction<'all' | 'OFAC' | 'FinCEN'>>
  updateObjectSection: (sectionKey: CedentEditableSectionKey, key: string, value: string | boolean) => void
  onTriggerScreening: (sources: string[]) => Promise<void>
}) {
  switch (activeSection) {
    case 'legal_entity':
      return editingSection === 'legal_entity' ? (
        <FieldGridForm fields={legalEntityFields} onChange={(key, value) => updateObjectSection('legal_entity', key, value)} values={toRecord(detail.legal_entity)} />
      ) : (
        <FieldGridReadOnly fields={legalEntityFields} values={toRecord(detail.legal_entity)} />
      )
    case 'pension_scheme':
      return editingSection === 'pension_scheme' ? (
        <FieldGridForm fields={pensionSchemeFields} onChange={(key, value) => updateObjectSection('pension_scheme', key, value)} values={toRecord(detail.pension_scheme)} />
      ) : (
        <FieldGridReadOnly fields={pensionSchemeFields} values={toRecord(detail.pension_scheme)} />
      )
    case 'key_contacts':
      return editingSection === 'key_contacts' ? (
        <KeyContactsEditor items={detail.key_contacts} onChange={(items) => setDetail((currentDetail) => (currentDetail ? { ...currentDetail, key_contacts: items } : currentDetail))} />
      ) : (
        <KeyContactsReadOnly items={detail.key_contacts} />
      )
    case 'financial_treasury':
      return editingSection === 'financial_treasury' ? (
        <FieldGridForm fields={financialTreasuryFields} onChange={(key, value) => updateObjectSection('financial_treasury', key, value)} values={toRecord(detail.financial_treasury)} />
      ) : (
        <FieldGridReadOnly fields={financialTreasuryFields} values={toRecord(detail.financial_treasury)} />
      )
    case 'contract_readiness':
      return editingSection === 'contract_readiness' ? (
        <FieldGridForm fields={contractReadinessFields} onChange={(key, value) => updateObjectSection('contract_readiness', key, value)} values={toRecord(detail.contract_readiness)} />
      ) : (
        <FieldGridReadOnly fields={contractReadinessFields} values={toRecord(detail.contract_readiness)} />
      )
    case 'population_exposure':
      return editingSection === 'population_exposure' ? (
        <FieldGridForm fields={populationExposureFields} onChange={(key, value) => updateObjectSection('population_exposure', key, value)} values={toRecord(detail.population_exposure)} />
      ) : (
        <FieldGridReadOnly fields={populationExposureFields} values={toRecord(detail.population_exposure)} />
      )
    case 'compliance_kyc':
      return editingSection === 'compliance_kyc' ? (
        <FieldGridForm fields={complianceKycFields} onChange={(key, value) => updateObjectSection('compliance_kyc', key, value)} values={toRecord(detail.compliance_kyc)} />
      ) : (
        <FieldGridReadOnly fields={complianceKycFields} values={toRecord(detail.compliance_kyc)} />
      )
    case 'regulatory_docs':
      return editingSection === 'regulatory_docs' ? (
        <RegulatoryDocsEditor items={detail.regulatory_docs} onChange={(items) => setDetail((currentDetail) => (currentDetail ? { ...currentDetail, regulatory_docs: items } : currentDetail))} />
      ) : (
        <RegulatoryDocsReadOnly items={detail.regulatory_docs} />
      )
    case 'operational_connectivity':
      return editingSection === 'operational_connectivity' ? (
        <div className="space-y-4">
            <FieldGridForm
              fields={operationalConnectivityFields}
              onChange={(key, value) => updateObjectSection('operational_connectivity', key, value)}
              values={toRecord(detail.operational_connectivity)}
            />
          <button className="btn-secondary" type="button">
            Test Connection
          </button>
        </div>
      ) : (
        <FieldGridReadOnly fields={operationalConnectivityFields} values={toRecord(detail.operational_connectivity)} />
      )
    case 'actuarial_preferences':
      return editingSection === 'actuarial_preferences' ? (
        <FieldGridForm fields={actuarialPreferencesFields} onChange={(key, value) => updateObjectSection('actuarial_preferences', key, value)} values={toRecord(detail.actuarial_preferences)} />
      ) : (
        <FieldGridReadOnly fields={actuarialPreferencesFields} values={toRecord(detail.actuarial_preferences)} />
      )
    case 'access_beneficiary_rules':
      return editingSection === 'access_beneficiary_rules' ? (
        <BeneficiaryRulesEditor items={detail.access_beneficiary_rules} onChange={(items) => setDetail((currentDetail) => (currentDetail ? { ...currentDetail, access_beneficiary_rules: items } : currentDetail))} />
      ) : (
        <BeneficiaryRulesReadOnly items={detail.access_beneficiary_rules} />
      )
    case 'sanction_screening':
      return (
        <SanctionScreeningPanel
          busySource={busySource}
          data={detail.sanction_screening}
          disabled={busy === 'screening'}
          filter={screeningFilter}
          onFilterChange={setScreeningFilter}
          onTrigger={(sources) => void onTriggerScreening(sources)}
        />
      )
    case 'audit_approval':
      return <AuditTimeline events={detail.audit_approval} />
    case 'mapped_contracts':
      return <MappedContractsTable detail={detail} />
    case 'calculations':
      return calculationView ? (
        <CedentCalculationsSection
          aggregation={calculationAggregation}
          contractFilter={calculationContract}
          from={calculationFrom}
          metric={calculationMetric}
          payload={detail.calculations}
          to={calculationTo}
          view={calculationView}
          onAggregationChange={setCalculationAggregation}
          onContractChange={setCalculationContract}
          onFromChange={setCalculationFrom}
          onMetricChange={setCalculationMetric}
          onToChange={setCalculationTo}
        />
      ) : null
  }
}

function MappedContractsTable({ detail }: { detail: CedentDetailPayload }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-iris-border">
      <table className="min-w-full bg-white text-[13px]">
        <thead className="bg-[#F8F9FA]">
          <tr>
            {['Contract ID', 'Name', 'Notional', 'Status', 'Inception', 'Lives', 'Action'].map((label) => (
              <th
                key={label}
                className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {detail.mapped_contracts.map((contract) => (
            <tr key={contract.contract_id} className="border-t border-[#EEF2F5]">
              <td className="px-3 py-2.5 font-mono text-[12px] text-iris-blue">{contract.contract_id}</td>
              <td className="px-3 py-2.5">{contract.contract_name}</td>
              <td className="px-3 py-2.5">{formatMoney(contract.notional, contract.currency)}</td>
              <td className="px-3 py-2.5">
                <StatusBadge status={contract.status}>{titleCase(contract.status)}</StatusBadge>
              </td>
              <td className="px-3 py-2.5">{contract.inception_date ?? '-'}</td>
              <td className="px-3 py-2.5">{contract.lives.toLocaleString()}</td>
              <td className="px-3 py-2.5">
                <Link className="font-medium text-iris-blue hover:underline" to={`/underwriting/contracts/${contract.contract_id}`}>
                  Open {'->'}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CedentCalculationsSection({
  aggregation,
  contractFilter,
  from,
  metric,
  payload,
  to,
  view,
  onAggregationChange,
  onContractChange,
  onFromChange,
  onMetricChange,
  onToChange,
}: {
  aggregation: CedentCalculationAggregationKey
  contractFilter: string
  from: string
  metric: CedentCalculationMetricKey
  payload: CedentCalculationsSummary
  to: string
  view: CedentCalculationView
  onAggregationChange: (value: CedentCalculationAggregationKey) => void
  onContractChange: (value: string) => void
  onFromChange: (value: string) => void
  onMetricChange: (value: CedentCalculationMetricKey) => void
  onToChange: (value: string) => void
}) {
  const currency = view.resultCurrency

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {payload.summary_cards.map((card) => (
          <div key={card.label} className="rounded-md border border-iris-border bg-white px-4 py-4">
            <p className="text-[11px] text-iris-text-secondary">{card.label}</p>
            <p className="mt-2 text-[14px] font-bold text-iris-text-primary">
              {formatCalculationCardValue(card.value, card.format, card.currency ?? currency, card.decimals)}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-iris-border bg-white p-4">
        <div className="mb-4">
          <h3 className="text-[14px] font-semibold text-iris-text-primary">Aggregation Calculator</h3>
          <p className="mt-1 text-[12px] text-iris-text-secondary">Run aggregations across contracts and quarters.</p>
        </div>

        <div className="grid gap-3 xl:grid-cols-5">
          <select className="field-input" value={metric} onChange={(event) => onMetricChange(event.target.value as CedentCalculationMetricKey)}>
            {cedentCalculationMetricOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className="field-input" value={aggregation} onChange={(event) => onAggregationChange(event.target.value as CedentCalculationAggregationKey)}>
            {cedentCalculationAggregationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className="field-input" value={from} onChange={(event) => onFromChange(event.target.value)}>
            {view.availableQuarters.map((quarter) => (
              <option key={quarter} value={quarter}>
                {quarter}
              </option>
            ))}
          </select>
          <select className="field-input" value={to} onChange={(event) => onToChange(event.target.value)}>
            {view.availableQuarters.map((quarter) => (
              <option key={quarter} value={quarter}>
                {quarter}
              </option>
            ))}
          </select>
          <select className="field-input" value={contractFilter} onChange={(event) => onContractChange(event.target.value)}>
            {view.availableContracts.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 rounded-md border border-[#D9E3EA] bg-[#F7FAFC] px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-iris-text-secondary">{view.resultLabel}</p>
              <p className="mt-2 text-[18px] font-bold text-iris-text-primary">{formatCalculationValue(view.resultValue, metric, currency)}</p>
            </div>
            <div className="text-right text-[12px] text-iris-text-secondary">
              <p>Across {view.selectedContracts.length} contract(s)</p>
              <p>Currency: {currency}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-iris-border">
          <table className="min-w-full bg-white text-[13px]">
            <thead className="bg-[#F8F9FA]">
              <tr>
                {['Quarter', 'SUM', 'Min', 'Max', 'Contracts'].map((label) => (
                  <th key={label} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.quarterRows.map((row) => (
                <tr key={row.quarter} className="border-t border-[#EEF2F5]">
                  <td className="px-3 py-2.5 text-iris-text-primary">{row.quarter}</td>
                  <td className="px-3 py-2.5 font-semibold text-iris-text-primary">{formatCalculationValue(row.sum, metric, currency)}</td>
                  <td className="px-3 py-2.5 text-iris-text-secondary">{formatCalculationValue(row.min, metric, currency)}</td>
                  <td className="px-3 py-2.5 text-iris-text-secondary">{formatCalculationValue(row.max, metric, currency)}</td>
                  <td className="px-3 py-2.5 text-iris-text-primary">{row.contracts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-iris-border bg-white p-4">
        <div className="mb-4">
          <h3 className="text-[14px] font-semibold text-iris-text-primary">Per-Contract Breakdown</h3>
        </div>
        <div className="overflow-x-auto rounded-xl border border-iris-border">
          <table className="min-w-full bg-white text-[13px]">
            <thead className="bg-[#F8F9FA]">
              <tr>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Contract</th>
                {view.filteredQuarters.map((quarter) => (
                  <th key={quarter} className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {quarter}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">SUM</th>
              </tr>
            </thead>
            <tbody>
              {view.contractRows.map((row) => (
                <tr key={row.contract_id} className="border-t border-[#EEF2F5]">
                  <td className="px-3 py-2.5 font-mono text-[12px] text-iris-text-primary">{row.contract_id}</td>
                  {view.filteredQuarters.map((quarter) => (
                    <td key={`${row.contract_id}-${quarter}`} className="px-3 py-2.5 text-right text-iris-text-primary">
                      {formatCalculationValue(row.quarterValues[quarter] ?? 0, metric, currency)}
                    </td>
                  ))}
                  <td className="bg-[#F3F6F9] px-3 py-2.5 text-right font-semibold text-iris-text-primary">
                    {formatCalculationValue(row.total, metric, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-iris-border bg-white p-4">
        <div className="mb-4">
          <h3 className="text-[14px] font-semibold text-iris-text-primary">Pensioners - Quarterly View</h3>
        </div>
        <div className="overflow-x-auto rounded-xl border border-iris-border">
          <table className="min-w-full bg-white text-[13px]">
            <thead className="bg-[#F8F9FA]">
              <tr>
                {['Quarter', 'Total Lives', 'Delta vs Previous', 'Mortality Rate'].map((label) => (
                  <th key={label} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.pensionerRows.map((row) => (
                <tr key={row.quarter} className="border-t border-[#EEF2F5]">
                  <td className="px-3 py-2.5 text-iris-text-primary">{row.quarter}</td>
                  <td className="px-3 py-2.5 text-iris-text-primary">{row.total_lives.toLocaleString()}</td>
                  <td className={`px-3 py-2.5 font-semibold ${row.delta_previous < 0 ? 'text-[#C0392B]' : 'text-[#117A65]'}`}>
                    {row.delta_previous > 0 ? `+${row.delta_previous}` : row.delta_previous}
                  </td>
                  <td className="px-3 py-2.5 text-iris-text-primary">{(row.mortality_rate * 100).toFixed(3)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function isEditableSection(section: CedentSectionKey): section is CedentEditableSectionKey {
  return editableSections.has(section as CedentEditableSectionKey)
}

function sectionTitle(section: CedentSectionKey) {
  switch (section) {
    case 'legal_entity':
      return 'Legal Entity'
    case 'pension_scheme':
      return 'Pension Scheme Information'
    case 'key_contacts':
      return 'Key Contacts'
    case 'financial_treasury':
      return 'Financial & Treasury'
    case 'contract_readiness':
      return 'Contract Readiness'
    case 'population_exposure':
      return 'Population & Exposure'
    case 'compliance_kyc':
      return 'Compliance & KYC'
    case 'regulatory_docs':
      return 'Regulatory & Docs'
    case 'operational_connectivity':
      return 'Operational Connectivity'
    case 'actuarial_preferences':
      return 'Actuarial Preferences'
    case 'access_beneficiary_rules':
      return 'Access & Beneficiary Rules'
    case 'sanction_screening':
      return 'Sanction Screening History'
    case 'audit_approval':
      return 'Audit Trails'
    case 'mapped_contracts':
      return 'Mapped Contracts'
    case 'calculations':
      return 'Calculations'
  }
}

function sectionSubtitle(section: CedentSectionKey) {
  switch (section) {
    case 'sanction_screening':
      return 'Periodic screening activity, source status, and review history.'
    case 'mapped_contracts':
      return 'All contracts linked to this cedant.'
    case 'calculations':
      return 'Aggregated settlement and pensioner trends across the cedant contract set.'
    default:
      return 'Review and maintain cedant master data in line with underwriting controls.'
  }
}

function buildCedentCalculationView({
  calculations,
  metric,
  aggregation,
  from,
  to,
  contractFilter,
}: {
  calculations: CedentCalculationsSummary
  metric: CedentCalculationMetricKey
  aggregation: CedentCalculationAggregationKey
  from: string
  to: string
  contractFilter: string
}): CedentCalculationView {
  const availableQuarters = Array.from(
    new Set(calculations.contracts.flatMap((contract) => contract.quarters.map((quarter) => quarter.quarter))),
  ).sort((left, right) => quarterSortValue(left) - quarterSortValue(right))

  const availableContracts = [
    { label: 'All Mapped', value: 'all' },
    ...calculations.contracts.map((contract) => ({ label: contract.contract_id, value: contract.contract_id })),
  ]

  const selectedContracts =
    contractFilter === 'all'
      ? calculations.contracts
      : calculations.contracts.filter((contract) => contract.contract_id === contractFilter)

  const fromIndex = availableQuarters.includes(from) ? availableQuarters.indexOf(from) : 0
  const toIndex = availableQuarters.includes(to) ? availableQuarters.indexOf(to) : Math.max(availableQuarters.length - 1, 0)
  const startIndex = Math.min(fromIndex, toIndex)
  const endIndex = Math.max(fromIndex, toIndex)
  const filteredQuarters = availableQuarters.slice(startIndex, endIndex + 1)

  const contractRows = selectedContracts.map((contract) => {
    const quarterValues = Object.fromEntries(
      filteredQuarters.map((quarter) => {
        const row = contract.quarters.find((item) => item.quarter === quarter)
        return [quarter, row ? getCedentCalculationMetricValue(row, metric) : 0]
      }),
    )

    return {
      contract_id: contract.contract_id,
      quarterValues,
      total: aggregateValues(Object.values(quarterValues), aggregation),
    }
  })

  const quarterRows = filteredQuarters.map((quarter) => {
    const values = selectedContracts
      .map((contract) => contract.quarters.find((item) => item.quarter === quarter))
      .filter((row): row is CedentCalculationQuarterRow => Boolean(row))
      .map((row) => getCedentCalculationMetricValue(row, metric))

    return {
      quarter,
      sum: aggregateValues(values, 'sum'),
      min: aggregateValues(values, 'min'),
      max: aggregateValues(values, 'max'),
      contracts: values.length,
    }
  })

  const resultValue = aggregateValues(quarterRows.map((row) => row.sum), aggregation)
  const resultCurrency = selectedContracts[0]?.currency ?? calculations.contracts[0]?.currency ?? 'USD'
  const metricLabel = cedentCalculationMetricOptions.find((option) => option.value === metric)?.label.toLowerCase() ?? metric

  const pensionerRows = filteredQuarters.map((quarter, index) => {
    const totalLives = selectedContracts.reduce((sum, contract) => {
      const row = contract.quarters.find((item) => item.quarter === quarter)
      return sum + (row?.active_pensioners ?? 0)
    }, 0)
    const previousLives = index === 0 ? totalLives : pensionerRowsSeed(selectedContracts, filteredQuarters[index - 1])
    const deltaPrevious = index === 0 ? 0 : totalLives - previousLives
    const denominator = index === 0 ? totalLives : previousLives

    return {
      quarter,
      total_lives: totalLives,
      delta_previous: deltaPrevious,
      mortality_rate: denominator > 0 ? Math.abs(deltaPrevious) / denominator : 0,
    }
  })

  return {
    availableQuarters,
    availableContracts,
    selectedContracts,
    filteredQuarters,
    resultValue,
    resultCurrency,
    resultLabel: `${aggregation.toUpperCase()} of ${metricLabel} - ${filteredQuarters.length} quarter(s)`,
    quarterRows,
    contractRows,
    pensionerRows,
  }
}

function pensionerRowsSeed(contracts: CedentCalculationContract[], quarter: string) {
  return contracts.reduce((sum, contract) => {
    const row = contract.quarters.find((item) => item.quarter === quarter)
    return sum + (row?.active_pensioners ?? 0)
  }, 0)
}

function getCedentCalculationMetricValue(row: CedentCalculationQuarterRow, metric: CedentCalculationMetricKey) {
  switch (metric) {
    case 'fixed_leg':
      return row.fixed_leg
    case 'floating_leg':
      return row.floating_leg
    case 'ae_ratio':
      return row.ae_ratio
    case 'active_pensioners':
      return row.active_pensioners
    default:
      return row.net_settlements
  }
}

function aggregateValues(values: number[], aggregation: CedentCalculationAggregationKey) {
  if (!values.length) {
    return 0
  }
  if (aggregation === 'avg') {
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }
  if (aggregation === 'min') {
    return Math.min(...values)
  }
  if (aggregation === 'max') {
    return Math.max(...values)
  }
  return values.reduce((sum, value) => sum + value, 0)
}

function formatCalculationCardValue(
  value: number,
  format: CedentCalculationsSummary['summary_cards'][number]['format'],
  currency: string,
  decimals = 0,
) {
  if (format === 'currency') {
    return formatCurrency(value, currency)
  }
  if (format === 'percentage') {
    return `${value.toFixed(decimals)}%`
  }
  return value.toLocaleString('en-GB', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  })
}

function formatCalculationValue(value: number, metric: CedentCalculationMetricKey, currency: string) {
  if (metric === 'ae_ratio') {
    return `${(value * 100).toFixed(2)}%`
  }
  if (metric === 'active_pensioners') {
    return value.toLocaleString('en-GB', { maximumFractionDigits: 0 })
  }
  return formatCurrency(value, currency)
}

function quarterSortValue(period: string) {
  const match = /^Q([1-4])\s+(\d{4})$/i.exec(period.trim())
  if (!match) {
    return Number.MIN_SAFE_INTEGER
  }
  return Number.parseInt(match[2], 10) * 10 + Number.parseInt(match[1], 10)
}

function isCedentCalculationMetric(value: string): value is CedentCalculationMetricKey {
  return cedentCalculationMetricOptions.some((option) => option.value === value)
}

function isCedentCalculationAggregation(value: string): value is CedentCalculationAggregationKey {
  return cedentCalculationAggregationOptions.some((option) => option.value === value)
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function displayCedantCountryCode(country: string | null) {
  return country ?? '-'
}

function formatMoney(amount: number, currency: string) {
  return formatCurrencyCompact(amount, currency)
}

function toRecord(value: unknown) {
  return value as Record<string, unknown>
}
