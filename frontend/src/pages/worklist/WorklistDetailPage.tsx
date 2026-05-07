import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Mail, WandSparkles } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../../api/client'
import { Breadcrumbs } from '../../components/common/Breadcrumbs'
import { EmptyState } from '../../components/common/EmptyState'
import { useUiStore } from '../../store/uiStore'
import type { WorklistPayload } from '../../types/api'

const DETAIL_OVERRIDES = {
  'WL-9202': {
    headline: 'Data Normalization Failure - Missing DOB (120 records)',
    reference: 'FILE-9921 · Q1 2026',
    badge: 'Blocking',
    issue: 'Normalization failed due to missing Date of Birth (DOB) values in 120 records.',
    rootCause:
      "Required field 'Date of Birth (DOB)' is missing in 120 records. No schema or column mapping mismatch detected.",
    impact:
      'Mortality calculations cannot be completed. Settlement processing is blocked until data is resolved or imputed.',
    requiredAction: 'Provide missing DOB values or proceed with statistical imputation.',
    metrics: [
      ['Total Records', '15,240'],
      ['Affected', '120'],
      ['Confidence', '94%'],
      ['Variance', '+2.1%'],
      ['Last Updated', '12m ago'],
      ['Assigned To', 'Operations Team A'],
    ],
    workflowProcessId: 'IRIS-PRC-59206-A',
  },
} as const

export function WorklistDetailPage() {
  const { wlId = '' } = useParams()
  const navigate = useNavigate()
  const pushToast = useUiStore((state) => state.pushToast)

  const worklistQuery = useQuery({
    queryKey: ['worklist-detail', wlId],
    queryFn: async () => (await api.get<WorklistPayload>('/worklist')).data,
  })

  const item = useMemo(() => worklistQuery.data?.items.find((entry) => entry.wl_id === wlId) ?? null, [worklistQuery.data?.items, wlId])
  const detail = DETAIL_OVERRIDES[wlId as keyof typeof DETAIL_OVERRIDES] ?? null

  if (worklistQuery.isLoading) {
    return <div className="panel-card">Loading worklist detail...</div>
  }

  if (!item && !detail) {
    return (
      <EmptyState
        description="Return to the worklist and reopen the task. This detail view currently supports the screenshot-aligned operations task flow."
        icon={<Mail className="h-5 w-5" />}
        title="Worklist detail not available"
      />
    )
  }

  return (
    <div className="pb-20">
      <Breadcrumbs items={[{ label: 'Worklist', to: '/worklist' }, { label: wlId }]} />

      <div className="rounded-[24px] bg-iris-navy px-6 py-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B8CAD9]">Operations</p>
            <h1 className="mt-2 text-[30px] font-bold leading-tight">{detail?.headline ?? item?.title ?? wlId}</h1>
            <p className="mt-2 text-[13px] text-[#DCE7F1]">
              {detail?.reference ?? `${item?.wl_id ?? wlId} · ${item?.category ?? 'Worklist Task'}`}
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-[#FDEDEC] px-3 py-1 text-[12px] font-semibold text-[#922B21]">
            {detail?.badge ?? item?.priority ?? 'Open'}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="space-y-5">
          <SectionCard body={detail?.issue ?? item?.description ?? 'Issue context unavailable.'} title="Issue" />
          <SectionCard body={detail?.rootCause ?? 'Root cause context is not available for this task yet.'} title="Root Cause" />
          <SectionCard body={detail?.impact ?? 'Impact assessment is not available for this task yet.'} title="Impact" />

          <div className="rounded-[24px] border border-[#F6D2A3] bg-[#FFF8EE] px-5 py-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B9770E]">Required Action</p>
            <p className="mt-3 text-[15px] font-semibold text-iris-text-primary">{detail?.requiredAction ?? 'No action guidance is currently defined.'}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              onClick={() => pushToast({ tone: 'info', message: 'A data request draft has been prepared for the cedent operations contact.' })}
              type="button"
            >
              <Mail className="h-4 w-4" />
              Request Data
            </button>
            <button
              className="btn-primary"
              onClick={() => pushToast({ tone: 'success', message: 'Statistical imputation has been queued as a documented mock remediation path.' })}
              type="button"
            >
              <WandSparkles className="h-4 w-4" />
              Impute
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[24px] border border-[#D9E3EA] bg-white px-5 py-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">Decision Metrics</p>
            <div className="mt-4 grid gap-3">
              {(detail?.metrics ?? []).map(([label, value]) => (
                <MetricRow key={label} label={label} value={value} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {detail?.workflowProcessId ? (
        <div className="fixed bottom-6 right-6 z-20">
          <button className="btn-primary shadow-lg" onClick={() => navigate(`/operations/${detail.workflowProcessId}`)} type="button">
            Go to Workflow
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SectionCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-[#D9E3EA] bg-white px-5 py-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">{title}</p>
      <p className="mt-3 text-[15px] leading-7 text-iris-text-primary">{body}</p>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  const accent = label === 'Affected' || label === 'Variance' ? 'text-[#922B21]' : 'text-iris-text-primary'
  return (
    <div className="rounded-xl bg-[#F8FAFC] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      <p className={`mt-1.5 text-[16px] font-semibold ${accent}`}>{value}</p>
    </div>
  )
}
