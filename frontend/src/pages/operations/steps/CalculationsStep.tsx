import { formatCurrency } from '../../../utils/formatters'
import type { OperationsCalculationsPayload } from '../../../types/api'

export function CalculationsStep({ payload }: { payload: OperationsCalculationsPayload }) {
  const netTone = payload.net_position < 0 ? 'text-[#922B21]' : 'text-[#117A65]'
  return (
    <div className="space-y-5">
      <SectionHeading subtitle={payload.subtitle} title={payload.title} />

      <div className="grid gap-4 xl:grid-cols-4">
        <KpiCard label="Fixed Leg Amount" value={formatCurrency(payload.fixed_leg_amount, payload.currency)} />
        <KpiCard label="Floating Leg Amount" value={formatCurrency(payload.floating_leg_amount, payload.currency)} />
        <KpiCard label="Net Position" tone={netTone} value={`${payload.net_position < 0 ? '-' : '+'}${formatCurrency(Math.abs(payload.net_position), payload.currency)}`} />
        <KpiCard label="Pricing Basis" value={payload.pricing_basis} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DetailCard
          items={[
            ['Rate', `${(payload.fixed_leg.rate * 100).toFixed(2)}%`],
            ['Notional', formatCurrency(payload.fixed_leg.notional, payload.currency)],
            ['Day Count', payload.fixed_leg.day_count],
            ['Period', payload.fixed_leg.period],
          ]}
          title="Fixed Leg (Expected)"
        />
        <DetailCard
          items={[
            ['Observed Mortality Rate', `${(payload.floating_leg.observed_mortality_rate * 100).toFixed(2)}%`],
            ['Source', payload.floating_leg.source],
            ['Notional', formatCurrency(payload.floating_leg.notional, payload.currency)],
            ['Period', payload.floating_leg.period],
          ]}
          title="Floating Leg (Observed)"
        />
      </div>

      <div className="rounded-[22px] border border-[#D9E3EA] bg-white px-5 py-4 shadow-sm">
        <p className="text-[15px] font-semibold text-iris-text-primary">IRiS Insight</p>
        <div className="mt-3 space-y-2 text-[13px] text-iris-text-secondary">
          {payload.insights.map((insight) => (
            <p key={insight}>• {insight}</p>
          ))}
        </div>
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

function DetailCard({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <div className="rounded-[22px] border border-[#D9E3EA] bg-white px-5 py-4 shadow-sm">
      <p className="text-[15px] font-semibold text-iris-text-primary">{title}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[#F8FAFC] px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
            <p className="mt-1.5 text-[14px] font-semibold text-iris-text-primary">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
