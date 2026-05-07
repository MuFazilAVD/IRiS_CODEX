import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { api } from '../../../api/client'
import { Breadcrumbs } from '../../../components/common/Breadcrumbs'
import { EmptyTableRow } from '../../../components/common/EmptyState'
import { PageHeader } from '../../../components/common/PageHeader'
import { KpiGridSkeleton, TableSkeleton } from '../../../components/common/Skeleton'
import { StatusBadge } from '../../../components/common/StatusBadge'
import { useUiStore } from '../../../store/uiStore'
import { formatCurrency } from '../../../utils/formatters'
import type {
  CedentsListPayload,
  ClaimsSettlementApproveResponse,
  ClaimsSettlementListItem,
  ClaimsSettlementListPayload,
  ContractsListPayload,
} from '../../../types/api'
import { SettlementDetailPanel } from './SettlementDetailPanel'

export function SettlementsPage() {
  const [searchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCedentId, setSelectedCedentId] = useState(searchParams.get('cedent_id') ?? 'all')
  const [selectedContractId, setSelectedContractId] = useState(searchParams.get('contract_id') ?? 'all')
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') ?? 'all')
  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null)
  const [busySettlementId, setBusySettlementId] = useState<string | null>(null)
  const pushToast = useUiStore((state) => state.pushToast)

  const settlementsQuery = useQuery({
    queryKey: ['claims-settlements', selectedCedentId, selectedContractId, selectedStatus],
    queryFn: async () =>
      (
        await api.get<ClaimsSettlementListPayload>('/claims/settlements', {
          params: {
            status: selectedStatus,
            cedent_id: selectedCedentId === 'all' ? undefined : selectedCedentId,
            contract_id: selectedContractId === 'all' ? undefined : selectedContractId,
            page: 1,
            page_size: 100,
          },
        })
      ).data,
  })

  const cedentsQuery = useQuery({
    queryKey: ['claims-settlement-cedents'],
    queryFn: async () =>
      (
        await api.get<CedentsListPayload>('/underwriting/cedents', {
          params: { status: 'all', page: 1, page_size: 100 },
        })
      ).data,
  })

  const contractsQuery = useQuery({
    queryKey: ['claims-settlement-contracts'],
    queryFn: async () =>
      (
        await api.get<ContractsListPayload>('/underwriting/contracts', {
          params: { status: 'all', page: 1, page_size: 200 },
        })
      ).data,
  })

  const contractOptions = contractsQuery.data?.items ?? []
  const visibleContracts = useMemo(
    () => (selectedCedentId === 'all' ? contractOptions : contractOptions.filter((item) => item.cedent_id === selectedCedentId)),
    [contractOptions, selectedCedentId],
  )

  useEffect(() => {
    if (selectedContractId === 'all' || selectedCedentId !== 'all') {
      return
    }
    const matchingContract = contractOptions.find((item) => item.contract_id === selectedContractId)
    if (matchingContract?.cedent_id) {
      setSelectedCedentId(matchingContract.cedent_id)
    }
  }, [contractOptions, selectedCedentId, selectedContractId])

  useEffect(() => {
    if (selectedContractId === 'all') {
      return
    }
    const currentStillVisible = visibleContracts.some((item) => item.contract_id === selectedContractId)
    if (!currentStillVisible) {
      setSelectedContractId('all')
    }
  }, [selectedContractId, visibleContracts])

  const settlementItems = settlementsQuery.data?.items ?? []
  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) {
      return settlementItems
    }
    return settlementItems.filter((item) =>
      [item.settlement_id, item.cedent_name, item.contract_name, item.contract_id ?? '', item.period_label]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [searchTerm, settlementItems])

  async function handleQuickApprove(item: ClaimsSettlementListItem) {
    setBusySettlementId(item.settlement_id)
    try {
      const { data } = await api.post<ClaimsSettlementApproveResponse>(`/claims/settlements/${item.settlement_id}/approve`, {
        notes: 'Approved from settlement register.',
      })
      await settlementsQuery.refetch()
      pushToast({
        tone: 'success',
        message: `${data.settlement_id} approved from the settlement register.`,
      })
    } catch (caughtError: unknown) {
      pushToast({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to approve this settlement right now.',
      })
    } finally {
      setBusySettlementId(null)
    }
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Claims & Settlement' }, { label: 'Settlements' }]} />
      <PageHeader
        eyebrow="Claims & Settlement"
        subtitle="Settlement approvals, held payments, and dispute routing created from the claims operations pipeline."
        title="Settlements"
      />

      {settlementsQuery.isLoading ? (
        <KpiGridSkeleton count={4} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Pending Approval" tone="amber" value={String(settlementsQuery.data?.metrics.pending_approval ?? 0)} />
          <MetricCard
            label="Pending Amount"
            tone="amber"
            value={formatCurrency(settlementsQuery.data?.metrics.pending_amount ?? 0, 'USD')}
          />
          <MetricCard label="Paid YTD" tone="green" value={String(settlementsQuery.data?.metrics.paid_ytd ?? 0)} />
          <MetricCard label="Disputes" tone="red" value={String(settlementsQuery.data?.metrics.dispute_count ?? 0)} />
        </div>
      )}

      <section className="mt-5 rounded-[24px] border border-iris-border bg-white shadow-sm">
        <div className="border-b border-[#EEF2F5] px-5 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[18px] font-bold text-iris-text-primary">Settlement Worklist</p>
              <p className="mt-1 text-[13px] text-iris-text-secondary">Review settlement records, approve payment, or route the item to hold and dispute queues.</p>
            </div>
            <div className="text-[12px] text-iris-text-muted">{filteredItems.length} settlements in current view</div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-iris-text-muted" />
              <input
                className="field-input pl-9"
                placeholder="Search settlement, cedant, contract, or period"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>

            <select className="field-input" value={selectedCedentId} onChange={(event) => setSelectedCedentId(event.target.value)}>
              <option value="all">All Cedants</option>
              {(cedentsQuery.data?.items ?? []).map((item) => (
                <option key={item.cedent_id} value={item.cedent_id}>
                  {item.legal_entity_name}
                </option>
              ))}
            </select>

            <select className="field-input" value={selectedContractId} onChange={(event) => setSelectedContractId(event.target.value)}>
              <option value="all">All Contracts</option>
              {visibleContracts.map((item) => (
                <option key={item.contract_id} value={item.contract_id}>
                  {item.contract_id}
                </option>
              ))}
            </select>

            <select className="field-input" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
              <option value="all">All Statuses</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="held">Held</option>
              <option value="disputed">Disputed</option>
            </select>
          </div>
        </div>

        {settlementsQuery.isLoading ? (
          <div className="px-5 py-5">
            <TableSkeleton columns={10} rows={6} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="bg-[#F8F9FA]">
                <tr>
                  {['Settlement ID', 'Cedant', 'Period', 'Fixed Leg', 'Floating Leg', 'Net Amount', 'Direction', 'Due Date', 'Status', 'Actions'].map((label) => (
                    <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.length ? (
                  filteredItems.map((item) => (
                    <tr key={item.settlement_id} className="border-t border-[#EEF2F5]">
                      <td className="px-4 py-3 font-mono text-[12px] font-semibold text-iris-blue">{item.settlement_id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-iris-text-primary">{item.cedent_name}</div>
                        <div className="mt-1 text-[12px] text-iris-text-secondary">{item.contract_id ?? item.contract_name}</div>
                      </td>
                      <td className="px-4 py-3 text-iris-text-primary">{item.period_label}</td>
                      <td className="px-4 py-3 text-iris-text-primary">{formatCurrency(item.fixed_leg, item.currency)}</td>
                      <td className="px-4 py-3 text-iris-text-primary">{formatCurrency(item.floating_leg, item.currency)}</td>
                      <td className={`px-4 py-3 font-semibold ${item.net_amount >= 0 ? 'text-[#117A65]' : 'text-[#922B21]'}`}>{formatSignedCurrency(item.net_amount, item.currency)}</td>
                      <td className={`px-4 py-3 ${item.net_amount >= 0 ? 'text-[#117A65]' : 'text-[#922B21]'}`}>{formatDirection(item.direction)}</td>
                      <td className="px-4 py-3 text-iris-text-secondary">{item.payment_due}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status}>{titleCase(item.status)}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button className="btn-secondary" onClick={() => setSelectedSettlementId(item.settlement_id)} type="button">
                            View
                          </button>
                          {item.status === 'pending_approval' ? (
                            <button
                              className="btn-secondary border-[#D5F5E3] text-[#1E8449]"
                              disabled={busySettlementId === item.settlement_id}
                              onClick={() => void handleQuickApprove(item)}
                              type="button"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {busySettlementId === item.settlement_id ? 'Approving...' : 'Approve'}
                            </button>
                          ) : null}
                        </div>
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
                          setSelectedCedentId('all')
                          setSelectedContractId('all')
                          setSelectedStatus('all')
                        }}
                        type="button"
                      >
                        Clear filters
                      </button>
                    }
                    colSpan={10}
                    description="Try widening the filter set or clear the search to bring settlement records back into view."
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

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'amber' | 'green' | 'red' }) {
  const borderClass = tone === 'green' ? 'border-[#82E0AA]' : tone === 'red' ? 'border-[#F1948A]' : 'border-[#F8C471]'
  return (
    <div className={`rounded-[22px] border-l-4 ${borderClass} border border-iris-border bg-white px-5 py-4 shadow-sm`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      <p className="mt-3 text-[28px] font-bold text-iris-text-primary">{value}</p>
    </div>
  )
}

function formatDirection(direction: string) {
  if (direction === 'reinsurer_to_cedant') {
    return 'Reinsurer -> Cedant'
  }
  if (direction === 'cedant_to_reinsurer') {
    return 'Cedant -> Reinsurer'
  }
  return titleCase(direction)
}

function formatSignedCurrency(value: number, currency: string) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatCurrency(Math.abs(value), currency)}`
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function extractErrorMessage(caughtError: unknown) {
  if (typeof caughtError !== 'object' || caughtError === null || !('response' in caughtError)) {
    return null
  }

  const response = (caughtError as { response?: { data?: { detail?: string; error?: string } } }).response
  return response?.data?.detail ?? response?.data?.error ?? null
}
