import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, ExternalLink, ShieldAlert, ShieldCheck } from 'lucide-react'

import { api } from '../../api/client'
import { BarChart } from '../../components/charts/BarChart'
import { LineChart } from '../../components/charts/LineChart'
import { Breadcrumbs } from '../../components/common/Breadcrumbs'
import { EmptyState } from '../../components/common/EmptyState'
import { IRiSInsightBanner } from '../../components/common/IRiSInsightBanner'
import { KPICard } from '../../components/common/KPICard'
import { PageHeader } from '../../components/common/PageHeader'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useUiStore } from '../../store/uiStore'
import type {
  ComplianceActiveHit,
  ComplianceActiveHitsPayload,
  ComplianceAuditRiskRow,
  ComplianceBulkScreeningJobResponse,
  ComplianceCedentScreeningPayload,
  ComplianceHitResolutionResponse,
  ComplianceSanctionsOverviewPayload,
  DashboardKpi,
  GraphConfig,
} from '../../types/api'

const KPI_META: Array<{
  key: keyof ComplianceSanctionsOverviewPayload['kpis']
  label: string
  subtitle: string
  trend: DashboardKpi['trend']
  trendValue: string
  borderColor: DashboardKpi['border_color']
}> = [
  { key: 'monthly_screening_pending', label: 'Monthly Screening Pending', subtitle: 'queued this month', trend: 'up', trendValue: '+4', borderColor: 'amber' },
  { key: 'ofac_matches', label: 'OFAC Matches', subtitle: 'watchlist hits', trend: 'up', trendValue: '+1', borderColor: 'red' },
  { key: 'fincen_matches', label: 'FinCEN Matches', subtitle: 'watchlist hits', trend: 'up', trendValue: '+1', borderColor: 'red' },
  { key: 'false_positives_pending', label: 'False Positives Pending', subtitle: 'awaiting analyst review', trend: 'neutral', trendValue: 'flat', borderColor: 'amber' },
  { key: 'overrides_awaiting_approval', label: 'Overrides Awaiting Approval', subtitle: 'manual sign-off queue', trend: 'up', trendValue: '+2', borderColor: 'amber' },
  { key: 'high_impact_changes', label: 'High Impact Changes', subtitle: 'workflow-sensitive changes', trend: 'up', trendValue: '+1', borderColor: 'blue' },
  { key: 'audit_exceptions_open', label: 'Audit Exceptions Open', subtitle: 'control breaks', trend: 'up', trendValue: '+3', borderColor: 'red' },
  { key: 'sensitive_export_alerts', label: 'Sensitive Export Alerts', subtitle: 'outbound controls', trend: 'neutral', trendValue: 'stable', borderColor: 'teal' },
  { key: 'access_violations', label: 'Access Violations', subtitle: 'permissions events', trend: 'down', trendValue: '-1', borderColor: 'amber' },
  { key: 'ref_data_changes', label: 'Ref Data Changes', subtitle: 'recent updates', trend: 'up', trendValue: '+5', borderColor: 'blue' },
  { key: 'compliance_holds_active', label: 'Compliance Holds Active', subtitle: 'blocking actions', trend: 'neutral', trendValue: 'flat', borderColor: 'red' },
  { key: 'escalated_tasks', label: 'Escalated Tasks', subtitle: 'requires owner attention', trend: 'up', trendValue: '+2', borderColor: 'amber' },
  { key: 'contracts_under_review', label: 'Contracts Under Review', subtitle: 'active investigations', trend: 'up', trendValue: '+1', borderColor: 'blue' },
  { key: 'screening_coverage_pct', label: 'Screening Coverage', subtitle: 'all active cedants', trend: 'up', trendValue: '+0.8%', borderColor: 'green' },
]

