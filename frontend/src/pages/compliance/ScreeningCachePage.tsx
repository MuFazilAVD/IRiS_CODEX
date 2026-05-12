import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Plus, Save, Trash2 } from 'lucide-react'

import { api } from '../../api/client'
import { Breadcrumbs } from '../../components/common/Breadcrumbs'
import { EmptyState } from '../../components/common/EmptyState'
import { PageHeader } from '../../components/common/PageHeader'
import { useUiStore } from '../../store/uiStore'
import type { ComplianceScreeningCacheWorkbook, ComplianceScreeningCacheWorkbookEntry } from '../../types/api'

export function ScreeningCachePage() {
  const pushToast = useUiStore((state) => state.pushToast)
  const [activeWorkbook, setActiveWorkbook] = useState<string | null>(null)
  const workbooksQuery = useQuery({
    queryKey: ['compliance-screening-cache-workbooks'],
    queryFn: async () => (await api.get<{ items: ComplianceScreeningCacheWorkbook[] }>('/compliance/sanctions/cache-workbooks')).data,
  })

  const workbooks = workbooksQuery.data?.items ?? []
  const selectedWorkbook =
    workbooks.find((workbook) => workbook.list_name === activeWorkbook) ??
    workbooks[0] ??
    null

  useEffect(() => {
    if (!workbooks.length) {
      setActiveWorkbook(null)
      return
    }
    if (!activeWorkbook || !workbooks.some((workbook) => workbook.list_name === activeWorkbook)) {
      setActiveWorkbook(workbooks[0].list_name)
    }
  }, [activeWorkbook, workbooks])

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Compliance' }, { label: 'Screening Database (Demo)' }]} />
      <PageHeader title="Screening Database (Demo)" />

      <section className="mt-6 overflow-hidden rounded-xl border border-iris-border bg-white">
        <div className="border-b border-[#E8EDF2] px-5 py-4">
          <h2 className="text-[16px] font-semibold text-iris-text-primary">Editable Screening Workbooks</h2>
          <p className="mt-1 text-[13px] text-iris-text-secondary">
            OFAC and FinCEN are generated from the current screening cache and saved back into the rows used by sanction screening.
          </p>
        </div>

        <div className="px-5 py-5">
          {workbooksQuery.isLoading ? (
            <div className="rounded-xl border border-dashed border-[#D9E3EA] bg-white px-4 py-6 text-[13px] text-iris-text-secondary">
              Loading screening workbooks...
            </div>
          ) : selectedWorkbook ? (
            <div>
              <div className="flex flex-wrap gap-2 border-b border-[#E8EDF2] pb-4">
                {workbooks.map((workbook) => {
                  const active = workbook.list_name === selectedWorkbook.list_name
                  return (
                    <button
                      key={workbook.list_name}
                      className={`rounded-lg border px-4 py-3 text-left transition ${
                        active
                          ? 'border-iris-navy bg-[#EEF4FA] text-iris-text-primary'
                          : 'border-[#D9E3EA] bg-white text-iris-text-secondary hover:bg-[#F8FAFC]'
                      }`}
                      onClick={() => setActiveWorkbook(workbook.list_name)}
                      type="button"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold">{workbook.display_name}</span>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                            workbook.status === 'active' ? 'border-[#BCE1C7] bg-[#EAF7EF] text-[#1E8449]' : 'border-[#F3D8A3] bg-[#FFF6E5] text-[#9A6B0A]'
                          }`}
                        >
                          {workbook.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px]">{workbook.record_count} rows</p>
                    </button>
                  )
                })}
              </div>

              <ScreeningWorkbookCard
                key={selectedWorkbook.list_name}
                workbook={selectedWorkbook}
                onSaved={async () => {
                  await workbooksQuery.refetch()
                }}
                onToast={pushToast}
              />
            </div>
          ) : (
            <div className="py-6">
              <EmptyState compact title="No screening workbooks are available" description="The current cache does not contain OFAC or FinCEN workbook rows." />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function ScreeningWorkbookCard({
  workbook,
  onSaved,
  onToast,
}: {
  workbook: ComplianceScreeningCacheWorkbook
  onSaved: () => Promise<void>
  onToast: (toast: { tone: 'success' | 'error'; message: string }) => void
}) {
  const [rows, setRows] = useState<ComplianceScreeningCacheWorkbookEntry[]>(normalizeWorkbookRows(workbook.entries))
  const [busyAction, setBusyAction] = useState<'save' | 'download' | null>(null)

  useEffect(() => {
    setRows(normalizeWorkbookRows(workbook.entries))
  }, [workbook.entries, workbook.list_name])

  async function handleSave() {
    setBusyAction('save')
    try {
      const { data } = await api.patch<ComplianceScreeningCacheWorkbook>(`/compliance/sanctions/cache-workbooks/${encodeURIComponent(workbook.list_name)}`, {
        entries: rows.map((row) => normalizeWorkbookEntry(row)),
      })
      setRows(normalizeWorkbookRows(data.entries))
      await onSaved()
      onToast({ tone: 'success', message: `${data.display_name} workbook saved and synced to the screening cache.` })
    } catch (caughtError: unknown) {
      onToast({ tone: 'error', message: extractErrorMessage(caughtError) ?? 'Unable to save this workbook.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleDownload() {
    setBusyAction('download')
    try {
      const response = await api.get<ArrayBuffer>(`/compliance/sanctions/cache-workbooks/${encodeURIComponent(workbook.list_name)}/download`, {
        responseType: 'arraybuffer',
      })
      downloadBinary(response.data, workbook.filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      onToast({ tone: 'success', message: `${workbook.display_name} workbook exported as Excel.` })
    } catch (caughtError: unknown) {
      onToast({ tone: 'error', message: extractErrorMessage(caughtError) ?? 'Unable to download this workbook.' })
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <article className="mt-4 overflow-hidden rounded-xl border border-[#D9E3EA] bg-[#FBFCFD]">
      <div className="border-b border-[#E8EDF2] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[16px] font-semibold text-iris-text-primary">{workbook.display_name}</h3>
              <span className="rounded-md border border-[#D9E3EA] bg-white px-2 py-1 text-[11px] text-iris-text-secondary">{workbook.provider}</span>
              <span className={`rounded-md border px-2 py-1 text-[11px] font-medium ${workbook.status === 'active' ? 'border-[#BCE1C7] bg-[#EAF7EF] text-[#1E8449]' : 'border-[#F3D8A3] bg-[#FFF6E5] text-[#9A6B0A]'}`}>
                {workbook.status}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-iris-text-secondary">
              {workbook.list_name} · {workbook.record_count} rows · {workbook.last_sync ? `last sync ${workbook.last_sync}` : 'not yet synced'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" disabled={busyAction !== null} onClick={() => void handleDownload()} type="button">
              <Download className="h-4 w-4" />
              {busyAction === 'download' ? 'Downloading...' : 'Download Excel'}
            </button>
            <button className="btn-secondary" disabled={busyAction !== null} onClick={() => setRows((current) => [...current, emptyWorkbookRow()])} type="button">
              <Plus className="h-4 w-4" />
              Add Row
            </button>
            <button className="btn-primary" disabled={busyAction !== null} onClick={() => void handleSave()} type="button">
              <Save className="h-4 w-4" />
              {busyAction === 'save' ? 'Saving...' : 'Save Workbook'}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-[12px]">
          <thead className="bg-[#F8F9FA]">
            <tr>
              {['Entity', 'Aliases', 'List ID', 'Type', 'Country', 'Address', 'City', 'Postal', 'TIN', 'Reg No', 'DOB', ''].map((label) => (
                <th key={label || 'actions'} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => (
                <tr key={`${workbook.list_name}-${index}`} className="border-t border-[#EEF2F5]">
                  <WorkbookCell value={row.entity_name} onChange={(value) => updateWorkbookRow(setRows, index, 'entity_name', value)} />
                  <WorkbookCell value={row.aliases.join(', ')} onChange={(value) => updateWorkbookRow(setRows, index, 'aliases', value.split(',').map((item) => item.trim()).filter(Boolean))} />
                  <WorkbookCell value={row.list_identifier} onChange={(value) => updateWorkbookRow(setRows, index, 'list_identifier', value)} mono />
                  <WorkbookCell value={row.entity_type} onChange={(value) => updateWorkbookRow(setRows, index, 'entity_type', value)} />
                  <WorkbookCell value={row.country} onChange={(value) => updateWorkbookRow(setRows, index, 'country', value)} />
                  <WorkbookCell value={row.street_address} onChange={(value) => updateWorkbookRow(setRows, index, 'street_address', value)} />
                  <WorkbookCell value={row.city} onChange={(value) => updateWorkbookRow(setRows, index, 'city', value)} />
                  <WorkbookCell value={row.postal_code} onChange={(value) => updateWorkbookRow(setRows, index, 'postal_code', value)} />
                  <WorkbookCell value={row.tax_identification_number} onChange={(value) => updateWorkbookRow(setRows, index, 'tax_identification_number', value)} />
                  <WorkbookCell value={row.company_registration_number} onChange={(value) => updateWorkbookRow(setRows, index, 'company_registration_number', value)} />
                  <WorkbookCell value={row.dob} onChange={(value) => updateWorkbookRow(setRows, index, 'dob', value)} />
                  <td className="px-3 py-2 align-top">
                    <button className="btn-secondary" disabled={busyAction !== null} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} type="button">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-8 text-[13px] text-iris-text-secondary" colSpan={12}>
                  No workbook rows are currently available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  )
}

function WorkbookCell({ value, onChange, mono }: { value: string; onChange: (value: string) => void; mono?: boolean }) {
  return (
    <td className="px-3 py-2 align-top">
      <input
        className={`field-input h-9 min-w-[110px] px-3 py-1.5 text-[12px] ${mono ? 'font-mono text-[11px]' : ''}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </td>
  )
}

function normalizeWorkbookRows(rows: ComplianceScreeningCacheWorkbookEntry[]) {
  return rows.map((row) => normalizeWorkbookEntry(row))
}

function normalizeWorkbookEntry(row: ComplianceScreeningCacheWorkbookEntry): ComplianceScreeningCacheWorkbookEntry {
  return {
    entity_name: row.entity_name ?? '',
    aliases: Array.isArray(row.aliases) ? row.aliases.map((item) => item.trim()).filter(Boolean) : [],
    list_identifier: row.list_identifier ?? '',
    entity_type: row.entity_type ?? '',
    country: row.country ?? '',
    street_address: row.street_address ?? '',
    city: row.city ?? '',
    postal_code: row.postal_code ?? '',
    tax_identification_number: row.tax_identification_number ?? '',
    company_registration_number: row.company_registration_number ?? '',
    dob: row.dob ?? '',
  }
}

function emptyWorkbookRow(): ComplianceScreeningCacheWorkbookEntry {
  return {
    entity_name: '',
    aliases: [],
    list_identifier: '',
    entity_type: '',
    country: '',
    street_address: '',
    city: '',
    postal_code: '',
    tax_identification_number: '',
    company_registration_number: '',
    dob: '',
  }
}

function updateWorkbookRow<T extends keyof ComplianceScreeningCacheWorkbookEntry>(
  setRows: Dispatch<SetStateAction<ComplianceScreeningCacheWorkbookEntry[]>>,
  index: number,
  field: T,
  value: ComplianceScreeningCacheWorkbookEntry[T],
) {
  setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)))
}

function downloadBinary(content: ArrayBuffer, filename: string, type: string) {
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
