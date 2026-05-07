import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { api } from '../../api/client'
import { BarChart } from '../../components/charts/BarChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { LineChart } from '../../components/charts/LineChart'
import { Breadcrumbs } from '../../components/common/Breadcrumbs'
import { EmptyState } from '../../components/common/EmptyState'
import { PageHeader } from '../../components/common/PageHeader'
import { TableSkeleton } from '../../components/common/Skeleton'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useUiStore } from '../../store/uiStore'
import type { GraphConfig, ReportDetailPayload } from '../../types/api'

export function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pushToast = useUiStore((state) => state.pushToast)

  const reportQuery = useQuery({
    queryKey: ['report-detail', reportId],
    queryFn: async () => (await api.get<ReportDetailPayload>(`/reports/${reportId}`)).data,
    enabled: Boolean(reportId),
  })

  async function handleExport(format: 'csv' | 'pdf') {
    if (!reportQuery.data) {
      return
    }

    try {
      const response = await api.post<Blob>(
        '/reports/export',
        {
          report_ids: [reportQuery.data.report_id],
          format,
          filters: readFilterSummary(searchParams),
        },
        { responseType: 'blob' },
      )
      const disposition = response.headers['content-disposition']
      const fallbackFilename = format === 'pdf' ? `${reportQuery.data.report_id}.pdf` : `${reportQuery.data.report_id}.csv`
      const filename = extractFilename(disposition) ?? fallbackFilename
      downloadBlob(response.data, filename)
      pushToast({ tone: 'success', message: `${reportQuery.data.report_id} downloaded as ${format.toUpperCase()}.` })
    } catch (caughtError: unknown) {
      pushToast({ tone: 'error', message: extractErrorMessage(caughtError) ?? 'Report download could not be completed.' })
    }
  }

  const filterSummary = readFilterSummary(searchParams)

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Reporting', to: '/reports' },
          { label: 'Report Catalog', to: '/reports' },
          { label: reportQuery.data?.name ?? reportId ?? 'Report Detail' },
        ]}
      />
      <PageHeader
        title={reportQuery.data?.name ?? 'Report Detail'}
        subtitle={reportQuery.data?.description ?? 'Loading static mock report content for this catalog entry...'}
        action={
          <>
            <button className="btn-secondary" onClick={() => navigate('/reports')} type="button">
              <ArrowLeft className="h-4 w-4" />
              Back to catalog
            </button>
            <button className="btn-secondary" disabled={!reportQuery.data} onClick={() => void handleExport('csv')} type="button">
              <Download className="h-4 w-4" />
              Download CSV
            </button>
            <button className="btn-primary" disabled={!reportQuery.data} onClick={() => void handleExport('pdf')} type="button">
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </>
        }
      />

      {reportQuery.isLoading ? (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-[22px] border border-iris-border bg-white px-5 py-4 shadow-sm">
                <div className="h-3 w-24 rounded-full bg-[#EEF2F5]" />
                <div className="mt-4 h-8 w-20 rounded-lg bg-[#EEF2F5]" />
                <div className="mt-3 h-3 w-28 rounded-full bg-[#EEF2F5]" />
              </div>
            ))}
          </div>
          <div className="rounded-[24px] border border-iris-border bg-white p-5 shadow-sm">
            <TableSkeleton columns={5} rows={5} />
          </div>
        </div>
      ) : reportQuery.data ? (
        <div className="space-y-5">
          <section className="rounded-[24px] border border-iris-border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] text-iris-blue">{reportQuery.data.report_id}</span>
                  <StatusBadge status={reportQuery.data.sensitivity}>{reportQuery.data.sensitivity}</StatusBadge>
                  <span className="rounded-full bg-[#EEF4F8] px-2.5 py-1 text-[11px] font-semibold text-iris-blue">{reportQuery.data.category}</span>
                </div>
                <p className="mt-3 max-w-[840px] text-[14px] leading-7 text-iris-text-secondary">{reportQuery.data.insight}</p>
              </div>
              <div className="rounded-xl border border-iris-border bg-[#FBFCFD] px-4 py-3 text-[13px] text-iris-text-secondary">
                {reportQuery.data.cadence} cadence · {reportQuery.data.distribution.join(', ')}
              </div>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {reportQuery.data.metrics.map((item) => (
              <DetailMetricCard key={item.label} label={item.label} subtitle={item.subtitle} tone={item.tone} value={item.value} />
            ))}
          </div>

          <section className="rounded-[24px] border border-iris-border bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-[18px] font-bold text-iris-text-primary">Filter summary</h2>
              <p className="mt-1 text-[12px] text-iris-text-secondary">The current report preview carries these mock filter values from the catalog.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(filterSummary).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-iris-border bg-[#FBFCFD] p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{formatFilterLabel(label)}</p>
                  <p className="mt-2 text-[14px] font-semibold text-iris-text-primary">{value || 'All'}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div>{reportQuery.data.graph ? <GraphPanel graph={reportQuery.data.graph} /> : null}</div>
            <section className="rounded-[24px] border border-iris-border bg-white p-5 shadow-sm">
              <h2 className="text-[18px] font-bold text-iris-text-primary">Preview notes</h2>
              <p className="mt-1 text-[12px] text-iris-text-secondary">Static POC context carried with this report detail.</p>
              <div className="mt-4 space-y-3">
                {reportQuery.data.notes.length ? (
                  reportQuery.data.notes.map((item) => (
                    <div key={item} className="rounded-xl border border-iris-border bg-[#FBFCFD] p-3.5 text-[13px] leading-6 text-iris-text-secondary">
                      {item}
                    </div>
                  ))
                ) : (
                  <EmptyState compact description="Additional report context will appear here when preview notes are configured." title="No preview notes were configured" />
                )}
              </div>
            </section>
          </div>

          <section className="rounded-[24px] border border-iris-border bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-[18px] font-bold text-iris-text-primary">Mock table preview</h2>
              <p className="mt-1 text-[12px] text-iris-text-secondary">Static sample rows for this report type. No live computation is performed in Phase 14.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-[13px]">
                <thead className="bg-[#F8F9FA]">
                  <tr>
                    {reportQuery.data.table.columns.map((column) => (
                      <th key={column} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportQuery.data.table.rows.map((row, index) => (
                    <tr key={`${index}-${row[reportQuery.data.table.columns[0]] ?? 'row'}`} className="border-t border-[#EEF2F5]">
                      {reportQuery.data.table.columns.map((column) => (
                        <td key={`${index}-${column}`} className="px-4 py-3 text-iris-text-primary">
                          {row[column] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <EmptyState description="The requested report detail could not be loaded from the mock catalog." title="Report detail is unavailable" />
      )}
    </div>
  )
}

function DetailMetricCard({
  label,
  subtitle,
  tone,
  value,
}: {
  label: string
  subtitle: string
  tone: 'default' | 'positive' | 'negative' | 'warning'
  value: string
}) {
  const borderClass =
    tone === 'positive'
      ? 'border-[#82E0AA]'
      : tone === 'negative'
        ? 'border-[#F1948A]'
        : tone === 'warning'
          ? 'border-[#F8C471]'
          : 'border-[#AED6F1]'

  return (
    <div className={`rounded-[22px] border border-iris-border border-l-4 ${borderClass} bg-white px-5 py-4 shadow-sm`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      <p className="mt-3 text-[28px] font-bold text-iris-text-primary">{value}</p>
      <p className="mt-2 text-[12px] text-iris-text-secondary">{subtitle}</p>
    </div>
  )
}

function GraphPanel({ graph }: { graph: GraphConfig }) {
  if (graph.type === 'line') {
    return <LineChart graph={graph} />
  }
  if (graph.type === 'donut') {
    return <DonutChart graph={graph} />
  }
  return <BarChart graph={graph} />
}

function readFilterSummary(searchParams: URLSearchParams) {
  return {
    cedent_id: searchParams.get('cedent_id') ?? searchParams.get('cedant') ?? 'all',
    contract_id: searchParams.get('contract_id') ?? 'all',
    period: normalizePeriod(searchParams.get('period')) ?? '2025 Q1',
    valuation_date: searchParams.get('valuation_date') ?? '2025-03-31',
    assumption_set: searchParams.get('assumption_set') ?? 'v3.2',
    currency: searchParams.get('currency') ?? 'all',
    movement_type: searchParams.get('movement_type') ?? 'all',
    compliance_status: searchParams.get('compliance_status') ?? 'all',
    approval_status: searchParams.get('approval_status') ?? 'all',
    search: searchParams.get('search') ?? '',
    sensitivity: searchParams.get('sensitivity') ?? 'all',
  }
}

function formatFilterLabel(value: string) {
  return value.replaceAll('_', ' ')
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

function extractErrorMessage(caughtError: unknown) {
  if (typeof caughtError !== 'object' || caughtError === null || !('response' in caughtError)) {
    return null
  }
  const response = (caughtError as { response?: { data?: { detail?: string; details?: string; error?: string } } }).response
  return response?.data?.details ?? response?.data?.detail ?? response?.data?.error ?? null
}
