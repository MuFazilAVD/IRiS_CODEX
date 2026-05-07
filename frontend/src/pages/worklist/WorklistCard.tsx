import { ArrowUpRight, Building2, Clock3, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'

import { StatusBadge } from '../../components/common/StatusBadge'
import type { AppRole, WorklistItem } from '../../types/api'

const borderColorMap: Record<WorklistItem['priority'], string> = {
  critical: 'border-l-iris-red',
  high: 'border-l-iris-orange',
  medium: 'border-l-iris-amber',
  low: 'border-l-[#3498DB]',
}

function titleCase(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatRoleLabel(role?: string | null) {
  if (!role) {
    return 'Unassigned'
  }

  if (role === 'claims_ops') {
    return 'Claims Ops'
  }

  if (role === 'super_admin') {
    return 'Admin'
  }

  return titleCase(role)
}

function formatAssigneeLabel(email?: string | null) {
  return email ? email.split('@')[0] : 'Unassigned'
}

function resolveSourceLabel(item: WorklistItem) {
  if (item.source) {
    return item.source
  }

  return item.ai_generated ? 'AI Agent' : 'System Rule'
}

function resolveEntityDisplay(item: WorklistItem) {
  if (item.entity_display) {
    return item.entity_display
  }

  if (item.cedent_name && item.contract_id) {
    return `${item.cedent_name} - ${item.contract_id}`
  }

  return item.cedent_name ?? item.contract_id ?? item.cedent_id ?? null
}

function resolveOwnerDisplay(item: WorklistItem) {
  return `${formatRoleLabel(item.assigned_role)}\n· ${formatAssigneeLabel(item.assigned_to_email)}`
}

function isReadOnlyForRole(item: WorklistItem, viewerRole: Exclude<AppRole, 'super_admin'> | null) {
  if (!viewerRole || !item.assigned_role) {
    return false
  }

  return item.assigned_role !== viewerRole
}

function resolveImpactTone(display?: string | null) {
  if (!display) {
    return 'text-iris-text-secondary'
  }

  if (display.startsWith('-')) {
    return 'text-iris-red'
  }

  return 'text-iris-text-primary'
}

export function WorklistCard({
  item,
  viewerRole,
}: {
  item: WorklistItem
  viewerRole: Exclude<AppRole, 'super_admin'> | null
}) {
  const sourceLabel = resolveSourceLabel(item)
  const entityDisplay = resolveEntityDisplay(item)
  const ownerDisplay = resolveOwnerDisplay(item)
  const hasImpact = Boolean(item.financial_impact_display)
  const isReadOnly = isReadOnlyForRole(item, viewerRole)

  return (
    <Link className="block h-full" to={`/worklist/${item.wl_id}`}>
      <article
        className={`flex h-full flex-col rounded-lg border border-iris-border bg-white p-3 shadow-sm border-l-[4px] transition hover:-translate-y-0.5 hover:shadow-md ${borderColorMap[item.priority]}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={item.priority}>{item.priority}</StatusBadge>
            {item.compliance_hold ? <StatusBadge status="hold">Hold</StatusBadge> : null}
            {isReadOnly ? <StatusBadge status="readonly">Read-only</StatusBadge> : null}
          </div>
          <span className="rounded p-0.5 text-iris-text-secondary">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>

        <div className="mt-2.5 flex flex-1 flex-col">
          <h3 className="min-h-[52px] text-[13px] font-semibold leading-5 text-iris-text-primary">{item.title}</h3>
          <p className="mt-1 font-mono text-[11px] text-iris-text-muted">
            {item.wl_id}
            {item.category ? ` - ${item.category}` : ''}
          </p>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${
                item.is_overdue
                  ? 'bg-[#FDEDEC] text-[#922B21]'
                  : item.is_approaching
                    ? 'bg-[#FEF5E7] text-[#784212]'
                    : 'bg-[#F0F2F5] text-iris-text-secondary'
              }`}
            >
              <Clock3 className="h-3 w-3" />
              {item.elapsed_display ?? '0m'}
            </span>
            <span
              className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium ${
                sourceLabel === 'AI Agent' ? 'bg-[#E0F7FA] text-[#006064]' : 'bg-[#F4F6F8] text-[#5D6D7E]'
              }`}
            >
              {sourceLabel}
            </span>
          </div>

          <div className="mt-3 flex flex-1 flex-col space-y-1.5 text-[11px] text-iris-text-secondary">
            <p className="min-h-[28px]">{item.breadcrumb}</p>
            {entityDisplay ? (
              <p className="flex min-h-[46px] items-start gap-1.5">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-iris-text-muted" />
                <span className="whitespace-pre-line">{entityDisplay}</span>
              </p>
            ) : (
              <div className="min-h-[46px]" />
            )}
            <p className="flex min-h-[38px] items-start gap-1.5">
              <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-iris-text-muted" />
              <span className="whitespace-pre-line">{ownerDisplay}</span>
            </p>
          </div>
        </div>

        <div className="mt-3 border-t border-iris-border pt-2.5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-h-[40px]">
              {hasImpact ? (
                <>
                  <p className={`text-[18px] font-semibold leading-none ${resolveImpactTone(item.financial_impact_display)}`}>
                    {item.financial_impact_display}
                  </p>
                  <p className="mt-1 text-[11px] text-iris-text-secondary">Financial impact</p>
                </>
              ) : (
                <p className="text-[11px] text-iris-text-secondary">No financial impact</p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {item.action_label ? (
                <span className="rounded-md border border-[#BFE1FB] bg-[#EFF7FF] px-2 py-1 text-[11px] font-medium text-iris-blue">
                  {item.action_label}
                </span>
              ) : null}
              {item.confidence_display ? (
                <span className="rounded-md bg-[#F4F6F8] px-2 py-1 text-[11px] font-medium text-iris-text-secondary">{item.confidence_display}</span>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}
