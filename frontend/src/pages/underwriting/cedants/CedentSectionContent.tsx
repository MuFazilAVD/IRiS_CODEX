import { Plus, Sparkles, Trash2, Upload } from 'lucide-react'

import { StatusBadge } from '../../../components/common/StatusBadge'
import {
  beneficiaryRuleTypeOptions,
  contactCategoryOptions,
  contactMethodOptions,
  languageOptions,
  type FieldConfig,
} from './cedentConfig'
import type {
  AccessBeneficiaryRule,
  AiExtractField,
  AuditEvent,
  KeyContact,
  RegulatoryDocument,
  SanctionScreeningSection,
} from '../../../types/api'

interface FieldGridFormProps {
  fields: FieldConfig[]
  values: Record<string, unknown>
  onChange: (key: string, value: string | boolean) => void
  extractedFields?: Record<string, AiExtractField>
  lowConfidenceFields?: string[]
}

interface FieldGridReadOnlyProps {
  fields: FieldConfig[]
  values: Record<string, unknown>
}

interface KeyContactsEditorProps {
  items: KeyContact[]
  onChange: (items: KeyContact[]) => void
}

interface KeyContactsReadOnlyProps {
  items: KeyContact[]
}

interface RegulatoryDocsEditorProps {
  items: RegulatoryDocument[]
  onChange: (items: RegulatoryDocument[]) => void
}

interface RegulatoryDocsReadOnlyProps {
  items: RegulatoryDocument[]
}

interface BeneficiaryRulesEditorProps {
  items: AccessBeneficiaryRule[]
  onChange: (items: AccessBeneficiaryRule[]) => void
}

interface BeneficiaryRulesReadOnlyProps {
  items: AccessBeneficiaryRule[]
}

interface AuditTimelineProps {
  events: AuditEvent[]
}

interface SanctionScreeningPanelProps {
  data: SanctionScreeningSection
  filter: 'all' | 'OFAC' | 'FinCEN'
  onFilterChange: (filter: 'all' | 'OFAC' | 'FinCEN') => void
  onTrigger?: (sources: string[]) => void
  disabled?: boolean
  busySource?: string | null
}

export function FieldGridForm({
  fields,
  values,
  onChange,
  extractedFields = {},
  lowConfidenceFields = [],
}: FieldGridFormProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => {
        const fieldValue = values[field.key]
        const extracted = extractedFields[field.key]
        const lowConfidence = lowConfidenceFields.includes(field.key)
        const wrapperClass = field.colSpan === 3 ? 'md:col-span-2 xl:col-span-3' : field.colSpan === 2 ? 'xl:col-span-2' : ''

        return (
          <div key={field.key} className={wrapperClass}>
            <label className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">
              <span>{field.label}</span>
              {extracted ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-[#E8F8F5] px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-[#0E6251]"
                  title={extracted.citation}
                >
                  <Sparkles className="h-3 w-3" />
                  {Math.round(extracted.confidence * 100)}%
                </span>
              ) : null}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                className={`min-h-[96px] w-full rounded-md border px-3 py-2 text-[13px] text-iris-text-primary ${
                  lowConfidence ? 'border-[#F5B041] bg-[#FEF5E7]' : 'border-iris-border bg-white'
                }`}
                disabled={field.readOnly}
                value={String(fieldValue ?? '')}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            ) : field.type === 'select' ? (
              <select
                className={`field-input ${lowConfidence ? 'border-[#F5B041] bg-[#FEF5E7]' : ''}`}
                disabled={field.readOnly}
                value={String(fieldValue ?? '')}
                onChange={(event) => onChange(field.key, event.target.value)}
              >
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'checkbox' ? (
              <label
                className={`flex min-h-[42px] items-center gap-2 rounded-md border px-3 py-2 text-[13px] ${
                  lowConfidence ? 'border-[#F5B041] bg-[#FEF5E7]' : 'border-iris-border bg-white'
                }`}
              >
                <input
                  checked={Boolean(fieldValue)}
                  disabled={field.readOnly}
                  type="checkbox"
                  onChange={(event) => onChange(field.key, event.target.checked)}
                />
                <span className="text-iris-text-primary">{field.label}</span>
              </label>
            ) : (
              <input
                className={`field-input ${lowConfidence ? 'border-[#F5B041] bg-[#FEF5E7]' : ''}`}
                disabled={field.readOnly}
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
                value={String(fieldValue ?? '')}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            )}
            {lowConfidence ? <p className="mt-1 text-[11px] text-[#AF601A]">Low-confidence extraction flagged for review.</p> : null}
          </div>
        )
      })}
    </div>
  )
}

