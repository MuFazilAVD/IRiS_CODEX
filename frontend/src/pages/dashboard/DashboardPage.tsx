import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Bot, Cog, ShieldAlert, UserRound, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../../api/client'
import { BarChart } from '../../components/charts/BarChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { LineChart } from '../../components/charts/LineChart'
import { IRiSInsightBanner } from '../../components/common/IRiSInsightBanner'
import { KPICard } from '../../components/common/KPICard'
import { PageHeader } from '../../components/common/PageHeader'
import { KpiGridSkeleton, Skeleton, SkeletonCard } from '../../components/common/Skeleton'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import type {
  AppRole,
  DashboardRecentActivitiesPayload,
  DashboardRecentActivitiesTabKey,
  DashboardPayload,
  DashboardSupplementaryPanel,
  GraphConfig,
  GraphPayload,
} from '../../types/api'

const secondRowLayoutByRole = {
  admin: { className: 'xl:grid-cols-[1.2fr_1fr]', skeletonCount: 2 },
  underwriter: { className: 'xl:grid-cols-3', skeletonCount: 3 },
  claims_ops: { className: 'xl:grid-cols-[1.2fr_1fr]', skeletonCount: 2 },
  compliance: { className: 'xl:grid-cols-[1.2fr_1fr]', skeletonCount: 2 },
} satisfies Record<Exclude<AppRole, 'super_admin'>, { className: string; skeletonCount: number }>

export function DashboardPage() {
  const navigate = useNavigate()
  const { effectiveRole } = useAuth()

  const kpisQuery = useQuery({
    queryKey: ['dashboard-kpis', effectiveRole],
    queryFn: async () => (await api.get<DashboardPayload>('/dashboard/kpis')).data,
    refetchInterval: 60_000,
    enabled: Boolean(effectiveRole),
  })

  const graphsQuery = useQuery({
    queryKey: ['dashboard-graphs', effectiveRole],
    queryFn: async () => (await api.get<GraphPayload>('/dashboard/graphs')).data,
    enabled: Boolean(effectiveRole),
  })

  const activitiesQuery = useQuery({
    queryKey: ['dashboard-activities', effectiveRole],
    queryFn: async () => (await api.get<DashboardRecentActivitiesPayload>('/dashboard/recent-activities')).data,
    enabled: Boolean(effectiveRole),
  })

  const graphs = graphsQuery.data?.graphs ?? []
  const supplementaryPanels = kpisQuery.data?.supplementary_panels ?? []
  const primaryGraphs = graphs.slice(0, 3)
  const secondaryVisuals = [
    ...graphs.slice(3).map((graph) => ({ kind: 'graph' as const, id: graph.id, graph })),
    ...supplementaryPanels.map((panel) => ({ kind: 'panel' as const, id: panel.id, panel })),
  ]
  const secondRowConfig = effectiveRole && effectiveRole in secondRowLayoutByRole ? secondRowLayoutByRole[effectiveRole as Exclude<AppRole, 'super_admin'>] : null
  const visualsLoading = graphsQuery.isLoading || kpisQuery.isLoading
  const lastRefreshed = useMemo(() => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), [kpisQuery.dataUpdatedAt])

  const headerActions = (
    <>
      {kpisQuery.data?.quick_actions?.map((action) => (
        <button
          key={action.label}
          className={action.variant === 'primary' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => {
            if (action.action.startsWith('navigate:')) {
              navigate(action.action.replace('navigate:', ''))
            }
          }}
          type="button"
        >
          {action.label}
        </button>
      ))}
    </>
  )

  return (
    <div>
      <PageHeader
        title={kpisQuery.data?.title ?? 'Dashboard'}
        subtitle={kpisQuery.data?.subtitle ?? 'Loading role dashboard...'}
        action={headerActions}
        actionPlacement="below"
      />

      {kpisQuery.data?.insight ? <IRiSInsightBanner message={kpisQuery.data.insight} /> : null}

      <div className="mb-2 flex justify-end text-[11px] text-iris-text-muted">Last refreshed {lastRefreshed}</div>

      {kpisQuery.isLoading ? (
        <KpiGridSkeleton count={14} density="compact" />
      ) : (
        <div className="dashboard-kpi-grid">
          {kpisQuery.data?.kpis?.map((kpi) => (
            <KPICard key={kpi.label} {...kpi} density="compact" />
          ))}
        </div>
      )}

      {visualsLoading ? (
        <>
          <DashboardVisualSkeletonRow className="mt-6 grid gap-4 xl:grid-cols-3" count={3} />
          {secondRowConfig ? <DashboardVisualSkeletonRow className={`mt-4 grid gap-4 ${secondRowConfig.className}`} count={secondRowConfig.skeletonCount} /> : null}
        </>
      ) : (
        <>
          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            {primaryGraphs.map((graph) => (
              <GraphPanel key={graph.id} graph={graph} />
            ))}
          </div>
          {secondaryVisuals.length ? (
            <div className={`mt-4 grid gap-4 ${secondRowConfig?.className ?? 'xl:grid-cols-3'}`}>
              {secondaryVisuals.map((visual) =>
                visual.kind === 'graph' ? (
                  <GraphPanel key={visual.id} graph={visual.graph} />
                ) : (
                  <DashboardSupplementaryPanelCard key={visual.id} panel={visual.panel} onNavigate={navigate} />
                ),
              )}
            </div>
          ) : null}
        </>
      )}

      <DashboardRecentActivitiesPanel loading={activitiesQuery.isLoading} payload={activitiesQuery.data ?? null} onNavigate={navigate} />
    </div>
  )
}

