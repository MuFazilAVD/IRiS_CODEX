import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Mail,
  Shield,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { api } from '../../api/client'
import { Breadcrumbs } from '../../components/common/Breadcrumbs'
import { EmptyState } from '../../components/common/EmptyState'
import { KPICard } from '../../components/common/KPICard'
import { PageHeader } from '../../components/common/PageHeader'
import { TableSkeleton } from '../../components/common/Skeleton'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useUiStore } from '../../store/uiStore'
import type {
  CedentsListPayload,
  ContractsListPayload,
  ReportsCatalogItem,
  ReportsCatalogPayload,
  ReportCategory,
} from '../../types/api'

interface CatalogFilters {
  savedFilterName: string
  cedentId: string
  contractId: string
  period: string
  valuationDate: string
  assumptionSet: string
  currency: string
  movementType: string
  complianceStatus: string
  approvalStatus: string
  sensitivity: string
  search: string
}

const DEFAULT_FILTERS: CatalogFilters = {
  savedFilterName: '',
  cedentId: 'all',
  contractId: 'all',
  period: '2025 Q1',
  valuationDate: '2025-03-31',
  assumptionSet: 'v3.2',
  currency: 'all',
  movementType: 'all',
  complianceStatus: 'all',
  approvalStatus: 'all',
  sensitivity: 'all',
  search: '',
}

const PERIOD_OPTIONS = ['2025 Q1', '2025 Q2', '2025 Q3', '2025 Q4', '2024 Q1', '2024 Q2', '2024 Q3', '2024 Q4']
const ASSUMPTION_SET_OPTIONS = ['v3.2', 'v3.1', 'v3.0']
const CURRENCY_OPTIONS = ['all', 'GBP', 'USD', 'EUR', 'CHF', 'CAD']
const MOVEMENT_TYPE_OPTIONS = ['all', 'Death', 'Deferred', 'Active', 'Spouse']
const COMPLIANCE_STATUS_OPTIONS = ['all', 'Clear', 'Review', 'Escalated']
const APPROVAL_STATUS_OPTIONS = ['all', 'Pending', 'Approved', 'Disputed']

