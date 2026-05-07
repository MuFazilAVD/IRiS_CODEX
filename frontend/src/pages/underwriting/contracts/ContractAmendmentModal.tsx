import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'

import { api } from '../../../api/client'
import { amendmentSectionOptions, amendmentTypeOptions } from './contractConfig'
import type { ContractAmendmentResponse } from '../../../types/api'

interface ContractAmendmentModalProps {
  open: boolean
  contractId: string
  onClose: () => void
  onSubmitted: () => void
}

export function ContractAmendmentModal({ open, contractId, onClose, onSubmitted }: ContractAmendmentModalProps) {
  const [summary, setSummary] = useState('')
  const [amendmentType, setAmendmentType] = useState('Other')
  const [submittedDate, setSubmittedDate] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [selectedSections, setSelectedSections] = useState<string[]>(['economic_terms'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSummary('')
      setAmendmentType('Other')
      setSubmittedDate('')
      setEffectiveDate('')
      setSelectedSections(['economic_terms'])
      setBusy(false)
      setError(null)
    }
  }, [open])

  if (!open) {
    return null
  }

  async function handleSubmit() {
    setBusy(true)
    setError(null)
    try {
      await api.post<ContractAmendmentResponse>(`/underwriting/contracts/${contractId}/amend`, {
        description: summary,
        amendment_type: amendmentType,
        submitted_date: submittedDate,
        effective_date: effectiveDate,
        status: 'pending_approval',
        changed_sections: selectedSections,
        changes: { summary },
      })
      onSubmitted()
      onClose()
    } catch {
      setError('Unable to submit the amendment right now.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(13,27,42,0.55)] p-4">
      <div className="mx-auto flex h-full max-w-3xl items-center">
        <div className="w-full rounded-2xl border border-iris-border bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[#EEF2F5] px-6 py-5">
            <div>
              <h2 className="text-[24px] font-bold text-iris-text-primary">Add Contract Amendment</h2>
              <p className="mt-1 text-[13px] text-iris-text-secondary">Create the amendment draft and route it for approval.</p>
            </div>
            <button className="btn-secondary" onClick={onClose} type="button">
              <X className="h-4 w-4" />
              Close
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">Summary</label>
              <input className="field-input" value={summary} onChange={(event) => setSummary(event.target.value)} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">Type</label>
                <select className="field-input" value={amendmentType} onChange={(event) => setAmendmentType(event.target.value)}>
                  {amendmentTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">Submitted</label>
                <input className="field-input" type="date" value={submittedDate} onChange={(event) => setSubmittedDate(event.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">Effective</label>
                <input className="field-input" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">Changed Sections</p>
              <div className="grid gap-2 md:grid-cols-2">
                {amendmentSectionOptions.map((option) => {
                  const checked = selectedSections.includes(option.value)
                  return (
                    <label key={option.value} className="flex items-center gap-2 rounded-lg border border-iris-border bg-[#FAFBFC] px-3 py-2 text-[13px] text-iris-text-primary">
                      <input
                        checked={checked}
                        type="checkbox"
                        onChange={() =>
                          setSelectedSections((currentSections) =>
                            checked ? currentSections.filter((value) => value !== option.value) : [...currentSections, option.value],
                          )
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-[#AED6F1] bg-[#F4F9FD] px-4 py-4">
              <p className="text-[13px] font-semibold text-iris-text-primary">Changes summary</p>
              <p className="mt-1 text-[13px] text-iris-text-secondary">{summary || 'The submitted summary will be stored as the current changes overview for this amendment.'}</p>
            </div>

            {error ? <div className="rounded-xl border border-[#F5C6CB] bg-[#FDEDEC] px-4 py-3 text-[13px] text-[#922B21]">{error}</div> : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#EEF2F5] px-6 py-4">
            <button className="btn-secondary" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={busy || !summary || !submittedDate || !effectiveDate || selectedSections.length === 0}
              onClick={() => void handleSubmit()}
              type="button"
            >
              <Plus className="h-4 w-4" />
              {busy ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
