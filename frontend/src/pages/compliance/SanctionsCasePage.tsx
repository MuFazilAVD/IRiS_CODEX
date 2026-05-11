import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, MapPin, Shield, UserRound, Wallet } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../../api/client'
import { Breadcrumbs } from '../../components/common/Breadcrumbs'
import { PageHeader } from '../../components/common/PageHeader'
import { useUiStore } from '../../store/uiStore'
import type {
  ComplianceHitResolutionResponse,
  ComplianceSanctionsCaseDetailPayload,
  ComplianceSanctionsOverviewPayload,
  SanctionsCaseAnalysis,
  SanctionsCaseAuditEvent,
} from '../../types/api'

export function SanctionsCasePage() {
  const { screeningRef = '' } = useParams()
  const navigate = useNavigate()
  const pushToast = useUiStore((state) => state.pushToast)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const overviewQuery = useQuery({
    queryKey: ['compliance-sanctions-workspace'],
    queryFn: async () => (await api.get<ComplianceSanctionsOverviewPayload>('/compliance/sanctions/overview')).data,
  })

  const detailQuery = useQuery({
    queryKey: ['compliance-sanctions-case', screeningRef],
    queryFn: async () => (await api.get<ComplianceSanctionsCaseDetailPayload>(`/compliance/sanctions/hits/${screeningRef}`)).data,
    enabled: Boolean(screeningRef),
  })

  const caseIndex = useMemo(
    () => (overviewQuery.data?.cases ?? []).findIndex((item) => item.screening_ref === screeningRef),
    [overviewQuery.data?.cases, screeningRef],
  )

  const previousCase = caseIndex > 0 ? overviewQuery.data?.cases[caseIndex - 1] : null
  const nextCase = caseIndex >= 0 && overviewQuery.data?.cases ? overviewQuery.data.cases[caseIndex + 1] : null

  async function handleResolution(action: 'clear' | 'escalate' | 'mark_false_positive') {
    setBusyAction(action)
    try {
      const { data } = await api.patch<ComplianceHitResolutionResponse>(`/compliance/sanctions/hits/${screeningRef}`, {
        action,
        notes: action === 'clear' ? 'Resolved from sanctions case report.' : 'Disposition captured from sanctions case report.',
      })
      await Promise.all([detailQuery.refetch(), overviewQuery.refetch()])
      pushToast({ tone: 'success', message: `${data.screening_ref} updated to ${data.status}.` })
    } catch (caughtError: unknown) {
      pushToast({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'This sanctions case could not be updated.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  const detail = detailQuery.data

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Compliance', to: '/compliance/sanctions' },
          { label: 'Sanction Screening', to: '/compliance/sanctions' },
          { label: screeningRef },
        ]}
      />

      <PageHeader
        title={detail?.title ?? screeningRef}
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => navigate('/compliance/sanctions')} type="button">
              All cases
            </button>
            <button className="btn-secondary" disabled={!previousCase} onClick={() => previousCase && navigate(`/compliance/sanctions/${previousCase.screening_ref}`)} type="button">
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button className="btn-secondary" disabled={!nextCase} onClick={() => nextCase && navigate(`/compliance/sanctions/${nextCase.screening_ref}`)} type="button">
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />
      <div className="mt-[-10px] flex items-center justify-between gap-3">
        <p className="text-[13px] text-iris-text-secondary">{detail?.subtitle}</p>
        <p className="text-[13px] text-iris-text-secondary">
          {caseIndex >= 0 && overviewQuery.data?.cases.length ? `${caseIndex + 1} / ${overviewQuery.data.cases.length}` : ''}
        </p>
      </div>

      {detailQuery.isLoading ? (
        <div className="mt-6 rounded-xl border border-iris-border bg-white px-5 py-8 text-[13px] text-iris-text-secondary">Loading sanctions case report...</div>
      ) : detail ? (
        <div className="space-y-5">
          <section className="mt-6 rounded-xl border border-iris-border bg-white px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#EEF2F5] text-iris-navy">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] text-iris-text-secondary">{detail.screening_ref}</span>
                    <Pill tone="default">{detail.trigger}</Pill>
                    <Pill tone={detail.status === 'Blocked' ? 'negative' : detail.status === 'Pending Review' ? 'warning' : 'positive'}>{detail.status}</Pill>
                  </div>
                  <h2 className="mt-2 text-[16px] font-semibold text-iris-text-primary">
                    {detail.trigger} screening · {detail.entity_name}
                  </h2>
                  <p className="mt-1 text-[13px] text-iris-text-secondary">
                    Started {formatDateTime(detail.started_at)} · {detail.processing_seconds}s · screened against {detail.watchlists_screened.join(' · ')}
                  </p>
                </div>
              </div>
              <button className="btn-secondary" onClick={() => navigate('/compliance/sanctions')} type="button">
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-iris-border bg-white">
            <div className="border-b border-[#E8EDF2] px-5 py-4">
              <h3 className="text-[16px] font-semibold text-iris-text-primary">Entity Under Screening</h3>
            </div>
            <div className="grid gap-5 px-5 py-5 xl:grid-cols-3">
              <div className="space-y-3">
                <DetailLine icon={<Shield className="h-4 w-4" />} label={detail.entity_under_screening.entity_name} />
                <InfoText label="Aliases" value={detail.entity_under_screening.aliases.join(', ') || 'None supplied'} />
                <InfoText label="Registration" value={detail.entity_under_screening.registration_number || 'Not supplied'} />
              </div>
              <div className="space-y-3">
                <DetailLine icon={<MapPin className="h-4 w-4" />} label={detail.entity_under_screening.registered_address || 'Address not supplied'} />
                <InfoText label="Country · Entity" value={`${detail.entity_under_screening.country || 'N/A'} · ${detail.entity_under_screening.entity_descriptor}`} />
                <DetailLine icon={<Wallet className="h-4 w-4" />} label={detail.entity_under_screening.bank_details || 'Bank details not supplied'} />
              </div>
              <div className="space-y-3">
                <DetailLine icon={<UserRound className="h-4 w-4" />} label="Beneficial Owners" />
                <p className="text-[14px] leading-6 text-iris-text-primary">
                  {detail.entity_under_screening.beneficial_owners.length ? detail.entity_under_screening.beneficial_owners.join(', ') : 'None supplied'}
                </p>
              </div>
            </div>
          </section>

          <section className={`rounded-xl border px-5 py-5 ${summaryClass(detail.summary.tone)}`}>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="mt-1 h-8 w-8" />
              <div>
                <h3 className="text-[15px] font-semibold">{detail.summary.headline}</h3>
                <p className="mt-2 text-[13px]">{detail.summary.description}</p>
              </div>
            </div>
          </section>

          {detail.raw_match || detail.analysis ? (
            <div className="grid gap-4 xl:grid-cols-[1fr_1.05fr]">
              {detail.raw_match ? <RawMatchPanel detail={detail.raw_match} /> : null}
              {detail.analysis ? <AnalysisPanel analysis={detail.analysis} onAction={(action) => void handleResolution(action)} busyAction={busyAction} /> : null}
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-3">
            <SimplePanel title="Network Analysis" note={detail.network_analysis.note} items={detail.network_analysis.items} />
            <DecisionHistoryPanel detail={detail.decision_history} />
            <AdverseMediaPanel severity={detail.adverse_media.severity} note={detail.adverse_media.note} />
          </div>

          <AuditTrailPanel items={detail.audit_trail} />
        </div>
      ) : null}
    </div>
  )
}

function RawMatchPanel({ detail }: { detail: NonNullable<ComplianceSanctionsCaseDetailPayload['raw_match']> }) {
  return (
    <section className="rounded-xl border border-iris-border bg-white">
      <div className="border-b border-[#E8EDF2] px-5 py-4">
        <h3 className="text-[16px] font-semibold text-iris-text-primary">{detail.title}</h3>
      </div>
      <div className="px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-medium leading-5 text-iris-text-primary">{detail.candidate_name}</p>
            <p className="mt-1 text-[13px] text-iris-text-secondary">{detail.subtitle}</p>
          </div>
          <span className="rounded-md border border-[#D9E3EA] px-2 py-1 text-[11px] text-iris-text-primary">{detail.candidate_id}</span>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <InfoText label="Country" value={detail.country} />
          <InfoText label="Type" value={detail.entity_type} />
        </div>
        <div className="mt-5 space-y-3">
          {detail.field_scores.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3 text-[12px]">
                <span className="text-iris-text-secondary">{item.label}</span>
                <span className="font-medium text-iris-text-primary">{item.value}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-[#EEF2F5]">
                <div className="h-2 rounded-full bg-[#E7626E]" style={{ width: `${item.value}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-[#E8EDF2] pt-4">
          <p className="text-[13px] text-iris-text-secondary">Aggregate match score</p>
          <p className="text-[14px] font-semibold text-iris-text-primary">{detail.aggregate_score}%</p>
        </div>
      </div>
    </section>
  )
}

function AnalysisPanel({
  analysis,
  busyAction,
  onAction,
}: {
  analysis: SanctionsCaseAnalysis
  busyAction: string | null
  onAction: (action: 'clear' | 'mark_false_positive' | 'escalate') => void
}) {
  return (
    <section className="rounded-xl border border-iris-border bg-white">
      <div className="flex items-center justify-between border-b border-[#E8EDF2] px-5 py-4">
        <h3 className="text-[16px] font-semibold text-iris-text-primary">IRiS Analysis</h3>
        <span className="rounded-md bg-[#F3F6F9] px-2 py-1 text-[11px] font-semibold text-iris-text-secondary">AI</span>
      </div>
      <div className="space-y-4 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Pill tone={analysis.label === 'High Risk' ? 'negative' : analysis.label === 'Needs Review' ? 'warning' : 'positive'}>{analysis.label}</Pill>
          <div className="flex min-w-[180px] items-center gap-3">
            <div className="h-2 flex-1 rounded-full bg-[#EEF2F5]">
              <div className="h-2 rounded-full bg-[#2EAF63]" style={{ width: `${analysis.confidence_pct}%` }} />
            </div>
            <span className="text-[12px] font-semibold text-iris-text-primary">{analysis.confidence_pct}%</span>
          </div>
        </div>

        <div className="rounded-xl border border-[#D9E7F1] bg-[#F7FBFF] px-4 py-4 text-[13px] leading-6 text-iris-text-primary">
          <p>{analysis.headline}</p>
          <p className="mt-2 text-iris-text-secondary">{analysis.body}</p>
        </div>

        <div className="space-y-2">
          {analysis.factors.map((item) => (
            <div key={item.text} className="flex items-center justify-between gap-4 text-[13px]">
              <div className="flex items-start gap-2">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.tone === 'positive' ? 'bg-[#2EAF63]' : 'bg-[#E7626E]'}`} />
                <span className="text-iris-text-primary">{item.text}</span>
              </div>
              <span className="text-iris-text-secondary">{item.weight_pct}%</span>
            </div>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {analysis.checks.map((item) => (
            <div key={item.label} className="text-[13px] text-iris-text-primary">
              <span className={`mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] ${item.passed ? 'bg-[#EAF7EF] text-[#1E8449]' : 'bg-[#FDEDEC] text-[#922B21]'}`}>
                {item.passed ? '✓' : '!'}
              </span>
              {item.label}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8EDF2] pt-4">
          <p className="text-[13px] text-iris-text-secondary">Recommended action</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" disabled={busyAction !== null} onClick={() => onAction('mark_false_positive')} type="button">
              {busyAction === 'mark_false_positive' ? 'Saving...' : 'False positive'}
            </button>
            <button className="btn-secondary" disabled={busyAction !== null} onClick={() => onAction('escalate')} type="button">
              {busyAction === 'escalate' ? 'Saving...' : 'Block'}
            </button>
            <button className="btn-primary" disabled={busyAction !== null} onClick={() => onAction('clear')} type="button">
              {busyAction === 'clear' ? 'Saving...' : analysis.recommended_action}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function SimplePanel({ title, note, items }: { title: string; note: string; items: Array<{ label: string; value: string }> }) {
  return (
    <section className="rounded-xl border border-iris-border bg-white">
      <div className="border-b border-[#E8EDF2] px-5 py-4">
        <h3 className="text-[16px] font-semibold text-iris-text-primary">{title}</h3>
      </div>
      <div className="space-y-3 px-5 py-5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 border-b border-[#EEF2F5] pb-2 last:border-b-0 last:pb-0">
            <span className="text-[13px] text-iris-text-secondary">{item.label}</span>
            <span className="text-[13px] font-medium text-iris-text-primary">{item.value}</span>
          </div>
        ))}
        <p className="text-[12px] italic text-iris-text-secondary">{note}</p>
      </div>
    </section>
  )
}

function DecisionHistoryPanel({ detail }: { detail: ComplianceSanctionsCaseDetailPayload['decision_history'] }) {
  return (
    <section className="rounded-xl border border-iris-border bg-white">
      <div className="border-b border-[#E8EDF2] px-5 py-4">
        <h3 className="text-[16px] font-semibold text-iris-text-primary">Decision History</h3>
      </div>
      <div className="space-y-3 px-5 py-5">
        <InfoText label="Times reviewed" value={String(detail.times_reviewed)} />
        <InfoText label="Last verdict" value={detail.last_verdict} />
        <p className="text-[12px] italic text-iris-text-secondary">{detail.note}</p>
      </div>
    </section>
  )
}

function AdverseMediaPanel({ severity, note }: { severity: string; note: string }) {
  return (
    <section className="rounded-xl border border-iris-border bg-white">
      <div className="border-b border-[#E8EDF2] px-5 py-4">
        <h3 className="text-[16px] font-semibold text-iris-text-primary">Adverse Media</h3>
      </div>
      <div className="space-y-3 px-5 py-5">
        <InfoText label="Severity" value={severity} />
        <p className="text-[12px] italic text-iris-text-secondary">{note}</p>
      </div>
    </section>
  )
}

function AuditTrailPanel({ items }: { items: SanctionsCaseAuditEvent[] }) {
  return (
    <section className="rounded-xl border border-iris-border bg-white">
      <div className="border-b border-[#E8EDF2] px-5 py-4">
        <h3 className="text-[16px] font-semibold text-iris-text-primary">Audit Trail</h3>
      </div>
      <div className="space-y-4 px-5 py-5">
        {items.map((item, index) => (
          <div key={`${item.timestamp}-${index}`} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className={`mt-1 h-2.5 w-2.5 rounded-full ${auditDotClass(item.actor_type)}`} />
              {index < items.length - 1 ? <span className="mt-1 h-full w-px bg-[#D9E3EA]" /> : null}
            </div>
            <div className="pb-2">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-iris-text-secondary">
                <span>{formatDateTime(item.timestamp)}</span>
                <Pill tone="default">{item.actor_type}</Pill>
                <span className="text-iris-text-primary">{item.actor}</span>
              </div>
              <p className="mt-1 text-[13px] text-iris-text-primary">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Pill({ children, tone }: { children: ReactNode; tone: 'default' | 'positive' | 'warning' | 'negative' }) {
  const toneClass =
    tone === 'positive'
      ? 'border-[#BCE1C7] bg-[#EAF7EF] text-[#1E8449]'
      : tone === 'warning'
        ? 'border-[#F3D8A3] bg-[#FFF6E5] text-[#9A6B0A]'
        : tone === 'negative'
          ? 'border-[#F3C0BA] bg-[#FDEDEC] text-[#922B21]'
          : 'border-[#D9E3EA] bg-white text-iris-text-primary'
  return <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${toneClass}`}>{children}</span>
}

function DetailLine({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[14px] leading-6 text-iris-text-primary">
      <span className="text-iris-text-secondary">{icon}</span>
      <span>{label}</span>
    </div>
  )
}

function InfoText({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-iris-text-secondary">{label}</p>
      <p className="mt-1 text-[13px] text-iris-text-primary">{value}</p>
    </div>
  )
}

function summaryClass(tone: string) {
  if (tone === 'negative') {
    return 'border-[#F3C0BA] bg-[#FEF4F3] text-[#922B21]'
  }
  if (tone === 'warning') {
    return 'border-[#F3D8A3] bg-[#FFF8EA] text-[#9A6B0A]'
  }
  return 'border-[#BCE1C7] bg-[#F4FBF6] text-[#1E8449]'
}

function auditDotClass(actorType: string) {
  if (actorType === 'AI') {
    return 'bg-[#0D1B2A]'
  }
  if (actorType === 'Human') {
    return 'bg-[#2EAF63]'
  }
  return 'bg-[#8392A5]'
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')} ${String(parsed.getUTCHours()).padStart(2, '0')}:${String(parsed.getUTCMinutes()).padStart(2, '0')}:${String(parsed.getUTCSeconds()).padStart(2, '0')}`
}

function extractErrorMessage(caughtError: unknown) {
  const maybeMessage = caughtError as { response?: { data?: { details?: string; error?: string } } }
  return maybeMessage.response?.data?.details ?? maybeMessage.response?.data?.error ?? null
}