export function SanctionsPage() {
  const [selectedHitId, setSelectedHitId] = useState<string | null>(null)
  const [busyBulk, setBusyBulk] = useState(false)
  const [busyHitAction, setBusyHitAction] = useState<string | null>(null)
  const pushToast = useUiStore((state) => state.pushToast)

  const overviewQuery = useQuery({
    queryKey: ['compliance-sanctions-overview'],
    queryFn: async () => (await api.get<ComplianceSanctionsOverviewPayload>('/compliance/sanctions/overview')).data,
  })

  const hitsQuery = useQuery({
    queryKey: ['compliance-sanctions-hits'],
    queryFn: async () => (await api.get<ComplianceActiveHitsPayload>('/compliance/sanctions/hits')).data,
  })

  const activeHits = hitsQuery.data?.items ?? overviewQuery.data?.active_hits ?? []
  const selectedHit = useMemo(() => activeHits.find((item) => item.screening_ref === selectedHitId) ?? null, [activeHits, selectedHitId])

  const hitDetailQuery = useQuery({
    queryKey: ['compliance-sanctions-cedent', selectedHit?.cedent_id],
    queryFn: async () => (await api.get<ComplianceCedentScreeningPayload>(`/compliance/sanctions/cedents/${selectedHit?.cedent_id}`)).data,
    enabled: Boolean(selectedHit?.cedent_id),
  })

  const kpiCards = useMemo(() => {
    const kpis = overviewQuery.data?.kpis
    if (!kpis) {
      return []
    }
    return KPI_META.map((item) => ({
      label: item.label,
      value: item.key === 'screening_coverage_pct' ? `${kpis[item.key]}%` : formatCount(kpis[item.key]),
      trend: item.trend,
      trend_value: item.trendValue,
      subtitle: item.subtitle,
      border_color: item.borderColor,
    }))
  }, [overviewQuery.data?.kpis])

  const chartLookup = useMemo(() => {
    const map = new Map<string, GraphConfig>()
    ;(overviewQuery.data?.charts ?? []).forEach((graph) => {
      map.set(graph.id, graph)
    })
    return map
  }, [overviewQuery.data?.charts])

  async function handleTriggerScreening() {
    setBusyBulk(true)
    try {
      const { data } = await api.post<ComplianceBulkScreeningJobResponse>('/compliance/sanctions/bulk-screen', {
        sources: ['OFAC SDN', 'FinCEN 314(a)'],
        scope: 'all_active',
      })
      await Promise.all([overviewQuery.refetch(), hitsQuery.refetch()])
      pushToast({
        tone: 'success',
        message: `Bulk screening queued under ${data.job_id}. Estimated duration ${data.estimated_duration_seconds}s.`,
      })
    } catch (caughtError: unknown) {
      pushToast({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Bulk screening could not be triggered.',
      })
    } finally {
      setBusyBulk(false)
    }
  }

  async function handleResolveHit(action: 'clear' | 'escalate' | 'mark_false_positive', notes: string) {
    if (!selectedHit) {
      return
    }

    setBusyHitAction(action)
    try {
      const { data } = await api.patch<ComplianceHitResolutionResponse>(`/compliance/sanctions/hits/${selectedHit.screening_ref}`, {
        action,
        notes,
      })
      await Promise.all([overviewQuery.refetch(), hitsQuery.refetch()])
      setSelectedHitId(null)
      pushToast({
        tone: 'success',
        message: `${data.screening_ref} marked as ${data.status}.`,
      })
    } catch (caughtError: unknown) {
      pushToast({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to resolve this screening hit right now.',
      })
    } finally {
      setBusyHitAction(null)
    }
  }

  function handleExportReport() {
    if (!activeHits.length) {
      pushToast({ tone: 'error', message: 'No active screening hits are available in the current view.' })
      return
    }

    const lines = [
      ['Hit ID', 'Entity', 'Cedant', 'Member ID', 'Match Type', 'Source', 'Confidence', 'Matched On', 'Status'].join(','),
      ...activeHits.map((item) =>
        [
          escapeCsv(item.screening_ref),
          escapeCsv(item.entity),
          escapeCsv(item.cedent_name),
          escapeCsv(item.member_id ?? ''),
          escapeCsv(item.match_type),
          escapeCsv(item.source),
          escapeCsv(item.confidence.toFixed(2)),
          escapeCsv(item.matched_on),
          escapeCsv(item.status),
        ].join(','),
      ),
    ]
    downloadBlob(lines.join('\n'), 'sanctions-screening-report.csv', 'text/csv;charset=utf-8;')
    pushToast({ tone: 'success', message: 'Screening report exported from the current sanctions overview.' })
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Compliance & Audit' }, { label: 'Sanctions Screening' }]} />
      <PageHeader
        title={overviewQuery.data?.title ?? 'Sanctions Screening'}
        action={
          <>
            <button className="btn-secondary" disabled={busyBulk} onClick={handleExportReport} type="button">
              <Download className="h-4 w-4" />
              Export Screening Report
            </button>
            <button className="btn-primary" disabled={busyBulk} onClick={() => void handleTriggerScreening()} type="button">
              <ShieldCheck className="h-4 w-4" />
              {busyBulk ? 'Triggering...' : 'Trigger Bulk Screening'}
            </button>
          </>
        }
      />

      {overviewQuery.data?.insight ? <IRiSInsightBanner message={overviewQuery.data.insight} /> : null}

      <div className="compact-kpi-grid">
        {kpiCards.map((item) => (
          <KPICard key={item.label} {...item} />
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <GraphPanel graph={chartLookup.get('screening_status_by_cedant')} />
        <GraphPanel graph={chartLookup.get('override_trend')} />
        <GraphPanel graph={chartLookup.get('compliance_holds_summary')} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.95fr]">
        <AuditRiskHeatmap rows={overviewQuery.data?.audit_risk_heatmap ?? []} />
        <ActiveHitsPanel hits={activeHits} onOpen={(hitId) => setSelectedHitId(hitId)} />
      </div>

      {selectedHit ? (
        <HitDetailDrawer
          busyAction={busyHitAction}
          hit={selectedHit}
          loading={hitDetailQuery.isLoading}
          screeningDetail={hitDetailQuery.data ?? null}
          onClear={(notes) => void handleResolveHit('clear', notes)}
          onClose={() => setSelectedHitId(null)}
          onEscalate={(notes) => void handleResolveHit('escalate', notes)}
          onMarkFalsePositive={(notes) => void handleResolveHit('mark_false_positive', notes)}
        />
      ) : null}
    </div>
  )
}

function GraphPanel({ graph }: { graph: GraphConfig | undefined }) {
  if (!graph) {
    return <div className="panel-card text-[13px] text-iris-text-secondary">Chart configuration is not available in the current mock payload.</div>
  }

  if (graph.type === 'line') {
    return <LineChart graph={graph} />
  }

  return <BarChart graph={graph} />
}

function AuditRiskHeatmap({ rows }: { rows: ComplianceAuditRiskRow[] }) {
  return (
    <section className="panel-card">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-iris-text-primary">Audit Risk Heatmap</h2>
        <p className="text-[11px] text-iris-text-secondary">Control breaks across underwriting, claims, compliance and admin</p>
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
                <HeatCell tone="low" value={row.low} />
                <HeatCell tone="medium" value={row.medium} />
                <HeatCell tone="high" value={row.high} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function HeatCell({ tone, value }: { tone: 'low' | 'medium' | 'high'; value: number }) {
  const toneClass = tone === 'low' ? 'bg-[#EAF7EF] text-[#1E8449]' : tone === 'medium' ? 'bg-[#FEF5E7] text-[#AF601A]' : 'bg-[#FDEDEC] text-[#922B21]'
  return (
    <td className="px-4 py-3">
      <div className={`inline-flex min-w-[44px] justify-center rounded-md px-2.5 py-1.5 text-[12px] font-semibold ${toneClass}`}>{value}</div>
    </td>
  )
}

function ActiveHitsPanel({ hits, onOpen }: { hits: ComplianceActiveHit[]; onOpen: (hitId: string) => void }) {
  return (
    <section className="panel-card">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-iris-text-primary">Active Screening Hits</h2>
        <p className="text-[11px] text-iris-text-secondary">Open matches requiring human validation or sign-off</p>
      </div>
      <div className="space-y-3">
        {hits.length ? (
          hits.map((item) => (
            <article key={item.screening_ref} className="rounded-lg border border-iris-border bg-[#FBFCFD] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold text-iris-text-primary">{item.entity}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={normalizeHitStatus(item.status)}>{item.status}</StatusBadge>
                    <span className="text-[12px] text-iris-text-secondary">
                      {item.match_type} · conf {item.confidence.toFixed(2)}
                    </span>
                  </div>
                </div>
                <button className="inline-flex items-center gap-1 text-[12px] font-semibold text-iris-blue" onClick={() => onOpen(item.screening_ref)} type="button">
                  Open
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-3 text-[12px] text-iris-text-secondary">
                {item.cedent_name} · matched {item.matched_on}
              </p>
            </article>
          ))
        ) : (
          <EmptyState compact description="All active screening hits are cleared right now. New watchlist matches will appear here." title="No active hits are open" />
        )}
      </div>
    </section>
  )
}

function HitDetailDrawer({
  busyAction,
  hit,
  screeningDetail,
  loading,
  onClose,
  onMarkFalsePositive,
  onEscalate,
  onClear,
}: {
  busyAction: string | null
  hit: ComplianceActiveHit
  screeningDetail: ComplianceCedentScreeningPayload | null
  loading: boolean
  onClose: () => void
  onMarkFalsePositive: (notes: string) => void
  onEscalate: (notes: string) => void
  onClear: (notes: string) => void
}) {
  const [notes, setNotes] = useState('Reviewed by compliance analyst.')

  return (
    <div className="fixed inset-0 z-40 bg-[#0D1B2A]/25">
      <div className="absolute inset-y-0 right-0 flex w-full max-w-[720px] flex-col border-l border-iris-border bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#E8EDF2] px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">Screening Hit Detail</p>
            <h2 className="mt-2 text-[22px] font-bold text-iris-text-primary">
              {hit.screening_ref} · {hit.match_type}
            </h2>
            <p className="mt-1 text-[13px] text-iris-text-secondary">IRiS flagged this match for compliance review before downstream processing continues.</p>
          </div>
          <button className="btn-secondary" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section className="rounded-xl border border-iris-border bg-[#FBFCFD] p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <DetailField label="Entity" value={hit.entity} />
              <DetailField label="Cedant" value={hit.cedent_name} />
              <DetailField label="Member ID" value={hit.member_id ?? 'N/A'} />
              <DetailField label="Match Type" value={hit.match_type} />
              <DetailField label="Source" value={hit.source} />
              <DetailField label="Confidence" value={`${Math.round(hit.confidence * 100)}%`} />
              <DetailField label="Matched On" value={hit.matched_on} />
              <DetailField label="Status" value={hit.status} />
            </div>
          </section>

          <section className="rounded-xl border border-[#D6EAF8] bg-[#F5FBFF] p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-iris-blue" />
              <div>
                <p className="text-[13px] font-semibold text-iris-text-primary">IRiS Reasoning</p>
                <p className="mt-1 text-[13px] leading-6 text-iris-text-secondary">{hit.reasoning}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-iris-border bg-white p-4">
            <p className="text-[13px] font-semibold text-iris-text-primary">Resolution Notes</p>
            <p className="mt-1 text-[12px] text-iris-text-secondary">Add the rationale that should be captured with this compliance disposition.</p>
            <textarea
              className="mt-3 min-h-[112px] w-full rounded-xl border border-iris-border px-3 py-2 text-[13px] text-iris-text-primary outline-none transition focus:border-iris-blue"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </section>

          <section className="rounded-xl border border-iris-border bg-white p-4">
            <div className="mb-3">
              <p className="text-[13px] font-semibold text-iris-text-primary">Cedant Screening Context</p>
              <p className="text-[12px] text-iris-text-secondary">Existing cedant-level sanctions history from underwriting onboarding.</p>
            </div>
            {loading ? (
              <p className="text-[13px] text-iris-text-secondary">Loading cedant sanctions context...</p>
            ) : screeningDetail ? (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <StatusBadge status={screeningDetail.screening_status}>{screeningDetail.screening_status}</StatusBadge>
                  <span className="text-[12px] text-iris-text-secondary">
                    {screeningDetail.sanction_screening.total_scans} total scans · {screeningDetail.sanction_screening.open_hits} open hits
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {screeningDetail.sanction_screening.source_status.map((item) => (
                    <div key={item.source} className="rounded-lg border border-iris-border bg-[#FBFCFD] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold text-iris-text-primary">{item.source}</p>
                        <StatusBadge status={item.status}>{item.status}</StatusBadge>
                      </div>
                      <p className="mt-2 text-[12px] text-iris-text-secondary">
                        {item.reference} · last scan {item.last_scan}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[13px] text-iris-text-secondary">Cedant sanctions context is not available for this hit.</p>
            )}
          </section>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#E8EDF2] px-6 py-4">
          <button className="btn-secondary" disabled={busyAction !== null} onClick={() => onMarkFalsePositive(notes)} type="button">
            {busyAction === 'mark_false_positive' ? 'Saving...' : 'Mark as False Positive'}
          </button>
          <button className="btn-secondary" disabled={busyAction !== null} onClick={() => onEscalate(notes)} type="button">
            {busyAction === 'escalate' ? 'Saving...' : 'Escalate'}
          </button>
          <button className="btn-primary bg-[#1E8449] hover:bg-[#229954]" disabled={busyAction !== null} onClick={() => onClear(notes)} type="button">
            {busyAction === 'clear' ? 'Saving...' : 'Clear - Compliance Sign-off'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      <p className="mt-1.5 text-[13px] text-iris-text-primary">{value}</p>
    </div>
  )
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-GB').format(value)
}

function normalizeHitStatus(value: string) {
  return value.toLowerCase().replaceAll(' ', '_')
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.URL.revokeObjectURL(url)
}

function extractErrorMessage(caughtError: unknown) {
  const maybeMessage = caughtError as { response?: { data?: { details?: string; error?: string } } }
  return maybeMessage.response?.data?.details ?? maybeMessage.response?.data?.error ?? null
}
