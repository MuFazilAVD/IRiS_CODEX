import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, PauseCircle, X } from 'lucide-react'

import { api } from '../../../api/client'
import { StatusBadge } from '../../../components/common/StatusBadge'
import { useUiStore } from '../../../store/uiStore'
import { formatCurrency, formatRelativeDate } from '../../../utils/formatters'
import type {
  ClaimsSettlementApproveResponse,
  ClaimsSettlementDetailPayload,
  ClaimsSettlementDisputeResponse,
  ClaimsSettlementHoldResponse,
} from '../../../types/api'

interface SettlementDetailPanelProps {
  settlementId: string
  onClose: () => void
  onRefresh: () => Promise<unknown> | void
}

export function SettlementDetailPanel({ settlementId, onClose, onRefresh }: SettlementDetailPanelProps) {
  const [approveNotes, setApproveNotes] = useState('Approved after settlement control review.')
  const [reviewReason, setReviewReason] = useState('Requires manual reconciliation review.')
  const [busyAction, setBusyAction] = useState<'approve' | 'hold' | 'dispute' | null>(null)
  const pushToast = useUiStore((state) => state.pushToast)

  const detailQuery = useQuery({
    queryKey: ['claims-settlement-detail', settlementId],
    queryFn: async () => (await api.get<ClaimsSettlementDetailPayload>(`/claims/settlements/${settlementId}`)).data,
    enabled: Boolean(settlementId),
  })

  useEffect(() => {
    setApproveNotes('Approved after settlement control review.')
    setReviewReason('Requires manual reconciliation review.')
  }, [settlementId])

  async function refreshPanel() {
    await Promise.all([detailQuery.refetch(), Promise.resolve(onRefresh())])
  }

  async function handleApprove() {
    setBusyAction('approve')
    try {
      const { data } = await api.post<ClaimsSettlementApproveResponse>(`/claims/settlements/${settlementId}/approve`, {
        notes: approveNotes,
      })
      await refreshPanel()
      pushToast({
        tone: 'success',
        message: `${data.settlement_id} approved at ${new Date(data.approved_at).toLocaleString('en-GB')}.`,
      })
    } catch (caughtError: unknown) {
      pushToast({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to approve this settlement right now.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleHold() {
    setBusyAction('hold')
    try {
      const { data } = await api.post<ClaimsSettlementHoldResponse>(`/claims/settlements/${settlementId}/hold`, {
        reason: reviewReason,
      })
      await refreshPanel()
      pushToast({
        tone: 'success',
        message: `${data.settlement_id} was moved to held status for manual review.`,
      })
    } catch (caughtError: unknown) {
      pushToast({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to hold this settlement right now.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleDispute() {
    setBusyAction('dispute')
    try {
      const { data } = await api.post<ClaimsSettlementDisputeResponse>(`/claims/settlements/${settlementId}/dispute`, {
        reason: reviewReason,
      })
      await refreshPanel()
      pushToast({
        tone: 'success',
        message: `${data.settlement_id} moved to dispute review.`,
      })
    } catch (caughtError: unknown) {
      pushToast({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to dispute this settlement right now.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  const detail = detailQuery.data
  const approvalDisabled = !detail || detail.status === 'approved' || detail.status === 'paid'
  const holdDisabled = !detail || detail.status === 'held' || detail.status === 'paid'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/25" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-iris-border bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-iris-border px-5 py-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-iris-text-muted">Settlement Detail</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-[24px] font-bold text-iris-text-primary">{detail?.settlement_display_id ?? detail?.settlement_id ?? settlementId}</h2>
              {detail ? <StatusBadge status={detail.status}>{formatSettlementStatus(detail.status)}</StatusBadge> : null}
            </div>
          </div>
          <button className="rounded-md p-1 text-iris-text-secondary hover:bg-iris-bg" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {detailQuery.isLoading ? (
            <p className="text-[13px] text-iris-text-secondary">Loading settlement detail...</p>
          ) : detail ? (
            <div className="space-y-5">
              <div className="rounded-[22px] border border-iris-border bg-[#FAFBFC] p-4">
                <div className="space-y-2 text-[13px]">
                  <InfoRow
                    label="Contract"
                    value={`${detail.contract_display_id ?? detail.contract_id ?? detail.contract_name}${detail.contract_version ? ` | ${detail.contract_version}` : ''}`}
                  />
                  <InfoRow label="Cedant" value={detail.cedent_name} />
                  <InfoRow label="Period" value={formatPeriodRange(detail.period_label, detail.period_start, detail.period_end)} />
                </div>
              </div>

              <div className="rounded-[22px] border border-iris-border bg-white p-4 shadow-sm">
                <div className="space-y-3">
                  <MoneyRow currency={detail.currency} label="Fixed Leg" value={detail.fixed_leg} />
                  <MoneyRow currency={detail.currency} label="Floating Leg" value={detail.floating_leg} />
                  <MoneyRow currency={detail.currency} label="Net Settlement" signed tone={detail.net_amount >= 0 ? 'positive' : 'negative'} value={detail.net_amount} />
                  <InfoRow label="Direction" value={formatDirection(detail.direction)} />
                  <InfoRow label="Currency" value={detail.currency} />
                  <InfoRow label="Payment Due" value={detail.payment_due} />
                </div>
              </div>

              <div className="rounded-[22px] border border-iris-border bg-white p-4 shadow-sm">
                <InfoRow label="Status" value={formatSettlementStatus(detail.status)} />
                <div className="mt-3 border-t border-[#EEF2F5] pt-3">
                  <InfoRow label="Source" value={detail.source} />
                  <InfoRow label="Last Updated" value={formatRelativeDate(detail.last_updated)} />
                </div>
              </div>

              <div className="rounded-[22px] border border-iris-border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[#1E8449]">
                  <CheckCircle2 className="h-4 w-4" />
                  <p className="text-[15px] font-semibold text-iris-text-primary">Approve Settlement</p>
                </div>
                <textarea
                  className="mt-3 min-h-[96px] w-full rounded-xl border border-iris-border px-3 py-2 text-[13px] text-iris-text-primary outline-none transition focus:border-iris-blue"
                  value={approveNotes}
                  onChange={(event) => setApproveNotes(event.target.value)}
                />
                <button className="btn-primary mt-3 w-full bg-[#1E8449] hover:bg-[#229954]" disabled={busyAction !== null || approvalDisabled} onClick={() => void handleApprove()} type="button">
                  {busyAction === 'approve' ? 'Approving...' : 'Approve Settlement'}
                </button>
              </div>

              <div className="rounded-[22px] border border-iris-border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[#AF601A]">
                  <PauseCircle className="h-4 w-4" />
                  <p className="text-[15px] font-semibold text-iris-text-primary">Hold or Dispute</p>
                </div>
                <textarea
                  className="mt-3 min-h-[96px] w-full rounded-xl border border-iris-border px-3 py-2 text-[13px] text-iris-text-primary outline-none transition focus:border-iris-blue"
                  value={reviewReason}
                  onChange={(event) => setReviewReason(event.target.value)}
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button className="btn-secondary" disabled={busyAction !== null || holdDisabled} onClick={() => void handleHold()} type="button">
                    {busyAction === 'hold' ? 'Holding...' : 'Hold Payment'}
                  </button>
                  <button className="btn-secondary border-[#F4C8C9] text-[#922B21]" disabled={busyAction !== null} onClick={() => void handleDispute()} type="button">
                    {busyAction === 'dispute' ? 'Submitting...' : 'Raise Dispute'}
                  </button>
                </div>
              </div>

              {detail.dispute_reason ? (
                <div className="rounded-xl border border-[#F4C8C9] bg-[#FFF8F8] px-4 py-3 text-[13px] text-[#922B21]">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold">Active dispute:</span>
                  </div>
                  <p className="mt-2">{detail.dispute_reason}</p>
                </div>
              ) : null}

              {detail.notes ? (
                <div className="rounded-xl border border-[#D6EAF8] bg-[#F4F9FD] px-4 py-3 text-[13px] text-iris-blue">
                  <span className="font-semibold">Latest note:</span> {detail.notes}
                </div>
              ) : null}

              <div className="rounded-[22px] border border-iris-border bg-white p-4 shadow-sm">
                <p className="text-[15px] font-semibold text-iris-text-primary">Audit Trail</p>
                <div className="mt-4 space-y-3">
                  {detail.audit_trail.length ? (
                    detail.audit_trail.map((item, index) => (
                      <div key={`${item.timestamp}-${item.actor}-${index}`} className="rounded-xl border border-[#EEF2F5] bg-[#FAFBFC] px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[13px] font-semibold text-iris-text-primary">{item.action}</p>
                          <span className="text-[11px] text-iris-text-muted">{formatRelativeDate(item.timestamp)}</span>
                        </div>
                        <p className="mt-1 text-[12px] text-iris-text-secondary">
                          {item.actor} | {item.type}
                        </p>
                        <p className="mt-2 text-[13px] text-iris-text-secondary">{item.detail}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] text-iris-text-secondary">No audit events have been logged for this settlement yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[#F5C6CB] bg-[#FDEDEC] px-4 py-3 text-[13px] text-[#922B21]">
              Settlement detail could not be loaded.
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-iris-text-secondary">{label}</span>
      <span className="text-right font-medium text-iris-text-primary">{value}</span>
    </div>
  )
}

function MoneyRow({
  label,
  value,
  currency,
  signed = false,
  tone = 'default',
}: {
  label: string
  value: number
  currency: string
  signed?: boolean
  tone?: 'default' | 'positive' | 'negative'
}) {
  const classes = tone === 'positive' ? 'text-[#117A65]' : tone === 'negative' ? 'text-[#922B21]' : 'text-iris-text-primary'
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-iris-text-secondary">{label}</span>
      <span className={`text-right font-semibold ${classes}`}>{signed ? formatSignedCurrency(value, currency) : formatCurrency(value, currency)}</span>
    </div>
  )
}

function formatDirection(direction: string) {
  if (direction === 'reinsurer_to_cedant') {
    return 'Reinsurer pays Cedant'
  }
  if (direction === 'cedant_to_reinsurer') {
    return 'Cedant pays Reinsurer'
  }
  return titleCase(direction)
}

function formatPeriodRange(periodLabel: string, start: string | null, end: string | null) {
  if (!start || !end) {
    return periodLabel
  }
  return `${periodLabel} (${start} -> ${end})`
}

function formatSignedCurrency(value: number, currency: string) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatCurrency(Math.abs(value), currency)}`
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatSettlementStatus(value: string) {
  const labels: Record<string, string> = {
    variance_review: 'Variance Review',
    ready_for_payment: 'Ready for Payment',
    pending_reconciliation: 'Pending Reconciliation',
    compliance_hold: 'Compliance Hold',
    pending_approval: 'Pending Approval',
  }
  return labels[value] ?? titleCase(value)
}

function extractErrorMessage(caughtError: unknown) {
  if (typeof caughtError !== 'object' || caughtError === null || !('response' in caughtError)) {
    return null
  }

  const response = (caughtError as { response?: { data?: { detail?: string; error?: string } } }).response
  return response?.data?.detail ?? response?.data?.error ?? null
}
