import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { api } from '../../../api/client'
import type {
  ComplianceScreenEntityResponse,
  OperationsScreeningMatchRow,
  OperationsScreeningPayload,
} from '../../../types/api'

export function ScreeningStep({
  busy,
  payload,
  processId,
  onResolve,
}: {
  busy: boolean
  payload: OperationsScreeningPayload
  processId: string
  onResolve: (screeningRef: string, action: string) => void
}) {
  const [selectedRef, setSelectedRef] = useState<string | null>(payload.match_table[0]?.screening_ref ?? null)

  useEffect(() => {
    setSelectedRef(payload.match_table[0]?.screening_ref ?? null)
  }, [payload.match_table, processId])

  const liveScreeningQuery = useQuery({
    queryKey: ['operations-screening-live', processId, payload.entities.map((item) => item.screening_ref).join('|')],
    queryFn: async () =>
      Promise.all(
        payload.entities.map(async (entity) => (await api.get<ComplianceScreenEntityResponse>('/compliance/sanctions/screen', { params: entity })).data),
      ),
    enabled: payload.entities.length > 0,
  })

  const mergedRows = useMemo(() => {
    const liveResults = new Map(
      (liveScreeningQuery.data ?? []).map((item) => [
        item.screening_ref,
        {
          confidence: item.llm_confidence,
          status: titleCase(item.result),
          source: item.source,
          matched_lists: item.matched_lists,
          reasoning: item.llm_reasoning,
        },
      ]),
    )

    return payload.match_table.map((row) => {
      const live = liveResults.get(row.screening_ref)
      return {
        ...row,
        confidence: live?.confidence ?? row.confidence,
        status: live?.status ?? row.status,
        source: live?.source ?? row.source,
        matched_lists: live?.matched_lists ?? [row.match_type],
        reasoning: live?.reasoning ?? '',
      }
    })
  }, [liveScreeningQuery.data, payload.match_table])

  const selectedRow = mergedRows.find((row) => row.screening_ref === selectedRef) ?? mergedRows[0] ?? null

  return (
    <div className="space-y-5">
      <SectionHeading subtitle={payload.subtitle} title={payload.title} />

      <div className="grid gap-4 xl:grid-cols-4">
        <KpiCard label="Entities Screened" value={formatCount(payload.entities_screened)} />
        <KpiCard label="Matches Found" value={formatCount(payload.matches_found)} />
        <KpiCard label="False Positives" value={formatCount(payload.false_positives)} />
        <KpiCard label="Critical Alerts" tone="text-[#922B21]" value={formatCount(payload.critical_alerts)} />
      </div>

      <div className="rounded-[24px] border border-[#D9E3EA] bg-white shadow-sm">
        <div className="border-b border-[#E9EEF3] px-5 py-4">
          <p className="text-[16px] font-semibold text-iris-text-primary">Match Table</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F7F9FB]">
              <tr>
                {['Entity Name', 'Match Type', 'Source', 'Confidence', 'Status'].map((column) => (
                  <th key={column} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mergedRows.length ? (
                mergedRows.map((row) => (
                  <tr
                    key={row.screening_ref}
                    className={`cursor-pointer border-t border-[#EEF2F5] transition ${selectedRef === row.screening_ref ? 'bg-[#F4FBFB]' : 'hover:bg-[#FAFCFD]'}`}
                    onClick={() => setSelectedRef(row.screening_ref)}
                  >
                    <td className="px-4 py-3 font-medium text-iris-text-primary">{row.entity_name}</td>
                    <td className="px-4 py-3 text-iris-text-secondary">{row.match_type}</td>
                    <td className="px-4 py-3 text-iris-text-secondary">{row.source}</td>
                    <td className="px-4 py-3 text-iris-text-secondary">{Math.round(row.confidence * 100)}%</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusClass(row.status)}`}>{row.status}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-iris-text-secondary" colSpan={5}>
                    No screening hits were returned for this pipeline.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[22px] border border-[#D9E3EA] bg-white px-5 py-4 shadow-sm">
        <p className="text-[15px] font-semibold text-iris-text-primary">IRiS Insight</p>
        <p className="mt-2 text-[13px] text-iris-text-secondary">{payload.insight}</p>
        {selectedRow ? (
          <div className="mt-4 rounded-xl bg-[#F8FAFC] px-4 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">Selected Screening Hit</p>
            <p className="mt-2 text-[14px] font-semibold text-iris-text-primary">
              {selectedRow.entity_name} · {selectedRow.screening_ref}
            </p>
            <p className="mt-1 text-[13px] text-iris-text-secondary">
              {(selectedRow as OperationsScreeningMatchRow & { reasoning?: string }).reasoning || 'Awaiting additional review notes.'}
            </p>
          </div>
        ) : null}
        {liveScreeningQuery.isError ? (
          <p className="mt-3 text-[12px] text-[#922B21]">Live sanctions verification could not be refreshed from the backend right now.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary"
          disabled={busy || !selectedRow}
          onClick={() => selectedRow && onResolve(selectedRow.screening_ref, 'escalate_to_compliance')}
          type="button"
        >
          Escalate to Compliance
        </button>
        <button
          className="btn-secondary"
          disabled={busy || !selectedRow}
          onClick={() => selectedRow && onResolve(selectedRow.screening_ref, 'mark_false_positive')}
          type="button"
        >
          Mark as False Positive
        </button>
        <button
          className="btn-secondary"
          disabled={busy || !selectedRow}
          onClick={() => selectedRow && onResolve(selectedRow.screening_ref, 'request_additional_data')}
          type="button"
        >
          Request Additional Data
        </button>
      </div>
    </div>
  )
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-[24px] font-bold text-iris-text-primary">{title}</h2>
      <p className="mt-1.5 text-[13px] text-iris-text-secondary">{subtitle}</p>
    </div>
  )
}

function KpiCard({ label, value, tone = 'text-iris-text-primary' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-[22px] border border-[#D9E3EA] bg-white px-5 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-iris-text-muted">{label}</p>
      <p className={`mt-3 text-[26px] font-bold ${tone}`}>{value}</p>
    </div>
  )
}

function statusClass(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === 'review' || normalized === 'escalated') {
    return 'bg-[#FDEDEC] text-[#922B21]'
  }
  if (normalized === 'cleared') {
    return 'bg-[#D5F5E3] text-[#1E8449]'
  }
  return 'bg-[#EBF5FB] text-[#1A5276]'
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
