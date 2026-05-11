import { useQueryClient } from '@tanstack/react-query'
import { FileUp, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { api } from '../../../api/client'
import { StatusBadge } from '../../../components/common/StatusBadge'
import {
  AuditTimeline,
  BeneficiaryRulesEditor,
  FieldGridForm,
  KeyContactsEditor,
  RegulatoryDocsEditor,
  SanctionScreeningPanel,
} from './CedentSectionContent'
import {
  actuarialPreferencesFields,
  applyAiExtractToDraft,
  complianceKycFields,
  contractReadinessFields,
  createEmptyCedentDraft,
  financialTreasuryFields,
  legalEntityFields,
  operationalConnectivityFields,
  pensionSchemeFields,
  populationExposureFields,
  sectionRouteMap,
  type CedentDraftSections,
  type CedentEditableSectionKey,
  wizardSteps,
} from './cedentConfig'
import type { AiExtractResponse, CedentCreateResponse, CedentDetailPayload } from '../../../types/api'

interface NewCedantWizardProps {
  open: boolean
  suggestedCedentId: string
  onClose: () => void
}

const editableSectionKeys: CedentEditableSectionKey[] = [
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
]

export function NewCedantWizard({ open, suggestedCedentId, onClose }: NewCedantWizardProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<CedentDraftSections>(() => createEmptyCedentDraft(suggestedCedentId))
  const [persistedCedentId, setPersistedCedentId] = useState<string | null>(null)
  const [extractedFields, setExtractedFields] = useState<Record<string, { value: string; confidence: number; citation: string }>>({})
  const [lowConfidenceFields, setLowConfidenceFields] = useState<string[]>([])
  const [extractSummary, setExtractSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'saving' | 'extracting' | 'screening' | null>(null)
  const [busySource, setBusySource] = useState<string | null>(null)
  const [screeningFilter, setScreeningFilter] = useState<'all' | 'OFAC' | 'FinCEN'>('all')
  const [acknowledged, setAcknowledged] = useState(false)

  const currentStep = wizardSteps[step]
  const displayCedentId = persistedCedentId ?? draft.legal_entity.cedent_id
  const completionRows = useMemo(() => buildCompletionRows(draft), [draft])

  useEffect(() => {
    if (!open) {
      return
    }

    setStep(0)
    setDraft(createEmptyCedentDraft(suggestedCedentId))
    setPersistedCedentId(null)
    setExtractedFields({})
    setLowConfidenceFields([])
    setExtractSummary(null)
    setError(null)
    setBusy(null)
    setBusySource(null)
    setScreeningFilter('all')
    setAcknowledged(false)
  }, [open, suggestedCedentId])

  if (!open) {
    return null
  }

  async function ensureCedentRecord() {
    if (persistedCedentId) {
      return persistedCedentId
    }

    const { data } = await api.post<CedentCreateResponse>('/underwriting/cedents', {
      legal_entity_name: draft.legal_entity.legal_entity_name.trim(),
      country: draft.legal_entity.country_of_registration || 'UK',
      entity_type: draft.legal_entity.entity_type || 'Pension Trust',
    })

    setPersistedCedentId(data.cedent_id)
    setDraft((currentDraft) => {
      const nextDraft = structuredClone(currentDraft)
      nextDraft.legal_entity.cedent_id = data.cedent_id
      nextDraft.pension_scheme.scheme_id = data.cedent_id.replace('CED', 'PS')
      return nextDraft
    })

    return data.cedent_id
  }

  async function persistSection(sectionKey: CedentEditableSectionKey) {
    const cedentId = await ensureCedentRecord()
    await api.patch(`/underwriting/cedents/${cedentId}/${sectionRouteMap[sectionKey]}`, draft[sectionKey])
  }

  async function handleContinue() {
    setError(null)

    if (step === 0) {
      setStep(1)
      return
    }

    if (currentStep.key === 'legal_entity' && !draft.legal_entity.legal_entity_name.trim()) {
      setError('Legal Entity Name is required before continuing.')
      return
    }

    if (isEditableSectionKey(currentStep.key)) {
      setBusy('saving')
      try {
        await persistSection(currentStep.key)
      } catch {
        setError('Unable to save this section right now.')
        setBusy(null)
        return
      }
      setBusy(null)
    }

    if (step < wizardSteps.length - 1) {
      setStep(step + 1)
    }
  }

  async function handleSaveDraft() {
    setError(null)
    if (isEditableSectionKey(currentStep.key)) {
      setBusy('saving')
      try {
        await persistSection(currentStep.key)
      } catch {
        setError('Unable to save the draft right now.')
        setBusy(null)
        return
      }
      setBusy(null)
    }
    await queryClient.invalidateQueries({ queryKey: ['cedents'] })
    onClose()
  }

  async function handleSubmitForApproval() {
    setError(null)
    setBusy('saving')
    try {
      if (!persistedCedentId) {
        await ensureCedentRecord()
      }
      await queryClient.invalidateQueries({ queryKey: ['cedents'] })
      onClose()
    } catch {
      setError('Unable to submit this onboarding package for approval.')
    } finally {
      setBusy(null)
    }
  }

  async function runAiExtract(file: File) {
    setError(null)
    setBusy('extracting')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<AiExtractResponse>('/underwriting/cedents/ai-extract', formData)
      setDraft((currentDraft) => applyAiExtractToDraft(currentDraft, data.extracted_fields))
      setExtractedFields(data.extracted_fields)
      setLowConfidenceFields(data.low_confidence_fields)
      setExtractSummary(
        `${Object.keys(data.extracted_fields).length} field(s) pre-filled across ${data.sections_populated.length} section(s). ${data.low_confidence_fields.length} field(s) need review.`,
      )
    } catch {
      setError('AI extraction could not process that onboarding pack.')
    } finally {
      setBusy(null)
    }
  }

  async function handleSampleDocument() {
    const sampleFile = new File(
      [
        'Northstar Pension Trust onboarding pack\nLEI: 5299001042ABCD1234EF56\nCountry: UK\nTrustee: Northstar Pension Trust Trustee\nContact: Alex Morgan',
      ],
      'northstar-onboarding-pack.txt',
      { type: 'text/plain' },
    )
    await runAiExtract(sampleFile)
  }

  async function handleScreeningTrigger(sources: string[]) {
    setError(null)
    setBusy('screening')
    setBusySource(sources.length > 1 ? 'ALL' : sources[0])

    try {
      const cedentId = await ensureCedentRecord()
      const screeningResponse = await api.post<{ status: string }>(`/underwriting/cedents/${cedentId}/sanction-screening`, { sources })
      const { data } = await api.get<CedentDetailPayload>(`/underwriting/cedents/${cedentId}`)
      setDraft((currentDraft) => ({
        ...currentDraft,
        sanction_screening: data.sanction_screening,
        audit_approval: data.audit_approval,
      }))
      if (screeningResponse.data.status === 'cleared' && currentStep.key === 'sanction_screening') {
        setStep((current) => Math.min(current + 1, wizardSteps.length - 1))
      }
    } catch {
      setError('Sanction screening could not be triggered.')
    } finally {
      setBusy(null)
      setBusySource(null)
    }
  }

  function updateObjectSection(sectionKey: CedentEditableSectionKey, key: string, value: string | boolean) {
    setDraft((currentDraft) => {
      const nextDraft = structuredClone(currentDraft)
      const section = nextDraft[sectionKey] as unknown as Record<string, unknown>
      section[key] = value
      return nextDraft
    })
  }

  function renderStepContent() {
    switch (currentStep.key) {
      case 'ai_intake':
        return (
          <div className="space-y-5">
            <div className="rounded-2xl border border-dashed border-[#B7D8EA] bg-[#F7FBFD] px-8 py-10 text-center">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#E8F8F5] text-iris-blue">
                <FileUp className="h-8 w-8" />
              </div>
              <h3 className="text-[22px] font-semibold text-iris-text-primary">Upload an onboarding pack</h3>
              <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-6 text-iris-text-secondary">
                Drop in a counterparty profile, scheme summary, ISDA, KYC pack, or trustee report. IRiS will pre-fill cedant fields with verbatim citations and confidence scores.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <label className="btn-primary cursor-pointer">
                  <span>{busy === 'extracting' ? 'Extracting...' : 'Choose file'}</span>
                  <input
                    className="hidden"
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        void runAiExtract(file)
                      }
                    }}
                  />
                </label>
                <button className="btn-secondary" disabled={busy === 'extracting'} onClick={() => void handleSampleDocument()} type="button">
                  Try sample document
                </button>
              </div>
              <p className="mt-4 text-[12px] text-iris-text-muted">Supported: TXT, MD, CSV, JSON. PDFs and DOCX accepted but processed as raw text.</p>
            </div>

            {extractSummary ? (
              <div className="rounded-xl border border-[#A9DFBF] bg-[#F4FCF7] px-4 py-3 text-[13px] text-[#1E8449]">
                {extractSummary}
              </div>
            ) : null}
          </div>
        )
      case 'legal_entity':
        return (
          <FieldGridForm
            extractedFields={extractedFields}
            fields={legalEntityFields}
            lowConfidenceFields={lowConfidenceFields}
            values={toRecord(draft.legal_entity)}
            onChange={(key, value) => updateObjectSection('legal_entity', key, value)}
          />
        )
      case 'pension_scheme':
        return (
          <FieldGridForm
            extractedFields={extractedFields}
            fields={pensionSchemeFields}
            lowConfidenceFields={lowConfidenceFields}
            values={toRecord(draft.pension_scheme)}
            onChange={(key, value) => updateObjectSection('pension_scheme', key, value)}
          />
        )
      case 'key_contacts':
        return <KeyContactsEditor items={draft.key_contacts} onChange={(items) => setDraft((currentDraft) => ({ ...currentDraft, key_contacts: items }))} />
      case 'financial_treasury':
        return (
          <FieldGridForm
            fields={financialTreasuryFields}
            values={toRecord(draft.financial_treasury)}
            onChange={(key, value) => updateObjectSection('financial_treasury', key, value)}
          />
        )
      case 'contract_readiness':
        return (
          <FieldGridForm
            fields={contractReadinessFields}
            values={toRecord(draft.contract_readiness)}
            onChange={(key, value) => updateObjectSection('contract_readiness', key, value)}
          />
        )
      case 'population_exposure':
        return (
          <FieldGridForm
            fields={populationExposureFields}
            values={toRecord(draft.population_exposure)}
            onChange={(key, value) => updateObjectSection('population_exposure', key, value)}
          />
        )
      case 'compliance_kyc':
        return (
          <FieldGridForm
            fields={complianceKycFields}
            values={toRecord(draft.compliance_kyc)}
            onChange={(key, value) => updateObjectSection('compliance_kyc', key, value)}
          />
        )
      case 'regulatory_docs':
        return <RegulatoryDocsEditor items={draft.regulatory_docs} onChange={(items) => setDraft((currentDraft) => ({ ...currentDraft, regulatory_docs: items }))} />
      case 'operational_connectivity':
        return (
          <div className="space-y-4">
            <FieldGridForm
              fields={operationalConnectivityFields}
              values={toRecord(draft.operational_connectivity)}
              onChange={(key, value) => updateObjectSection('operational_connectivity', key, value)}
            />
            <button className="btn-secondary" type="button">
              Test Connection
            </button>
          </div>
        )
      case 'actuarial_preferences':
        return (
          <FieldGridForm
            fields={actuarialPreferencesFields}
            values={toRecord(draft.actuarial_preferences)}
            onChange={(key, value) => updateObjectSection('actuarial_preferences', key, value)}
          />
        )
      case 'access_beneficiary_rules':
        return (
          <BeneficiaryRulesEditor
            items={draft.access_beneficiary_rules}
            onChange={(items) => setDraft((currentDraft) => ({ ...currentDraft, access_beneficiary_rules: items }))}
          />
        )
      case 'sanction_screening':
        return (
          <div className="space-y-4">
            {!persistedCedentId ? (
              <div className="rounded-xl border border-[#AED6F1] bg-[#F4F9FD] px-4 py-3 text-[13px] text-[#1A5276]">
                IRiS will create the cedant record first, then sanction screening can run against the persisted profile.
              </div>
            ) : null}
            <SanctionScreeningPanel
              busySource={busySource}
              data={draft.sanction_screening}
              disabled={busy === 'screening'}
              filter={screeningFilter}
              onFilterChange={setScreeningFilter}
              onTrigger={(sources) => void handleScreeningTrigger(sources)}
            />
          </div>
        )
      case 'audit_approval':
        return (
          <div className="space-y-5">
            <div className="rounded-xl border border-iris-border bg-[#FAFBFC] p-4">
              <h3 className="text-[16px] font-semibold text-iris-text-primary">Summary of completed sections</h3>
              <div className="mt-4 space-y-2">
                {completionRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-lg border border-[#EEF2F5] bg-white px-3 py-2">
                    <span className="text-[13px] text-iris-text-primary">{row.label}</span>
                    <StatusBadge status={row.complete ? 'cleared' : 'pending'}>{row.complete ? 'Complete' : 'Needs review'}</StatusBadge>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-iris-border bg-[#FAFBFC] p-4">
              <p className="text-[14px] font-semibold text-iris-text-primary">Certification</p>
              <label className="mt-3 flex items-start gap-3 text-[13px] text-iris-text-secondary">
                <input checked={acknowledged} type="checkbox" onChange={(event) => setAcknowledged(event.target.checked)} />
                <span>I confirm the information above is accurate and complete and I acknowledge this cedant onboarding for approval.</span>
              </label>
            </div>

            <AuditTimeline events={draft.audit_approval} />
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(13,27,42,0.55)] p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#D6E2EA] bg-white shadow-[0_30px_80px_rgba(13,27,42,0.25)]">
        <div className="flex items-center justify-between border-b border-[#EEF2F5] px-6 py-4">
          <div>
            <h2 className="text-[24px] font-semibold text-iris-text-primary">New Cedant Onboarding</h2>
            <p className="mt-1 text-[13px] text-iris-text-secondary">
              {displayCedentId} - Step {step} of 13
            </p>
          </div>
          <button className="rounded-full border border-iris-border p-2 text-iris-text-secondary hover:bg-iris-bg" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="border-r border-[#EEF2F5] bg-[#FAFBFC] px-5 py-5">
            <div className="space-y-1.5">
              {wizardSteps.map((wizardStep) => {
                const active = wizardStep.step === step
                const completed = wizardStep.step < step
                const selectable = wizardStep.step <= step
                return (
                  <button
                    key={wizardStep.step}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                      active ? 'bg-white text-iris-text-primary shadow-sm' : 'text-iris-text-secondary hover:bg-white hover:text-iris-text-primary'
                    }`}
                    disabled={!selectable}
                    onClick={() => {
                      if (selectable) {
                        setStep(wizardStep.step)
                      }
                    }}
                    type="button"
                  >
                    <span
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                        active
                          ? 'bg-iris-teal text-white'
                          : completed
                            ? 'border border-iris-teal bg-white text-iris-teal'
                            : 'bg-[#E5E8EB] text-iris-text-secondary'
                      }`}
                    >
                      {wizardStep.step}
                    </span>
                    <span className={active ? 'font-semibold' : 'font-medium'}>{wizardStep.title}</span>
                  </button>
                )
              })}
            </div>
          </aside>

          <div className="min-h-0 overflow-y-auto px-6 py-6">{renderStepContent()}</div>
        </div>

        <div className="flex items-center justify-between border-t border-[#EEF2F5] px-6 py-4">
          <button className="btn-secondary" disabled={busy === 'saving'} onClick={() => void handleSaveDraft()} type="button">
            Save as Draft
          </button>
          <div className="flex items-center gap-2">
            <button className="btn-secondary" disabled={step === 0 || busy !== null} onClick={() => setStep(Math.max(0, step - 1))} type="button">
              Back
            </button>
            {step === 0 ? (
              <button className="btn-primary" disabled={busy !== null} onClick={() => void handleContinue()} type="button">
                Continue to Forms
              </button>
            ) : step === wizardSteps.length - 1 ? (
              <button className="btn-primary" disabled={!acknowledged || busy !== null} onClick={() => void handleSubmitForApproval()} type="button">
                Submit for Approval
              </button>
            ) : (
              <button className="btn-primary" disabled={busy !== null} onClick={() => void handleContinue()} type="button">
                Next
              </button>
            )}
          </div>
        </div>

        {error ? <div className="border-t border-[#F5C6CB] bg-[#FDEDEC] px-6 py-3 text-[13px] text-[#922B21]">{error}</div> : null}
      </div>
    </div>
  )
}