export function ReportsPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const pushToast = useUiStore((state) => state.pushToast)

  const [showFilters, setShowFilters] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('All')
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([])
  const [busyFormat, setBusyFormat] = useState<string | null>(null)
  const [filters, setFilters] = useState<CatalogFilters>(() => ({
    ...DEFAULT_FILTERS,
    cedentId: searchParams.get('cedent_id') ?? searchParams.get('cedant') ?? DEFAULT_FILTERS.cedentId,
    period: normalizePeriod(searchParams.get('period')) ?? DEFAULT_FILTERS.period,
    search: searchParams.get('filter') ?? DEFAULT_FILTERS.search,
  }))
  const deferredSearch = useDeferredValue(filters.search)

  const reportsQuery = useQuery({
    queryKey: ['reports-catalog'],
    queryFn: async () => (await api.get<ReportsCatalogPayload>('/reports')).data,
  })

  const cedentsQuery = useQuery({
    queryKey: ['reports-cedents'],
    queryFn: async () => (await api.get<CedentsListPayload>('/underwriting/cedents', { params: { status: 'all', page: 1, page_size: 100 } })).data,
  })

  const contractsQuery = useQuery({
    queryKey: ['reports-contracts'],
    queryFn: async () => (await api.get<ContractsListPayload>('/underwriting/contracts', { params: { status: 'all', page: 1, page_size: 200 } })).data,
  })

  const catalogItems = reportsQuery.data?.items ?? []
  const categoryItems = useMemo(() => reportsQuery.data?.categories ?? [], [reportsQuery.data?.categories])

  const filteredItems = useMemo(() => {
    return catalogItems.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false
      }
      if (filters.sensitivity !== 'all' && item.sensitivity !== filters.sensitivity) {
        return false
      }
      const normalizedSearch = deferredSearch.trim().toLowerCase()
      if (normalizedSearch) {
        const haystack = [item.report_id, item.name, item.description, item.category, item.cadence].join(' ').toLowerCase()
        if (!haystack.includes(normalizedSearch)) {
          return false
        }
      }
      return true
    })
  }, [catalogItems, deferredSearch, filters.sensitivity, selectedCategory])

  const selectedVisibleCount = filteredItems.filter((item) => selectedReportIds.includes(item.report_id)).length
  const allVisibleSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedReportIds.includes(item.report_id))

  const kpis = useMemo(() => {
    const sensitiveCount = catalogItems.filter((item) => item.sensitivity === 'Sensitive').length
    const scheduledCount = catalogItems.filter((item) => Boolean(item.cadence)).length
    return [
      {
        label: 'Available reports',
        value: String(catalogItems.length),
        subtitle: 'role-filtered entitlements',
        trend: 'neutral' as const,
        trend_value: 'catalog',
        border_color: 'blue' as const,
      },
      {
        label: 'Sensitive / regulator',
        value: String(sensitiveCount),
        subtitle: 'extra audit applied',
        trend: 'up' as const,
        trend_value: 'restricted',
        border_color: 'red' as const,
      },
      {
        label: 'Report categories',
        value: String(categoryItems.filter((item) => item.category !== 'All').length),
        subtitle: 'across the platform',
        trend: 'neutral' as const,
        trend_value: '7 tracked',
        border_color: 'teal' as const,
      },
      {
        label: 'Scheduled cadence',
        value: String(scheduledCount),
        subtitle: 'auto-distribution',
        trend: 'neutral' as const,
        trend_value: 'mock',
        border_color: 'green' as const,
      },
    ]
  }, [catalogItems, categoryItems])

  async function handleExport(format: 'excel' | 'pdf' | 'zip' | 'csv', reportIds: string[]) {
    if (!reportIds.length) {
      pushToast({ tone: 'warning', message: 'Select at least one report or keep a visible catalog slice before exporting.' })
      return
    }

    setBusyFormat(format)
    try {
      const response = await api.post<Blob>(
        '/reports/export',
        {
          report_ids: reportIds,
          format,
          filters: buildExportFilters(filters),
        },
        { responseType: 'blob' },
      )
      const disposition = response.headers['content-disposition']
      const fallbackFilename = format === 'zip' ? 'reports-export.zip' : format === 'pdf' ? 'reports-export.pdf' : format === 'excel' ? 'reports-export.xls' : 'reports-export.csv'
      const filename = extractFilename(disposition) ?? fallbackFilename
      downloadBlob(response.data, filename)
      pushToast({ tone: 'success', message: `${reportIds.length} report${reportIds.length === 1 ? '' : 's'} exported as ${format.toUpperCase()}.` })
    } catch (caughtError: unknown) {
      pushToast({ tone: 'error', message: extractErrorMessage(caughtError) ?? 'Report export could not be completed.' })
    } finally {
      setBusyFormat(null)
    }
  }

  function handleTopExport() {
    void handleExport('excel', selectedReportIds)
  }

  function handleQuickExport(format: 'excel' | 'pdf') {
    const ids = selectedReportIds.length ? selectedReportIds : filteredItems.map((item) => item.report_id)
    void handleExport(format, ids)
  }

  function handleRegulatoryPack() {
    const complianceIds = catalogItems.filter((item) => item.category === 'Compliance').map((item) => item.report_id)
    void handleExport('zip', complianceIds)
  }

  function handleDistributionList() {
    pushToast({
      tone: 'info',
      message: 'Distribution list management stays mock-backed in Phase 14 and is not persisted yet.',
    })
  }

  function handleSchedule() {
    pushToast({
      tone: 'info',
      message: 'Scheduling stays mock-backed in Phase 14. The catalog layout is ready for the later workflow.',
    })
  }

  function handleSaveFilter() {
    if (!filters.savedFilterName.trim()) {
      pushToast({ tone: 'warning', message: 'Enter a saved filter name before saving this catalog view.' })
      return
    }
    pushToast({ tone: 'success', message: `Saved mock filter view "${filters.savedFilterName.trim()}".` })
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS)
    setSelectedCategory('All')
    setSelectedReportIds([])
  }

  function handleSelectAll(checked: boolean) {
    if (!checked) {
      setSelectedReportIds((current) => current.filter((id) => !filteredItems.some((item) => item.report_id === id)))
      return
    }

    setSelectedReportIds((current) => Array.from(new Set([...current, ...filteredItems.map((item) => item.report_id)])))
  }

  function handleSelectOne(reportId: string, checked: boolean) {
    setSelectedReportIds((current) => (checked ? Array.from(new Set([...current, reportId])) : current.filter((id) => id !== reportId)))
  }

  function openReport(item: ReportsCatalogItem) {
    const nextSearchParams = new URLSearchParams()
    Object.entries(buildExportFilters(filters)).forEach(([key, value]) => {
      if (value && value !== 'all') {
        nextSearchParams.set(key, value)
      }
    })
    navigate(`/reports/${item.report_id}?${nextSearchParams.toString()}`)
  }

  const cedentOptions = cedentsQuery.data?.items ?? []
  const contractOptions = contractsQuery.data?.items ?? []

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Reporting' }, { label: 'Report Catalog' }]} />
      <PageHeader
        eyebrow="Reporting"
        title="Reports"
        subtitle="Reporting intelligence layer - historical, financial, operational, compliance, actuarial and audit."
        action={
          <>
            <button className="btn-secondary" onClick={() => setShowFilters((current) => !current)} type="button">
              <Filter className="h-4 w-4" />
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
            <button className="btn-secondary" onClick={handleSchedule} type="button">
              <CalendarDays className="h-4 w-4" />
              Schedule
            </button>
            <button className="btn-primary" disabled={!selectedReportIds.length || busyFormat !== null} onClick={handleTopExport} type="button">
              <Download className="h-4 w-4" />
              {busyFormat === 'excel' ? 'Exporting...' : 'Export selected'}
            </button>
          </>
        }
      />

      <div className="compact-kpi-grid">
        {kpis.map((item) => (
          <KPICard key={item.label} {...item} />
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[244px_minmax(0,1fr)]">
        <aside className="rounded-[24px] border border-iris-border bg-white p-4 shadow-sm">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">Categories</p>
            <div className="space-y-1.5">
              {categoryItems.map((item) => (
                <button
                  key={item.category}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                    selectedCategory === item.category
                      ? 'border-l-2 border-iris-blue bg-[#F4F9FC] text-iris-text-primary'
                      : 'text-iris-text-secondary hover:bg-[#FBFCFD] hover:text-iris-text-primary'
                  }`}
                  onClick={() => setSelectedCategory(item.category)}
                  type="button"
                >
                  <span className="text-[13px] font-medium">{item.label}</span>
                  <span className="text-[13px] font-semibold">{item.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-[#EEF2F5] pt-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">Quick actions</p>
            <div className="space-y-2">
              <QuickActionButton icon={FileSpreadsheet} label="Export Excel" onClick={() => handleQuickExport('excel')} />
              <QuickActionButton icon={FileText} label="Export PDF" onClick={() => handleQuickExport('pdf')} />
              <QuickActionButton icon={Shield} label="Regulatory pack" onClick={handleRegulatoryPack} />
              <QuickActionButton icon={Mail} label="Distribution list" onClick={handleDistributionList} />
            </div>
          </div>
        </aside>

        <div>
          {showFilters ? (
            <section className="rounded-[24px] border border-iris-border bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-[18px] font-bold text-iris-text-primary">Global filters</h2>
                  <p className="mt-1 text-[12px] text-iris-text-secondary">Catalog metadata filters plus contextual report parameters carried into detail and export previews.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="field-input min-w-[220px]"
                    placeholder="Saved filter name"
                    value={filters.savedFilterName}
                    onChange={(event) => setFilters((current) => ({ ...current, savedFilterName: event.target.value }))}
                  />
                  <button className="btn-secondary" onClick={handleSaveFilter} type="button">
                    Save
                  </button>
                  <button className="btn-secondary" onClick={handleResetFilters} type="button">
                    Reset
                  </button>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-5">
                <select className="field-input" value={filters.cedentId} onChange={(event) => setFilters((current) => ({ ...current, cedentId: event.target.value }))}>
                  <option value="all">Cedant: All</option>
                  {cedentOptions.map((item) => (
                    <option key={item.cedent_id} value={item.cedent_id}>
                      {item.legal_entity_name}
                    </option>
                  ))}
                </select>

                <select className="field-input" value={filters.contractId} onChange={(event) => setFilters((current) => ({ ...current, contractId: event.target.value }))}>
                  <option value="all">Contract: All</option>
                  {contractOptions.map((item) => (
                    <option key={item.contract_id} value={item.contract_id}>
                      {item.contract_id}
                    </option>
                  ))}
                </select>

                <select className="field-input" value={filters.period} onChange={(event) => setFilters((current) => ({ ...current, period: event.target.value }))}>
                  {PERIOD_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <input
                  className="field-input"
                  type="date"
                  value={filters.valuationDate}
                  onChange={(event) => setFilters((current) => ({ ...current, valuationDate: event.target.value }))}
                />

                <select className="field-input" value={filters.assumptionSet} onChange={(event) => setFilters((current) => ({ ...current, assumptionSet: event.target.value }))}>
                  {ASSUMPTION_SET_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <select className="field-input" value={filters.currency} onChange={(event) => setFilters((current) => ({ ...current, currency: event.target.value }))}>
                  {CURRENCY_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item === 'all' ? 'Currency: All' : item}
                    </option>
                  ))}
                </select>

                <select className="field-input" value={filters.movementType} onChange={(event) => setFilters((current) => ({ ...current, movementType: event.target.value }))}>
                  {MOVEMENT_TYPE_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item === 'all' ? 'Movement type: All' : item}
                    </option>
                  ))}
                </select>

                <select className="field-input" value={filters.complianceStatus} onChange={(event) => setFilters((current) => ({ ...current, complianceStatus: event.target.value }))}>
                  {COMPLIANCE_STATUS_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item === 'all' ? 'Compliance status: All' : item}
                    </option>
                  ))}
                </select>

                <select className="field-input" value={filters.approvalStatus} onChange={(event) => setFilters((current) => ({ ...current, approvalStatus: event.target.value }))}>
                  {APPROVAL_STATUS_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item === 'all' ? 'Approval status: All' : item}
                    </option>
                  ))}
                </select>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_148px] xl:grid-cols-[minmax(0,1fr)_148px]">
                  <input
                    className="field-input"
                    placeholder="Search report name or ID"
                    value={filters.search}
                    onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  />
                  <select
                    className="field-input"
                    value={filters.sensitivity}
                    onChange={(event) => setFilters((current) => ({ ...current, sensitivity: event.target.value }))}
                  >
                    <option value="all">All sensitivity</option>
                    <option value="Sensitive">Sensitive</option>
                    <option value="Standard">Standard</option>
                  </select>
                </div>
              </div>
            </section>
          ) : null}

          <section className="mt-5 rounded-[24px] border border-iris-border bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#EEF2F5] px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="text-[18px] font-bold text-iris-text-primary">
                {filteredItems.length} reports <span className="text-iris-text-muted">·</span> {selectedVisibleCount} selected
              </div>
              <label className="inline-flex items-center gap-2 text-[13px] font-medium text-iris-text-primary">
                <input checked={allVisibleSelected} onChange={(event) => handleSelectAll(event.target.checked)} type="checkbox" />
                Select all
              </label>
            </div>

            <div className="px-5 py-5">
              {reportsQuery.isLoading ? (
                <TableSkeleton columns={7} rows={7} />
              ) : filteredItems.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[13px]">
                    <thead className="bg-[#F8F9FA]">
                      <tr>
                        {['', 'Report', 'Category', 'Cadence', 'Distribution', 'Sensitivity', 'Actions'].map((label) => (
                          <th key={label || 'checkbox'} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => (
                        <tr key={item.report_id} className="border-t border-[#EEF2F5] align-top">
                          <td className="px-4 py-4">
                            <input
                              checked={selectedReportIds.includes(item.report_id)}
                              onChange={(event) => handleSelectOne(item.report_id, event.target.checked)}
                              type="checkbox"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 text-iris-text-muted">◦</span>
                              <div>
                                <p className="text-[16px] font-semibold text-iris-text-primary">{item.name}</p>
                                <p className="mt-1 font-mono text-[12px] text-iris-blue">{item.report_id}</p>
                                <p className="mt-2 max-w-[420px] text-[13px] leading-6 text-iris-text-secondary">{item.description}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-iris-text-primary">{item.category}</td>
                          <td className="px-4 py-4 text-iris-text-primary">{item.cadence}</td>
                          <td className="px-4 py-4 text-iris-text-secondary">{item.distribution.join(', ')}</td>
                          <td className="px-4 py-4">
                            <StatusBadge status={item.sensitivity}>{item.sensitivity}</StatusBadge>
                          </td>
                          <td className="px-4 py-4">
                            <button className="btn-secondary" onClick={() => openReport(item)} type="button">
                              Open
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  compact
                  description="Try widening the category or sensitivity filters, or clear the search term to bring report catalog rows back."
                  title="No reports matched this catalog view"
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof FileSpreadsheet
  label: string
  onClick: () => void
}) {
  return (
    <button className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-[14px] text-iris-text-primary transition hover:border-iris-border hover:bg-[#FBFCFD]" onClick={onClick} type="button">
      <Icon className="h-4 w-4 text-iris-blue" />
      <span>{label}</span>
    </button>
  )
}

function buildExportFilters(filters: CatalogFilters) {
  return {
    cedent_id: filters.cedentId,
    contract_id: filters.contractId,
    period: filters.period,
    valuation_date: filters.valuationDate,
    assumption_set: filters.assumptionSet,
    currency: filters.currency,
    movement_type: filters.movementType,
    compliance_status: filters.complianceStatus,
    approval_status: filters.approvalStatus,
    search: filters.search,
    sensitivity: filters.sensitivity,
  }
}

function extractFilename(disposition: string | undefined) {
  if (!disposition) {
    return null
  }
  const match = disposition.match(/filename="?([^"]+)"?/)
  return match?.[1] ?? null
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.URL.revokeObjectURL(url)
}

function normalizePeriod(value: string | null) {
  if (!value) {
    return null
  }
  if (value.includes(' ')) {
    return value
  }
  const match = value.match(/^Q([1-4])-(\d{4})$/)
  if (!match) {
    return value
  }
  return `${match[2]} Q${match[1]}`
}

function extractErrorMessage(caughtError: unknown) {
  if (typeof caughtError !== 'object' || caughtError === null || !('response' in caughtError)) {
    return null
  }
  const response = (caughtError as { response?: { data?: { detail?: string; details?: string; error?: string } } }).response
  return response?.data?.details ?? response?.data?.detail ?? response?.data?.error ?? null
}
