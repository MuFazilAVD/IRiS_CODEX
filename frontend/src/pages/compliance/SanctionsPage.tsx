import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Play, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { api } from '../../api/client'
import { Breadcrumbs } from '../../components/common/Breadcrumbs'
import { EmptyState } from '../../components/common/EmptyState'
import { PageHeader } from '../../components/common/PageHeader'
import { useUiStore } from '../../store/uiStore'
import type {
  ComplianceScreenEntityResponse,
  ComplianceSanctionsOverviewPayload,
  ComplianceScreeningCacheWorkbook,
  SanctionsWorkspaceCase,
  SanctionsWorkspaceKpi,
} from '../../types/api'

const DEFAULT_FORM = {
  trigger_type: 'onboarding',
  country: 'UK',
  entity_name: '',
  registration_number: '',
  aliases: '',
  registered_address: '',
  beneficial_owners: '',
  bank_details: '',
}

const DEFAULT_WORKBOOKS: ComplianceScreeningCacheWorkbook[] = [
  {
    list_name: 'OFAC SDN',
    display_name: 'OFAC',
    provider: 'US Treasury',
    record_count: 4,
    last_sync: '',
    status: 'active',
    filename: 'OFAC.xlsx',
    entries: [],
  },
  {
    list_name: 'FinCEN 314(a)',
    display_name: 'FinCEN',
    provider: 'FinCEN',
    record_count: 3,
    last_sync: '',
    status: 'active',
    filename: 'FinCEN.xlsx',
    entries: [],
  },
]

