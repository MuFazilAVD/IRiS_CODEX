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
import type { WorklistItem, WorklistPayload, WorklistSummary } from '../../types/api'
import { WorklistCard } from './WorklistCard'

const summaryConfig: Array<{ key: keyof WorklistSummary; label: string; border: string; filter: string | null }> = [
  { key: 'my_critical', label: 'My Critical Tasks', border: 'border-l-iris-red', filter: 'critical' },
  { key: 'overdue', label: 'Overdue', border: 'border-l-iris-red', filter: 'overdue' },
  { key: 'pending_approvals', label: 'Pending Approvals', border: 'border-l-[#3498DB]', filter: 'approval' },
  { key: 'compliance_holds', label: 'Compliance Holds', border: 'border-l-iris-amber', filter: 'hold' },
  { key: 'ai_exception_queue', label: 'AI Exception Queue', border: 'border-l-iris-teal', filter: 'ai' },
  { key: 'team_backlog', label: 'Team Backlog', border: 'border-l-[#3498DB]', filter: null },
  { key: 'awaiting_review', label: 'Awaiting My Review', border: 'border-l-slate-400', filter: 'approval' },
]

export function WorklistPage() {
  const { effectiveRole } = useAuth()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('all')
  const [status, setStatus] = useState('all')
  const [quickFilter, setQuickFilter] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['worklist', effectiveRole],
    queryFn: async () => (await api.get<WorklistPayload>('/worklist')).data,
    enabled: Boolean(effectiveRole),
    refetchInterval: effectiveRole === 'claims_ops' ? 30_000 : false,
  })

  const items = useMemo(() => {
    const source = query.data?.items ?? []
    return source.filter((item) => {
      const haystack = [item.wl_id, item.title, item.cedent_id, item.contract_id, item.category, item.breadcrumb]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const searchMatch = haystack.includes(search.toLowerCase())
      const priorityMatch = priority === 'all' || item.priority === priority
      const statusMatch = status === 'all' || item.status === status
      const quickMatch =
        quickFilter === null ||
        (quickFilter === 'critical' && item.priority === 'critical') ||
        (quickFilter === 'overdue' && item.is_overdue) ||
        (quickFilter === 'approval' && item.status === 'pending_review') ||
        (quickFilter === 'ai' && item.ai_generated) ||
        (quickFilter === 'hold' && item.compliance_hold)

      return searchMatch && priorityMatch && statusMatch && quickMatch
    })
  }, [priority, query.data?.items, quickFilter, search, status])

  return (
    <div>
      <PageHeader
        title="Worklist"
        subtitle={`Operational command center · ${effectiveRole?.replace('_', ' ')} view · ${items.length} of ${query.data?.total ?? 0} tasks`}
        eyebrow="Command Queue"
        action={
          <div className="flex gap-2">
            <button className={view === 'grid' ? 'btn-primary' : 'btn-secondary'} onClick={() => setView('grid')} type="button">
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button className={view === 'list' ? 'btn-primary' : 'btn-secondary'} onClick={() => setView('list')} type="button">
              <List className="h-4 w-4" />
            </button>
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
              className={`rounded-lg border border-iris-border bg-white p-3.5 text-left shadow-sm border-l-[3px] ${summary.border}`}
              onClick={() => setQuickFilter(summary.filter === quickFilter ? null : summary.filter)}
              type="button"
            >
              <p className="text-[11px] leading-4 text-iris-text-secondary">{summary.label}</p>
              <p className="mt-2 text-[24px] font-bold leading-none text-iris-text-primary">{query.data?.summary?.[summary.key] ?? 0}</p>
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-iris-border bg-white p-3.5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_repeat(2,minmax(0,1fr))]">
          <label className="input-shell">
            <Search className="h-4 w-4 text-iris-text-muted" />
            <input
              aria-label="Search worklist"
              placeholder="Search task ID, title, cedant, contract, or category..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select className="field-input" value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="all">Priority: All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select className="field-input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Status: All</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="pending_review">Pending Review</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ['overdue', 'Overdue'],
            ['approval', 'Approval Required'],
            ['ai', 'AI-generated'],
            ['hold', 'Compliance Hold'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                quickFilter === value ? 'border-iris-blue bg-[#EBF5FB] text-iris-blue' : 'border-iris-border bg-white text-iris-text-secondary'
              }`}
              onClick={() => setQuickFilter(quickFilter === value ? null : value)}
              type="button"
            >
              <Filter className="mr-1 inline h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {query.isLoading ? (
          view === 'grid' ? (
            <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={index}>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                  <Skeleton className="mt-4 h-4 w-4/5 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-full rounded-full" />
                  <Skeleton className="mt-2 h-3 w-3/4 rounded-full" />
                  <div className="mt-4 flex items-center justify-between">
                    <Skeleton className="h-3 w-28 rounded-full" />
                    <Skeleton className="h-3 w-20 rounded-full" />
                  </div>
                </SkeletonCard>
              ))}
            </div>
          ) : (
            <TableSkeleton columns={7} rows={6} />
          )
        ) : view === 'grid' ? (
          items.length ? (
            <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
              {items.map((item) => (
                <WorklistCard key={item.wl_id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState
              action={
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSearch('')
                    setPriority('all')
                    setStatus('all')
                    setQuickFilter(null)
                  }}
                  type="button"
                >
                  Clear Filters
                </button>
              }
              description="No tasks matched the current search, status, priority, and quick-filter combination."
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
                  <Link className="font-medium text-iris-text-primary hover:text-iris-blue" to={`/worklist/${row.wl_id}`}>
                    {String(value)}
                  </Link>
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
              { key: 'cedent_id', label: 'Cedant' },
              { key: 'elapsed_display', label: 'Due' },
              { key: 'assigned_role', label: 'Assigned' },
            ]}
            data={items}
            emptyDescription="No tasks matched the current search, status, priority, and quick-filter combination."
            emptyMessage="No tasks match your filters"
          />
        )}
      </div>
    </div>
  )
}
