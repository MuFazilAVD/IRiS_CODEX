import { useDeferredValue, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Bug,
  CalendarDays,
  ChevronRight,
  Clock3,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  LineChart as LineChartIcon,
  Mail,
  Search,
  Shield,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { api } from '../../api/client'
import { Breadcrumbs } from '../../components/common/Breadcrumbs'
import { EmptyState } from '../../components/common/EmptyState'
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

const CATEGORY_ICONS: Record<ReportCategory, LucideIcon> = {
  All: FileText,
  Historical: Clock3,
  Dynamic: LineChartIcon,
  Debugging: Bug,
  Movement: Activity,
  Compliance: Shield,
  Financial: DollarSign,
  Admin: Users,
}

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
      },
      {
        label: 'Sensitive / regulator',
        value: String(sensitiveCount),
        subtitle: 'extra audit applied',
      },
      {
        label: 'Report categories',
        value: String(categoryItems.filter((item) => item.category !== 'All').length),
        subtitle: 'across the platform',
      },
      {
        label: 'Scheduled cadence',
        value: String(scheduledCount),
        subtitle: 'auto-distribution',
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

      <div className="mb-5 border-b border-[#E3EAF0] pb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-[28px] font-bold leading-tight text-iris-text-primary">Reports</h1>
            <p className="mt-1.5 max-w-[760px] text-[13px] text-iris-text-secondary">
              Reporting intelligence layer - historical, financial, operational, compliance, actuarial and audit
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        {kpis.map((item) => (
          <ReportKpiCard key={item.label} label={item.label} subtitle={item.subtitle} value={item.value} />
        ))}
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[228px_minmax(0,1fr)]">
        <aside className="xl:border-r xl:border-[#E1E8ED] xl:pr-6">
          <div>
            <p className="mb-2.5 text-[11px] font-medium text-iris-text-secondary">Categories</p>
            <div className="space-y-1">
              {categoryItems.map((item) => {
                const Icon = CATEGORY_ICONS[item.category]
                const active = selectedCategory === item.category

                return (
                  <button
                    key={item.category}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition ${
                      active
                        ? 'border-l-[3px] border-iris-navy bg-[#EEF3F6] text-iris-text-primary'
                        : 'text-iris-text-primary hover:bg-white'
                    }`}
                    onClick={() => setSelectedCategory(item.category)}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0 text-[#274A63]" />
                      <span className="truncate text-[13px] font-medium">{item.label}</span>
                    </span>
                    <span className="ml-3 text-[13px] text-iris-text-secondary">{item.count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-8 border-t border-[#E6EDF2] pt-6">
            <p className="mb-2.5 text-[11px] font-medium text-iris-text-secondary">Quick actions</p>
            <div className="space-y-1">
              <QuickActionButton icon={FileSpreadsheet} label="Export Excel" onClick={() => handleQuickExport('excel')} />
              <QuickActionButton icon={FileText} label="Export PDF" onClick={() => handleQuickExport('pdf')} />
              <QuickActionButton icon={Shield} label="Regulatory pack" onClick={handleRegulatoryPack} />
              <QuickActionButton icon={Mail} label="Distribution list" onClick={handleDistributionList} />
            </div>
          </div>
        </aside>

        <div>
          {showFilters ? (
            <section className="rounded-lg border border-[#D7E1E8] bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-[#274A63]" />
                    <h2 className="text-[16px] font-semibold text-iris-text-primary">Global filters</h2>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="field-input h-9 min-w-[190px] px-3 py-1.5 text-[12px]"
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

              <div className="mt-4 grid gap-x-3 gap-y-3 xl:grid-cols-5">
                <ReportFilterField label="Cedant">
                  <select className="field-input h-9 px-3 py-1.5 text-[12px]" value={filters.cedentId} onChange={(event) => setFilters((current) => ({ ...current, cedentId: event.target.value }))}>
                    <option value="all">All</option>
                    {cedentOptions.map((item) => (
                      <option key={item.cedent_id} value={item.cedent_id}>
                        {item.legal_entity_name}
                      </option>
                    ))}
                  </select>
                </ReportFilterField>

                <ReportFilterField label="Contract">
                  <select className="field-input h-9 px-3 py-1.5 text-[12px]" value={filters.contractId} onChange={(event) => setFilters((current) => ({ ...current, contractId: event.target.value }))}>
                    <option value="all">All</option>
                    {contractOptions.map((item) => (
                      <option key={item.contract_id} value={item.contract_id}>
                        {item.contract_id}
                      </option>
                    ))}
                  </select>
                </ReportFilterField>

                <ReportFilterField label="Reporting period">
                  <select className="field-input h-9 px-3 py-1.5 text-[12px]" value={filters.period} onChange={(event) => setFilters((current) => ({ ...current, period: event.target.value }))}>
                    {PERIOD_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </ReportFilterField>

                <ReportFilterField label="Valuation date">
                  <input
                    className="field-input h-9 px-3 py-1.5 text-[12px]"
                    type="date"
                    value={filters.valuationDate}
                    onChange={(event) => setFilters((current) => ({ ...current, valuationDate: event.target.value }))}
                  />
                </ReportFilterField>

                <ReportFilterField label="Assumption set">
                  <select className="field-input h-9 px-3 py-1.5 text-[12px]" value={filters.assumptionSet} onChange={(event) => setFilters((current) => ({ ...current, assumptionSet: event.target.value }))}>
                    {ASSUMPTION_SET_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </ReportFilterField>

                <ReportFilterField label="Currency">
                  <select className="field-input h-9 px-3 py-1.5 text-[12px]" value={filters.currency} onChange={(event) => setFilters((current) => ({ ...current, currency: event.target.value }))}>
                    {CURRENCY_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item === 'all' ? 'All' : item}
                      </option>
                    ))}
                  </select>
                </ReportFilterField>

                <ReportFilterField label="Movement type">
                  <select className="field-input h-9 px-3 py-1.5 text-[12px]" value={filters.movementType} onChange={(event) => setFilters((current) => ({ ...current, movementType: event.target.value }))}>
                    {MOVEMENT_TYPE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item === 'all' ? 'All' : item}
                      </option>
                    ))}
                  </select>
                </ReportFilterField>

                <ReportFilterField label="Compliance status">
                  <select className="field-input h-9 px-3 py-1.5 text-[12px]" value={filters.complianceStatus} onChange={(event) => setFilters((current) => ({ ...current, complianceStatus: event.target.value }))}>
                    {COMPLIANCE_STATUS_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item === 'all' ? 'All' : item}
                      </option>
                    ))}
                  </select>
                </ReportFilterField>

                <ReportFilterField label="Approval status">
                  <select className="field-input h-9 px-3 py-1.5 text-[12px]" value={filters.approvalStatus} onChange={(event) => setFilters((current) => ({ ...current, approvalStatus: event.target.value }))}>
                    {APPROVAL_STATUS_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item === 'all' ? 'All' : item}
                      </option>
                    ))}
                  </select>
                </ReportFilterField>

                <ReportFilterField label="Search">
                  <div className="input-shell h-9 px-3 py-1.5 text-[12px]">
                    <Search className="h-3.5 w-3.5 shrink-0 text-iris-text-muted" />
                    <input
                      placeholder="Report name or ID"
                      value={filters.search}
                      onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                    />
                  </div>
                </ReportFilterField>
              </div>
            </section>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-[14px] font-medium text-iris-text-primary">
              <span className="font-semibold">{filteredItems.length}</span> reports <span className="text-iris-text-muted">·</span>{' '}
              <span className="font-semibold">{selectedVisibleCount}</span> selected
            </div>
            <label className="inline-flex items-center gap-2 rounded-md border border-[#D7E1E8] bg-white px-3 py-2 text-[12px] font-medium text-iris-text-primary">
              <input checked={allVisibleSelected} onChange={(event) => handleSelectAll(event.target.checked)} type="checkbox" />
              Select all
            </label>
          </div>

          {reportsQuery.isLoading ? (
            <section className="mt-3 rounded-lg border border-[#D7E1E8] bg-white p-4">
              <TableSkeleton columns={7} rows={7} />
            </section>
          ) : filteredItems.length ? (
            <section className="mt-3 overflow-hidden rounded-lg border border-[#D7E1E8] bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full text-[12px]">
                  <thead className="border-b border-[#E8EEF3] bg-white">
                    <tr>
                      {['', 'Report', 'Category', 'Cadence', 'Distribution', 'Sensitivity', 'Actions'].map((label) => (
                        <th key={label || 'checkbox'} className="px-4 py-3 text-left text-[11px] font-semibold text-iris-text-secondary">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const ItemIcon = CATEGORY_ICONS[item.category]
                      return (
                        <tr key={item.report_id} className="border-t border-[#E8EEF3] align-top">
                          <td className="px-4 py-3.5">
                            <input
                              checked={selectedReportIds.includes(item.report_id)}
                              onChange={(event) => handleSelectOne(item.report_id, event.target.checked)}
                              type="checkbox"
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-start gap-2.5">
                              <ItemIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5C7283]" />
                              <div className="min-w-0">
                                <p className="text-[14px] font-medium leading-5 text-iris-text-primary">{item.name}</p>
                                <p className="mt-0.5 text-[12px] leading-5 text-[#51697A]">
                                  {item.report_id} · {item.description}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-[12px] text-iris-text-primary">{item.category}</td>
                          <td className="px-4 py-3.5 text-[12px] text-iris-text-primary">{item.cadence}</td>
                          <td className="px-4 py-3.5 text-[12px] leading-5 text-iris-text-secondary">{item.distribution.join(', ')}</td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={item.sensitivity}>{item.sensitivity}</StatusBadge>
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              className="inline-flex items-center gap-1 rounded-md border border-[#D7E1E8] bg-white px-3 py-1.5 text-[12px] font-medium text-iris-text-primary transition hover:bg-iris-bg"
                              onClick={() => openReport(item)}
                              type="button"
                            >
                              Open
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="mt-3 rounded-lg border border-[#D7E1E8] bg-white p-4">
              <EmptyState
                compact
                description="Try widening the category filter or clearing the search term to bring report catalog rows back."
                title="No reports matched this catalog view"
              />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function ReportKpiCard({
  label,
  subtitle,
  value,
}: {
  label: string
  subtitle: string
  value: string
}) {
  return (
    <article className="rounded-lg border border-[#D7E1E8] bg-white px-5 py-4">
      <p className="text-[12px] text-iris-text-secondary">{label}</p>
      <p className="mt-3 text-[22px] font-bold leading-none text-iris-text-primary">{value}</p>
      <p className="mt-2 text-[12px] text-iris-text-secondary">{subtitle}</p>
    </article>
  )
}

function ReportFilterField({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-iris-text-secondary">{label}</span>
      {children}
    </label>
  )
}

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13px] font-medium text-iris-text-primary transition hover:bg-white"
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4 text-[#274A63]" />
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
