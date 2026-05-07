import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Filter, LayoutGrid, List, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../../api/client'
import { DataTable } from '../../components/common/DataTable'
import { EmptyState } from '../../components/common/EmptyState'
import { PageHeader } from '../../components/common/PageHeader'
import { KpiGridSkeleton, Skeleton, SkeletonCard, TableSkeleton } from '../../components/common/Skeleton'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import type { AppRole, User, WorklistItem, WorklistPayload, WorklistSummary } from '../../types/api'
import { WorklistCard } from './WorklistCard'

type WorklistViewMode = 'my_tasks' | 'team_tasks' | 'all_accessible'
type QuickFilterKey = 'critical' | 'overdue' | 'approval' | 'ai' | 'hold' | 'high_impact'

const rolePersonaEmailMap: Record<Exclude<AppRole, 'super_admin'>, string> = {
  admin: 'd.rhodes@reinsure.io',
  underwriter: 'm.patel@reinsure.io',
  claims_ops: 'a.chen@reinsure.io',
  compliance: 'j.morales@reinsure.io',
}

const taskViewOptions: Array<{ value: WorklistViewMode; label: string }> = [
  { value: 'my_tasks', label: 'My Tasks' },
  { value: 'team_tasks', label: 'Team Tasks' },
  { value: 'all_accessible', label: 'All Accessible' },
]

const summaryConfig: Array<{
  key: keyof WorklistSummary
  label: string
  border: string
  quickFilter?: QuickFilterKey
  viewMode?: WorklistViewMode
}> = [
  { key: 'my_critical', label: 'My Critical Tasks', border: 'border-l-iris-red', quickFilter: 'critical', viewMode: 'my_tasks' },
  { key: 'overdue', label: 'Overdue', border: 'border-l-iris-red', quickFilter: 'overdue' },
  { key: 'pending_approvals', label: 'Pending Approvals', border: 'border-l-[#3498DB]', quickFilter: 'approval' },
  { key: 'compliance_holds', label: 'Compliance Holds', border: 'border-l-iris-amber', quickFilter: 'hold' },
  { key: 'ai_exception_queue', label: 'AI Exception Queue', border: 'border-l-iris-teal', quickFilter: 'ai' },
  { key: 'team_backlog', label: 'Team Backlog', border: 'border-l-[#3498DB]', viewMode: 'team_tasks' },
  { key: 'awaiting_review', label: 'Awaiting My Review', border: 'border-l-slate-400', quickFilter: 'approval', viewMode: 'my_tasks' },
]

const baseCategoryOptions = [
  'Reconciliation Mismatch',
  'OFAC Match',
  'AI Mapping Failure',
  'SFTP Failure',
  'Settlement Approval',
  'Role Assignment',
  'Access Audit',
  'Override Approval',
]

const baseSourceOptions = ['AI Agent', 'System Rule', 'Human', 'SFTP']

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

function resolveViewerEmail(user: User | null, effectiveRole: Exclude<AppRole, 'super_admin'> | null) {
  if (!effectiveRole) {
    return null
  }

  if (user?.role === 'super_admin') {
    return rolePersonaEmailMap[effectiveRole]
  }

  return user?.email ?? rolePersonaEmailMap[effectiveRole]
}

function resolveSourceLabel(item: WorklistItem) {
  if (item.source) {
    return item.source
  }

  return item.ai_generated ? 'AI Agent' : 'System Rule'
}

