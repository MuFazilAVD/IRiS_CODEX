import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'

import { api } from '../../../api/client'
import type { CedentsListPayload, ContractCreateResponse } from '../../../types/api'

interface NewContractModalProps {
  open: boolean
  onClose: () => void
  onCreated: (contractId: string) => void
}

interface ContractDraft {
  contract_name: string
  cedent_id: string
  counterparty_role: string
  parent_contract_id: string
  swap_type: string
  structure: string
  master_agreement_reference: string
  inception_date: string
  effective_date: string
  maturity_date: string
  duration_years: string
  governing_law: string
  jurisdiction: string
  notional_amount: string
  currency: string
  fixed_leg_rate_pct: string
  fixed_leg_frequency: string
  floating_leg_definition: string
  floating_leg_index_table: string
}

const initialDraft: ContractDraft = {
  contract_name: '',
  cedent_id: '',
  counterparty_role: 'Reinsurer',
  parent_contract_id: '',
  swap_type: 'Indemnity',
  structure: 'Single tranche',
  master_agreement_reference: '',
  inception_date: '',
  effective_date: '',
  maturity_date: '',
  duration_years: '',
  governing_law: 'English Law',
  jurisdiction: 'England & Wales',
  notional_amount: '',
  currency: 'GBP',
  fixed_leg_rate_pct: '',
  fixed_leg_frequency: 'Quarterly',
  floating_leg_definition: 'Realized mortality',
  floating_leg_index_table: 'CMI 2024 SAPS',
}

