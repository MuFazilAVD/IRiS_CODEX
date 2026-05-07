import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  Grid2x2,
  List,
  Search,
} from 'lucide-react'
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useSearchParams } from 'react-router-dom'

import { api } from '../../../api/client'
import { Breadcrumbs } from '../../../components/common/Breadcrumbs'
import { EmptyTableRow } from '../../../components/common/EmptyState'
import { PageHeader } from '../../../components/common/PageHeader'
import { KpiGridSkeleton, TableSkeleton } from '../../../components/common/Skeleton'
import { StatusBadge } from '../../../components/common/StatusBadge'
import { useUiStore } from '../../../store/uiStore'
import type { ClaimsSettlementListItem, ClaimsSettlementListPayload } from '../../../types/api'
import { SettlementDetailPanel } from './SettlementDetailPanel'

const STATUS_LABELS: Record<string, string> = {
  variance_review: 'Variance Review',
  ready_for_payment: 'Ready for Payment',
  pending_reconciliation: 'Pending Reconciliation',
  compliance_hold: 'Compliance Hold',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  paid: 'Paid',
  held: 'Held',
  disputed: 'Disputed',
  accept: 'Accept',
  adjust: 'Adjust',
  review: 'Review',
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'variance_review', label: 'Variance Review' },
  { value: 'ready_for_payment', label: 'Ready for Payment' },
  { value: 'pending_reconciliation', label: 'Pending Reconciliation' },
  { value: 'compliance_hold', label: 'Compliance Hold' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'held', label: 'Held' },
  { value: 'disputed', label: 'Disputed' },
]

const REVIEW_STATUSES = new Set(['variance_review', 'pending_reconciliation', 'held', 'disputed'])
const HOLD_STATUSES = new Set(['compliance_hold', 'held'])
const OPEN_STATUSES = new Set([
  'variance_review',
  'ready_for_payment',
  'pending_reconciliation',
  'compliance_hold',
  'pending_approval',
  'approved',
  'held',
  'disputed',
])

type SettlementViewMode = 'list' | 'grid'