export function FieldGridReadOnly({ fields, values }: FieldGridReadOnlyProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => {
        const fieldValue = values[field.key]
        const wrapperClass = field.colSpan === 3 ? 'md:col-span-2 xl:col-span-3' : field.colSpan === 2 ? 'xl:col-span-2' : ''

        return (
          <div key={field.key} className={wrapperClass}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{field.label}</p>
            <div className="min-h-[42px] rounded-md border border-[#EEF2F5] bg-[#FAFBFC] px-3 py-2 text-[13px] text-iris-text-primary">
              {formatDisplayValue(fieldValue)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function KeyContactsEditor({ items, onChange }: KeyContactsEditorProps) {
  return (
    <div className="space-y-4">
      {items.map((contact, index) => (
        <div key={`${contact.category}-${index}`} className="rounded-xl border border-iris-border bg-[#FAFBFC] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-iris-text-primary">
                {contact.category || 'Contact'} - {contact.full_name || 'New Contact'}
              </p>
              <p className="text-[12px] text-iris-text-secondary">Primary relationship and outreach details.</p>
            </div>
            {items.length > 1 ? (
              <button
                className="btn-secondary"
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SelectField
              label="Category"
              options={contactCategoryOptions}
              value={contact.category}
              onChange={(value) => updateItem(items, index, 'category', value, onChange)}
            />
            <TextField
              label="Full Name"
              value={contact.full_name}
              onChange={(value) => updateItem(items, index, 'full_name', value, onChange)}
            />
            <TextField
              label="Designation"
              value={contact.designation}
              onChange={(value) => updateItem(items, index, 'designation', value, onChange)}
            />
            <TextField
              label="Department"
              value={contact.department}
              onChange={(value) => updateItem(items, index, 'department', value, onChange)}
            />
            <TextField
              label="Email"
              type="email"
              value={contact.email}
              onChange={(value) => updateItem(items, index, 'email', value, onChange)}
            />
            <TextField
              label="Phone"
              value={contact.phone}
              onChange={(value) => updateItem(items, index, 'phone', value, onChange)}
            />
            <TextField
              label="Mobile"
              value={contact.mobile}
              onChange={(value) => updateItem(items, index, 'mobile', value, onChange)}
            />
            <SelectField
              label="Preferred Contact"
              options={contactMethodOptions}
              value={contact.preferred_contact}
              onChange={(value) => updateItem(items, index, 'preferred_contact', value, onChange)}
            />
            <SelectField
              label="Language"
              options={languageOptions}
              value={contact.language}
              onChange={(value) => updateItem(items, index, 'language', value, onChange)}
            />
          </div>
        </div>
      ))}

      <button
        className="btn-secondary"
        onClick={() =>
          onChange([
            ...items,
            {
              category: 'Underwriting Contact',
              full_name: '',
              designation: '',
              department: '',
              email: '',
              phone: '',
              mobile: '',
              preferred_contact: 'Email',
              language: 'English',
            },
          ])
        }
        type="button"
      >
        <Plus className="h-4 w-4" />
        Add Contact
      </button>
    </div>
  )
}

export function KeyContactsReadOnly({ items }: KeyContactsReadOnlyProps) {
  return (
    <div className="space-y-4">
      {items.map((contact, index) => (
        <div key={`${contact.category}-${index}`} className="rounded-xl border border-iris-border bg-[#FAFBFC] p-4">
          <p className="mb-4 text-[14px] font-semibold text-iris-text-primary">
            {contact.category || 'Contact'} - {contact.full_name || '-'}
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ReadOnlyField label="Category" value={contact.category} />
            <ReadOnlyField label="Full Name" value={contact.full_name} />
            <ReadOnlyField label="Designation" value={contact.designation} />
            <ReadOnlyField label="Department" value={contact.department} />
            <ReadOnlyField label="Email" value={contact.email} />
            <ReadOnlyField label="Phone" value={contact.phone} />
            <ReadOnlyField label="Mobile" value={contact.mobile} />
            <ReadOnlyField label="Preferred Contact" value={contact.preferred_contact} />
            <ReadOnlyField label="Language" value={contact.language} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function RegulatoryDocsEditor({ items, onChange }: RegulatoryDocsEditorProps) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-iris-border">
        <table className="min-w-full bg-white text-[13px]">
          <thead className="bg-[#F8F9FA]">
            <tr>
              {['Doc Type', 'Doc Name', 'Doc Date', 'Expiry Date', 'Regulator', 'Upload', ''].map((label) => (
                <th
                  key={label}
                  className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.doc_name}-${index}`} className="border-t border-[#EEF2F5]">
                <td className="px-3 py-2.5">
                  <input className="field-input" value={item.doc_type} onChange={(event) => updateItem(items, index, 'doc_type', event.target.value, onChange)} />
                </td>
                <td className="px-3 py-2.5">
                  <input className="field-input" value={item.doc_name} onChange={(event) => updateItem(items, index, 'doc_name', event.target.value, onChange)} />
                </td>
                <td className="px-3 py-2.5">
                  <input className="field-input" type="date" value={item.doc_date} onChange={(event) => updateItem(items, index, 'doc_date', event.target.value, onChange)} />
                </td>
                <td className="px-3 py-2.5">
                  <input className="field-input" type="date" value={item.expiry_date} onChange={(event) => updateItem(items, index, 'expiry_date', event.target.value, onChange)} />
                </td>
                <td className="px-3 py-2.5">
                  <input className="field-input" value={item.regulator} onChange={(event) => updateItem(items, index, 'regulator', event.target.value, onChange)} />
                </td>
                <td className="px-3 py-2.5">
                  <label className="btn-secondary cursor-pointer">
                    <Upload className="h-4 w-4" />
                    <span>{item.file_name || 'Choose file'}</span>
                    <input
                      className="hidden"
                      type="file"
                      onChange={(event) => updateItem(items, index, 'file_name', event.target.files?.[0]?.name ?? '', onChange)}
                    />
                  </label>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button className="btn-secondary" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} type="button">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        className="btn-secondary"
        onClick={() =>
          onChange([
            ...items,
            { doc_type: '', doc_name: '', doc_date: '', expiry_date: '', regulator: '', file_name: '' },
          ])
        }
        type="button"
      >
        <Plus className="h-4 w-4" />
        Add Document
      </button>
    </div>
  )
}

export function RegulatoryDocsReadOnly({ items }: RegulatoryDocsReadOnlyProps) {
  if (items.length === 0) {
    return <p className="rounded-lg border border-dashed border-iris-border bg-[#FAFBFC] px-4 py-5 text-[13px] text-iris-text-secondary">No regulatory documents recorded yet.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-iris-border">
      <table className="min-w-full bg-white text-[13px]">
        <thead className="bg-[#F8F9FA]">
          <tr>
            {['Doc Type', 'Doc Name', 'Doc Date', 'Expiry Date', 'Regulator', 'File'].map((label) => (
              <th
                key={label}
                className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.doc_name}-${index}`} className="border-t border-[#EEF2F5]">
              <td className="px-3 py-2.5">{formatDisplayValue(item.doc_type)}</td>
              <td className="px-3 py-2.5">{formatDisplayValue(item.doc_name)}</td>
              <td className="px-3 py-2.5">{formatDisplayValue(item.doc_date)}</td>
              <td className="px-3 py-2.5">{formatDisplayValue(item.expiry_date)}</td>
              <td className="px-3 py-2.5">{formatDisplayValue(item.regulator)}</td>
              <td className="px-3 py-2.5">{formatDisplayValue(item.file_name)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function BeneficiaryRulesEditor({ items, onChange }: BeneficiaryRulesEditorProps) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={`${item.rule_type}-${index}`} className="rounded-xl border border-iris-border bg-[#FAFBFC] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[14px] font-semibold text-iris-text-primary">Rule {index + 1}</p>
            {items.length > 1 ? (
              <button
                className="btn-secondary"
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SelectField
              label="Rule Type"
              options={beneficiaryRuleTypeOptions}
              value={item.rule_type}
              onChange={(value) => updateItem(items, index, 'rule_type', value, onChange)}
            />
            <TextField
              label="% of Benefit"
              type="number"
              value={String(item.pct_benefit ?? '')}
              onChange={(value) => updateItem(items, index, 'pct_benefit', value, onChange)}
            />
            <div />
            <TextAreaField
              label="Conditions"
              value={item.conditions}
              onChange={(value) => updateItem(items, index, 'conditions', value, onChange)}
            />
            <TextAreaField
              label="Rule Description"
              value={item.rule_description}
              onChange={(value) => updateItem(items, index, 'rule_description', value, onChange)}
            />
          </div>
        </div>
      ))}

      <button
        className="btn-secondary"
        onClick={() =>
          onChange([
            ...items,
            {
              rule_type: 'spousal',
              pct_benefit: '',
              conditions: '',
              rule_description: '',
            },
          ])
        }
        type="button"
      >
        <Plus className="h-4 w-4" />
        Add Rule
      </button>
    </div>
  )
}

export function BeneficiaryRulesReadOnly({ items }: BeneficiaryRulesReadOnlyProps) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={`${item.rule_type}-${index}`} className="rounded-xl border border-iris-border bg-[#FAFBFC] p-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ReadOnlyField label="Rule Type" value={item.rule_type} />
            <ReadOnlyField label="% of Benefit" value={item.pct_benefit} />
            <div />
            <ReadOnlyField className="xl:col-span-3" label="Conditions" value={item.conditions} />
            <ReadOnlyField className="xl:col-span-3" label="Rule Description" value={item.rule_description} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SanctionScreeningPanel({
  data,
  filter,
  onFilterChange,
  onTrigger,
  disabled = false,
  busySource = null,
}: SanctionScreeningPanelProps) {
  const filteredHistory =
    filter === 'all' ? data.history : data.history.filter((item) => item.source.toUpperCase() === filter.toUpperCase())

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricChip label="Total Scans" value={String(data.total_scans)} />
        <MetricChip label="Open Hits / Reviews" value={String(data.open_hits)} />
        <MetricChip label="Sources Monitored" value={String(data.sources_monitored)} />
        <MetricChip label="Next Periodic Due" value={formatDisplayValue(data.next_periodic_due)} />
      </div>

      <section className="rounded-xl border border-iris-border bg-white p-4">
        <div className="mb-4">
          <h3 className="text-[14px] font-semibold text-iris-text-primary">Source Status</h3>
          <p className="mt-1 text-[12px] text-iris-text-secondary">Latest result from each watchlist provider.</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {data.source_status.map((source) => (
            <div key={source.source} className="rounded-md border border-[#D9E3EA] bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[15px] font-semibold text-iris-text-primary">{displaySourceName(source.source)}</p>
                <StatusBadge status={source.status}>{source.status}</StatusBadge>
              </div>
              <div className="space-y-1.5 text-[12px] text-iris-text-primary">
                <p>
                  <span className="text-iris-text-secondary">Last scan:</span> {formatDisplayValue(source.last_scan)}
                </p>
                <p>
                  <span className="text-iris-text-secondary">Reference:</span> {formatDisplayValue(source.reference)}
                </p>
                <p>
                  <span className="text-iris-text-secondary">Matches:</span> {source.matches}
                </p>
              </div>
              {onTrigger ? (
                <button
                  className="btn-secondary mt-4 w-full justify-center"
                  disabled={disabled}
                  onClick={() => onTrigger([displaySourceName(source.source)])}
                  type="button"
                >
                  {busySource === displaySourceName(source.source) ? 'Running...' : `Trigger ${displaySourceName(source.source)} Scan`}
                </button>
              ) : null}
            </div>
          ))}
        </div>

        {onTrigger ? (
          <div className="mt-3 flex justify-end">
            <button className="btn-primary" disabled={disabled} onClick={() => onTrigger(['OFAC', 'FinCEN'])} type="button">
              {busySource === 'ALL' ? 'Running...' : 'Run Adhoc Screening - All Sources'}
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-iris-border bg-white p-4">
        <div className="mb-3">
          <h3 className="text-[14px] font-semibold text-iris-text-primary">Screening History</h3>
          <p className="mt-1 text-[12px] text-iris-text-secondary">Periodic and adhoc scan results across all watchlist providers.</p>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-iris-text-secondary">Filter:</span>
          {(['all', 'OFAC', 'FinCEN'] as const).map((option) => (
            <button
              key={option}
              className={`rounded-md border px-3 py-1.5 text-[12px] font-semibold ${
                filter === option ? 'border-iris-navy bg-iris-navy text-white' : 'border-iris-border bg-white text-iris-text-primary'
              }`}
              onClick={() => onFilterChange(option)}
              type="button"
            >
              {option === 'all' ? 'ALL' : option}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white text-[13px]">
            <thead className="bg-[#F8F9FA]">
              <tr>
                {['Date', 'Source', 'Type', 'Result', 'Matches', 'Reference', 'Reviewer', 'Notes'].map((label) => (
                  <th
                    key={label}
                    className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td className="px-3 py-5 text-iris-text-secondary" colSpan={8}>
                    No screening history for this source filter yet.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="border-t border-[#EEF2F5]">
                    <td className="px-3 py-2.5 font-mono text-[12px]">{formatHistoryDate(item.screening_date)}</td>
                    <td className="px-3 py-2.5">{displaySourceName(item.source)}</td>
                    <td className="px-3 py-2.5">{item.scan_type ?? 'Periodic'}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={item.result}>{item.result}</StatusBadge>
                    </td>
                    <td className="px-3 py-2.5">{item.matches}</td>
                    <td className="px-3 py-2.5 font-mono text-[12px]">{item.reference_id}</td>
                    <td className="px-3 py-2.5">{item.reviewer ?? 'm.patel@reinsure.io'}</td>
                    <td className="max-w-[220px] px-3 py-2.5 text-iris-text-secondary">{item.notes ?? (item.matches > 0 ? 'Under analyst review' : 'No watchlist matches found')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export function AuditTimeline({ events }: AuditTimelineProps) {
  return (
    <div className="space-y-3">
      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-iris-border bg-[#FAFBFC] px-4 py-5 text-[13px] text-iris-text-secondary">
          Audit trail will populate as underwriting actions are saved.
        </p>
      ) : (
        events.map((event, index) => (
          <div key={`${event.timestamp}-${index}`} className="rounded-xl border border-iris-border bg-[#FAFBFC] p-4">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <p className="text-[14px] font-semibold text-iris-text-primary">{event.action}</p>
              <p className="text-[12px] text-iris-text-secondary">{event.timestamp}</p>
            </div>
            <p className="mt-2 text-[13px] text-iris-text-secondary">
              {event.actor} - {event.detail}
            </p>
          </div>
        ))
      )}
    </div>
  )
}

function updateItem<T extends object>(
  items: T[],
  index: number,
  key: keyof T,
  value: string,
  onChange: (items: T[]) => void,
) {
  const nextItems = structuredClone(items)
  ;(nextItems[index] as Record<string, unknown>)[String(key)] = value
  onChange(nextItems)
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'number'
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</label>
      <input className="field-input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ label: string; value: string }>
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</label>
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="md:col-span-2 xl:col-span-3">
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</label>
      <textarea className="min-h-[96px] w-full rounded-md border border-iris-border bg-white px-3 py-2 text-[13px] text-iris-text-primary" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function ReadOnlyField({
  label,
  value,
  className = '',
}: {
  label: string
  value: unknown
  className?: string
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      <div className="rounded-md border border-[#EEF2F5] bg-white px-3 py-2 text-[13px] text-iris-text-primary">{formatDisplayValue(value)}</div>
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-iris-border bg-white px-4 py-4">
      <p className="text-[11px] text-iris-text-secondary">{label}</p>
      <p className="mt-2 text-[22px] font-bold text-iris-text-primary">{value}</p>
    </div>
  )
}

function displaySourceName(value: string) {
  const normalized = value.toLowerCase()
  if (normalized.startsWith('ofac')) {
    return 'OFAC'
  }
  if (normalized.startsWith('fincen')) {
    return 'FinCEN'
  }
  return value
}

function formatHistoryDate(value: string) {
  if (!value) {
    return '-'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`
}

function formatDisplayValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  return String(value)
}
