import { formatCurrency } from '../../../utils/formatters'
import type { OperationsOutcomePayload } from '../../../types/api'

export function OutcomeStep({
  busy,
  payload,
  onAction,
}: {
  busy: boolean
  payload: OperationsOutcomePayload
  onAction: (action: string) => void
}) {
  return (
    <div className="space-y-5">
      <SectionHeading subtitle={payload.subtitle} title={payload.title} />

      <div className="grid gap-4 xl:grid-cols-4">
        <KpiCard label="Final Status" tone={statusTone(payload.final_status)} value={payload.final_status} />
        <KpiCard label="Settlement Amount" value={formatCurrency(payload.settlement_amount, payload.settlement_currency)} />
        <KpiCard label="Approval Required" value={payload.approval_required ? 'Yes' : 'No'} />
        <KpiCard label="SLA Status" tone={statusTone(payload.sla_status)} value={payload.sla_status} />
      </div>

      <div className="rounded-[22px] border border-[#D9E3EA] bg-white px-5 py-4 shadow-sm">
        <p className="text-[15px] font-semibold text-iris-text-primary">Summary Panel</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <MetricLine label="Contract" value={payload.summary.contract} />
          <MetricLine label="Total Records" value={payload.summary.total_records.toLocaleString('en-GB')} />
          <MetricLine label="Issues Resolved" value={payload.summary.issues_resolved ? 'Yes' : 'No'} />
          <MetricLine label="Compliance" value={payload.summary.compliance} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary bg-[#1E8449] hover:bg-[#229954]" disabled={busy} onClick={() => onAction('approve_settlement')} type="button">
          Approve Settlement
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => onAction('hold_payment')} type="button">
          Hold Payment
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => onAction('reject_case')} type="button">
          Reject Case
        </button>
      </div>
    </div>
  )
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-[24px] font-bold text-iris-text-primary">{title}</h2>
      <p className="mt-1.5 text-[13px] text-iris-text-secondary">{subtitle}</p>
    </div>
  )
}

function KpiCard({ label, value, tone = 'text-iris-text-primary' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-[22px] border border-[#D9E3EA] bg-white px-5 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-iris-text-muted">{label}</p>
      <p className={`mt-3 text-[26px] font-bold ${tone}`}>{value}</p>
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

function statusTone(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('risk') || normalized.includes('pending') || normalized.includes('hold')) {
    return 'text-[#B9770E]'
  }
  if (normalized.includes('approved') || normalized.includes('complete')) {
    return 'text-[#117A65]'
  }
  if (normalized.includes('reject')) {
    return 'text-[#922B21]'
  }
  return 'text-iris-text-primary'
}
