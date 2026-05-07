import { useDeferredValue, useState, useTransition } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bot,
  CheckCircle2,
  Database,
  DollarSign,
  Download,
  FileText,
  LayoutDashboard,
  Lock,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { api } from '../../api/client'
import { Breadcrumbs } from '../../components/common/Breadcrumbs'
import { EmptyState } from '../../components/common/EmptyState'
import { KPICard } from '../../components/common/KPICard'
import { PageHeader } from '../../components/common/PageHeader'
import { KpiGridSkeleton, TableSkeleton } from '../../components/common/Skeleton'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useUiStore } from '../../store/uiStore'
import type {
  AuditAIDecisionPayload,
  AuditDashboardPayload,
  AuditEventItem,
  AuditEventListPayload,
  AuditExportReportsPayload,
  AuditManualOverride,
  AuditManualOverridesPayload,
  AuditSearchPayload,
  DashboardKpi,
} from '../../types/api'
import { formatCurrency } from '../../utils/formatters'

type AuditSectionId =
  | 'dashboard'
  | 'search'
  | 'financial_impact'
  | 'approvals'
  | 'ai_decisions'
  | 'manual_overrides'
  | 'reference_data'
  | 'access_logs'
  | 'document_history'
  | 'export_reports'

interface AuditNavItem {
  key: AuditSectionId
  label: string
  group: string
  icon: typeof LayoutDashboard
}

const NAV_ITEMS: AuditNavItem[] = [
  { key: 'dashboard', label: 'Audit Dashboard', group: 'Overview', icon: LayoutDashboard },
  { key: 'search', label: 'Audit Search', group: 'Overview', icon: Search },
  { key: 'financial_impact', label: 'Financial Impact Changes', group: 'Risk & Governance', icon: DollarSign },
  { key: 'approvals', label: 'Approval Audit', group: 'Risk & Governance', icon: CheckCircle2 },
  { key: 'ai_decisions', label: 'AI Decision Audit', group: 'Risk & Governance', icon: Bot },
  { key: 'manual_overrides', label: 'Manual Overrides', group: 'Risk & Governance', icon: ShieldAlert },
  { key: 'reference_data', label: 'Reference Data Audit', group: 'Data & Access', icon: Database },
  { key: 'access_logs', label: 'Access Logs', group: 'Data & Access', icon: Lock },
  { key: 'document_history', label: 'Document History', group: 'Data & Access', icon: FileText },
  { key: 'export_reports', label: 'Export Audit Reports', group: 'Reporting', icon: Download },
]

const DASHBOARD_KPI_META: Array<{
  key: keyof AuditDashboardPayload['kpis']
  label: string
  subtitle: string
  trend: DashboardKpi['trend']
  trendValue: string
  borderColor: DashboardKpi['border_color']
  valueFormatter?: (value: number) => string
}> = [
  {
    key: 'audit_events_today',
    label: 'Audit Events Today',
    subtitle: '23% vs 7d average',
    trend: 'up',
    trendValue: '+23%',
    borderColor: 'green',
  },
  {
    key: 'high_risk_changes',
    label: 'High-Risk Changes',
    subtitle: '2 critical changes open',
    trend: 'up',
    trendValue: '2 critical',
    borderColor: 'red',
  },
  {
    key: 'pending_approvals',
    label: 'Pending Approvals',
    subtitle: 'oldest pending is 3h',
    trend: 'neutral',
    trendValue: '3h oldest',
    borderColor: 'amber',
  },
  {
    key: 'manual_overrides',
    label: 'Manual Overrides',
    subtitle: 'awaiting review',
    trend: 'neutral',
    trendValue: '1 open',
    borderColor: 'amber',
  },
  {
    key: 'ai_decisions_pending_review',
    label: 'AI Decisions Pending Review',
    subtitle: 'confidence below 0.90',
    trend: 'up',
    trendValue: '1 flagged',
    borderColor: 'red',
  },
  {
    key: 'failed_screenings',
    label: 'Failed Screenings',
    subtitle: 'last 24 hours',
    trend: 'down',
    trendValue: '0',
    borderColor: 'green',
  },
  {
    key: 'high_financial_impact',
    label: 'High Financial Impact',
    subtitle: 'changes >= GBP 1M',
    trend: 'up',
    trendValue: '4 events',
    borderColor: 'amber',
  },
]