function isEditableSectionKey(key: string): key is CedentEditableSectionKey {
  return editableSectionKeys.includes(key as CedentEditableSectionKey)
}

function buildCompletionRows(draft: CedentDraftSections): Array<{ label: string; complete: boolean }> {
  return [
    { label: 'Legal Entity', complete: Boolean(draft.legal_entity.legal_entity_name && draft.legal_entity.country_of_registration) },
    { label: 'Pension Scheme', complete: Boolean(draft.pension_scheme.scheme_name && draft.pension_scheme.trustee_name) },
    { label: 'Key Contacts', complete: draft.key_contacts.some((item) => Boolean(item.full_name && item.email)) },
    { label: 'Financial & Treasury', complete: Boolean(draft.financial_treasury.bank_name || draft.financial_treasury.account_currency) },
    { label: 'Contract Readiness', complete: draft.contract_readiness.isda_signed || draft.contract_readiness.kyc_complete || draft.contract_readiness.aml_complete },
    { label: 'Population & Exposure', complete: Boolean(draft.population_exposure.total_lives || draft.population_exposure.mortality_table_used) },
    { label: 'Compliance & KYC', complete: Boolean(draft.compliance_kyc.kyc_status && draft.compliance_kyc.aml_status) },
    { label: 'Regulatory & Docs', complete: draft.regulatory_docs.some((item) => Boolean(item.doc_type || item.doc_name || item.file_name)) },
    { label: 'Operational Connectivity', complete: Boolean(draft.operational_connectivity.sftp_host || draft.operational_connectivity.notification_email) },
    { label: 'Actuarial Preferences', complete: Boolean(draft.actuarial_preferences.mortality_table && draft.actuarial_preferences.improvement_scale) },
    { label: 'Access & Beneficiary Rules', complete: draft.access_beneficiary_rules.some((item) => Boolean(item.rule_type && item.pct_benefit)) },
    { label: 'Sanction Screening', complete: draft.sanction_screening.total_scans > 0 || draft.sanction_screening.history.length > 0 },
  ]
}

function toRecord(value: unknown) {
  return value as Record<string, unknown>
}
