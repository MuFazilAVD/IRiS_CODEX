import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

import type { DashboardKpi } from '../../types/api'

const borderMap: Record<DashboardKpi['border_color'], string> = {
  green: 'border-l-iris-green',
  amber: 'border-l-iris-amber',
  red: 'border-l-iris-red',
  blue: 'border-l-[#3498DB]',
  teal: 'border-l-iris-teal',
}

export function KPICard({ label, value, trend, trend_value, subtitle, border_color }: DashboardKpi) {
  return (
    <article className={`min-h-[88px] rounded-lg border border-iris-border bg-white p-3.5 shadow-sm border-l-[3px] ${borderMap[border_color]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] leading-4 text-iris-text-secondary">{label}</p>
        <TrendIcon trend={trend} />
      </div>
      <p className="mt-3 text-[25px] font-bold leading-none text-iris-text-primary">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-iris-text-secondary">{trend_value}</p>
      <p className="mt-1 text-[11px] leading-4 text-iris-text-muted">{subtitle}</p>
    </article>
  )
}

function TrendIcon({ trend }: { trend: DashboardKpi['trend'] }) {
  if (trend === 'up') {
    return <ArrowUpRight className="h-3.5 w-3.5 text-iris-green" />
  }

  if (trend === 'down') {
    return <ArrowDownRight className="h-3.5 w-3.5 text-iris-red" />
  }

  return <ArrowRight className="h-3.5 w-3.5 text-iris-text-muted" />
}
