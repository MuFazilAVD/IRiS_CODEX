import { formatCurrency } from '../../../utils/formatters'
import type { OperationsVariancePayload } from '../../../types/api'

export function VarianceAnalysisStep({
  busy,
  payload,
  onAction,
}: {
  busy: boolean
  payload: OperationsVariancePayload
  onAction: (action: string) => void
}) {
  return (
    <div className="space-y-5">
      <SectionHeading subtitle={payload.subtitle} title={payload.title} />

      <div className="grid gap-4 xl:grid-cols-4">
        <KpiCard label="Portfolio Variance" value={`${payload.portfolio_variance_pct.toFixed(1)}%`} />
        <KpiCard label="Threshold" value={`${payload.threshold_pct.toFixed(1)}%`} />
        <KpiCard label="Breach Status" tone={payload.breach_status === 'Within Limit' ? 'text-[#117A65]' : 'text-[#922B21]'} value={payload.breach_status} />
        <KpiCard label="Impact" value={formatCurrency(payload.impact_amount, payload.impact_currency)} />
      </div>

      <div className="rounded-[24px] border border-[#D9E3EA] bg-white shadow-sm">
        <div className="border-b border-[#E9EEF3] px-5 py-4">
          <p className="text-[16px] font-semibold text-iris-text-primary">Variance Breakdown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F7F9FB]">
              <tr>
                {['Component', 'Expected', 'Observed', 'Variance'].map((column) => (
                  <th key={column} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payload.breakdown.map((row) => (
                <tr key={row.component} className="border-t border-[#EEF2F5]">
                  <td className="px-4 py-3 text-iris-text-primary">{row.component}</td>
                  <td className="px-4 py-3 text-iris-text-secondary">{row.expected}</td>
                  <td className="px-4 py-3 text-iris-text-secondary">{row.observed}</td>
                  <td className="px-4 py-3 font-semibold text-[#922B21]">+{row.variance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[22px] border border-[#D9E3EA] bg-white px-5 py-4 shadow-sm">
        <p className="text-[15px] font-semibold text-iris-text-primary">IRiS Insights</p>
        <div className="mt-3 space-y-2 text-[13px] text-iris-text-secondary">
          {payload.insights.map((insight) => (
            <p key={insight}>• {insight}</p>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={busy} onClick={() => onAction('flag_for_review')} type="button">
          Flag for Review
        </button>
        <button className="btn-primary" disabled={busy} onClick={() => onAction('send_to_underwriter')} type="button">
          Send to Underwriter
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