export function NewContractModal({ open, onClose, onCreated }: NewContractModalProps) {
  const [draft, setDraft] = useState<ContractDraft>(initialDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cedentsQuery = useQuery({
    queryKey: ['cedents', 'contract-create'],
    queryFn: async () =>
      (
        await api.get<CedentsListPayload>('/underwriting/cedents', {
          params: { status: 'all', page: 1, page_size: 200 },
        })
      ).data,
    enabled: open,
  })

  useEffect(() => {
    if (!open) {
      setDraft(initialDraft)
      setBusy(false)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || draft.cedent_id || !(cedentsQuery.data?.items.length)) {
      return
    }

    const firstCedent = cedentsQuery.data.items[0]
    setDraft((currentDraft) => ({ ...currentDraft, cedent_id: firstCedent.cedent_id, currency: mapCountryToCurrency(firstCedent.country) }))
  }, [cedentsQuery.data, draft.cedent_id, open])

  if (!open) {
    return null
  }

  async function handleCreate() {
    setBusy(true)
    setError(null)
    try {
      const payload = {
        ...draft,
        parent_contract_id: draft.parent_contract_id || null,
        effective_date: draft.effective_date || draft.inception_date,
        duration_years: draft.duration_years ? Number(draft.duration_years) : null,
        notional_amount: Number(draft.notional_amount),
        fixed_leg_rate_pct: Number(draft.fixed_leg_rate_pct),
      }
      const { data } = await api.post<ContractCreateResponse>('/underwriting/contracts', payload)
      onCreated(data.contract_id)
      onClose()
    } catch {
      setError('Unable to create the contract draft right now.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(13,27,42,0.55)] p-4">
      <div className="mx-auto flex h-full max-w-5xl items-center">
        <div className="w-full rounded-2xl border border-iris-border bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[#EEF2F5] px-6 py-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">Underwriting</p>
              <h2 className="mt-1 text-[24px] font-bold text-iris-text-primary">New Contract</h2>
              <p className="mt-1 text-[13px] text-iris-text-secondary">Create the next longevity contract draft with the master data required by the spec.</p>
            </div>
            <button className="btn-secondary" onClick={onClose} type="button">
              <X className="h-4 w-4" />
              Close
            </button>
          </div>

          <div className="max-h-[80vh] space-y-6 overflow-y-auto px-6 py-5">
            <section>
              <h3 className="text-[15px] font-semibold text-iris-text-primary">Master Data</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Contract Name">
                  <input className="field-input" value={draft.contract_name} onChange={(event) => setDraftField(setDraft, 'contract_name', event.target.value)} />
                </Field>
                <Field label="Cedant">
                  <select className="field-input" value={draft.cedent_id} onChange={(event) => setDraftField(setDraft, 'cedent_id', event.target.value)}>
                    {(cedentsQuery.data?.items ?? []).map((item) => (
                      <option key={item.cedent_id} value={item.cedent_id}>
                        {item.cedent_id} - {item.legal_entity_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Counterparty Role">
                  <select className="field-input" value={draft.counterparty_role} onChange={(event) => setDraftField(setDraft, 'counterparty_role', event.target.value)}>
                    <option value="Reinsurer">Reinsurer</option>
                    <option value="Cedant">Cedant</option>
                  </select>
                </Field>
                <Field label="Parent Contract">
                  <input className="field-input" value={draft.parent_contract_id} onChange={(event) => setDraftField(setDraft, 'parent_contract_id', event.target.value)} />
                </Field>
                <Field label="Swap Type">
                  <select className="field-input" value={draft.swap_type} onChange={(event) => setDraftField(setDraft, 'swap_type', event.target.value)}>
                    <option value="Indemnity">Indemnity</option>
                    <option value="Funded">Funded</option>
                    <option value="Parametric">Parametric</option>
                  </select>
                </Field>
                <Field label="Structure">
                  <select className="field-input" value={draft.structure} onChange={(event) => setDraftField(setDraft, 'structure', event.target.value)}>
                    <option value="Single tranche">Single tranche</option>
                    <option value="Multi-tranche">Multi-tranche</option>
                  </select>
                </Field>
                <Field label="Master Agreement Reference">
                  <input className="field-input" value={draft.master_agreement_reference} onChange={(event) => setDraftField(setDraft, 'master_agreement_reference', event.target.value)} />
                </Field>
                <Field label="Inception Date">
                  <input className="field-input" type="date" value={draft.inception_date} onChange={(event) => setDraftField(setDraft, 'inception_date', event.target.value)} />
                </Field>
                <Field label="Effective Date">
                  <input className="field-input" type="date" value={draft.effective_date} onChange={(event) => setDraftField(setDraft, 'effective_date', event.target.value)} />
                </Field>
                <Field label="Maturity Date">
                  <input className="field-input" type="date" value={draft.maturity_date} onChange={(event) => setDraftField(setDraft, 'maturity_date', event.target.value)} />
                </Field>
                <Field label="Duration (years)">
                  <input className="field-input" type="number" value={draft.duration_years} onChange={(event) => setDraftField(setDraft, 'duration_years', event.target.value)} />
                </Field>
                <Field label="Governing Law">
                  <input className="field-input" value={draft.governing_law} onChange={(event) => setDraftField(setDraft, 'governing_law', event.target.value)} />
                </Field>
                <Field label="Jurisdiction">
                  <input className="field-input" value={draft.jurisdiction} onChange={(event) => setDraftField(setDraft, 'jurisdiction', event.target.value)} />
                </Field>
              </div>
            </section>

            <section>
              <h3 className="text-[15px] font-semibold text-iris-text-primary">Economic Terms</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Notional Amount">
                  <input className="field-input" type="number" value={draft.notional_amount} onChange={(event) => setDraftField(setDraft, 'notional_amount', event.target.value)} />
                </Field>
                <Field label="Currency">
                  <select className="field-input" value={draft.currency} onChange={(event) => setDraftField(setDraft, 'currency', event.target.value)}>
                    {['GBP', 'CHF', 'EUR', 'USD', 'CAD'].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Fixed Leg Rate (%)">
                  <input className="field-input" type="number" value={draft.fixed_leg_rate_pct} onChange={(event) => setDraftField(setDraft, 'fixed_leg_rate_pct', event.target.value)} />
                </Field>
                <Field label="Fixed Leg Frequency">
                  <select className="field-input" value={draft.fixed_leg_frequency} onChange={(event) => setDraftField(setDraft, 'fixed_leg_frequency', event.target.value)}>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Annual">Annual</option>
                  </select>
                </Field>
                <Field label="Floating Leg Definition">
                  <input className="field-input" value={draft.floating_leg_definition} onChange={(event) => setDraftField(setDraft, 'floating_leg_definition', event.target.value)} />
                </Field>
                <Field label="Floating Leg Index / Table">
                  <input className="field-input" value={draft.floating_leg_index_table} onChange={(event) => setDraftField(setDraft, 'floating_leg_index_table', event.target.value)} />
                </Field>
              </div>
            </section>

            {error ? <div className="rounded-xl border border-[#F5C6CB] bg-[#FDEDEC] px-4 py-3 text-[13px] text-[#922B21]">{error}</div> : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#EEF2F5] px-6 py-4">
            <p className="text-[12px] text-iris-text-secondary">The API creates a draft contract and the screenshot-only detail sections use documented mock overlays until schema models are added.</p>
            <button
              className="btn-primary"
              disabled={busy || !draft.contract_name || !draft.cedent_id || !draft.inception_date || !draft.maturity_date || !draft.notional_amount || !draft.fixed_leg_rate_pct}
              onClick={() => void handleCreate()}
              type="button"
            >
              <Plus className="h-4 w-4" />
              {busy ? 'Creating...' : 'Create Draft'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</label>
      {children}
    </div>
  )
}

function setDraftField(
  setDraft: Dispatch<SetStateAction<ContractDraft>>,
  key: keyof ContractDraft,
  value: string,
) {
  setDraft((currentDraft) => ({ ...currentDraft, [key]: value }))
}

function mapCountryToCurrency(country: string | null) {
  switch (country) {
    case 'UK':
      return 'GBP'
    case 'CH':
      return 'CHF'
    case 'DE':
      return 'EUR'
    case 'CA':
      return 'CAD'
    case 'US':
      return 'USD'
    default:
      return 'GBP'
  }
}
