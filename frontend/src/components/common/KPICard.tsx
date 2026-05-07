import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

import type { DashboardKpi } from '../../types/api'

const borderMap: Record<DashboardKpi['border_color'], string> = {
  green: 'border-l-iris-green',
  amber: 'border-l-iris-amber',
  red: 'border-l-iris-red',
  blue: 'border-l-[#3498DB]',
  teal: 'border-l-iris-teal',
}

interface KPICardProps extends DashboardKpi {
  density?: 'default' | 'compact'
}

export function KPICard({ label, value, trend, trend_value, subtitle, border_color, density = 'default' }: KPICardProps) {
  const compact = density === 'compact'

  return (
    <article
      className={`min-w-0 rounded-lg border border-iris-border bg-white shadow-sm border-l-[3px] ${borderMap[border_color]} ${
        compact ? 'px-3 py-2.5' : 'min-h-[88px] p-3.5'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={compact ? 'text-[10px] font-medium leading-[1.3] text-iris-text-secondary' : 'text-[11px] leading-4 text-iris-text-secondary'}>
          {label}
        </p>
        <TrendIcon trend={trend} density={density} />
      </div>
      <p className={compact ? 'mt-2 text-[18px] font-bold leading-none tracking-[-0.01em] text-iris-text-primary' : 'mt-3 text-[25px] font-bold leading-none text-iris-text-primary'}>
        {value}
      </p>
      {trend_value ? (
        <p className={compact ? 'mt-1 text-[10px] font-medium leading-[1.35] text-iris-text-secondary' : 'mt-1 text-[11px] font-medium text-iris-text-secondary'}>
          {trend_value}
        </p>
      ) : null}
      {subtitle ? (
        <p className={compact ? 'mt-0.5 text-[10px] leading-[1.35] text-iris-text-muted' : 'mt-1 text-[11px] leading-4 text-iris-text-muted'}>
          {subtitle}
        </p>
      ) : null}
    </article>
  )
}

function TrendIcon({
  trend,
  density,
}: {
  trend: DashboardKpi['trend']
  density: 'default' | 'compact'
}) {
  const sizeClass = density === 'compact' ? 'h-3 w-3' : 'h-3.5 w-3.5'

  if (trend === 'up') {
    return <ArrowUpRight className={`${sizeClass} mt-0.5 shrink-0 text-iris-green`} />
  }

  if (trend === 'down') {
    return <ArrowDownRight className={`${sizeClass} mt-0.5 shrink-0 text-iris-red`} />
  }

  return <ArrowRight className={`${sizeClass} mt-0.5 shrink-0 text-iris-text-muted`} />
}