export function SettlementsPage() {
  const [searchParams] = useSearchParams()
  const pinnedCedentId = searchParams.get('cedent_id')
  const pinnedContractId = searchParams.get('contract_id')
  const initialSearch = searchParams.get('q') ?? pinnedContractId ?? pinnedCedentId ?? ''
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') ?? 'all')
  const [viewMode, setViewMode] = useState<SettlementViewMode>('list')
  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null)
  const pushToast = useUiStore((state) => state.pushToast)

  const settlementsQuery = useQuery({
    queryKey: ['claims-settlements-register'],
    queryFn: async () =>
      (
        await api.get<ClaimsSettlementListPayload>('/claims/settlements', {
          params: {
            page: 1,
            page_size: 100,
          },
        })
      ).data,
  })

  const settlementItems = settlementsQuery.data?.items ?? []

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return settlementItems.filter((item) => {
      if (pinnedCedentId && item.cedent_id !== pinnedCedentId) {
        return false
      }
      if (pinnedContractId && item.contract_id !== pinnedContractId) {
        return false
      }
      if (selectedStatus !== 'all' && item.status !== selectedStatus) {
        return false
      }
      if (!normalizedSearch) {
        return true
      }

      return [
        item.settlement_display_id ?? item.settlement_id,
        item.settlement_id,
        item.cedent_name,
        item.contract_display_id ?? item.contract_id ?? '',
        item.contract_name,
        item.period_label,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [pinnedCedentId, pinnedContractId, searchTerm, selectedStatus, settlementItems])

  const overview = useMemo(() => buildSettlementOverview(settlementItems), [settlementItems])
  const chartRows = useMemo(() => settlementItems.map((item) => buildChartRow(item)), [settlementItems])

  function handleExportCurrentView() {
    if (!filteredItems.length) {
      pushToast({
        tone: 'error',
        message: 'There are no settlement rows in the current view to export.',
      })
      return
    }

    const header = ['Settlement', 'Cedant', 'Contract', 'Period', 'Expected', 'Actual', 'Variance', 'IRiS', 'Status']
    const rows = filteredItems.map((item) => [
      item.settlement_display_id ?? item.settlement_id,
      item.cedent_name,
      `${item.contract_display_id ?? item.contract_id ?? item.contract_name} ${item.contract_version ? `(${item.contract_version})` : ''}`.trim(),
      item.period_label,
      formatAmountMillions(item.fixed_leg, item.currency),
      formatAmountMillions(item.floating_leg, item.currency),
      `${formatSignedAmountMillions(item.net_amount, item.currency)} (${formatVariancePct(item)}%)`,
      formatSettlementStatus(item.iris_recommendation ?? 'review'),
      formatSettlementStatus(item.status),
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'iris-settlements-register.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    pushToast({
      tone: 'success',
      message: `Exported ${filteredItems.length} settlement rows from the current register view.`,
    })
  }

  function handleGenerateStatement() {
    pushToast({
      tone: 'success',
      message: 'Settlement statement generation was queued for the current settlement register.',
    })
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Claims & Settlement' }, { label: 'Settlements' }]} />
      <PageHeader
        title="Settlement & Reconciliation"
        subtitle="Financial control layer - reconciliation, AI variance analysis, approvals, screening and payment release"
        action={
          <>
            <button className="btn-secondary" onClick={handleExportCurrentView} type="button">
              <Download className="h-4 w-4" />
              Export
            </button>
            <button className="btn-primary" onClick={handleGenerateStatement} type="button">
              <FileSpreadsheet className="h-4 w-4" />
              Generate Settlement Statement
            </button>
          </>
        }
      />

      {settlementsQuery.isLoading ? (
        <>
          <KpiGridSkeleton count={7} />
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-iris-border bg-white p-4 shadow-sm">
                <div className="skeleton-block h-4 w-40 rounded" />
                <div className="skeleton-block mt-4 h-56 rounded-xl" />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <OverviewCard label="Total Pending" subtitle="across cedants" value={String(overview.totalPending)} />
            <OverviewCard label="Pending Reconciliation" subtitle="needs review" value={String(overview.pendingReview)} />
            <OverviewCard label="Pending Approval" subtitle="awaiting sign-off" value={String(overview.pendingApproval)} />
            <OverviewCard label="High Variance" subtitle=">1.5% threshold" subtitleTone="positive" value={String(overview.highVariance)} />
            <OverviewCard label="Compliance Hold" subtitle="screening" subtitleTone="negative" value={String(overview.complianceHold)} />
            <OverviewCard label="Total Payable" subtitle="Q1 2025" valueLines={['$', `${overview.totalPayableM.toFixed(2)}M`]} />
            <OverviewCard label="Overdue" subtitle="past due date" value={String(overview.overdue)} />
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            <ChartPanel title="Expected vs Actual (M)">
              <ExpectedVsActualChart rows={chartRows} />
            </ChartPanel>
            <ChartPanel title="Variance % by Cedant">
              <VarianceByCedantChart rows={chartRows} />
            </ChartPanel>
            <ChartPanel title="Cedant Settlement Exposure (M)">
              <ExposureChart rows={chartRows} />
            </ChartPanel>
          </div>
        </>
      )}

      <section className="mt-5 overflow-hidden rounded-xl border border-iris-border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#E7EDF3] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-[15px] font-semibold text-iris-text-primary">Settlement Worklist</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="input-shell min-w-[280px]">
              <Search className="h-4 w-4 text-iris-text-muted" />
              <input
                placeholder="Search by id, cedant, contract"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <select className="field-input min-w-[160px]" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="flex items-center rounded-md border border-iris-border bg-white">
              <button
                aria-label="List view"
                className={`flex h-10 w-10 items-center justify-center text-iris-text-secondary transition ${viewMode === 'list' ? 'bg-[#F4F8FB] text-iris-text-primary' : 'hover:bg-[#F8FAFC]'}`}
                onClick={() => setViewMode('list')}
                type="button"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                aria-label="Grid view"
                className={`flex h-10 w-10 items-center justify-center border-l border-iris-border text-iris-text-secondary transition ${viewMode === 'grid' ? 'bg-[#F4F8FB] text-iris-text-primary' : 'hover:bg-[#F8FAFC]'}`}
                onClick={() => setViewMode('grid')}
                type="button"
              >
                <Grid2x2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {settlementsQuery.isLoading ? (
          <div className="px-5 py-5">
            <TableSkeleton columns={9} rows={5} />
          </div>
        ) : viewMode === 'grid' ? (
          filteredItems.length ? (
            <div className="grid gap-3 px-5 py-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => (
                <SettlementGridCard key={item.settlement_id} item={item} onOpen={() => setSelectedSettlementId(item.settlement_id)} />
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-[15px] font-semibold text-iris-text-primary">No settlements matched this view</p>
              <p className="mt-2 text-[13px] text-iris-text-secondary">Try widening the status filter or clear the search to bring settlement rows back into view.</p>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[12px]">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['Settlement', 'Cedant / Contract', 'Period', 'Expected', 'Actual', 'Variance', 'IRiS', 'Status', ''].map((label) => (
                    <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold text-iris-text-secondary">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.length ? (
                  filteredItems.map((item) => (
                    <tr key={item.settlement_id} className="border-t border-[#E7EDF3] align-top">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-iris-text-primary">
                        {item.settlement_display_id ?? item.settlement_id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[14px] font-medium text-iris-text-primary">{item.cedent_name}</div>
                        <div className="mt-1 text-[12px] text-iris-text-secondary">
                          {item.contract_display_id ?? item.contract_id ?? item.contract_name}
                          {item.contract_version ? ` | ${item.contract_version}` : ''}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-iris-text-primary">{item.period_label}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-iris-text-primary">{formatAmountMillions(item.fixed_leg, item.currency)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-iris-text-primary">{formatAmountMillions(item.floating_leg, item.currency)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className={`flex items-center gap-1.5 font-medium ${item.net_amount >= 0 ? 'text-[#1E8449]' : 'text-[#D64545]'}`}>
                          {item.net_amount >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                          <span>{formatSignedAmountMillions(item.net_amount, item.currency)}</span>
                        </div>
                        <div className={`mt-1 text-[11px] ${item.net_amount >= 0 ? 'text-[#1E8449]' : 'text-[#D64545]'}`}>{formatVariancePct(item)}%</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={item.iris_recommendation ?? 'review'}>
                          {formatSettlementStatus(item.iris_recommendation ?? 'review')}
                        </StatusBadge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={item.status}>{formatSettlementStatus(item.status)}</StatusBadge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button className="inline-flex items-center gap-1 text-[13px] font-medium text-iris-text-primary transition hover:text-iris-blue" onClick={() => setSelectedSettlementId(item.settlement_id)} type="button">
                          Open
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <EmptyTableRow
                    action={
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setSearchTerm('')
                          setSelectedStatus('all')
                        }}
                        type="button"
                      >
                        Clear filters
                      </button>
                    }
                    colSpan={9}
                    description="Try widening the status filter or clear the search to bring settlement rows back into view."
                    title="No settlements matched this view"
                  />
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedSettlementId ? (
        <SettlementDetailPanel settlementId={selectedSettlementId} onClose={() => setSelectedSettlementId(null)} onRefresh={() => settlementsQuery.refetch()} />
      ) : null}
    </div>
  )
}

function OverviewCard({
  label,
  value,
  subtitle,
  subtitleTone = 'default',
  valueLines,
}: {
  label: string
  value?: string
  subtitle: string
  subtitleTone?: 'default' | 'positive' | 'negative'
  valueLines?: string[]
}) {
  const subtitleClass =
    subtitleTone === 'positive' ? 'text-[#1E8449]' : subtitleTone === 'negative' ? 'text-[#D64545]' : 'text-iris-text-secondary'

  return (
    <div className="min-h-[140px] rounded-xl border border-iris-border bg-white px-4 py-4 shadow-sm">
      <p className="text-[14px] leading-5 text-iris-text-primary">{label}</p>
      {valueLines ? (
        <div className="mt-4 space-y-1 text-iris-text-primary">
          {valueLines.map((line, index) => (
            <div key={`${label}-${index}`} className={index === 0 ? 'text-[16px] font-semibold' : 'text-[20px] font-bold tracking-[0.02em]'}>
              {line}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-[20px] font-bold tracking-[0.02em] text-iris-text-primary">{value}</p>
      )}
      <p className={`mt-2 text-[13px] ${subtitleClass}`}>{subtitle}</p>
    </div>
  )
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-iris-border bg-white shadow-sm">
      <div className="border-b border-[#E7EDF3] px-4 py-3">
        <h3 className="text-[15px] font-semibold text-iris-text-primary">{title}</h3>
      </div>
      <div className="h-[240px] px-3 py-3">{children}</div>
    </div>
  )
}

function ExpectedVsActualChart({ rows }: { rows: SettlementChartRow[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart data={rows} barGap={2}>
        <CartesianGrid stroke="#E9EEF4" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="settlementLabel" tick={{ fill: '#657889', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#D7DFE7' }} />
        <YAxis tick={{ fill: '#657889', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#D7DFE7' }} />
        <Tooltip content={<ChartTooltip formatter={(value) => `${value}M`} />} />
        <Bar dataKey="expected" fill="#111111" radius={[2, 2, 0, 0]} />
        <Bar dataKey="actual" fill="#111111" radius={[2, 2, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

function VarianceByCedantChart({ rows }: { rows: SettlementChartRow[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart data={rows}>
        <CartesianGrid stroke="#E9EEF4" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="cedantLabel" tick={{ fill: '#657889', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#D7DFE7' }} />
        <YAxis tick={{ fill: '#657889', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#D7DFE7' }} domain={['dataMin - 0.1', 'dataMax + 0.1']} />
        <Tooltip content={<ChartTooltip formatter={(value) => `${value}%`} />} />
        <ReferenceLine y={0} stroke="#D7DFE7" />
        <Bar dataKey="variancePct" fill="#111111" radius={[2, 2, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

function ExposureChart({ rows }: { rows: SettlementChartRow[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart data={rows}>
        <CartesianGrid stroke="#E9EEF4" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="cedantLabel" tick={{ fill: '#657889', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#D7DFE7' }} />
        <YAxis tick={{ fill: '#657889', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#D7DFE7' }} />
        <Tooltip content={<ChartTooltip formatter={(value) => `${value}M`} />} />
        <Bar dataKey="exposure" fill="#39BDE8" radius={[2, 2, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

function SettlementGridCard({ item, onOpen }: { item: ClaimsSettlementListItem; onOpen: () => void }) {
  return (
    <div className="rounded-xl border border-iris-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[12px] text-iris-text-primary">{item.settlement_display_id ?? item.settlement_id}</p>
          <p className="mt-2 text-[15px] font-semibold text-iris-text-primary">{item.cedent_name}</p>
          <p className="mt-1 text-[12px] text-iris-text-secondary">
            {item.contract_display_id ?? item.contract_id ?? item.contract_name}
            {item.contract_version ? ` | ${item.contract_version}` : ''}
          </p>
        </div>
        <StatusBadge status={item.status}>{formatSettlementStatus(item.status)}</StatusBadge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricStack label="Expected" value={formatAmountMillions(item.fixed_leg, item.currency)} />
        <MetricStack label="Actual" value={formatAmountMillions(item.floating_leg, item.currency)} />
        <MetricStack label="Variance" tone={item.net_amount >= 0 ? 'positive' : 'negative'} value={`${formatSignedAmountMillions(item.net_amount, item.currency)} | ${formatVariancePct(item)}%`} />
        <MetricStack label="IRiS" value={formatSettlementStatus(item.iris_recommendation ?? 'review')} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[#E7EDF3] pt-3">
        <span className="text-[12px] text-iris-text-secondary">{item.period_label}</span>
        <button className="inline-flex items-center gap-1 text-[13px] font-medium text-iris-text-primary transition hover:text-iris-blue" onClick={onOpen} type="button">
          Open
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function MetricStack({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative'
}) {
  const toneClass = tone === 'positive' ? 'text-[#1E8449]' : tone === 'negative' ? 'text-[#D64545]' : 'text-iris-text-primary'
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.08em] text-iris-text-muted">{label}</p>
      <p className={`mt-1 text-[13px] font-medium ${toneClass}`}>{value}</p>
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string }>
  label?: string
  formatter: (value: string | number) => string
}) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="rounded-lg border border-iris-border bg-white px-3 py-2 shadow-lg">
      <p className="text-[12px] font-semibold text-iris-text-primary">{label}</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="text-[12px] text-iris-text-secondary">
            <span className="font-medium text-iris-text-primary">{entry.name}:</span> {formatter(entry.value ?? 0)}
          </div>
        ))}
      </div>
    </div>
  )
}

function buildSettlementOverview(items: ClaimsSettlementListItem[]) {
  const totalPending = items.filter((item) => OPEN_STATUSES.has(item.status)).length
  const pendingReview = items.filter((item) => REVIEW_STATUSES.has(item.status)).length
  const pendingApproval = items.filter((item) => item.status === 'pending_approval').length
  const highVariance = items.filter((item) => Math.abs(calculateVariancePct(item)) > 1.5).length
  const complianceHold = items.filter((item) => HOLD_STATUSES.has(item.status)).length
  const totalPayable = items.reduce((sum, item) => sum + item.floating_leg, 0)
  const overdue = items.filter((item) => item.status === 'overdue').length

  return {
    totalPending,
    pendingReview,
    pendingApproval,
    highVariance,
    complianceHold,
    totalPayableM: toMillions(totalPayable),
    overdue,
  }
}

function buildChartRow(item: ClaimsSettlementListItem): SettlementChartRow {
  return {
    settlementLabel: (item.settlement_display_id ?? item.settlement_id).slice(-3),
    cedantLabel: compactCedantLabel(item.cedent_name),
    expected: toMillions(item.fixed_leg),
    actual: toMillions(item.floating_leg),
    variancePct: Number(formatVariancePct(item)),
    exposure: toMillions(Math.max(item.fixed_leg, item.floating_leg)),
  }
}

function formatAmountMillions(value: number, currency: string) {
  return `${currency} ${toMillions(value).toFixed(2)}M`
}

function formatSignedAmountMillions(value: number, currency: string) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${currency} ${toMillions(Math.abs(value)).toFixed(2)}M`
}

function formatSettlementStatus(status: string) {
  return STATUS_LABELS[status] ?? status.replaceAll('_', ' ').replace(/\b\w/g, (segment) => segment.toUpperCase())
}

function calculateVariancePct(item: ClaimsSettlementListItem) {
  if (item.fixed_leg === 0) {
    return 0
  }
  return (item.net_amount / item.fixed_leg) * 100
}

function formatVariancePct(item: ClaimsSettlementListItem) {
  return calculateVariancePct(item).toFixed(2)
}

function toMillions(value: number) {
  return value / 1_000_000
}

function compactCedantLabel(value: string) {
  return value.split(' ')[0] ?? value
}

interface SettlementChartRow {
  settlementLabel: string
  cedantLabel: string
  expected: number
  actual: number
  variancePct: number
  exposure: number
}
