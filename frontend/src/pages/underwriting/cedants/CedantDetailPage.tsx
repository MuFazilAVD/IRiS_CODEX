import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowLeft, Pencil, ShieldAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { api } from '../../../api/client'
import { Breadcrumbs } from '../../../components/common/Breadcrumbs'
import { SectionPanel } from '../../../components/common/SectionPanel'
import { StatusBadge } from '../../../components/common/StatusBadge'
import { formatCurrencyCompact } from '../../../utils/formatters'
import type { CedentDetailPayload, CedentStatusResponse } from '../../../types/api'
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

export function CedantDetailPage() {
  const { id = '' } = useParams()
  const [activeSection, setActiveSection] = useState<CedentSectionKey>('legal_entity')
  const [editingSection, setEditingSection] = useState<CedentEditableSectionKey | null>(null)
  const [detail, setDetail] = useState<CedentDetailPayload | null>(null)
  const [screeningFilter, setScreeningFilter] = useState<'all' | 'OFAC' | 'FinCEN'>('all')
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
              {detail.cedent_id} - {displayCedantCountryCode(detail.legal_entity_name, detail.country)} - {detail.contracts_count} contract(s) - AUM {formatMoney(detail.aum, detail.aum_currency)}
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
          detail,
          editingSection,
        screeningFilter,
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
  detail,
  editingSection,
  screeningFilter,
  setDetail,
  setScreeningFilter,
  updateObjectSection,
  onTriggerScreening,
}: {
  activeSection: CedentSectionKey
  busy: 'saving' | 'screening' | 'status' | null
  busySource: string | null
  detail: CedentDetailPayload
  editingSection: CedentEditableSectionKey | null
  screeningFilter: 'all' | 'OFAC' | 'FinCEN'
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
      return (
        <div className="rounded-xl border border-dashed border-[#AED6F1] bg-[#F4F9FD] p-5">
          <p className="text-[15px] font-semibold text-iris-text-primary">Aggregation calculator</p>
          <p className="mt-2 text-[13px] text-iris-text-secondary">{detail.calculations.message}</p>
        </div>
      )
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
      return 'Audit & Approval'
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
      return 'Cedant-level calculation placeholder until the underwriting API defines this endpoint.'
    default:
      return 'Review and maintain cedant master data in line with underwriting controls.'
  }
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function displayCedantCountryCode(legalEntityName: string, country: string | null) {
  if (legalEntityName === 'Maple Leaf Pension Plan' && country === 'CA') {
    return 'CAD'
  }
  return country ?? '-'
}

function formatMoney(amount: number, currency: string) {
  return formatCurrencyCompact(amount, currency)
}

function toRecord(value: unknown) {
  return value as Record<string, unknown>
}
