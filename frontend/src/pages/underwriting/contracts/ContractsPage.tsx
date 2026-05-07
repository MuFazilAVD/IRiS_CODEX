import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { api } from '../../../api/client'
import { Breadcrumbs } from '../../../components/common/Breadcrumbs'
import { EmptyTableRow } from '../../../components/common/EmptyState'
import { PageHeader } from '../../../components/common/PageHeader'
import { TableSkeleton } from '../../../components/common/Skeleton'
import { StatusBadge } from '../../../components/common/StatusBadge'
import type { ContractListItem, ContractsListPayload } from '../../../types/api'
import { ContractAmendmentModal } from './ContractAmendmentModal'
import { NewContractModal } from './NewContractModal'

export function ContractsPage() {
  const navigate = useNavigate()
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [amendContractId, setAmendContractId] = useState<string | null>(null)

  const contractsQuery = useQuery({
    queryKey: ['contracts'],
    queryFn: async () =>
      (
        await api.get<ContractsListPayload>('/underwriting/contracts', {
          params: { status: 'all', page: 1, page_size: 50 },
        })
      ).data,
  })

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Underwriting' }, { label: 'Contracts' }]} />
      <PageHeader
        action={
          <button className="btn-primary" onClick={() => setNewModalOpen(true)} type="button">
            <Plus className="h-4 w-4" />
            New Contract
          </button>
        }
        subtitle="Longevity reinsurance contracts: terms, versioning, amendments"
        title="Contracts"
      />

      <div className="rounded-xl border border-iris-border bg-white px-4 py-3 shadow-sm">
        <p className="text-[13px] font-medium text-iris-text-secondary">{contractsQuery.data?.total ?? 0} contract(s)</p>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-iris-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F8F9FA]">
              <tr>
                {['ID', 'Cedant', 'Notional', 'Fixed', 'Floating', 'Inception', 'Maturity', 'Lives', 'Version', 'Status', 'Actions'].map((label) => (
                  <th
                    key={label}
                    className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary ${
                      label === 'Notional' || label === 'Lives' ? 'text-right' : ''
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contractsQuery.isLoading ? null : contractsQuery.data?.items.length ? (
                contractsQuery.data.items.map((item) => (
                  <ContractRow
                    key={item.contract_id}
                    item={item}
                    onAmend={() => setAmendContractId(item.contract_id)}
                    onMembers={() => navigate(`/underwriting/population?cedent_id=${item.cedent_id ?? ''}&contract_id=${item.contract_id}`)}
                    onView={() => navigate(`/underwriting/contracts/${item.contract_id}`)}
                  />
                ))
              ) : (
                <EmptyTableRow
                  colSpan={11}
                  description="Create the first contract or check whether the current environment seed has loaded the register."
                  title="No contracts are available yet"
                />
              )}
            </tbody>
          </table>
          {contractsQuery.isLoading ? <TableSkeleton columns={11} rows={6} /> : null}
        </div>
      </div>

      <NewContractModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onCreated={(contractId) => {
          void contractsQuery.refetch()
          navigate(`/underwriting/contracts/${contractId}`)
        }}
      />

      <ContractAmendmentModal
        contractId={amendContractId ?? ''}
        open={Boolean(amendContractId)}
        onClose={() => setAmendContractId(null)}
        onSubmitted={() => void contractsQuery.refetch()}
      />
    </div>
  )
}

function ContractRow({
  item,
  onView,
  onMembers,
  onAmend,
}: {
  item: ContractListItem
  onView: () => void
  onMembers: () => void
  onAmend: () => void
}) {
  return (
    <tr className="border-t border-[#EEF2F5] hover:bg-[#FAFBFC]">
      <td className="px-3 py-3 font-mono text-[12px] text-iris-blue">
        <Link className="hover:underline" to={`/underwriting/contracts/${item.contract_id}`}>
          {item.contract_id}
        </Link>
      </td>
      <td className="px-3 py-3">
        <p className="font-semibold text-iris-text-primary">{item.cedent_name}</p>
        <p className="text-[12px] text-iris-text-secondary">{item.contract_name}</p>
      </td>
      <td className="px-3 py-3 text-right">{formatCurrencyCompact(item.notional, item.currency)}</td>
      <td className="px-3 py-3">{(item.fixed_rate * 100).toFixed(2)}%</td>
      <td className="px-3 py-3">{item.floating_definition || '-'}</td>
      <td className="px-3 py-3">{item.inception_date ?? '-'}</td>
      <td className="px-3 py-3">{item.maturity_date ?? '-'}</td>
      <td className="px-3 py-3 text-right">{item.lives_count.toLocaleString()}</td>
      <td className="px-3 py-3">{item.version}</td>
      <td className="px-3 py-3">
        <StatusBadge status={item.status}>{titleCase(item.status)}</StatusBadge>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="flex min-w-max flex-nowrap items-center gap-2">
          <button className="btn-secondary" onClick={onView} type="button">
            View
          </button>
          <button className="btn-secondary" onClick={onMembers} type="button">
            Members
          </button>
          <button className="btn-primary" onClick={onAmend} type="button">
            + Amend
          </button>
        </div>
      </td>
    </tr>
  )
}

function formatCurrencyCompact(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    notation: amount >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: amount >= 1_000_000 ? 1 : 0,
  }).format(amount)
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