export function AuditPage() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState<AuditSectionId>('dashboard')
  const [searchText, setSearchText] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')
  const [approvalFilter, setApprovalFilter] = useState('all')
  const [impactFilter, setImpactFilter] = useState('any')
  const [riskFilter, setRiskFilter] = useState('all')
  const deferredSearchText = useDeferredValue(searchText)
  const [, startTransition] = useTransition()
  const pushToast = useUiStore((state) => state.pushToast)

  const dashboardQuery = useQuery({
    queryKey: ['audit-dashboard'],
    queryFn: async () => (await api.get<AuditDashboardPayload>('/audit/dashboard')).data,
  })

  const searchQuery = useQuery({
    queryKey: ['audit-search', deferredSearchText, moduleFilter, actorFilter, approvalFilter, impactFilter, riskFilter],
    queryFn: async () =>
      (
        await api.get<AuditSearchPayload>('/audit/search', {
          params: {
            q: deferredSearchText.trim() || undefined,
            module: moduleFilter,
            actor: actorFilter,
            approval: approvalFilter,
            impact: impactFilter,
            risk: riskFilter,
            page: 1,
            page_size: 100,
          },
        })
      ).data,
    enabled: activeSection === 'search',
  })

  const financialImpactQuery = useQuery({
    queryKey: ['audit-financial-impact'],
    queryFn: async () => (await api.get<AuditEventListPayload>('/audit/financial-impact')).data,
    enabled: activeSection === 'financial_impact',
  })

  const approvalsQuery = useQuery({
    queryKey: ['audit-approvals'],
    queryFn: async () => (await api.get<AuditEventListPayload>('/audit/approvals')).data,
    enabled: activeSection === 'approvals',
  })

  const aiDecisionsQuery = useQuery({
    queryKey: ['audit-ai-decisions'],
    queryFn: async () => (await api.get<AuditAIDecisionPayload>('/audit/ai-decisions')).data,
    enabled: activeSection === 'ai_decisions',
  })

  const manualOverridesQuery = useQuery({
    queryKey: ['audit-manual-overrides'],
    queryFn: async () => (await api.get<AuditManualOverridesPayload>('/audit/manual-overrides')).data,
    enabled: activeSection === 'manual_overrides',
  })

  const referenceDataQuery = useQuery({
    queryKey: ['audit-reference-data'],
    queryFn: async () => (await api.get<AuditEventListPayload>('/audit/reference-data')).data,
    enabled: activeSection === 'reference_data',
  })

  const accessLogsQuery = useQuery({
    queryKey: ['audit-access-logs'],
    queryFn: async () => (await api.get<AuditEventListPayload>('/audit/access-logs')).data,
    enabled: activeSection === 'access_logs',
  })

  const documentHistoryQuery = useQuery({
    queryKey: ['audit-document-history'],
    queryFn: async () => (await api.get<AuditEventListPayload>('/audit/document-history')).data,
    enabled: activeSection === 'document_history',
  })

  const exportReportsQuery = useQuery({
    queryKey: ['audit-export-reports'],
    queryFn: async () => (await api.get<AuditExportReportsPayload>('/audit/export-reports')).data,
    enabled: activeSection === 'export_reports',
  })

  async function handleDownloadCatalogReport(reportName: string, format: string) {
    try {
      const response = await api.get<Blob>('/audit/export-reports/download', {
        params: { report_name: reportName, format },
        responseType: 'blob',
      })
      const fallbackFilename = `${slugify(reportName)}.${format}`
      const disposition = response.headers['content-disposition']
      const filename = extractFilename(disposition) ?? fallbackFilename
      downloadBlob(response.data, filename)
      pushToast({ tone: 'success', message: `${reportName} downloaded as ${format.toUpperCase()}.` })
    } catch (caughtError: unknown) {
      pushToast({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Audit report download could not be completed.',
      })
    }
  }

  function handleLocalExport(filename: string, rows: Record<string, string | number | null | undefined>[]) {
    if (!rows.length) {
      pushToast({ tone: 'warning', message: 'There is no data available in the current view to export.' })
      return
    }
    downloadTextAsCsv(rows, filename)
    pushToast({ tone: 'success', message: `${filename} exported from the current audit view.` })
  }

  const activeNavItem = NAV_ITEMS.find((item) => item.key === activeSection) ?? NAV_ITEMS[0]

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Compliance & Audit' }, { label: 'Audit Management' }]} />
      <PageHeader
        title="Audit & Traceability"
        action={
          <button className="btn-secondary" onClick={() => navigate('/reports')} type="button">
            <Download className="h-4 w-4" />
            Reports
          </button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
        <AuditLeftNav activeSection={activeSection} onSelect={(nextSection) => startTransition(() => setActiveSection(nextSection))} />

        <section className="rounded-[24px] border border-iris-border bg-white shadow-sm">
          <div className="border-b border-[#EEF2F5] px-5 py-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">{activeNavItem.group}</p>
                <h2 className="mt-1 text-[22px] font-bold text-iris-text-primary">{activeNavItem.label}</h2>
                <p className="mt-1 text-[13px] text-iris-text-secondary">{describeSection(activeSection)}</p>
              </div>
            </div>
          </div>

          <div className="px-5 py-5">
            {activeSection === 'dashboard' ? (
              <AuditDashboardSection
                data={dashboardQuery.data}
                isLoading={dashboardQuery.isLoading}
                onExportHighImpact={() =>
                  handleLocalExport(
                    'audit-dashboard-high-impact.csv',
                    (dashboardQuery.data?.high_impact_changes ?? []).map((item) => mapEventToCsvRow(item)),
                  )
                }
              />
            ) : null}

            {activeSection === 'search' ? (
              <AuditSearchSection
                actorFilter={actorFilter}
                approvalFilter={approvalFilter}
                impactFilter={impactFilter}
                isLoading={searchQuery.isLoading}
                moduleFilter={moduleFilter}
                onActorFilterChange={setActorFilter}
                onApprovalFilterChange={setApprovalFilter}
                onExport={() =>
                  handleLocalExport('audit-search-results.csv', (searchQuery.data?.items ?? []).map((item) => mapEventToCsvRow(item)))
                }
                onImpactFilterChange={setImpactFilter}
                onModuleFilterChange={setModuleFilter}
                onRiskFilterChange={setRiskFilter}
                onSearchTextChange={setSearchText}
                results={searchQuery.data}
                riskFilter={riskFilter}
                searchText={searchText}
              />
            ) : null}

            {activeSection === 'financial_impact' ? (
              <AuditEventSection
                data={financialImpactQuery.data}
                emptyDescription="Financially material events will appear here once audit rows include signed impact values."
                emptyTitle="No financial impact changes are available"
                isLoading={financialImpactQuery.isLoading}
                showFinancialImpact
                title="Financial Impact Changes"
                onExport={() =>
                  handleLocalExport('audit-financial-impact.csv', (financialImpactQuery.data?.items ?? []).map((item) => mapEventToCsvRow(item)))
                }
              />
            ) : null}

            {activeSection === 'approvals' ? (
              <AuditEventSection
                data={approvalsQuery.data}
                emptyDescription="Approval-linked audit items will appear here once routed actions require a sign-off trail."
                emptyTitle="No approval audit events are available"
                isLoading={approvalsQuery.isLoading}
                showApproval
                title="Approval Audit"
                onExport={() => handleLocalExport('audit-approvals.csv', (approvalsQuery.data?.items ?? []).map((item) => mapEventToCsvRow(item)))}
              />
            ) : null}

            {activeSection === 'ai_decisions' ? (
              <AuditAiDecisionSection
                data={aiDecisionsQuery.data}
                isLoading={aiDecisionsQuery.isLoading}
                onExport={() =>
                  handleLocalExport(
                    'audit-ai-decisions.csv',
                    (aiDecisionsQuery.data?.decisions ?? []).map((item) => ({
                      module: item.module,
                      agent_name: `${item.agent_name} ${item.agent_version}`,
                      confidence: item.confidence,
                      timestamp: formatTimestamp(item.timestamp),
                      decision: item.decision,
                      prompt_summary: item.prompt_summary,
                      input_ref: item.input_ref,
                      human_review_required: item.human_review_required ? 'Yes' : 'No',
                    })),
                  )
                }
              />
            ) : null}

            {activeSection === 'manual_overrides' ? (
              <AuditManualOverridesSection
                data={manualOverridesQuery.data}
                isLoading={manualOverridesQuery.isLoading}
                onExport={() =>
                  handleLocalExport(
                    'audit-manual-overrides.csv',
                    (manualOverridesQuery.data?.overrides ?? []).map((item) => ({
                      override_ref: item.override_ref,
                      field_name: item.field_name,
                      original_value: item.original_value,
                      override_value: item.override_value,
                      approver_id: item.approver_id,
                      approver_title: item.approver_title,
                      approved_at: formatTimestamp(item.approved_at),
                      financial_impact: formatSignedCurrency(item.financial_impact_amount, item.financial_impact_currency),
                    })),
                  )
                }
              />
            ) : null}

            {activeSection === 'reference_data' ? (
              <AuditEventSection
                data={referenceDataQuery.data}
                emptyDescription="Reference data updates will appear here once market-data and assumption refreshes hit the audit trail."
                emptyTitle="No reference data audit events are available"
                isLoading={referenceDataQuery.isLoading}
                showChannel
                title="Reference Data Audit"
                onExport={() =>
                  handleLocalExport('audit-reference-data.csv', (referenceDataQuery.data?.items ?? []).map((item) => mapEventToCsvRow(item)))
                }
              />
            ) : null}

            {activeSection === 'access_logs' ? (
              <AuditEventSection
                data={accessLogsQuery.data}
                emptyDescription="Sensitive exports, permission changes, and failed logins will appear here."
                emptyTitle="No access events are available"
                isLoading={accessLogsQuery.isLoading}
                title="Access Logs"
                onExport={() =>
                  handleLocalExport('audit-access-logs.csv', (accessLogsQuery.data?.items ?? []).map((item) => mapEventToCsvRow(item)))
                }
              />
            ) : null}

            {activeSection === 'document_history' ? (
              <AuditEventSection
                data={documentHistoryQuery.data}
                emptyDescription="Document-linked approvals, uploads, and amendments will appear here."
                emptyTitle="No document history is available"
                isLoading={documentHistoryQuery.isLoading}
                title="Document History"
                onExport={() =>
                  handleLocalExport('audit-document-history.csv', (documentHistoryQuery.data?.items ?? []).map((item) => mapEventToCsvRow(item)))
                }
              />
            ) : null}

            {activeSection === 'export_reports' ? (
              <AuditExportReportsSection
                data={exportReportsQuery.data}
                isLoading={exportReportsQuery.isLoading}
                onDownload={(reportName, format) => void handleDownloadCatalogReport(reportName, format)}
              />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}

function AuditLeftNav({
  activeSection,
  onSelect,
}: {
  activeSection: AuditSectionId
  onSelect: (section: AuditSectionId) => void
}) {
  const groupedItems = NAV_ITEMS.reduce<Record<string, AuditNavItem[]>>((accumulator, item) => {
    accumulator[item.group] ??= []
    accumulator[item.group].push(item)
    return accumulator
  }, {})

  return (
    <aside className="rounded-[24px] border border-iris-border bg-white p-4 shadow-sm">
      {Object.entries(groupedItems).map(([group, items]) => (
        <div key={group} className="mb-5 last:mb-0">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">{group}</p>
          <div className="space-y-1.5">
            {items.map((item) => (
              <button
                key={item.key}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                  activeSection === item.key
                    ? 'border-iris-blue bg-[#F4F9FC] text-iris-text-primary'
                    : 'border-transparent text-iris-text-secondary hover:border-iris-border hover:bg-[#FBFCFD] hover:text-iris-text-primary'
                }`}
                onClick={() => onSelect(item.key)}
                type="button"
              >
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                    activeSection === item.key ? 'bg-iris-blue text-white' : 'bg-[#EEF4F8] text-iris-blue'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-semibold">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </aside>
  )
}

function AuditDashboardSection({
  data,
  isLoading,
  onExportHighImpact,
}: {
  data: AuditDashboardPayload | undefined
  isLoading: boolean
  onExportHighImpact: () => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-5">
        <KpiGridSkeleton count={7} />
        <div className="rounded-[22px] border border-iris-border bg-white p-4">
          <TableSkeleton columns={4} rows={6} />
        </div>
      </div>
    )
  }

  if (!data) {
    return <EmptyState description="The audit dashboard payload is not available right now." title="Audit dashboard is unavailable" />
  }

  return (
    <div className="space-y-5">
      <div className="compact-kpi-grid">
        {DASHBOARD_KPI_META.map((item) => (
          <KPICard
            key={item.label}
            border_color={item.borderColor}
            label={item.label}
            subtitle={item.subtitle}
            trend={item.trend}
            trend_value={item.trendValue}
            value={item.valueFormatter ? item.valueFormatter(data.kpis[item.key]) : formatCount(data.kpis[item.key])}
          />
        ))}
      </div>

      <section className="rounded-[22px] border border-iris-border bg-[#FBFCFD] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-bold text-iris-text-primary">Today · Audit Timeline</h3>
            <p className="mt-1 text-[12px] text-iris-text-secondary">Human, AI, system, financial, and access events across the latest mock business day.</p>
          </div>
        </div>
        <div className="space-y-4">
          {data.timeline.map((item) => (
            <article key={item.audit_id} className="grid gap-3 md:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center pt-1">
                <span className={`h-3 w-3 rounded-full ${timelineDotClass(item.module)}`} />
                <span className="mt-2 h-full min-h-[36px] w-px bg-[#D9E3EA]" />
              </div>
              <div className="rounded-xl border border-iris-border bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] text-iris-text-muted">{formatTimestamp(item.timestamp)}</span>
                  <ModuleBadge module={item.module} />
                  <ActorBadge actorType={item.actor_type} actorId={item.actor_id} compact />
                  <span className="text-[13px] font-semibold text-iris-text-primary">{item.event_type}</span>
                  {item.is_high_impact && item.financial_impact_amount !== null ? (
                    <span className="rounded-full bg-[#FEF5E7] px-2.5 py-1 text-[11px] font-semibold text-[#AF601A]">
                      High Impact · {formatCurrencyCompact(item.financial_impact_amount, item.financial_impact_currency ?? 'GBP')}
                    </span>
                  ) : null}
                  {item.approval_status !== 'n/a' ? <StatusBadge status={item.approval_status}>{titleCase(item.approval_status)}</StatusBadge> : null}
                </div>
                <p className="mt-2 text-[13px] leading-6 text-iris-text-secondary">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[22px] border border-iris-border bg-white p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-bold text-iris-text-primary">High-Impact Financial Changes</h3>
              <p className="mt-1 text-[12px] text-iris-text-secondary">Material contract, settlement, and reference-data changes.</p>
            </div>
            <button className="btn-secondary" onClick={onExportHighImpact} type="button">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
          <div className="space-y-3">
            {data.high_impact_changes.map((item) => (
              <div key={item.audit_id} className="rounded-xl border border-iris-border bg-[#FBFCFD] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-iris-text-primary">{item.event_type}</p>
                    <p className="mt-1 text-[12px] text-iris-text-secondary">
                      {item.entity_id} · {item.module === 'contract' ? 'Contract' : titleCase(item.module.replaceAll('_', ' '))}
                    </p>
                  </div>
                  <span className="text-[13px] font-bold text-[#AF601A]">
                    {formatCurrencyCompact(item.financial_impact_amount ?? 0, item.financial_impact_currency ?? 'GBP')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[22px] border border-iris-border bg-white p-4">
          <div className="mb-4">
            <h3 className="text-[16px] font-bold text-iris-text-primary">AI Decisions Awaiting Human Review</h3>
            <p className="mt-1 text-[12px] text-iris-text-secondary">Explainability trace for decisions below the confidence floor.</p>
          </div>
          {data.ai_pending_review.length ? (
            <div className="space-y-3">
              {data.ai_pending_review.map((item) => (
                <div key={`${item.agent_name}-${item.timestamp}`} className="rounded-xl border border-iris-border bg-[#FBFCFD] p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-semibold text-iris-text-primary">
                        {item.agent_name} · {item.agent_version}
                      </p>
                      <p className="mt-1 text-[12px] text-iris-text-secondary">{item.decision}</p>
                    </div>
                    <span className="rounded-full bg-[#FDEDEC] px-2.5 py-1 text-[11px] font-semibold text-[#922B21]">conf {item.confidence.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState compact description="Low-confidence AI decisions will appear here when a human review is required." title="No AI review items are pending" />
          )}
        </section>
      </div>
    </div>
  )
}

function AuditSearchSection({
  actorFilter,
  approvalFilter,
  impactFilter,
  isLoading,
  moduleFilter,
  onActorFilterChange,
  onApprovalFilterChange,
  onExport,
  onImpactFilterChange,
  onModuleFilterChange,
  onRiskFilterChange,
  onSearchTextChange,
  results,
  riskFilter,
  searchText,
}: {
  actorFilter: string
  approvalFilter: string
  impactFilter: string
  isLoading: boolean
  moduleFilter: string
  onActorFilterChange: (value: string) => void
  onApprovalFilterChange: (value: string) => void
  onExport: () => void
  onImpactFilterChange: (value: string) => void
  onModuleFilterChange: (value: string) => void
  onRiskFilterChange: (value: string) => void
  onSearchTextChange: (value: string) => void
  results: AuditSearchPayload | undefined
  riskFilter: string
  searchText: string
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-[1.2fr_repeat(5,minmax(0,1fr))]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-iris-text-muted" />
          <input
            className="field-input pl-9"
            placeholder="Audit ID, entity, user, action..."
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
          />
        </label>

        <select className="field-input" value={moduleFilter} onChange={(event) => onModuleFilterChange(event.target.value)}>
          <option value="all">Module: all</option>
          <option value="settlement">Settlement</option>
          <option value="cession">Cession</option>
          <option value="calculation">Calculation</option>
          <option value="contract">Contract</option>
          <option value="compliance">Compliance</option>
          <option value="reference_data">Reference Data</option>
          <option value="access">Access</option>
          <option value="document">Document</option>
        </select>

        <select className="field-input" value={actorFilter} onChange={(event) => onActorFilterChange(event.target.value)}>
          <option value="all">Actor: all</option>
          <option value="human">Human</option>
          <option value="ai">AI</option>
          <option value="system">System</option>
        </select>

        <select className="field-input" value={approvalFilter} onChange={(event) => onApprovalFilterChange(event.target.value)}>
          <option value="all">Approval: all</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="n/a">N/A</option>
        </select>

        <select className="field-input" value={impactFilter} onChange={(event) => onImpactFilterChange(event.target.value)}>
          <option value="any">Impact: all</option>
          <option value="high">High impact</option>
        </select>

        <select className="field-input" value={riskFilter} onChange={(event) => onRiskFilterChange(event.target.value)}>
          <option value="all">Risk: all</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <AuditEventSection
        data={results}
        emptyDescription="Try clearing one or more filters to bring matching audit rows back into view."
        emptyTitle="No audit events matched the current search"
        isLoading={isLoading}
        title={`${results?.total ?? 0} matching events`}
        onExport={onExport}
      />
    </div>
  )
}

function AuditEventSection({
  data,
  emptyDescription,
  emptyTitle,
  isLoading,
  onExport,
  showApproval = false,
  showChannel = false,
  showFinancialImpact = false,
  title,
}: {
  data: AuditEventListPayload | AuditSearchPayload | undefined
  emptyDescription: string
  emptyTitle: string
  isLoading: boolean
  onExport: () => void
  showApproval?: boolean
  showChannel?: boolean
  showFinancialImpact?: boolean
  title: string
}) {
  const columnCount = 5 + Number(showChannel) + Number(showApproval) + Number(showFinancialImpact)

  return (
    <section className="rounded-[22px] border border-iris-border bg-white">
      <div className="flex flex-col gap-3 border-b border-[#EEF2F5] px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-[16px] font-bold text-iris-text-primary">{title}</h3>
          <p className="mt-1 text-[12px] text-iris-text-secondary">Every row retains timestamp, actor, entity, and event-level business context.</p>
        </div>
        <button className="btn-secondary" onClick={onExport} type="button">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>
      <div className="px-4 py-4">
        {isLoading ? (
          <TableSkeleton columns={columnCount} rows={5} />
        ) : (data?.items.length ?? 0) > 0 ? (
          <AuditEventsTable
            items={data?.items ?? []}
            showApproval={showApproval}
            showChannel={showChannel}
            showFinancialImpact={showFinancialImpact}
          />
        ) : (
          <EmptyState compact description={emptyDescription} title={emptyTitle} />
        )}
      </div>
    </section>
  )
}

function AuditAiDecisionSection({
  data,
  isLoading,
  onExport,
}: {
  data: AuditAIDecisionPayload | undefined
  isLoading: boolean
  onExport: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-3 md:grid-cols-3">
          <KpiChip label="AI decisions logged" tone="blue" value={String(data?.kpis.ai_decisions_logged ?? 0)} />
          <KpiChip label="Below confidence floor" tone="red" value={String(data?.kpis.below_confidence_floor ?? 0)} />
          <KpiChip label="Human overrides" tone="amber" value={String(data?.kpis.human_overrides ?? 0)} />
        </div>
        <button className="btn-secondary" onClick={onExport} type="button">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-[22px] border border-iris-border bg-white p-4">
          <TableSkeleton columns={4} rows={3} />
        </div>
      ) : data?.decisions.length ? (
        <div className="space-y-4">
          {data.decisions.map((item) => (
            <article key={`${item.agent_name}-${item.timestamp}`} className="rounded-[22px] border border-iris-border bg-[#FBFCFD] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#EEF4F8] px-2.5 py-1 text-[11px] font-semibold text-iris-blue">
                      {item.agent_name} {item.agent_version}
                    </span>
                    <span className="rounded-full bg-[#F5F7FA] px-2.5 py-1 text-[11px] font-semibold text-iris-text-secondary">{item.module}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.below_threshold ? 'bg-[#FDEDEC] text-[#922B21]' : 'bg-[#D5F5E3] text-[#1E8449]'}`}>
                      confidence {item.confidence.toFixed(2)}
                    </span>
                    <span className="font-mono text-[12px] text-iris-text-muted">{formatTimestamp(item.timestamp)}</span>
                  </div>
                  <p className="mt-3 text-[14px] font-semibold text-iris-text-primary">{item.decision}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
                <div className="rounded-xl border border-iris-border bg-white p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">Prompt</p>
                  <p className="mt-2 text-[13px] leading-6 text-iris-text-secondary">{item.prompt_summary}</p>
                </div>
                <div className="rounded-xl border border-iris-border bg-white p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">Input Reference</p>
                  <p className="mt-2 break-all text-[13px] text-iris-text-primary">{item.input_ref}</p>
                  <p className="mt-3 text-[12px] text-iris-text-secondary">
                    {item.human_review_required ? 'Human review required before downstream approval.' : 'No human intervention required for this AI decision.'}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState compact description="AI explainability cards will appear once decision logs are available." title="No AI decisions were returned" />
      )}
    </div>
  )
}

function AuditManualOverridesSection({
  data,
  isLoading,
  onExport,
}: {
  data: AuditManualOverridesPayload | undefined
  isLoading: boolean
  onExport: () => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-[22px] border border-[#F8C471] bg-[#FEF5E7] px-4 py-3 text-[13px] text-[#AF601A]">
          Loading mandatory override controls...
        </div>
        <div className="rounded-[22px] border border-iris-border bg-white p-4">
          <TableSkeleton columns={4} rows={2} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-[#F8C471] bg-[#FEF5E7] px-4 py-3 text-[13px] text-[#AF601A]">
        Mandatory override controls. No override is permitted without a captured reason and a recorded approver. All overrides feed the regulatory exception report.
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold text-iris-text-primary">Manual Overrides · {data?.total ?? 0} captured</h3>
          <p className="mt-1 text-[12px] text-iris-text-secondary">Override deltas, reasons, and approver sign-off are retained for regulator review.</p>
        </div>
        <button className="btn-secondary" onClick={onExport} type="button">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {data?.overrides.length ? (
        <div className="space-y-4">
          {data.overrides.map((item) => (
            <ManualOverrideCard key={item.override_ref} override={item} />
          ))}
        </div>
      ) : (
        <EmptyState compact description="Manual overrides with captured reasons and approvers will appear here." title="No manual overrides were returned" />
      )}
    </div>
  )
}

function AuditExportReportsSection({
  data,
  isLoading,
  onDownload,
}: {
  data: AuditExportReportsPayload | undefined
  isLoading: boolean
  onDownload: (reportName: string, format: string) => void
}) {
  return (
    <section className="rounded-[22px] border border-iris-border bg-white">
      <div className="border-b border-[#EEF2F5] px-4 py-4">
        <h3 className="text-[16px] font-bold text-iris-text-primary">Downloadable Audit Reports</h3>
        <p className="mt-1 text-[12px] text-iris-text-secondary">Static POC exports mapped to the audit report catalog from the additions spec.</p>
      </div>
      <div className="px-4 py-4">
        {isLoading ? (
          <TableSkeleton columns={4} rows={6} />
        ) : data?.reports.length ? (
          <div className="space-y-3">
            {data.reports.map((report) => (
              <article key={report.name} className="flex flex-col gap-3 rounded-xl border border-iris-border bg-[#FBFCFD] p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[14px] font-semibold text-iris-text-primary">{report.name}</p>
                  <p className="mt-1 text-[12px] text-iris-text-secondary">{report.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {report.formats.map((format) => (
                    <button
                      key={`${report.name}-${format}`}
                      className="btn-secondary"
                      onClick={() => onDownload(report.name, format)}
                      type="button"
                    >
                      <Download className="h-4 w-4" />
                      {format.toUpperCase()}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState compact description="Configured audit report downloads will appear here." title="No audit reports are available" />
        )}
      </div>
    </section>
  )
}

function AuditEventsTable({
  items,
  showApproval = false,
  showChannel = false,
  showFinancialImpact = false,
}: {
  items: AuditEventItem[]
  showApproval?: boolean
  showChannel?: boolean
  showFinancialImpact?: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-[13px]">
        <thead className="bg-[#F8F9FA]">
          <tr>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Timestamp</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Module</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Event</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Entity</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Actor</th>
            {showChannel ? <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Channel</th> : null}
            {showApproval ? <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Approval</th> : null}
            {showFinancialImpact ? (
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">Financial Impact</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.audit_id} className="border-t border-[#EEF2F5] align-top">
              <td className="px-4 py-3 font-mono text-[12px] text-iris-text-muted">{formatTimestamp(item.timestamp)}</td>
              <td className="px-4 py-3">
                <ModuleBadge module={item.module} />
              </td>
              <td className="px-4 py-3">
                <div className="font-semibold text-iris-text-primary">{item.event_type}</div>
                <div className="mt-1 max-w-[420px] text-[12px] leading-5 text-iris-text-secondary">{item.description}</div>
              </td>
              <td className="px-4 py-3 font-mono text-[12px] text-iris-text-primary">{item.entity_id}</td>
              <td className="px-4 py-3">
                <ActorBadge actorId={item.actor_id} actorType={item.actor_type} />
              </td>
              {showChannel ? <td className="px-4 py-3 text-iris-text-secondary">{item.channel}</td> : null}
              {showApproval ? (
                <td className="px-4 py-3">
                  <StatusBadge status={item.approval_status}>{titleCase(item.approval_status)}</StatusBadge>
                </td>
              ) : null}
              {showFinancialImpact ? (
                <td className="px-4 py-3 font-semibold text-[#AF601A]">
                  {item.financial_impact_amount !== null && item.financial_impact_currency
                    ? formatSignedCurrency(item.financial_impact_amount, item.financial_impact_currency)
                    : 'N/A'}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ModuleBadge({ module }: { module: string }) {
  const normalized = module.toLowerCase()
  const classes =
    normalized === 'settlement'
      ? 'bg-[#EBF5FB] text-[#1A5276]'
      : normalized === 'cession'
        ? 'bg-[#E8F8F5] text-[#117A65]'
        : normalized === 'calculation'
          ? 'bg-[#F4ECF7] text-[#6C3483]'
          : normalized === 'contract'
            ? 'bg-[#EAF2F8] text-[#1B4F72]'
            : normalized === 'access'
              ? 'bg-[#F2F3F4] text-[#626567]'
              : normalized === 'reference_data'
                ? 'bg-[#FEF5E7] text-[#AF601A]'
                : normalized === 'compliance'
                  ? 'bg-[#FDEDEC] text-[#922B21]'
                  : normalized === 'document'
                    ? 'bg-[#FDF2E9] text-[#935116]'
                    : 'bg-[#EEF4F8] text-iris-blue'

  return <span className={`inline-flex rounded px-2 py-1 text-[11px] font-semibold ${classes}`}>{formatModuleLabel(module)}</span>
}

function ActorBadge({
  actorId,
  actorType,
  compact = false,
}: {
  actorId: string
  actorType: string
  compact?: boolean
}) {
  return (
    <div className={`flex items-center gap-2 ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
      <span className={`h-2 w-2 rounded-full ${actorDotClass(actorType)}`} />
      <span className="font-medium text-iris-text-primary">{titleCase(actorType)}</span>
      {!compact ? <span className="text-iris-text-secondary">{actorId}</span> : null}
    </div>
  )
}

function ManualOverrideCard({ override }: { override: AuditManualOverride }) {
  return (
    <article className="rounded-[22px] border border-iris-border bg-white p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-[16px] font-bold text-iris-text-primary">Manual Override · {override.override_ref}</h3>
          <p className="mt-1 font-mono text-[12px] text-iris-text-muted">{formatTimestamp(override.approved_at)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[180px_180px_1fr]">
        <ValueCard label="Original" value={override.original_value} />
        <ValueCard label="Override" value={override.override_value} />
        <div className="rounded-xl border border-iris-border bg-[#FBFCFD] p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">Approver</p>
          <p className="mt-2 text-[14px] font-semibold text-iris-text-primary">{override.approver_id}</p>
          <p className="mt-1 text-[12px] text-iris-text-secondary">{override.approver_title}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-iris-border bg-[#FBFCFD] p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">Reason</p>
        <p className="mt-2 text-[13px] leading-6 text-iris-text-secondary">{override.reason}</p>
      </div>

      <div className="mt-4">
        <span className="inline-flex rounded-full bg-[#FDEDEC] px-3 py-1.5 text-[12px] font-semibold text-[#922B21]">
          Financial impact {formatSignedCurrency(override.financial_impact_amount, override.financial_impact_currency)}
        </span>
      </div>
    </article>
  )
}

function ValueCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-iris-border bg-[#FBFCFD] p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      <p className="mt-2 text-[22px] font-bold text-iris-text-primary">{value}</p>
    </div>
  )
}

function KpiChip({ label, tone, value }: { label: string; tone: 'amber' | 'blue' | 'red'; value: string }) {
  const accentClass = tone === 'red' ? 'border-[#F1948A] bg-[#FFF5F4]' : tone === 'amber' ? 'border-[#F8C471] bg-[#FFFAF2]' : 'border-[#AED6F1] bg-[#F5FBFF]'
  return (
    <div className={`rounded-xl border px-4 py-3 ${accentClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      <p className="mt-2 text-[22px] font-bold text-iris-text-primary">{value}</p>
    </div>
  )
}

function describeSection(section: AuditSectionId) {
  switch (section) {
    case 'dashboard':
      return 'Control-room summary of today’s audit posture, high-impact changes, and AI review queues.'
    case 'search':
      return 'Search and export the mock audit register by module, actor, approval, risk, and impact.'
    case 'financial_impact':
      return 'Signed financial changes that can materially affect settlements, contracts, or actuarial assumptions.'
    case 'approvals':
      return 'Approval-linked audit rows requiring traceability across human and AI-assisted actions.'
    case 'ai_decisions':
      return 'Explainability log for AI recommendations, confidence, prompts, and required human review.'
    case 'manual_overrides':
      return 'Captured overrides with reasons, approvers, and regulator-facing exception controls.'
    case 'reference_data':
      return 'Reference data refreshes and controlled market-data changes with channel visibility.'
    case 'access_logs':
      return 'Sensitive exports, permission changes, and failed login events.'
    case 'document_history':
      return 'Document-linked approvals, uploads, and contract amendment history.'
    case 'export_reports':
      return 'Pre-generated mock CSV and JSON downloads for audit, governance, and compliance review packs.'
    default:
      return ''
  }
}

function formatModuleLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

function formatCurrencyCompact(value: number, currency: string) {
  const absolute = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (absolute >= 1_000_000_000) {
    return `${sign}${currency} ${(absolute / 1_000_000_000).toFixed(2)}B`
  }
  if (absolute >= 1_000_000) {
    return `${sign}${currency} ${(absolute / 1_000_000).toFixed(2)}M`
  }
  if (absolute >= 1_000) {
    return `${sign}${currency} ${(absolute / 1_000).toFixed(1)}K`
  }
  return `${sign}${formatCurrency(absolute, currency)}`
}

function formatSignedCurrency(value: number, currency: string) {
  const prefix = value >= 0 ? '+' : '-'
  return `${prefix}${formatCurrency(Math.abs(value), currency)}`
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-GB').format(value)
}

function timelineDotClass(module: string) {
  const normalized = module.toLowerCase()
  if (normalized === 'settlement') {
    return 'bg-[#F39C12]'
  }
  if (normalized === 'cession') {
    return 'bg-iris-blue'
  }
  if (normalized === 'contract') {
    return 'bg-[#C0392B]'
  }
  if (normalized === 'reference_data') {
    return 'bg-[#85929E]'
  }
  if (normalized === 'access') {
    return 'bg-[#148F77]'
  }
  return 'bg-[#5D6D7E]'
}

function actorDotClass(actorType: string) {
  const normalized = actorType.toLowerCase()
  if (normalized === 'human') {
    return 'bg-[#1F618D]'
  }
  if (normalized === 'ai') {
    return 'bg-[#8E44AD]'
  }
  return 'bg-[#7B7D7D]'
}

function mapEventToCsvRow(item: AuditEventItem) {
  return {
    audit_id: item.audit_id,
    timestamp: formatTimestamp(item.timestamp),
    module: formatModuleLabel(item.module),
    event_type: item.event_type,
    entity_id: item.entity_id,
    actor_type: titleCase(item.actor_type),
    actor_id: item.actor_id,
    approval_status: titleCase(item.approval_status),
    risk_level: titleCase(item.risk_level),
    channel: item.channel,
    financial_impact:
      item.financial_impact_amount !== null && item.financial_impact_currency
        ? formatSignedCurrency(item.financial_impact_amount, item.financial_impact_currency)
        : null,
    description: item.description,
  }
}

function downloadTextAsCsv(rows: Record<string, string | number | null | undefined>[], filename: string) {
  const headers = Object.keys(rows[0] ?? {})
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, filename)
}

function escapeCsvValue(value: string | number | null | undefined) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.URL.revokeObjectURL(url)
}

function extractFilename(disposition: string | undefined) {
  if (!disposition) {
    return null
  }
  const match = disposition.match(/filename="?([^"]+)"?/)
  return match?.[1] ?? null
}

function slugify(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function extractErrorMessage(caughtError: unknown) {
  if (typeof caughtError !== 'object' || caughtError === null || !('response' in caughtError)) {
    return null
  }

  const response = (caughtError as { response?: { data?: { detail?: string; details?: string; error?: string } } }).response
  return response?.data?.details ?? response?.data?.detail ?? response?.data?.error ?? null
}
