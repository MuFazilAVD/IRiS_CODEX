import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { api } from '../../../api/client'
import { Breadcrumbs } from '../../../components/common/Breadcrumbs'
import { EmptyTableRow } from '../../../components/common/EmptyState'
import { PageHeader } from '../../../components/common/PageHeader'
import { TableSkeleton } from '../../../components/common/Skeleton'
import { StatusBadge } from '../../../components/common/StatusBadge'
import type { CedentListItem, CedentsListPayload } from '../../../types/api'
import { NewCedantWizard } from './NewCedantWizard'

export function CedantsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [wizardOpen, setWizardOpen] = useState(false)

  const cedantsQuery = useQuery({
    queryKey: ['cedents', search, status],
    queryFn: async () =>
      (
        await api.get<CedentsListPayload>('/underwriting/cedents', {
          params: {
            search: search || undefined,
            status,
            page: 1,
            page_size: 50,
          },
        })
      ).data,
  })

  const allCedantsQuery = useQuery({
    queryKey: ['cedents', 'all'],
    queryFn: async () =>
      (
        await api.get<CedentsListPayload>('/underwriting/cedents', {
          params: {
            status: 'all',
            page: 1,
            page_size: 50,
          },
        })
      ).data,
  })

  const suggestedCedentId = getSuggestedCedentId(allCedantsQuery.data?.items ?? cedantsQuery.data?.items ?? [])

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Underwriting' }, { label: 'Cedants' }]} />
      <PageHeader
        action={
          <button className="btn-primary" onClick={() => setWizardOpen(true)} type="button">
            <Plus className="h-4 w-4" />
            New Cedant
          </button>
        }
        eyebrow="Counterparty Register"
        subtitle="Counterparties ceding longevity risk to the platform"
        title="Cedants"
      />

      <div className="rounded-xl border border-iris-border bg-white p-3.5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.7fr_220px_auto]">
          <label className="input-shell">
            <Search className="h-4 w-4 text-iris-text-muted" />
            <input
              aria-label="Search cedants"
              placeholder="Search by ID, name, country..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select className="field-input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="onboarding">Onboarding</option>
          </select>
          <div className="flex items-center justify-end text-[13px] font-medium text-iris-text-secondary">
            {cedantsQuery.data?.items.length ?? 0} of {cedantsQuery.data?.total ?? 0}
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-iris-border bg-white shadow-sm">
        <div className="border-b border-[#EEF2F5] px-4 py-3">
          <h2 className="text-[15px] font-semibold text-iris-text-primary">Cedants Register</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F8F9FA]">
              <tr>
                {['ID', 'Name', 'Country', 'AUM', 'Contracts', 'Screening', 'Status', 'Onboarded', 'Action'].map((label) => (
                  <th
                    key={label}
                    className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary ${
                      label === 'AUM' ? 'text-right' : ''
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cedantsQuery.isLoading ? null : cedantsQuery.data?.items.length ? (
                cedantsQuery.data.items.map((item) => (
                  <CedantRow key={item.cedent_id} item={item} onOpen={() => navigate(`/underwriting/cedants/${item.cedent_id}`)} />
                ))
              ) : (
                <EmptyTableRow
                  colSpan={9}
                  description="Try broadening the register search or switching the status filter back to All."
                  title="No cedants match the current filter set"
                />
              )}
            </tbody>
          </table>
          {cedantsQuery.isLoading ? <TableSkeleton columns={9} rows={6} /> : null}
        </div>
      </div>

      <NewCedantWizard open={wizardOpen} suggestedCedentId={suggestedCedentId} onClose={() => setWizardOpen(false)} />
    </div>
  )
}

function CedantRow({ item, onOpen }: { item: CedentListItem; onOpen: () => void }) {
  return (
    <tr className="cursor-pointer border-t border-[#EEF2F5] hover:bg-[#FAFBFC]" onClick={onOpen}>
      <td className="px-3 py-3 font-mono text-[12px] text-iris-blue">
        <Link className="hover:underline" to={`/underwriting/cedants/${item.cedent_id}`}>
          {item.cedent_id}
        </Link>
      </td>
      <td className="px-3 py-3">
        <Link className="font-semibold text-iris-blue hover:underline" to={`/underwriting/cedants/${item.cedent_id}`}>
          {item.legal_entity_name}
        </Link>
      </td>
      <td className="px-3 py-3">
        {countryFlag(item.country)} {item.country ?? '-'}
      </td>
      <td className="px-3 py-3 text-right">{item.aum}</td>
      <td className={`px-3 py-3 ${item.contracts_count === 0 ? 'text-iris-text-muted' : 'text-iris-text-primary'}`}>{item.contracts_count}</td>
      <td className="px-3 py-3">
        <StatusBadge status={item.screening_status}>{titleCase(item.screening_status)}</StatusBadge>
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={item.status}>{titleCase(item.status)}</StatusBadge>
      </td>
      <td className="px-3 py-3">{item.onboarded_date ?? '-'}</td>
      <td className="px-3 py-3 font-medium text-iris-blue">{item.status === 'inactive' ? 'Reactivate ->' : 'View / Edit ->'}</td>
    </tr>
  )
}

function getSuggestedCedentId(items: CedentListItem[]) {
  const maxValue = items.reduce((currentMax, item) => {
    const parsedValue = Number(item.cedent_id.split('-')[1] ?? 0)
    return Number.isFinite(parsedValue) ? Math.max(currentMax, parsedValue) : currentMax
  }, 1201)

  return `CED-${String(maxValue + 1).padStart(4, '0')}`
}

function countryFlag(country: string | null) {
  switch (country) {
    case 'UK':
      return '🇬🇧'
    case 'CH':
      return '🇨🇭'
    case 'US':
      return '🇺🇸'
    case 'CA':
      return '🇨🇦'
    case 'DE':
      return '🇩🇪'
    default:
      return '🏳️'
  }
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
