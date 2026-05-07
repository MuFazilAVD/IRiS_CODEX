import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { StatusBadge } from '../../components/common/StatusBadge'
import type { WorklistItem } from '../../types/api'

const borderColorMap: Record<WorklistItem['priority'], string> = {
  critical: 'border-l-iris-red',
  high: 'border-l-iris-orange',
  medium: 'border-l-iris-amber',
  low: 'border-l-[#3498DB]',
}

export function WorklistCard({ item }: { item: WorklistItem }) {
  const sourceLabel = item.ai_generated ? 'AI Agent' : item.source ?? 'System'

  return (
    <Link className="block" to={`/worklist/${item.wl_id}`}>
      <article className={`rounded-lg border border-iris-border bg-white p-4 shadow-sm border-l-[3px] transition hover:-translate-y-0.5 hover:shadow-md ${borderColorMap[item.priority]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={item.priority}>{item.priority}</StatusBadge>
          {item.compliance_hold ? <StatusBadge status="review">Hold</StatusBadge> : null}
        </div>
        <span className="rounded p-1 text-iris-text-secondary">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>

      <h3 className="mt-3 text-[14px] font-semibold leading-5 text-iris-text-primary">{item.title}</h3>
      <p className="mt-1 font-mono text-[11px] text-iris-text-muted">
        {item.wl_id} · {item.category}
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
            item.is_overdue
              ? 'bg-[#FDEDEC] text-[#922B21]'
              : item.is_approaching
                ? 'bg-[#FEF5E7] text-[#784212]'
                : 'bg-[#F0F2F5] text-iris-text-secondary'
          }`}
        >
          {item.elapsed_display ?? '0m'}
        </span>
        <span className="rounded-full bg-[#E0F7FA] px-2.5 py-1 text-[11px] font-medium text-[#006064]">{sourceLabel}</span>
      </div>

      <p className="mt-3 text-[11px] text-iris-text-secondary">{item.breadcrumb}</p>
      </article>
    </Link>
  )
}