function resolveOwnerDisplay(item: WorklistItem) {
  const assignee = item.assigned_to_email ? item.assigned_to_email.split('@')[0] : 'Unassigned'
  return `${formatRoleLabel(item.assigned_role)} · ${assignee}`
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

function parseCompactImpactValue(display?: string | null) {
  if (!display) {
    return 0
  }

  const match = display.replace(/,/g, '').match(/[-+]?([0-9]+(?:\.[0-9]+)?)([KMB])?/i)
  if (!match) {
    return 0
  }

  const value = Number(match[1])
  const suffix = match[2]?.toUpperCase()

  if (suffix === 'B') {
    return value * 1_000_000_000
  }

  if (suffix === 'M') {
    return value * 1_000_000
  }

  if (suffix === 'K') {
    return value * 1_000
  }

  return value
}

function isHighImpact(item: WorklistItem) {
  if (typeof item.is_high_impact === 'boolean') {
    return item.is_high_impact
  }

  return Math.abs(parseCompactImpactValue(item.financial_impact_display)) >= 1_000_000
}

function mergeOptions(defaultOptions: string[], discovered: Array<string | undefined>) {
  return Array.from(new Set([...defaultOptions, ...discovered.filter((value): value is string => Boolean(value))]))
}

export function WorklistPage() {
  const { effectiveRole, user } = useAuth()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [taskView, setTaskView] = useState<WorklistViewMode>('all_accessible')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('all')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [source, setSource] = useState('all')
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey | null>(null)

  const query = useQuery({
    queryKey: ['worklist', effectiveRole],
    queryFn: async () => (await api.get<WorklistPayload>('/worklist')).data,
    enabled: Boolean(effectiveRole),
    refetchInterval: effectiveRole === 'claims_ops' ? 30_000 : false,
  })

  const viewerEmail = resolveViewerEmail(user, effectiveRole)
  const allItems = query.data?.items ?? []

  const categoryOptions = useMemo(
    () => mergeOptions(baseCategoryOptions, allItems.map((item) => item.category)),
    [allItems],
  )
  const sourceOptions = useMemo(
    () => mergeOptions(baseSourceOptions, allItems.map((item) => resolveSourceLabel(item))),
    [allItems],
  )

  const viewScopedItems = useMemo(() => {
    return allItems.filter((item) => {
      if (taskView === 'all_accessible') {
        return true
      }

      if (taskView === 'team_tasks') {
        return effectiveRole ? item.assigned_role === effectiveRole : true
      }

      return viewerEmail ? item.assigned_to_email?.toLowerCase() === viewerEmail.toLowerCase() : false
    })
  }, [allItems, effectiveRole, taskView, viewerEmail])

  const items = useMemo(() => {
    return viewScopedItems.filter((item) => {
      const haystack = [
        item.wl_id,
        item.title,
        item.cedent_id,
        item.cedent_name,
        item.contract_id,
        item.category,
        item.breadcrumb,
        resolveSourceLabel(item),
        resolveEntityDisplay(item),
        item.assigned_role,
        item.assigned_to_email ?? undefined,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const searchMatch = haystack.includes(search.toLowerCase())
      const priorityMatch = priority === 'all' || item.priority === priority
      const statusMatch = status === 'all' || item.status === status
      const categoryMatch = category === 'all' || item.category === category
      const sourceMatch = source === 'all' || resolveSourceLabel(item) === source
      const quickMatch =
        quickFilter === null ||
        (quickFilter === 'critical' && item.priority === 'critical') ||
        (quickFilter === 'overdue' && item.is_overdue) ||
        (quickFilter === 'approval' && (item.status === 'pending_review' || item.action_label === 'Approval req.')) ||
        (quickFilter === 'ai' && item.ai_generated) ||
        (quickFilter === 'hold' && item.compliance_hold) ||
        (quickFilter === 'high_impact' && isHighImpact(item))

      return searchMatch && priorityMatch && statusMatch && categoryMatch && sourceMatch && quickMatch
    })
  }, [category, priority, quickFilter, search, source, status, viewScopedItems])

  const subtitle = effectiveRole
    ? `Operational command center - ${formatRoleLabel(effectiveRole)} view - ${items.length} of ${viewScopedItems.length} tasks`
    : undefined

  return (
    <div>
      <PageHeader
        title="Worklist"
        subtitle={subtitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-[#D3DEE7] bg-white p-1 shadow-sm">
              {taskViewOptions.map((option) => (
                <button
                  key={option.value}
                  className={`rounded px-3 py-1.5 text-[12px] font-semibold transition ${
                    taskView === option.value
                      ? 'border border-iris-navy bg-iris-navy text-white'
                      : 'border border-transparent text-iris-text-secondary hover:border-[#D3DEE7] hover:bg-iris-bg hover:text-iris-text-primary'
                  }`}
                  onClick={() => setTaskView(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-md border border-[#D3DEE7] bg-white p-1 shadow-sm">
              <button
                className={`rounded border p-2 transition ${
                  view === 'grid'
                    ? 'border-iris-navy bg-iris-navy text-white'
                    : 'border-transparent text-iris-text-secondary hover:border-[#D3DEE7] hover:bg-iris-bg hover:text-iris-text-primary'
                }`}
                onClick={() => setView('grid')}
                type="button"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                className={`rounded border p-2 transition ${
                  view === 'list'
                    ? 'border-iris-navy bg-iris-navy text-white'
                    : 'border-transparent text-iris-text-secondary hover:border-[#D3DEE7] hover:bg-iris-bg hover:text-iris-text-primary'
                }`}
                onClick={() => setView('list')}
                type="button"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        }
      />

      {query.isLoading ? (
        <KpiGridSkeleton count={7} />
      ) : (
        <div className="compact-kpi-grid">
          {summaryConfig.map((summary) => (
            <button
              key={summary.key}
              className={`rounded-lg border border-iris-border bg-white p-3 text-left shadow-sm border-l-[3px] ${summary.border}`}
              onClick={() => {
                if (summary.viewMode) {
                  setTaskView(summary.viewMode)
                }
                setQuickFilter(summary.quickFilter ?? null)
              }}
              type="button"
            >
              <p className="text-[11px] leading-4 text-iris-text-secondary">{summary.label}</p>
              <p className="mt-1.5 text-[22px] font-bold leading-none text-iris-text-primary">{query.data?.summary?.[summary.key] ?? 0}</p>
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-[#D3DEE7] bg-white p-3 shadow-sm">
        <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.82fr))]">
          <label className="input-shell border-[#D3DEE7] shadow-[0_1px_0_rgba(13,27,42,0.04)]">
            <Search className="h-4 w-4 text-iris-text-muted" />
            <input
              aria-label="Search worklist"
              placeholder="Search task ID, title, cedant, contract, assignee..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select className="field-input border-[#D3DEE7] shadow-[0_1px_0_rgba(13,27,42,0.04)]" value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="all">Priority: All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select className="field-input border-[#D3DEE7] shadow-[0_1px_0_rgba(13,27,42,0.04)]" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Status: All</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="pending_review">Pending Review</option>
            <option value="resolved">Resolved</option>
          </select>
          <select className="field-input border-[#D3DEE7] shadow-[0_1px_0_rgba(13,27,42,0.04)]" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">Category: All</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2.5 grid gap-2.5 xl:grid-cols-[minmax(0,0.34fr)_1fr]">
          <select className="field-input border-[#D3DEE7] shadow-[0_1px_0_rgba(13,27,42,0.04)]" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="all">Source: All</option>
            {sourceOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E6ECF1] pt-3">
          <Filter className="h-3.5 w-3.5 text-iris-text-muted" />
          {[
            ['overdue', 'Overdue'],
            ['approval', 'Approval Required'],
            ['ai', 'AI-generated'],
            ['hold', 'Compliance Hold'],
            ['high_impact', 'High Impact (>=1M)'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={`rounded-md border px-3 py-1.5 text-[12px] font-medium ${
                quickFilter === value ? 'border-iris-blue bg-[#EBF5FB] text-iris-blue' : 'border-iris-border bg-white text-iris-text-secondary'
              }`}
              onClick={() => setQuickFilter(quickFilter === value ? null : (value as QuickFilterKey))}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {query.isLoading ? (
          view === 'grid' ? (
            <div className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={index}>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                  </div>
                  <Skeleton className="mt-3 h-4 w-4/5 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-2/5 rounded-full" />
                  <div className="mt-3 flex items-center justify-between">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                  <Skeleton className="mt-3 h-3 w-4/5 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-3/5 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-2/3 rounded-full" />
                </SkeletonCard>
              ))}
            </div>
          ) : (
            <TableSkeleton columns={7} rows={6} />
          )
        ) : view === 'grid' ? (
          items.length ? (
            <div className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <WorklistCard key={item.wl_id} item={item} viewerRole={effectiveRole} />
              ))}
            </div>
          ) : (
            <EmptyState
              action={
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setTaskView('all_accessible')
                    setSearch('')
                    setPriority('all')
                    setStatus('all')
                    setCategory('all')
                    setSource('all')
                    setQuickFilter(null)
                  }}
                  type="button"
                >
                  Clear Filters
                </button>
              }
              description="No tasks matched the current view, search, or filter combination."
              icon={<ClipboardList className="h-5 w-5" />}
              title="No tasks match your filters"
            />
          )
        ) : (
          <DataTable<WorklistItem>
            columns={[
              {
                key: 'wl_id',
                label: 'WL ID',
                render: (value) => (
                  <Link className="font-mono text-[12px] text-iris-blue hover:text-iris-navy" to={`/worklist/${String(value)}`}>
                    {String(value)}
                  </Link>
                ),
              },
              {
                key: 'title',
                label: 'Title',
                render: (value, row) => (
                  <div>
                    <Link className="font-medium text-iris-text-primary hover:text-iris-blue" to={`/worklist/${row.wl_id}`}>
                      {String(value)}
                    </Link>
                    {resolveEntityDisplay(row) ? <p className="mt-1 text-[11px] text-iris-text-secondary">{resolveEntityDisplay(row)}</p> : null}
                  </div>
                ),
              },
              {
                key: 'priority',
                label: 'Priority',
                render: (value) => <StatusBadge status={String(value)}>{String(value)}</StatusBadge>,
              },
              {
                key: 'status',
                label: 'Status',
                render: (value) => <StatusBadge status={String(value)}>{String(value).replace('_', ' ')}</StatusBadge>,
              },
              {
                key: 'cedent_id',
                label: 'Cedant',
                render: (_value, row) => resolveEntityDisplay(row) ?? '-',
              },
              { key: 'elapsed_display', label: 'Due' },
              {
                key: 'assigned_role',
                label: 'Assigned',
                render: (_value, row) => resolveOwnerDisplay(row),
              },
            ]}
            data={items}
            emptyDescription="No tasks matched the current view, search, or filter combination."
            emptyMessage="No tasks match your filters"
          />
        )}
      </div>
    </div>
  )
}
