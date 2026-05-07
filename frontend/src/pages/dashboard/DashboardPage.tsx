import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../../api/client'
import { BarChart } from '../../components/charts/BarChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { LineChart } from '../../components/charts/LineChart'
import { IRiSInsightBanner } from '../../components/common/IRiSInsightBanner'
import { KPICard } from '../../components/common/KPICard'
import { PageHeader } from '../../components/common/PageHeader'
import { KpiGridSkeleton, Skeleton, SkeletonCard, SkeletonText } from '../../components/common/Skeleton'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import type {
  ActivitiesPayload,
  DashboardPayload,
  DashboardSupplementaryPanel,
  GraphConfig,
  GraphPayload,
  IntelligencePayload,
} from '../../types/api'
import { formatRelativeDate } from '../../utils/formatters'

export function DashboardPage() {
  const navigate = useNavigate()
  const { effectiveRole } = useAuth()

  const kpisQuery = useQuery({
    queryKey: ['dashboard-kpis', effectiveRole],
    queryFn: async () => (await api.get<DashboardPayload>('/dashboard/kpis')).data,
    refetchInterval: 60_000,
    enabled: Boolean(effectiveRole),
  })

  const intelligenceQuery = useQuery({
    queryKey: ['dashboard-intelligence', effectiveRole],
    queryFn: async () => (await api.get<IntelligencePayload>('/dashboard/intelligence')).data,
    enabled: Boolean(effectiveRole),
  })

  const graphsQuery = useQuery({
    queryKey: ['dashboard-graphs', effectiveRole],
    queryFn: async () => (await api.get<GraphPayload>('/dashboard/graphs')).data,
    enabled: Boolean(effectiveRole),
  })

  const activitiesQuery = useQuery({
    queryKey: ['dashboard-activities'],
    queryFn: async () => (await api.get<ActivitiesPayload>('/dashboard/recent-activities')).data,
    enabled: effectiveRole === 'admin',
  })

  const graphs = graphsQuery.data?.graphs ?? []
  const supplementaryPanels = kpisQuery.data?.supplementary_panels ?? []
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
        eyebrow="Operational Command Center"
      />

      {kpisQuery.data?.insight ? <IRiSInsightBanner message={kpisQuery.data.insight} /> : null}

      <div className="mb-2 flex justify-end text-[11px] text-iris-text-muted">Last refreshed {lastRefreshed}</div>

      {kpisQuery.isLoading ? (
        <KpiGridSkeleton count={14} />
      ) : (
        <div className="compact-kpi-grid">
          {kpisQuery.data?.kpis?.map((kpi) => <KPICard key={kpi.label} {...kpi} />)}
        </div>
      )}

      {graphsQuery.isLoading ? (
        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={index}>
              <Skeleton className="h-4 w-40 rounded-full" />
              <Skeleton className="mt-2 h-3 w-28 rounded-full" />
              <Skeleton className="mt-5 h-60 rounded-xl" />
            </SkeletonCard>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {graphs.map((graph) => (
            <GraphPanel key={graph.id} graph={graph} />
          ))}
          {supplementaryPanels.map((panel) => (
            <SupplementaryPanelCard key={panel.id} panel={panel} onNavigate={navigate} />
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="panel-card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-iris-text-primary">Today's Intelligence</h2>
              <p className="text-[11px] text-iris-text-secondary">Role-filtered IRiS feed cards</p>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {intelligenceQuery.isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonCard key={index} className="rounded-lg">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-3 w-14 rounded-full" />
                    </div>
                    <SkeletonText lines={3} widths={['92%', '88%', '64%']} />
                    <div className="mt-4 flex items-center justify-between">
                      <Skeleton className="h-3 w-28 rounded-full" />
                      <Skeleton className="h-3 w-16 rounded-full" />
                    </div>
                  </SkeletonCard>
                ))
              : intelligenceQuery.data?.items?.map((item) => (
                  <article key={item.id} className="rounded-lg border border-iris-border bg-iris-surface p-3.5">
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                      <StatusBadge status={item.priority.toLowerCase()}>{item.priority}</StatusBadge>
                      <span className="text-[11px] text-iris-text-muted">{item.sla}</span>
                    </div>
                    <h3 className="text-[13px] font-semibold leading-5 text-iris-text-primary">{item.message}</h3>
                    <p className="mt-1.5 text-[11px] leading-4 text-iris-text-secondary">{item.impact}</p>
                    <div className="mt-3 flex items-center justify-between text-[11px]">
                      <span className="text-iris-text-muted">
                        {item.cedant} - {item.contract_id}
                      </span>
                      <button
                        className="font-semibold text-iris-blue"
                        onClick={() => navigate(item.action.replace('navigate:', ''))}
                        type="button"
                      >
                        {item.action_label}
                      </button>
                    </div>
                  </article>
                ))}
          </div>
        </section>

        {effectiveRole === 'admin' ? (
          <section className="panel-card">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-iris-text-primary">Recent Activities</h2>
              <p className="text-[11px] text-iris-text-secondary">Admin feed across team, AI, and escalations</p>
            </div>
            <div className="space-y-3">
              {activitiesQuery.isLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="border-b border-iris-border pb-3 last:border-b-0 last:pb-0">
                      <div className="mb-2 flex gap-2">
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-5 w-14 rounded-full" />
                      </div>
                      <SkeletonText lines={2} widths={['88%', '46%']} />
                    </div>
                  ))
                : activitiesQuery.data?.items?.map((item) => (
                    <article key={item.id} className="border-b border-iris-border pb-3 last:border-b-0 last:pb-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {item.tags.map((tag) => (
                          <StatusBadge key={tag} status={tag.toLowerCase()}>
                            {tag}
                          </StatusBadge>
                        ))}
                      </div>
                      <h3 className="text-[13px] font-semibold leading-5 text-iris-text-primary">{item.title}</h3>
                      <p className="mt-1 text-[11px] text-iris-text-secondary">
                        {item.actor ? `${item.actor} - ` : ''}
                        {item.cedant ? `${item.cedant} - ` : ''}
                        {formatRelativeDate(item.timestamp)}
                      </p>
                    </article>
                  ))}
            </div>
          </section>
        ) : (
          <section className="panel-card">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-iris-text-primary">Role Notes</h2>
              <p className="text-[11px] text-iris-text-secondary">Shared supporting signals for the selected role</p>
            </div>
            <div className="space-y-3 text-[13px] text-iris-text-secondary">
              <p>The current dashboard is using mock KPI, graph, and intelligence JSON exactly as defined in the POC specs.</p>
              <p>Role-aware navigation and data switching are active, including `super_admin` role switching through the topbar.</p>
            </div>
          </section>
        )}
      </div>
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

function SupplementaryPanelCard({
  panel,
  onNavigate,
}: {
  panel: DashboardSupplementaryPanel
  onNavigate: (path: string) => void
}) {
  return (
    <section className="panel-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-iris-text-primary">{panel.title}</h3>
        <button
          className="text-[11px] font-semibold text-iris-blue"
          onClick={() => {
            if (panel.action.startsWith('navigate:')) {
              onNavigate(panel.action.replace('navigate:', ''))
            }
          }}
          type="button"
        >
          {panel.action_label}
        </button>
      </div>
      <div className="space-y-3">
        {panel.items.map((item) => (
          <article key={item.id} className="rounded-lg border border-iris-border bg-[#FAFBFC] px-3.5 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] font-semibold leading-5 text-iris-text-primary">{item.title}</p>
              {item.badge ? <StatusBadge status={item.badge.toLowerCase()}>{item.badge}</StatusBadge> : null}
              {!item.badge && item.metric ? <span className="text-[11px] font-semibold text-iris-blue">{item.metric}</span> : null}
            </div>
            <p className="mt-1.5 text-[12px] leading-5 text-iris-text-secondary">{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