function DashboardVisualSkeletonRow({ className, count }: { className: string; count: number }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index}>
          <Skeleton className="h-4 w-40 rounded-full" />
          <Skeleton className="mt-2 h-3 w-28 rounded-full" />
          <Skeleton className="mt-5 h-60 rounded-xl" />
        </SkeletonCard>
      ))}
    </div>
  )
}

function GraphPanel({ graph }: { graph: GraphConfig }) {
  if (graph.type === 'donut') {
    return <DonutChart graph={graph} />
  }

  if (graph.type === 'line' || graph.type === 'area') {
    return <LineChart graph={graph} />
  }

  return <BarChart graph={graph} />
}

function DashboardSupplementaryPanelCard({
  panel,
  onNavigate,
}: {
  panel: DashboardSupplementaryPanel
  onNavigate: (path: string) => void
}) {
  if (panel.variant === 'status_grid') {
    return <DashboardStatusGridPanel panel={panel} />
  }

  if (panel.variant === 'heatmap') {
    return <DashboardHeatmapPanel panel={panel} />
  }

  return <DashboardListPanel panel={panel} onNavigate={onNavigate} />
}

function DashboardListPanel({
  panel,
  onNavigate,
}: {
  panel: DashboardSupplementaryPanel
  onNavigate: (path: string) => void
}) {
  const items = panel.items ?? []

  return (
    <section className="panel-card">
      <DashboardSupplementaryHeader panel={panel} onNavigate={onNavigate} />
      <div className="divide-y divide-iris-border">
        {items.map((item) => (
          <article key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-5 text-iris-text-primary">{item.title}</p>
              {item.description ? <p className="mt-1 text-[12px] leading-5 text-iris-text-secondary">{item.description}</p> : null}
            </div>
            {item.badge ? <StatusBadge status={normalizeBadgeStatus(item.badge)}>{item.badge}</StatusBadge> : null}
            {!item.badge && item.metric ? (
              <span className={`shrink-0 text-[12px] font-semibold ${item.metric_tone === 'negative' ? 'text-iris-red' : 'text-iris-blue'}`}>{item.metric}</span>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function DashboardStatusGridPanel({ panel }: { panel: DashboardSupplementaryPanel }) {
  const items = panel.items ?? []

  return (
    <section className="panel-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-iris-text-primary">{panel.title}</h3>
        {panel.meta_text ? <span className="text-[11px] text-iris-text-secondary">{panel.meta_text}</span> : null}
      </div>
      <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 border-b border-[#EEF2F5] pb-3 last:border-b-0 last:pb-0 md:last:border-b md:last:pb-3">
            <p className="text-[13px] leading-5 text-iris-text-primary">{item.title}</p>
            {item.badge ? <StatusBadge status={normalizeBadgeStatus(item.badge)}>{item.badge}</StatusBadge> : null}
          </div>
        ))}
      </div>
    </section>
  )
}

function DashboardHeatmapPanel({ panel }: { panel: DashboardSupplementaryPanel }) {
  const rows = panel.heatmap_rows ?? []

  return (
    <section className="panel-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-iris-text-primary">{panel.title}</h3>
        {panel.meta_text ? <span className="text-[11px] text-iris-text-secondary">{panel.meta_text}</span> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[13px]">
          <thead className="bg-[#F8F9FA]">
            <tr>
              {['Area', 'Low', 'Medium', 'High'].map((label) => (
                <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.area} className="border-t border-[#EEF2F5]">
                <td className="px-4 py-3 font-medium text-iris-text-primary">{row.area}</td>
                <DashboardHeatCell tone="low" value={row.low} />
                <DashboardHeatCell tone="medium" value={row.medium} />
                <DashboardHeatCell tone="high" value={row.high} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function DashboardSupplementaryHeader({
  panel,
  onNavigate,
}: {
  panel: DashboardSupplementaryPanel
  onNavigate: (path: string) => void
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <h3 className="text-sm font-semibold text-iris-text-primary">{panel.title}</h3>
      {panel.action_label && panel.action ? (
        <button
          className="text-[11px] font-semibold text-iris-blue"
          onClick={() => {
            if (panel.action?.startsWith('navigate:')) {
              onNavigate(panel.action.replace('navigate:', ''))
            }
          }}
          type="button"
        >
          {panel.action_label}
        </button>
      ) : panel.meta_text ? (
        <span className="text-[11px] text-iris-text-secondary">{panel.meta_text}</span>
      ) : null}
    </div>
  )
}

function DashboardHeatCell({ tone, value }: { tone: 'low' | 'medium' | 'high'; value: number }) {
  if (value === 0) {
    return <td className="px-4 py-3 text-center text-[12px] text-iris-text-muted">-</td>
  }

  const toneClass = tone === 'low' ? 'bg-[#EBF7FD] text-[#3498DB]' : tone === 'medium' ? 'bg-[#FEF5E7] text-[#AF601A]' : 'bg-[#FDEDEC] text-[#E74C3C]'
  return (
    <td className="px-4 py-3">
      <div className={`inline-flex min-w-[30px] justify-center rounded-md px-2 py-1 text-[12px] font-semibold ${toneClass}`}>{value}</div>
    </td>
  )
}

function DashboardRecentActivitiesPanel({
  payload,
  loading,
  onNavigate,
}: {
  payload: DashboardRecentActivitiesPayload | null
  loading: boolean
  onNavigate: (path: string) => void
}) {
  const [activeTab, setActiveTab] = useState<DashboardRecentActivitiesTabKey>('team_activities')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'FYA' | 'FYI'>('all')
  const [processFilter, setProcessFilter] = useState('all')
  const [peopleFilter, setPeopleFilter] = useState('all')

  useEffect(() => {
    setActiveTab(payload?.default_tab ?? 'team_activities')
    setPriorityFilter('all')
    setProcessFilter('all')
    setPeopleFilter('all')
  }, [payload?.default_tab, payload?.role])

  const items = payload?.items ?? []
  const tabCounts = useMemo(
    () => ({
      team_activities: items.filter((item) => item.tab === 'team_activities').length,
      iris_ai: items.filter((item) => item.tab === 'iris_ai').length,
      escalations: items.filter((item) => item.tab === 'escalations').length,
    }),
    [items],
  )

  const processOptions = useMemo(() => ['all', ...Array.from(new Set(items.map((item) => item.module.toLowerCase()))).sort()], [items])
  const peopleOptions = useMemo(() => ['all', ...Array.from(new Set(items.map((item) => item.actor_label.toLowerCase()))).sort()], [items])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (item.tab !== activeTab) {
        return false
      }
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
        return false
      }
      if (processFilter !== 'all' && item.module.toLowerCase() !== processFilter) {
        return false
      }
      if (peopleFilter !== 'all' && item.actor_label.toLowerCase() !== peopleFilter) {
        return false
      }
      return true
    })
  }, [activeTab, items, peopleFilter, priorityFilter, processFilter])

  const tabs: Array<{ key: DashboardRecentActivitiesTabKey; label: string; count: number; icon: typeof Users }> = [
    { key: 'team_activities', label: 'Team Activities', count: tabCounts.team_activities, icon: Users },
    { key: 'iris_ai', label: 'IRiS AI', count: tabCounts.iris_ai, icon: Bot },
    { key: 'escalations', label: 'Escalations', count: tabCounts.escalations, icon: ShieldAlert },
  ]

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-iris-border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#E8EDF2] px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold text-iris-text-primary">Recent Activities</h2>
          <span className="text-[11px] text-iris-text-secondary">{payload?.window_label ?? 'Last 24h'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = tab.key === activeTab
            return (
              <button
                key={tab.key}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-medium transition ${
                  active
                    ? 'border-iris-navy bg-iris-navy text-white'
                    : 'border-iris-border bg-white text-iris-text-primary hover:bg-iris-bg'
                }`}
                onClick={() => setActiveTab(tab.key)}
                type="button"
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label} ({tab.count})
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-b border-[#E8EDF2] px-4 py-3">
        <div className="flex min-w-0 flex-nowrap items-center gap-2.5 overflow-x-auto pr-2">
          <span className="shrink-0 text-[12px] text-iris-text-secondary">Filter:</span>
          <div className="flex shrink-0 items-center gap-2">
            {(['all', 'FYA', 'FYI'] as const).map((value) => {
              const active = priorityFilter === value
              return (
                <button
                  key={value}
                  className={`rounded px-3 py-1.5 text-[12px] font-medium transition ${
                    active
                      ? 'bg-iris-navy text-white'
                      : 'border border-iris-border bg-white text-iris-text-primary hover:bg-iris-bg'
                  }`}
                  onClick={() => setPriorityFilter(value)}
                  type="button"
                >
                  {value === 'all' ? 'All' : value}
                </button>
              )
            })}
          </div>
          <select className="field-input w-[116px] shrink-0" value={processFilter} onChange={(event) => setProcessFilter(event.target.value)}>
            <option value="all">All processes</option>
            {processOptions
              .filter((option) => option !== 'all')
              .map((option) => (
                <option key={option} value={option}>
                  {formatFilterLabel(option)}
                </option>
              ))}
          </select>
          <select className="field-input w-[116px] shrink-0" value={peopleFilter} onChange={(event) => setPeopleFilter(event.target.value)}>
            <option value="all">All people</option>
            {peopleOptions
              .filter((option) => option !== 'all')
              .map((option) => (
                <option key={option} value={option}>
                  {formatFilterLabel(option)}
                </option>
              ))}
          </select>
        </div>
        <span className="shrink-0 text-[12px] text-iris-text-secondary">{filteredItems.length} shown</span>
      </div>

      {loading ? (
        <RecentActivitiesSkeleton />
      ) : (
        <div className="max-h-[520px] overflow-y-auto">
          {filteredItems.map((item) => (
            <RecentActivityRow key={item.id} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </section>
  )
}

function RecentActivitiesSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="border-b border-[#E8EDF2] px-4 py-4 last:border-b-0">
          <div className="mb-2 flex gap-2">
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-6 w-20 rounded-md" />
            <Skeleton className="h-6 w-10 rounded-md" />
          </div>
          <Skeleton className="h-5 w-[68%] rounded-full" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Skeleton className="h-3 w-28 rounded-full" />
            <Skeleton className="h-3 w-36 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

function RecentActivityRow({
  item,
  onNavigate,
}: {
  item: DashboardRecentActivitiesPayload['items'][number]
  onNavigate: (path: string) => void
}) {
  const handleOpen = () => {
    if (item.action?.startsWith('navigate:')) {
      onNavigate(item.action.replace('navigate:', ''))
    }
  }

  return (
    <article className="relative border-b border-[#E8EDF2] px-4 py-4 last:border-b-0">
      <button
        aria-label={`Open ${item.title}`}
        className="absolute right-4 top-4 text-iris-text-secondary transition hover:text-iris-blue"
        onClick={handleOpen}
        type="button"
      >
        <ArrowUpRight className="h-4 w-4" />
      </button>

      <div className="mb-2 flex flex-wrap items-center gap-2 pr-8">
        <RecentActivityActorBadge kind={item.actor_kind} label={item.actor_label} />
        <RecentActivityModuleBadge module={item.module} />
        <RecentActivityPriorityBadge priority={item.priority} />
      </div>

      <h3 className="pr-8 text-[14px] leading-6 text-iris-text-primary">{item.title}</h3>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-iris-text-secondary">
        <span className="font-mono">{item.timestamp_label}</span>
        {item.meta_segments.map((segment) => (
          <span key={segment} className="font-mono">
            · {segment}
          </span>
        ))}
        {item.emphasis_chip ? <RecentActivityInfoChip chip={item.emphasis_chip} /> : null}
        {item.metric_chip ? <RecentActivityInfoChip chip={item.metric_chip} /> : null}
        {item.worklist_ref ? (
          <button
            className="inline-flex items-center gap-1 rounded-md border border-[#A8BED0] bg-[#EEF5FB] px-2.5 py-1 font-mono text-[11px] text-[#11364D] transition hover:bg-[#E1EEF8]"
            onClick={handleOpen}
            type="button"
          >
            <ArrowUpRight className="h-3 w-3" />
            {item.worklist_ref}
          </button>
        ) : null}
      </div>
    </article>
  )
}

function RecentActivityActorBadge({ kind, label }: { kind: 'person' | 'system' | 'iris'; label: string }) {
  const icon =
    kind === 'person' ? <UserRound className="h-3 w-3" /> : kind === 'system' ? <Cog className="h-3 w-3" /> : <Bot className="h-3 w-3" />
  const className =
    kind === 'person'
      ? 'bg-[#EBF7EF] text-[#1E8449]'
      : kind === 'system'
        ? 'bg-[#F2F3F4] text-[#5D6D7E]'
        : 'bg-[#EEF4FB] text-[#1A5276]'

  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${className}`}>
      {icon}
      {label}
    </span>
  )
}

function RecentActivityModuleBadge({ module }: { module: string }) {
  const className = getRecentActivityModuleClass(module)
  return <span className={`inline-flex rounded px-2 py-1 text-[11px] font-medium ${className}`}>{module}</span>
}

function RecentActivityPriorityBadge({ priority }: { priority: 'FYA' | 'FYI' }) {
  const className =
    priority === 'FYA'
      ? 'border border-[#F5B7B1] bg-[#FFF5F5] text-[#C0392B]'
      : 'border border-[#D6DBDF] bg-white text-[#6C7A89]'

  return <span className={`inline-flex rounded px-2 py-1 text-[11px] font-medium ${className}`}>{priority}</span>
}

function RecentActivityInfoChip({
  chip,
}: {
  chip: NonNullable<DashboardRecentActivitiesPayload['items'][number]['emphasis_chip']>
}) {
  const className =
    chip.tone === 'negative'
      ? 'bg-[#FFF1F1] text-[#C0392B]'
      : chip.tone === 'warning'
        ? 'bg-[#FEF5E7] text-[#AF601A]'
        : chip.tone === 'positive'
          ? 'bg-[#EAF7EF] text-[#1E8449]'
          : chip.tone === 'info'
            ? 'bg-[#EEF5FB] text-[#1A5276]'
            : 'bg-[#F4F6F8] text-[#5D6D7E]'

  return <span className={`inline-flex rounded px-2 py-1 text-[11px] ${className}`}>{chip.label}</span>
}

function getRecentActivityModuleClass(module: string) {
  const normalized = module.toLowerCase()
  if (normalized === 'compliance') {
    return 'bg-[#F4ECFF] text-[#7D3C98]'
  }
  if (normalized === 'underwriting') {
    return 'bg-[#EEF5FB] text-[#3498DB]'
  }
  if (normalized === 'cession') {
    return 'bg-[#F5F9FC] text-[#11364D]'
  }
  if (normalized === 'settlement') {
    return 'bg-[#EBF7EF] text-[#1E8449]'
  }
  if (normalized === 'population') {
    return 'bg-[#FEF5E7] text-[#AF601A]'
  }
  if (normalized === 'calculation') {
    return 'bg-[#FEF9E7] text-[#9A7D0A]'
  }
  if (normalized === 'admin') {
    return 'bg-[#F2F3F4] text-[#626567]'
  }
  return 'bg-[#F5F9FC] text-[#11364D]'
}

function formatFilterLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function normalizeBadgeStatus(value: string) {
  return value.toLowerCase().replaceAll(' ', '_')
}