export function SanctionsPage() {
  const navigate = useNavigate()
  const pushToast = useUiStore((state) => state.pushToast)
  const [activeTab, setActiveTab] = useState<'all_cases' | 'pending_review' | 'auto_cleared' | 'blocked' | 'historical'>('pending_review')
  const [searchValue, setSearchValue] = useState('')
  const [countryFilter, setCountryFilter] = useState('All')
  const [formState, setFormState] = useState(DEFAULT_FORM)
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [sourcesInitialized, setSourcesInitialized] = useState(false)
  const [busyRun, setBusyRun] = useState(false)

  const overviewQuery = useQuery({
    queryKey: ['compliance-sanctions-workspace'],
    queryFn: async () => (await api.get<ComplianceSanctionsOverviewPayload>('/compliance/sanctions/overview')).data,
  })

  const workbooks = overviewQuery.data?.screening_cache_workbooks ?? []
  const sourceOptions = workbooks.length ? workbooks : DEFAULT_WORKBOOKS

  useEffect(() => {
    if (!sourcesInitialized && workbooks.length) {
      setSelectedSources(workbooks.map((workbook) => workbook.list_name))
      setSourcesInitialized(true)
    }
  }, [sourcesInitialized, workbooks])

  const filteredCases = useMemo(() => {
    const rows = overviewQuery.data?.cases ?? []
    return rows.filter((item) => {
      const matchesTab =
        activeTab === 'all_cases'
          ? true
          : activeTab === 'pending_review'
            ? item.status === 'Pending Review'
            : activeTab === 'auto_cleared'
              ? item.status === 'Auto-Cleared'
              : activeTab === 'blocked'
                ? item.status === 'Blocked'
                : item.status === 'Auto-Cleared'
      const haystack = `${item.screening_ref} ${item.entity_name} ${item.entity_subtitle}`.toLowerCase()
      const matchesSearch = searchValue.trim() ? haystack.includes(searchValue.trim().toLowerCase()) : true
      const matchesCountry = countryFilter === 'All' ? true : item.country === countryFilter
      return matchesTab && matchesSearch && matchesCountry
    })
  }, [activeTab, countryFilter, overviewQuery.data?.cases, searchValue])

  async function handleRunScreening() {
    if (!formState.entity_name.trim()) {
      pushToast({ tone: 'error', message: 'Entity name is required before screening can run.' })
      return
    }

    setBusyRun(true)
    try {
      const params = new URLSearchParams()
      params.set('trigger_type', formState.trigger_type)
      params.set('country', formState.country)
      params.set('entity_name', formState.entity_name)
      params.set('registration_number', formState.registration_number)
      params.set('aliases', formState.aliases)
      params.set('registered_address', formState.registered_address)
      params.set('beneficial_owners', formState.beneficial_owners)
      params.set('bank_details', formState.bank_details)
      params.set('persist_case', 'true')
      ;(selectedSources.length ? selectedSources : sourceOptions.map((workbook) => workbook.list_name)).forEach((source) => {
        params.append('sources', source)
      })
      const { data } = await api.get<ComplianceScreenEntityResponse>('/compliance/sanctions/screen', {
        params,
      })
      await overviewQuery.refetch()
      navigate(`/compliance/sanctions/${data.screening_ref}`)
    } catch (caughtError: unknown) {
      pushToast({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Sanctions screening could not be started.',
      })
    } finally {
      setBusyRun(false)
    }
  }

  function handleExportCurrentView() {
    if (!filteredCases.length) {
      pushToast({ tone: 'error', message: 'There are no cases in the current view to export.' })
      return
    }

    const lines = [
      ['Case ID', 'Entity', 'Trigger', 'Risk', 'Confidence', 'AI Recommendation', 'Status', 'Started At'].join(','),
      ...filteredCases.map((item) =>
        [
          escapeCsv(item.screening_ref),
          escapeCsv(item.entity_name),
          escapeCsv(item.trigger),
          escapeCsv(`${item.risk_label} ${item.risk_score}`),
          escapeCsv(`${item.confidence_pct}%`),
          escapeCsv(item.ai_recommendation),
          escapeCsv(item.status),
          escapeCsv(item.started_at),
        ].join(','),
      ),
    ]
    downloadBlob(lines.join('\n'), 'sanction-screening-cases.csv', 'text/csv;charset=utf-8;')
    pushToast({ tone: 'success', message: 'The current sanctions case view was exported.' })
  }

  const tabs = overviewQuery.data?.tabs ?? []
  const countries = overviewQuery.data?.filters.country_options ?? ['All']

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Compliance' }, { label: 'Sanction Screening' }]} />
      <PageHeader
        title={overviewQuery.data?.title ?? 'Sanction Screening'}
        action={
          <button className="btn-secondary" onClick={handleExportCurrentView} type="button">
            <Download className="h-4 w-4" />
            Export Cases
          </button>
        }
      />
      <p className="mt-[-10px] text-[13px] text-iris-text-secondary">{overviewQuery.data?.subtitle}</p>

      <section className="mt-6 grid gap-3 xl:grid-cols-7">
        {(overviewQuery.data?.kpis ?? []).map((item) => (
          <KpiTile key={item.id} item={item} />
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-iris-border bg-white">
        <div className="flex items-center gap-3 border-b border-[#E8EDF2] px-5 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D7E0E8] bg-[#F8FAFC]">
            <Play className="h-4 w-4 text-iris-blue" />
          </div>
          <h2 className="text-[16px] font-semibold text-iris-text-primary">Run Ad-Hoc Screening</h2>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="grid gap-4 xl:grid-cols-[0.9fr_0.9fr_1.7fr]">
            <Field label="Trigger">
              <select value={formState.trigger_type} onChange={(event) => setFormState((current) => ({ ...current, trigger_type: event.target.value }))}>
                <option value="onboarding">Onboarding</option>
                <option value="adhoc">Ad-hoc</option>
                <option value="periodic">Periodic</option>
              </select>
            </Field>
            <Field label="Country">
              <select value={formState.country} onChange={(event) => setFormState((current) => ({ ...current, country: event.target.value }))}>
                {['UK', 'US', 'DE', 'CH', 'CA'].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Entity Name *">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-iris-text-muted" />
                <input
                  className="pl-9"
                  placeholder="e.g. Atlas Corporate Pensions Ltd"
                  value={formState.entity_name}
                  onChange={(event) => setFormState((current) => ({ ...current, entity_name: event.target.value }))}
                />
              </div>
            </Field>
          </div>

          <Field label="Screening Sources">
            <div className="flex flex-wrap gap-2">
              {sourceOptions.map((workbook) => {
                const isActive = selectedSources.includes(workbook.list_name)
                return (
                  <button
                    key={workbook.list_name}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-medium transition ${
                      isActive ? 'border-iris-navy bg-[#EEF4FA] text-iris-navy' : 'border-[#D9E3EA] bg-white text-iris-text-secondary'
                    }`}
                    onClick={() =>
                      setSelectedSources((current) =>
                        current.includes(workbook.list_name)
                          ? current.filter((item) => item !== workbook.list_name)
                          : [...current, workbook.list_name],
                      )
                    }
                    type="button"
                  >
                    {workbook.display_name}
                    <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] text-iris-text-secondary">{workbook.record_count}</span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[12px] text-iris-text-secondary">Screening uses the saved workbook rows for the selected sources. Leave both selected to screen against OFAC and FinCEN together.</p>
          </Field>

          <div className="grid gap-4 xl:grid-cols-2">
            <Field label="Registration Number">
              <input
                placeholder="e.g. 04895721"
                value={formState.registration_number}
                onChange={(event) => setFormState((current) => ({ ...current, registration_number: event.target.value }))}
              />
            </Field>
            <Field label="Aliases / DBA (comma-separated)">
              <input
                placeholder="e.g. Atlas Pensions, Atlas Corp Trust"
                value={formState.aliases}
                onChange={(event) => setFormState((current) => ({ ...current, aliases: event.target.value }))}
              />
            </Field>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Field label="Registered Address">
              <input
                placeholder="e.g. 12 Cornhill, London EC3V 0BN"
                value={formState.registered_address}
                onChange={(event) => setFormState((current) => ({ ...current, registered_address: event.target.value }))}
              />
            </Field>
            <Field label="Beneficial Owners (comma-separated)">
              <input
                placeholder="e.g. J. Whitefield, R. Patel"
                value={formState.beneficial_owners}
                onChange={(event) => setFormState((current) => ({ ...current, beneficial_owners: event.target.value }))}
              />
            </Field>
          </div>

          <Field label="Bank Details (IBAN / SWIFT / Account)">
            <input
              placeholder="e.g. GB29 NWBK 6016 1331 9268 19 - BIC NWBKGB2L"
              value={formState.bank_details}
              onChange={(event) => setFormState((current) => ({ ...current, bank_details: event.target.value }))}
            />
          </Field>

          <div className="flex flex-col gap-4 border-t border-[#E8EDF2] pt-4 xl:flex-row xl:items-center xl:justify-between">
            <p className="text-[12px] text-iris-text-secondary">{overviewQuery.data?.workspace_note}</p>
            <button className="btn-primary min-w-[180px]" disabled={busyRun} onClick={() => void handleRunScreening()} type="button">
              {busyRun ? 'Running...' : 'Run Screening'}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-col gap-3 border-b border-[#E8EDF2] pb-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item.key}
                className={`inline-flex items-center gap-2 border-b-2 px-2 py-2 text-[13px] font-medium ${
                  activeTab === item.key ? 'border-iris-navy text-iris-text-primary' : 'border-transparent text-iris-text-secondary'
                }`}
                onClick={() => setActiveTab(item.key as typeof activeTab)}
                type="button"
              >
                {item.label}
                <span className="rounded-md bg-[#F3F6F9] px-1.5 py-0.5 text-[11px] text-iris-text-muted">{item.count}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-iris-text-muted" />
              <input className="pl-9" placeholder="Search cases..." value={searchValue} onChange={(event) => setSearchValue(event.target.value)} />
            </div>
            <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>
              {countries.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-iris-border bg-white">
          <div className="border-b border-[#E8EDF2] px-5 py-4">
            <h2 className="text-[16px] font-semibold text-iris-text-primary">Cases - {filteredCases.length}</h2>
          </div>
          {overviewQuery.isLoading ? (
            <div className="px-5 py-8 text-[13px] text-iris-text-secondary">Loading sanctions cases...</div>
          ) : filteredCases.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-[12px]">
                <thead className="bg-[#F8F9FA]">
                  <tr>
                    {['Case ID', 'Entity', 'Trigger', 'Watchlists', 'Matches', 'Risk', 'Confidence', 'AI Recommendation', 'Status', 'Started'].map((label) => (
                      <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map((item) => (
                    <CaseRow key={item.screening_ref} item={item} onOpen={() => navigate(`/compliance/sanctions/${item.screening_ref}`)} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-6">
              <EmptyState compact description="Try a different tab, search term, or country filter." title="No sanctions cases match this view" />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function KpiTile({ item }: { item: SanctionsWorkspaceKpi }) {
  const toneClass = item.tone === 'positive' ? 'text-[#1E8449]' : item.tone === 'negative' ? 'text-[#C0392B]' : 'text-iris-text-primary'
  return (
    <article className="rounded-xl border border-iris-border bg-white px-4 py-4">
      <p className="text-[13px] text-iris-text-secondary">{item.label}</p>
      <p className={`mt-3 text-[22px] font-bold leading-none ${toneClass}`}>
        {item.value}
        {item.suffix ?? ''}
      </p>
      <p className={`mt-2 text-[12px] ${toneClass}`}>{item.subtitle}</p>
    </article>
  )
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[12px] font-medium text-iris-text-secondary">{label}</span>
      {children}
    </label>
  )
}

function CaseRow({ item, onOpen }: { item: SanctionsWorkspaceCase; onOpen: () => void }) {
  return (
    <tr className="cursor-pointer border-t border-[#EEF2F5] hover:bg-[#FAFCFD]" onClick={onOpen}>
      <td className="px-4 py-4 align-top">
        <p className="text-[12px] font-medium text-iris-text-primary">{item.screening_ref}</p>
        <span className="mt-2 inline-flex rounded-md bg-[#FEF3D8] px-2 py-1 text-[11px] font-semibold text-[#9A6B0A]">{item.status === 'Blocked' ? 'HIGH RISK' : 'ELEVATED'}</span>
      </td>
      <td className="px-4 py-4 align-top">
        <p className="text-[14px] font-medium leading-5 text-iris-text-primary">{item.entity_name}</p>
        <p className="mt-1 text-[12px] text-iris-text-secondary">{item.entity_subtitle}</p>
      </td>
      <td className="px-4 py-4 align-top">
        <span className="rounded-md border border-[#D9E3EA] px-2 py-1 text-[11px] text-iris-text-primary">{item.trigger}</span>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="flex max-w-[120px] flex-wrap gap-1">
          {item.watchlists.slice(0, 3).map((watchlist) => (
            <span key={watchlist} className="rounded-md border border-[#D9E3EA] bg-[#F8FAFC] px-1.5 py-0.5 text-[11px] text-iris-text-primary">
              {watchlist}
            </span>
          ))}
          {item.watchlists.length > 3 ? <span className="text-[11px] text-iris-text-secondary">+{item.watchlists.length - 3}</span> : null}
        </div>
      </td>
      <td className="px-4 py-4 align-top text-[12px] text-iris-text-primary">{item.matches_count}</td>
      <td className="px-4 py-4 align-top">
        <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${riskClass(item.risk_label)}`}>
          {item.risk_label}
        </span>
        <p className="mt-1 text-[11px] text-iris-text-secondary">{item.risk_score}</p>
      </td>
      <td className="px-4 py-4 align-top text-[12px] text-iris-text-primary">{item.confidence_pct}%</td>
      <td className="px-4 py-4 align-top">
        <span className="rounded-md border border-[#CBD8E3] bg-[#EDF4FA] px-2 py-1 text-[11px] font-semibold text-iris-text-primary">{item.ai_recommendation}</span>
      </td>
      <td className="px-4 py-4 align-top">
        <span className={`rounded-md border px-2 py-1 text-[12px] font-medium ${statusClass(item.status)}`}>{item.status}</span>
      </td>
      <td className="px-4 py-4 align-top text-[12px] text-iris-text-secondary">{formatStarted(item.started_at)}</td>
    </tr>
  )
}

function riskClass(value: string) {
  if (value === 'High') {
    return 'bg-[#FDEDEC] text-[#922B21]'
  }
  if (value === 'Medium') {
    return 'bg-[#FEF3D8] text-[#9A6B0A]'
  }
  return 'bg-[#EAF7EF] text-[#1E8449]'
}

function statusClass(value: string) {
  if (value === 'Blocked') {
    return 'border-[#F3C0BA] bg-[#FDEDEC] text-[#922B21]'
  }
  if (value === 'Pending Review') {
    return 'border-[#CBE6F9] bg-[#F3FAFF] text-[#2C6EA6]'
  }
  return 'border-[#BCE1C7] bg-[#EAF7EF] text-[#1E8449]'
}

function formatStarted(value: string) {
  const parsed = new Date(value)
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')} ${String(parsed.getUTCHours()).padStart(2, '0')}:${String(parsed.getUTCMinutes()).padStart(2, '0')}`
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.URL.revokeObjectURL(url)
}

function extractErrorMessage(caughtError: unknown) {
  const maybeMessage = caughtError as { response?: { data?: { details?: string; error?: string } } }
  return maybeMessage.response?.data?.details ?? maybeMessage.response?.data?.error ?? null
}
