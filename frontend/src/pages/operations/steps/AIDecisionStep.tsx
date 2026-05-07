import type { OperationsAIDecisionPayload } from '../../../types/api'

export function AIDecisionStep({
  busy,
  payload,
  onAction,
}: {
  busy: boolean
  payload: OperationsAIDecisionPayload
  onAction: (action: string) => void
}) {
  return (
    <div className="space-y-5">
      <SectionHeading subtitle={payload.subtitle} title={payload.title} />

      <div className="grid gap-4 xl:grid-cols-4">
        <KpiCard label="Confidence Score" value={`${Math.round(payload.confidence_score * 100)}%`} />
        <KpiCard label="Risk Level" value={payload.risk_level} />
        <KpiCard label="Decision" value={payload.decision} />
        <KpiCard label="Human Review Required" tone={payload.human_review_required ? 'text-[#922B21]' : 'text-[#117A65]'} value={payload.human_review_required ? 'Yes' : 'No'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[22px] border border-[#D9E3EA] bg-white px-5 py-4 shadow-sm">
          <p className="text-[15px] font-semibold text-iris-text-primary">Decision Panel</p>
          <div className="mt-4 space-y-3 text-[13px] text-iris-text-secondary">
            {payload.decision_panel.map((item) => (
              <div key={item.text} className="rounded-xl bg-[#F8FAFC] px-4 py-3">
                <p className="font-medium text-iris-text-primary">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-[#D9E3EA] bg-white px-5 py-4 shadow-sm">
          <p className="text-[15px] font-semibold text-iris-text-primary">Flags</p>
          <div className="mt-4 space-y-3 text-[13px] text-iris-text-secondary">
            {payload.flags.map((item) => (
              <div key={item.text} className="rounded-xl bg-[#FFF8EE] px-4 py-3 text-[#B9770E]">
                <p className="font-medium">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy} onClick={() => onAction('approve_and_proceed')} type="button">
          Approve & Proceed
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => onAction('escalate')} type="button">
          Escalate
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => onAction('request_manual_review')} type="button">
          Request Manual Review
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
