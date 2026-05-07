import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Database, Download, Eye, History, RefreshCcw, Upload } from 'lucide-react'

import { api } from '../../../api/client'
import { Breadcrumbs } from '../../../components/common/Breadcrumbs'
import { EmptyState, EmptyTableRow } from '../../../components/common/EmptyState'
import { PageHeader } from '../../../components/common/PageHeader'
import { StatusBadge } from '../../../components/common/StatusBadge'
import { useUiStore } from '../../../store/uiStore'
import type {
  AdminLibraryItem,
  AdminLibraryPayload,
  AdminLibraryUploadResponse,
  AdminScreeningCacheSyncResponse,
} from '../../../types/api'

type LibraryTab = 'fx_rate' | 'mortality_table' | 'yield_curve' | 'assumption_set' | 'file_template' | 'screening_cache'
const TAB_META: Array<{ key: LibraryTab; label: string }> = [
  { key: 'fx_rate', label: 'Currencies & FX' },
  { key: 'mortality_table', label: 'Mortality Tables' },
  { key: 'yield_curve', label: 'Yield Curves' },
  { key: 'assumption_set', label: 'Assumption Sets' },
  { key: 'file_template', label: 'File Templates' },
  { key: 'screening_cache', label: 'Screening Cache' },
]

export function ReferenceLibraryPage() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('fx_rate')
  const [detailRef, setDetailRef] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const pushToast = useUiStore((state) => state.pushToast)

  const libraryQuery = useQuery({
    queryKey: ['admin-library', activeTab],
    queryFn: async () =>
      (
        await api.get<AdminLibraryPayload>('/admin/library', {
          params: { type: activeTab },
        })
      ).data,
  })

  const detailQuery = useQuery({
    queryKey: ['admin-library-detail', detailRef],
    queryFn: async () => (await api.get<AdminLibraryItem>(`/admin/library/${detailRef}`)).data,
    enabled: Boolean(detailRef),
  })

  const subtitle = useMemo(() => {
    if (activeTab === 'fx_rate') {
      return 'As of 2025-04-29 · Bloomberg'
    }
    if (activeTab === 'screening_cache') {
      return 'Cached lists used by sanctions and AML workflows'
    }
    return 'Core system dependency · version-controlled · lockable at contract level'
  }, [activeTab])

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Administration' }, { label: 'Reference Library' }]} />
      <PageHeader
        title="Reference Data Library"
        action={
          <button className="btn-primary" onClick={() => setUploadOpen(true)} type="button">
            <Upload className="h-4 w-4" />
            New Version
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {TAB_META.map((tab) => (
          <button key={tab.key} className={activeTab === tab.key ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab(tab.key)} type="button">
            {tab.label}
          </button>
        ))}
      </div>

      <section className="rounded-[22px] border border-iris-border bg-white shadow-sm">
        <div className="border-b border-[#E8EDF2] px-5 py-4">
          <p className="text-[18px] font-bold text-iris-text-primary">{libraryTitle(activeTab)}</p>
          <p className="mt-1 text-[13px] text-iris-text-secondary">{subtitle}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F8F9FA]">
              <tr>
                {columnsForTab(activeTab).map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {libraryQuery.isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-iris-text-secondary" colSpan={columnsForTab(activeTab).length}>
                    Loading reference data...
                  </td>
                </tr>
              ) : !(libraryQuery.data?.items ?? []).length ? (
                <EmptyTableRow
                  colSpan={columnsForTab(activeTab).length}
                  description="No versions are currently present for this library type in the seeded admin dataset."
                  icon={<Database className="h-5 w-5" />}
                  title={`No ${libraryTitle(activeTab).toLowerCase()} entries are available`}
                />
              ) : (
                (libraryQuery.data?.items ?? []).map((item, index) => (
                  <LibraryRow
                    key={`${item.ref_id ?? item.list_name ?? index}`}
                    activeTab={activeTab}
                    item={item}
                    onDetail={() => setDetailRef(item.ref_id ?? item.list_name ?? null)}
                    onForceSync={async () => {
                      try {
                        const { data } = await api.post<AdminScreeningCacheSyncResponse>(`/admin/library/screening-cache/${item.list_name}/sync`)
                        await libraryQuery.refetch()
                        pushToast({ tone: 'success', message: `${data.list_name}: ${data.message}.` })
                      } catch (caughtError: unknown) {
                        pushToast({ tone: 'error', message: extractErrorMessage(caughtError) ?? 'Unable to force sync this list.' })
                      }
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {uploadOpen ? (
        <UploadVersionModal
          activeTab={activeTab}
          onClose={() => setUploadOpen(false)}
          onUploaded={async (response) => {
            setUploadOpen(false)
            await libraryQuery.refetch()
            pushToast({ tone: 'success', message: `${response.ref_id} uploaded as a mock reference-data version.` })
          }}
          onError={(message) => pushToast({ tone: 'error', message })}
        />
      ) : null}

      {detailRef ? (
        <DetailDrawer item={detailQuery.data ?? null} loading={detailQuery.isLoading} onClose={() => setDetailRef(null)} />
      ) : null}
    </div>
  )
}

function LibraryRow({
  activeTab,
  item,
  onDetail,
  onForceSync,
}: {
  activeTab: LibraryTab
  item: AdminLibraryItem
  onDetail: () => void
  onForceSync: () => Promise<void>
}) {
  return (
    <tr className="border-t border-[#EEF2F5]">
      {cellsForItem(activeTab, item).map((cell, index) => (
        <td key={`${cell.label}-${index}`} className="px-4 py-3 text-iris-text-primary">
          {cell.type === 'status' ? (
            <StatusBadge status={String(cell.value)}>{renderStatusText(String(cell.value), item.is_locked)}</StatusBadge>
          ) : cell.type === 'actions' ? (
            <div className="flex flex-wrap gap-2">
              {activeTab === 'screening_cache' ? (
                <button className="btn-secondary" onClick={() => void onForceSync()} type="button">
                  <RefreshCcw className="h-4 w-4" />
                  Force Sync
                </button>
              ) : activeTab === 'fx_rate' ? (
                <button className="btn-secondary" onClick={onDetail} type="button">
                  <History className="h-4 w-4" />
                  History
                </button>
              ) : activeTab === 'file_template' ? (
                <>
                  <button className="btn-secondary" onClick={onDetail} type="button">
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <button className="btn-secondary" onClick={() => downloadTemplate(item)} type="button">
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                </>
              ) : (
                <button className="btn-secondary" onClick={onDetail} type="button">
                  <Eye className="h-4 w-4" />
                  View
                </button>
              )}
            </div>
          ) : (
            <span className={cell.mono ? 'font-mono text-[12px]' : ''}>{cell.value}</span>
          )}
        </td>
      ))}
    </tr>
  )
}

function UploadVersionModal({
  activeTab,
  onClose,
  onUploaded,
  onError,
}: {
  activeTab: LibraryTab
  onClose: () => void
  onUploaded: (response: AdminLibraryUploadResponse) => Promise<void>
  onError: (message: string) => void
}) {
  const [dataType, setDataType] = useState<Exclude<LibraryTab, 'screening_cache'>>(activeTab === 'screening_cache' ? 'fx_rate' : activeTab)
  const [source, setSource] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('2025-04-29')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    setBusy(true)
    try {
      const formData = new FormData()
      formData.append('data_type', dataType)
      formData.append('source', source)
      formData.append('effective_date', effectiveDate)
      formData.append('notes', notes)
      if (file) {
        formData.append('file', file)
      }
      const { data } = await api.post<AdminLibraryUploadResponse>('/admin/library', formData)
      await onUploaded(data)
    } catch (caughtError: unknown) {
      onError(extractErrorMessage(caughtError) ?? 'Unable to upload this reference-data version.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0D1B2A]/25 p-4">
      <div className="w-full max-w-[620px] rounded-[24px] border border-iris-border bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-[22px] font-bold text-iris-text-primary">Upload New Reference Data Version</h2>
          <button className="btn-secondary" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="grid gap-4">
          <Field label="Data Type">
            <select className="field-input" value={dataType} onChange={(event) => setDataType(event.target.value as Exclude<LibraryTab, 'screening_cache'>)}>
              <option value="mortality_table">Mortality Table</option>
              <option value="yield_curve">Yield Curve</option>
              <option value="fx_rate">FX Rate</option>
              <option value="assumption_set">Assumption Set</option>
              <option value="file_template">File Template</option>
            </select>
          </Field>
          <Field label="Source">
            <input className="field-input" value={source} onChange={(event) => setSource(event.target.value)} />
          </Field>
          <Field label="Effective">
            <input className="field-input" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
          </Field>
          <Field label="File">
            <input className="field-input" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </Field>
          <Field label="Notes">
            <textarea className="field-input min-h-[92px]" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn-primary" disabled={busy || !source || !effectiveDate} onClick={() => void handleSubmit()} type="button">
            {busy ? 'Uploading...' : 'Upload & Validate'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailDrawer({ item, loading, onClose }: { item: AdminLibraryItem | null; loading: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-[#0D1B2A]/25">
      <div className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-iris-border bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#E8EDF2] px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">Reference Detail</p>
            <h2 className="mt-2 text-[22px] font-bold text-iris-text-primary">{item?.ref_id ?? item?.list_name ?? 'Loading...'}</h2>
          </div>
          <button className="btn-secondary" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <p className="text-[13px] text-iris-text-secondary">Loading detail...</p>
          ) : item ? (
            <div className="space-y-4">
              {Object.entries(item).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-iris-border bg-[#FBFCFD] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{key.replaceAll('_', ' ')}</p>
                  <pre className="mt-2 whitespace-pre-wrap text-[12px] leading-6 text-iris-text-primary">
                    {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              description="This reference record does not currently expose a detail payload in the admin mock dataset."
              icon={<Database className="h-5 w-5" />}
              title="No detail is available for this reference item"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      {children}
    </label>
  )
}

function libraryTitle(tab: LibraryTab) {
  switch (tab) {
    case 'fx_rate':
      return 'Currencies & FX Rates'
    case 'mortality_table':
      return 'Mortality Tables'
    case 'yield_curve':
      return 'Yield Curves & Discount Rates'
    case 'assumption_set':
      return 'Assumption Sets · Mortality + Discounting + Inflation'
    case 'file_template':
      return 'File Ingestion Templates'
    default:
      return 'Screening List Cache'
  }
}

function columnsForTab(tab: LibraryTab) {
  switch (tab) {
    case 'fx_rate':
      return ['Code', 'Name', 'FX → USD', 'As Of', 'Source', 'Version', 'Actions']
    case 'mortality_table':
      return ['ID', 'Name', 'Source', 'Version', 'Effective', 'Status', 'Contracts Using', 'Actions']
    case 'yield_curve':
      return ['ID', 'Currency', 'Source', 'As Of', 'Tenors', 'Status', 'Version', 'Actions']
    case 'assumption_set':
      return ['ID', 'Name', 'Mortality', 'Curve', 'Inflation', 'Used By', 'Lock', 'Actions']
    case 'file_template':
      return ['Template', 'Cedant', 'Fields', 'Format', 'Version', 'Actions']
    default:
      return ['List', 'Provider', 'Records', 'Last Sync', 'Status', 'Actions']
  }
}

function cellsForItem(tab: LibraryTab, item: AdminLibraryItem) {
  switch (tab) {
    case 'fx_rate':
      return [
        { label: 'code', value: item.code ?? '', mono: true },
        { label: 'name', value: item.name ?? '' },
        { label: 'fx_to_usd', value: item.fx_to_usd?.toFixed(4) ?? '' },
        { label: 'as_of', value: item.as_of ?? '' },
        { label: 'source', value: item.source ?? '' },
        { label: 'version', value: item.version ?? '' },
        { label: 'actions', value: '', type: 'actions' as const },
      ]
    case 'mortality_table':
      return [
        { label: 'ref_id', value: item.ref_id ?? '', mono: true },
        { label: 'name', value: item.name ?? '' },
        { label: 'source', value: item.source ?? '' },
        { label: 'version', value: item.version ?? '' },
        { label: 'effective_date', value: item.effective_date ?? '' },
        { label: 'status', value: item.is_locked ? 'locked' : item.status ?? 'active', type: 'status' as const },
        { label: 'contracts_using', value: String(item.contracts_using ?? '') },
        { label: 'actions', value: '', type: 'actions' as const },
      ]
    case 'yield_curve':
      return [
        { label: 'ref_id', value: item.ref_id ?? '', mono: true },
        { label: 'currency', value: item.currency ?? '' },
        { label: 'source', value: item.source ?? '' },
        { label: 'as_of', value: item.as_of ?? '' },
        { label: 'tenors', value: String(item.tenors ?? '') },
        { label: 'status', value: item.status ?? 'active', type: 'status' as const },
        { label: 'version', value: item.version ?? '' },
        { label: 'actions', value: '', type: 'actions' as const },
      ]
    case 'assumption_set':
      return [
        { label: 'ref_id', value: item.ref_id ?? '', mono: true },
        { label: 'name', value: item.name ?? '' },
        { label: 'mortality', value: item.mortality ?? '' },
        { label: 'curve', value: item.curve ?? '' },
        { label: 'inflation', value: item.inflation ?? '' },
        { label: 'used_by', value: item.used_by ?? '' },
        { label: 'status', value: item.is_locked ? 'locked' : 'editable', type: 'status' as const },
        { label: 'actions', value: '', type: 'actions' as const },
      ]
    case 'file_template':
      return [
        { label: 'template', value: item.template ?? '', mono: true },
        { label: 'cedant', value: item.cedant ?? '' },
        { label: 'fields', value: String(item.fields ?? '') },
        { label: 'format', value: item.format ?? '' },
        { label: 'version', value: item.version ?? '' },
        { label: 'actions', value: '', type: 'actions' as const },
      ]
    default:
      return [
        { label: 'list_name', value: item.list_name ?? '' },
        { label: 'provider', value: item.provider ?? '' },
        { label: 'records', value: formatCount(item.records ?? 0) },
        { label: 'last_sync', value: item.last_sync ?? '' },
        { label: 'status', value: item.status ?? 'active', type: 'status' as const },
        { label: 'actions', value: '', type: 'actions' as const },
      ]
  }
}

function renderStatusText(value: string, isLocked?: boolean) {
  if (value === 'locked' || isLocked) {
    return 'Locked'
  }
  if (value === 'editable') {
    return 'Editable'
  }
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-GB').format(value)
}

function downloadTemplate(item: AdminLibraryItem) {
  const content = JSON.stringify(item.data_payload ?? {}, null, 2)
  const blob = new Blob([content], { type: 'application/json;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${item.template ?? item.ref_id ?? 'template'}.json`
  anchor.click()
  window.URL.revokeObjectURL(url)
}

function extractErrorMessage(caughtError: unknown) {
  const maybeMessage = caughtError as { response?: { data?: { details?: string } } }
  return maybeMessage.response?.data?.details
}
