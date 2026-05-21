import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Inbox, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { api } from '../../../api/client'
import { Breadcrumbs } from '../../../components/common/Breadcrumbs'
import { EmptyState, EmptyTableRow } from '../../../components/common/EmptyState'
import { PageHeader } from '../../../components/common/PageHeader'
import { FileProcessingModal } from './FileProcessingModal'
import { formatRelativeDate } from '../../../utils/formatters'
import type {
  ClaimsCessionQueueItem,
  ClaimsCessionQueuePayload,
} from '../../../types/api'

type StatusFilter = 'all' | 'exceptions' | 'review' | 'approved'

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'review', label: 'Review' },
  { id: 'approved', label: 'Approved' },
]

export function CessionFilesPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [fileTypeFilter, setFileTypeFilter] = useState('all')
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  const queueQuery = useQuery({
    queryKey: ['claims-cession-files', statusFilter, fileTypeFilter],
    queryFn: async () =>
      (
        await api.get<ClaimsCessionQueuePayload>('/claims/cession-files', {
          params: {
            status: statusFilter,
            file_type: fileTypeFilter === 'all' ? undefined : fileTypeFilter,
            page: 1,
            page_size: 50,
          },
        })
      ).data,
  })

  const fileTypeOptions = ['all', ...new Set((queueQuery.data?.items ?? []).map((item) => item.file_type).filter(Boolean))]

  return (
    <div className="cession-compact">
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Claims Ops' }, { label: 'Cession Files' }]} />
      <PageHeader
        action={
          <button className="btn-primary" onClick={() => setUploadModalOpen(true)} type="button">
            <Upload className="h-4 w-4" />
            Upload File
          </button>
        }
        title="Cedant File Processing"
      />

      {queueQuery.data ? (
        <>
          <div className="compact-kpi-grid">
            <MetricCard label="In Pipeline" subtitle="awaiting" value={formatCount(queueQuery.data.metrics.in_pipeline)} />
            <MetricCard label="Exceptions" subtitle="critical errors" value={formatCount(queueQuery.data.metrics.exceptions)} tone="critical" />
            <MetricCard label="Processed" subtitle="approved" value={formatCount(queueQuery.data.metrics.processed)} tone="success" />
            <MetricCard label="STP" subtitle="straight-through" value={`${queueQuery.data.metrics.stp_pct.toFixed(1)}%`} tone="blue" />
          </div>

          <div className="mt-4 rounded-[22px] border border-iris-border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[18px] font-bold text-iris-text-primary">Pipeline Throughput (24h)</p>
                <p className="mt-1 text-[13px] text-iris-text-secondary">Spec-backed mock metrics with live queue rows below.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ThroughputTile label="Records ingested" value={formatCount(queueQuery.data.metrics.pipeline_throughput.records_ingested)} />
              <ThroughputTile label="Files" value={formatCount(queueQuery.data.metrics.pipeline_throughput.files)} />
              <ThroughputTile label="In exception" value={formatCount(queueQuery.data.metrics.pipeline_throughput.in_exception)} />
              <ThroughputTile label="Avg processing time" value={queueQuery.data.metrics.pipeline_throughput.avg_processing_time} />
            </div>
          </div>

          <div className="mt-5 rounded-[22px] border border-iris-border bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-[#E8EDF2] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[18px] font-bold text-iris-text-primary">File Queue</p>
                {/* <p className="mt-1 text-[13px] text-iris-text-secondary">{formatCount(queueQuery.data.items.length)} file(s) currently in this filtered view. Historical intake and processing detail now open in the full-page workflow.</p> */}
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <select className="field-input min-w-[220px]" value={fileTypeFilter} onChange={(event) => setFileTypeFilter(event.target.value)}>
                  {fileTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'all' ? 'All types' : option}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap gap-2">
                  {STATUS_FILTERS.map((item) => (
                    <button
                      key={item.id}
                      className={`rounded-full px-3.5 py-2 text-[12px] font-semibold transition ${
                        statusFilter === item.id
                          ? 'bg-iris-navy text-white'
                          : 'bg-[#F4F7FA] text-iris-text-secondary hover:bg-[#EAF1F6]'
                      }`}
                      onClick={() => setStatusFilter(item.id)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-[13px]">
                <thead className="bg-[#F8F9FA]">
                  <tr>
                    {['File ID', 'Filename', 'Cedant', 'Type', 'Contract', 'Records', 'Stage', 'Critical', 'Received'].map((label) => (
                      <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queueQuery.data.items.map((item) => (
                    <QueueRow key={item.file_id} item={item} onOpen={() => navigate(`/claims/cession-files/${item.file_id}`)} />
                  ))}

                  {!queueQuery.data.items.length ? (
                    <EmptyTableRow
                      colSpan={9}
                      description="Try another file type or status pill, or upload a new cedant file to seed the queue."
                      title="No cession files match the selected filters"
                    />
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : queueQuery.isLoading ? (
        <div className="panel-card">Loading cession file queue...</div>
      ) : (
        <EmptyState
          description="The queue payload could not be loaded for this session. Refresh the page or re-open the file-processing workflow."
          icon={<Inbox className="h-5 w-5" />}
          title="Unable to load the cession file queue"
        />
      )}

      {uploadModalOpen ? (
        <FileProcessingModal
          cedentOptions={[]}
          contractOptions={[]}
          modalVariant="upload-only"
          onClose={() => setUploadModalOpen(false)}
          onFileCreated={(nextFileId) => {
            setUploadModalOpen(false)
            navigate(`/claims/cession-files/${nextFileId}`)
          }}
          onRefresh={() => queueQuery.refetch()}
        />
      ) : null}
    </div>
  )
}

function QueueRow({ item, onOpen }: { item: ClaimsCessionQueueItem; onOpen: () => void }) {
  return (
    <tr className="cursor-pointer border-t border-[#EEF2F5] transition hover:bg-[#FAFBFC]" onClick={onOpen}>
      <td className="px-4 py-3 font-mono text-[12px] text-iris-blue">{item.file_id}</td>
      <td className="px-4 py-3 font-medium text-iris-text-primary">{item.filename}</td>
      <td className="px-4 py-3 text-iris-text-secondary">{item.cedent}</td>
      <td className="px-4 py-3 text-iris-text-secondary">{item.file_type}</td>
      <td className="px-4 py-3 text-iris-text-secondary">{item.contract_id ?? '—'}</td>
      <td className="px-4 py-3 text-iris-text-secondary">{formatCount(item.records)}</td>
      <td className="px-4 py-3">
        <QueueStageBadge stage={item.stage} />
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${item.critical_count > 0 ? 'bg-[#FDEDEC] text-[#922B21]' : 'bg-[#E8F8F5] text-[#117A65]'}`}>
          {item.critical_count}
        </span>
      </td>
      <td className="px-4 py-3 text-iris-text-secondary">{formatRelativeDate(item.received_at)}</td>
    </tr>
  )
}

function QueueStageBadge({ stage }: { stage: string }) {
  const normalized = stage.toLowerCase()
  const classes: Record<string, string> = {
    uploaded: 'bg-[#EEF1F4] text-[#566573]',
    detected: 'bg-[#EBF5FB] text-[#1A5276]',
    mapped: 'bg-[#EBF5FB] text-[#1A5276]',
    clauses: 'bg-[#EBF5FB] text-[#1A5276]',
    validated: 'bg-[#DDF7F2] text-[#117A65]',
    exceptions: 'bg-[#FDEDEC] text-[#922B21]',
    processing: 'bg-[#EBF5FB] text-[#1A5276]',
    processed: 'bg-[#D5F5E3] text-[#1E8449]',
    approved: 'bg-[#D5F5E3] text-[#1E8449]',
    rejected: 'bg-[#FDEDEC] text-[#922B21]',
  }

  return <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${classes[normalized] ?? 'bg-[#EEF1F4] text-[#566573]'}`}>{titleCase(stage)}</span>
}

function MetricCard({
  label,
  value,
  subtitle,
  tone = 'neutral',
}: {
  label: string
  value: string
  subtitle: string
  tone?: 'neutral' | 'critical' | 'success' | 'blue'
}) {
  const toneClass =
    tone === 'critical'
      ? 'border-[#F4C8C9] bg-[#FFF8F8]'
      : tone === 'success'
        ? 'border-[#CFE9D9] bg-[#F7FCF8]'
        : tone === 'blue'
          ? 'border-[#D3E4F2] bg-[#F7FBFF]'
          : 'border-[#DCE4EB] bg-white'

  return (
    <div className={`rounded-[20px] border px-4 py-4 shadow-sm ${toneClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-iris-text-muted">{label}</div>
      <div className="mt-2 text-[24px] font-bold text-iris-text-primary">{value}</div>
      <div className="mt-1 text-[12px] text-iris-text-secondary">{subtitle}</div>
    </div>
  )
}

function ThroughputTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E3EAF0] bg-[#F8FAFC] px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</div>
      <div className="mt-2 text-[22px] font-bold text-iris-text-primary">{value}</div>
    </div>
  )
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-GB').format(value)
}

