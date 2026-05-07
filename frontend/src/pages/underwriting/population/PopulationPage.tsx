import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, Upload, Users, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { api } from '../../../api/client'
import { Breadcrumbs } from '../../../components/common/Breadcrumbs'
import { EmptyState, EmptyTableRow } from '../../../components/common/EmptyState'
import { PageHeader } from '../../../components/common/PageHeader'
import { StatusBadge } from '../../../components/common/StatusBadge'
import { useUiStore } from '../../../store/uiStore'
import type {
  CedentsListPayload,
  ContractsListPayload,
  PopulationDeferResponse,
  PopulationHistoryPayload,
  PopulationListPayload,
  PopulationRecord,
} from '../../../types/api'

type InitialPopulationParams = {
  cedentId: string
  contractId: string
  memberId: string
  status: string
  view: string
  action: string
}

export function PopulationPage() {
  const [searchParams] = useSearchParams()
  const initialParamsRef = useRef<InitialPopulationParams>({
    cedentId: searchParams.get('cedent_id') ?? '',
    contractId: searchParams.get('contract_id') ?? '',
    memberId: searchParams.get('member_id') ?? '',
    status: searchParams.get('status') ?? 'all',
    view: searchParams.get('view') ?? '',
    action: searchParams.get('action') ?? '',
  })
  const appliedInitialIntent = useRef(false)

  const [selectedCedentId, setSelectedCedentId] = useState(initialParamsRef.current.cedentId)
  const [selectedContractId, setSelectedContractId] = useState(initialParamsRef.current.contractId)
  const [selectedStatus, setSelectedStatus] = useState(initialParamsRef.current.status)
  const [historyMemberId, setHistoryMemberId] = useState<string | null>(null)
  const [deferTargetId, setDeferTargetId] = useState<string | null>(null)
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadFileName, setUploadFileName] = useState('')
  const pushToast = useUiStore((state) => state.pushToast)

  const cedentsQuery = useQuery({
    queryKey: ['population-cedents'],
    queryFn: async () =>
      (
        await api.get<CedentsListPayload>('/underwriting/cedents', {
          params: { status: 'all', page: 1, page_size: 100 },
        })
      ).data,
  })

  const contractsQuery = useQuery({
    queryKey: ['population-contracts'],
    queryFn: async () =>
      (
        await api.get<ContractsListPayload>('/underwriting/contracts', {
          params: { status: 'all', page: 1, page_size: 200 },
        })
      ).data,
  })

  const populationQuery = useQuery({
    queryKey: ['population-register', selectedCedentId, selectedContractId, selectedStatus],
    queryFn: async () =>
      (
        await api.get<PopulationListPayload>('/underwriting/population', {
          params: {
            cedent_id: selectedCedentId,
            contract_id: selectedContractId,
            status: selectedStatus,
            page: 1,
            page_size: 50,
          },
        })
      ).data,
    enabled: Boolean(selectedCedentId && selectedContractId),
  })

  const historyQuery = useQuery({
    queryKey: ['population-history', historyMemberId],
    queryFn: async () => (await api.get<PopulationHistoryPayload>(`/underwriting/population/${historyMemberId}/history`)).data,
    enabled: Boolean(historyMemberId),
  })

  const cedentOptions = cedentsQuery.data?.items ?? []
  const contractOptions = contractsQuery.data?.items ?? []

  useEffect(() => {
    if (selectedCedentId || !cedentOptions.length) {
      return
    }

    const preferredFromContract = contractOptions.find((item) => item.contract_id === initialParamsRef.current.contractId)?.cedent_id
    const preferredCedentId =
      initialParamsRef.current.cedentId ||
      preferredFromContract ||
      (cedentOptions.some((item) => item.cedent_id === 'CED-1042') ? 'CED-1042' : cedentOptions[0]?.cedent_id || '')

    if (preferredCedentId) {
      setSelectedCedentId(preferredCedentId)
    }
  }, [cedentOptions, contractOptions, selectedCedentId])

  useEffect(() => {
    if (selectedCedentId || !selectedContractId || !contractOptions.length) {
      return
    }

    const matchingContract = contractOptions.find((item) => item.contract_id === selectedContractId)
    if (matchingContract?.cedent_id) {
      setSelectedCedentId(matchingContract.cedent_id)
    }
  }, [contractOptions, selectedCedentId, selectedContractId])

  const visibleContracts = useMemo(
    () => contractOptions.filter((item) => !selectedCedentId || item.cedent_id === selectedCedentId),
    [contractOptions, selectedCedentId],
  )

  useEffect(() => {
    if (!visibleContracts.length) {
      if (selectedContractId) {
        setSelectedContractId('')
      }
      return
    }

    const currentStillValid = visibleContracts.some((item) => item.contract_id === selectedContractId)
    if (currentStillValid) {
      return
    }

    const preferredContractId =
      (initialParamsRef.current.contractId &&
        visibleContracts.some((item) => item.contract_id === initialParamsRef.current.contractId) &&
        initialParamsRef.current.contractId) ||
      (selectedCedentId === 'CED-1042' &&
        visibleContracts.some((item) => item.contract_id === 'LSC-2024-019') &&
        'LSC-2024-019') ||
      visibleContracts[0]?.contract_id ||
      ''

    setSelectedContractId(preferredContractId)
  }, [selectedCedentId, selectedContractId, visibleContracts])

  useEffect(() => {
    if (appliedInitialIntent.current || !populationQuery.data) {
      return
    }

    const memberId = initialParamsRef.current.memberId
    if (!memberId) {
      appliedInitialIntent.current = true
      return
    }

    if (initialParamsRef.current.view === 'history') {
      setHistoryMemberId(memberId)
    } else if (initialParamsRef.current.action === 'defer') {
      setDeferTargetId(memberId)
    }

    appliedInitialIntent.current = true
  }, [populationQuery.data])

  const deferTarget = useMemo(
    () => populationQuery.data?.items.find((item) => item.member_id === deferTargetId) ?? null,
    [deferTargetId, populationQuery.data?.items],
  )

  async function handleConfirmDefer() {
    if (!deferTarget) {
      setDeferTargetId(null)
      return
    }

    setBusyMemberId(deferTarget.member_id)
    try {
      const { data } = await api.patch<PopulationDeferResponse>(`/underwriting/population/${deferTarget.member_id}/defer`)
      await Promise.all([
        populationQuery.refetch(),
        historyMemberId === deferTarget.member_id ? historyQuery.refetch() : Promise.resolve(),
      ])
      pushToast({
        tone: 'success',
        message: `${data.member_id} marked as deferred effective ${data.effective_from}.`,
      })
      setDeferTargetId(null)
    } catch (caughtError: unknown) {
      pushToast({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to defer this member right now.',
      })
    } finally {
      setBusyMemberId(null)
    }
  }

  function handleCaptureUploadStub() {
    // MOCK IMPLEMENTATION:
    // The Population spec references the later cession-file pipeline, but Phase 8 is not
    // built yet and the upload API contract does not exist in the current sequence.
    pushToast({
      tone: 'success',
      message: uploadFileName
        ? `${uploadFileName} captured as a mock upload handoff. The live cession-file pipeline remains scheduled for Phase 8.`
        : 'Mock upload handoff captured. The live cession-file pipeline remains scheduled for Phase 8.',
    })
    setUploadModalOpen(false)
    setUploadFileName('')
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Underwriting' }, { label: 'Population' }]} />
      <PageHeader
        action={
          <button className="btn-primary" onClick={() => setUploadModalOpen(true)} type="button">
            <Upload className="h-4 w-4" />
            Upload cedant file
          </button>
        }
        eyebrow="Population Screen"
        subtitle="Insured lives across active reinsurance contracts"
        title="Population"
      />

      <div className="rounded-xl border border-iris-border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-3">
          <select
            className="field-input"
            value={selectedCedentId}
            onChange={(event) => {
              setSelectedCedentId(event.target.value)
            }}
          >
            {cedentOptions.map((item) => (
              <option key={item.cedent_id} value={item.cedent_id}>
                {item.legal_entity_name}
              </option>
            ))}
          </select>

          <select
            className="field-input"
            value={selectedContractId}
            onChange={(event) => {
              setSelectedContractId(event.target.value)
            }}
          >
            {visibleContracts.map((item) => (
              <option key={item.contract_id} value={item.contract_id}>
                {item.contract_id}
              </option>
            ))}
          </select>

          <select
            className="field-input"
            value={selectedStatus}
            onChange={(event) => {
              setSelectedStatus(event.target.value)
            }}
          >
            <option value="all">Status: all</option>
            <option value="active">Active</option>
            <option value="deceased">Deceased</option>
            <option value="deferred">Deferred</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-iris-border bg-white px-4 py-3 shadow-sm">
        <p className="text-[13px] font-medium text-iris-text-secondary">
          {populationQuery.data?.total ?? 0} member(s)
          {populationQuery.data?.filters_applied.contract ? ` · ${populationQuery.data.filters_applied.contract}` : ''}
        </p>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-iris-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F8F9FA]">
              <tr>
                {['Member ID', 'Contract', 'Age', 'Gender', 'Annuity', 'Status', 'Last Verified', 'Actions'].map((label) => (
                  <th
                    key={label}
                    className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary ${
                      label === 'Age' ? 'text-right' : ''
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {populationQuery.isLoading ? (
                <tr>
                  <td className="px-3 py-6 text-iris-text-secondary" colSpan={8}>
                    Loading population register...
                  </td>
                </tr>
              ) : populationQuery.data?.items.length ? (
                populationQuery.data.items.map((item) => (
                  <PopulationRow
                    key={item.member_id}
                    busyMemberId={busyMemberId}
                    item={item}
                    onDefer={() => setDeferTargetId(item.member_id)}
                    onHistory={() => setHistoryMemberId(item.member_id)}
                  />
                ))
              ) : (
                <EmptyTableRow
                  colSpan={8}
                  description="Try a different cedant, contract, or member status to bring matching population rows back."
                  icon={<Users className="h-5 w-5" />}
                  title="No population records match the current filters"
                />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {historyMemberId ? (
        <HistoryDrawer
          memberId={historyMemberId}
          payload={historyQuery.data}
          loading={historyQuery.isLoading}
          onClose={() => setHistoryMemberId(null)}
        />
      ) : null}

      {deferTargetId ? (
        <DeferMemberModal
          busy={busyMemberId === deferTargetId}
          member={deferTarget}
          onCancel={() => setDeferTargetId(null)}
          onConfirm={() => void handleConfirmDefer()}
        />
      ) : null}

      {uploadModalOpen ? (
        <UploadHandoffModal
          fileName={uploadFileName}
          onCapture={handleCaptureUploadStub}
          onClose={() => {
            setUploadModalOpen(false)
            setUploadFileName('')
          }}
          onFileNameChange={setUploadFileName}
        />
      ) : null}
    </div>
  )
}

function PopulationRow({
  item,
  busyMemberId,
  onDefer,
  onHistory,
}: {
  item: PopulationRecord
  busyMemberId: string | null
  onDefer: () => void
  onHistory: () => void
}) {
  return (
    <tr className="border-t border-[#EEF2F5] hover:bg-[#FAFBFC]">
      <td className="px-3 py-3 font-mono text-[12px] text-iris-blue">{item.member_id}</td>
      <td className="px-3 py-3">{item.contract_id}</td>
      <td className="px-3 py-3 text-right">{item.age}</td>
      <td className="px-3 py-3">{item.gender}</td>
      <td className="px-3 py-3">{formatMoney(item.annual_pension, item.currency)}</td>
      <td className="px-3 py-3">
        <StatusBadge status={item.status}>{titleCase(item.status)}</StatusBadge>
      </td>
      <td className="px-3 py-3">{item.last_verified}</td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-2">
          {item.status === 'active' ? (
            <button className="btn-secondary" disabled={busyMemberId === item.member_id} onClick={onDefer} type="button">
              Defer
            </button>
          ) : null}
          <button className="btn-secondary" onClick={onHistory} type="button">
            <History className="h-4 w-4" />
            History
          </button>
        </div>
      </td>
    </tr>
  )
}

function HistoryDrawer({
  memberId,
  payload,
  loading,
  onClose,
}: {
  memberId: string
  payload: PopulationHistoryPayload | undefined
  loading: boolean
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-iris-border bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-iris-border px-5 py-4">
          <div>
            <p className="text-[18px] font-bold text-iris-text-primary">Member History</p>
            <p className="mt-1 text-[13px] text-iris-text-secondary">{memberId}</p>
          </div>
          <button className="rounded-md p-1 text-iris-text-secondary hover:bg-iris-bg" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-[13px] text-iris-text-secondary">Loading SCD2 history...</p>
          ) : payload?.history.length ? (
            <div className="space-y-3">
              {payload.history.map((item) => (
                <div key={`${item.effective_from}-${item.status}`} className="rounded-xl border border-iris-border bg-[#FAFBFC] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge status={item.status}>{titleCase(item.status)}</StatusBadge>
                    {item.is_current ? (
                      <span className="rounded bg-[#EBF5FB] px-2 py-1 text-[11px] font-semibold text-iris-blue">Current</span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-2 text-[13px] text-iris-text-secondary">
                    <HistoryLine label="Effective From" value={item.effective_from} />
                    <HistoryLine label="Effective To" value={item.effective_to ?? 'Current'} />
                    <HistoryLine label="Annual Pension" value={formatNumber(item.annual_pension)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              description="There are no prior SCD2 versions for this member in the current seeded register."
              icon={<History className="h-5 w-5" />}
              title="No history entries are available yet"
            />
          )}
        </div>
      </aside>
    </>
  )
}

function HistoryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="font-medium text-iris-text-primary">{value}</span>
    </div>
  )
}

function DeferMemberModal({
  busy,
  member,
  onCancel,
  onConfirm,
}: {
  busy: boolean
  member: PopulationRecord | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const canConfirm = Boolean(member && member.status === 'active')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/30" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="w-full max-w-[480px] rounded-xl border border-iris-border bg-white shadow-2xl">
          <div className="border-b border-iris-border px-5 py-4">
            <p className="text-[18px] font-bold text-iris-text-primary">Defer Member</p>
            <p className="mt-1 text-[13px] text-iris-text-secondary">
              {member ? `Create a new deferred SCD2 version for ${member.member_id}.` : 'Member context unavailable.'}
            </p>
          </div>
          <div className="px-5 py-4 text-[13px] text-iris-text-secondary">
            {member ? (
              <div className="space-y-2">
                <p>
                  Contract: <span className="font-medium text-iris-text-primary">{member.contract_id}</span>
                </p>
                <p>
                  Current status: <span className="font-medium text-iris-text-primary">{titleCase(member.status)}</span>
                </p>
              </div>
            ) : (
              <p>The requested member could not be found in the current filtered register.</p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-iris-border px-5 py-4">
            <button className="btn-secondary" onClick={onCancel} type="button">
              Cancel
            </button>
            <button className="btn-primary" disabled={!canConfirm || busy} onClick={onConfirm} type="button">
              {busy ? 'Deferring...' : 'Confirm Defer'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function UploadHandoffModal({
  fileName,
  onCapture,
  onClose,
  onFileNameChange,
}: {
  fileName: string
  onCapture: () => void
  onClose: () => void
  onFileNameChange: (value: string) => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="w-full max-w-[560px] rounded-xl border border-iris-border bg-white shadow-2xl">
          <div className="border-b border-iris-border px-5 py-4">
            <p className="text-[18px] font-bold text-iris-text-primary">Upload Cedant File</p>
            <p className="mt-1 text-[13px] text-iris-text-secondary">
              Mock handoff until the Claims cession-file pipeline is built in the next phase.
            </p>
          </div>
          <div className="space-y-3 px-5 py-4">
            <div className="rounded-xl border border-[#AED6F1] bg-[#EBF5FB] px-4 py-3 text-[13px] text-iris-blue">
              The Population spec references a later pipeline modal. This build captures the handoff without inventing the Phase 8 flow early.
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">Filename</span>
              <input
                className="field-input"
                placeholder="northstar_status_2025Q1.csv"
                value={fileName}
                onChange={(event) => onFileNameChange(event.target.value)}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-iris-border px-5 py-4">
            <button className="btn-secondary" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="btn-primary" onClick={onCapture} type="button">
              Capture Mock Handoff
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 0,
  }).format(value)
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function extractErrorMessage(caughtError: unknown) {
  const maybeMessage = caughtError as { response?: { data?: { details?: string } } }
  return maybeMessage.response?.data?.details
}
