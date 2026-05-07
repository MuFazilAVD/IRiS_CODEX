import { useEffect, useState } from 'react'

import type { OperationsNormalizationPayload } from '../../../types/api'

const TAB_ORDER = [
  'Input Preview',
  'Column Mapping',
  'Normalization Rules',
  'Validation & Data Quality',
  'Normalized Output',
] as const

export function NormalizationStep({ payload }: { payload: OperationsNormalizationPayload }) {
  const [activeTab, setActiveTab] = useState<(typeof TAB_ORDER)[number]>('Input Preview')

  useEffect(() => {
    setActiveTab('Input Preview')
  }, [payload.process_id])

  return (
    <div className="space-y-5">
      <SectionHeading
        subtitle={`${payload.step.subtitle} · ${payload.process_id} · Started ${formatDate(payload.started_at)}`}
        title={payload.step.label}
      />

      <div className="flex flex-wrap gap-2">
        {TAB_ORDER.map((tab) => (
          <button
            key={tab}
            className={`rounded-full px-3.5 py-2 text-[12px] font-semibold transition ${
              activeTab === tab ? 'bg-iris-navy text-white' : 'bg-[#F4F7FA] text-iris-text-secondary hover:bg-[#EAF1F6]'
            }`}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Input Preview' ? (
        <div className="rounded-[24px] border border-[#D9E3EA] bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[#E9EEF3] px-5 py-4">
            <div>
              <p className="text-[16px] font-semibold text-iris-text-primary">Raw Source File Preview (Unstructured)</p>
              <p className="mt-1 text-[13px] text-iris-text-secondary">Page 1 of {formatCount(payload.input_preview.total_pages)}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="bg-[#F7F9FB]">
                <tr>
                  {payload.input_preview.columns.map((column) => (
                    <th key={column} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.input_preview.rows.map((row) => (
                  <tr key={row['RED ID']} className="border-t border-[#EEF2F5]">
                    {payload.input_preview.columns.map((column) => {
                      const value = row[column as keyof typeof row]
                      const isDobIssue = column === 'DOB' && row.dob_issue
                      return (
                        <td key={`${row['RED ID']}-${column}`} className={`px-4 py-3 ${isDobIssue ? 'bg-[#FFF8EE] text-[#B9770E]' : 'text-iris-text-primary'}`}>
                          {String(value || '—')}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'Column Mapping' ? (
        <PanelTable
          columns={['Source Field', 'Target Field', 'Transformation']}
          rows={payload.column_mapping.map((row) => [row.source_field, row.target_field, row.transformation])}
          title="Source to IRiS Schema Map"
        />
      ) : null}

      {activeTab === 'Normalization Rules' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {payload.normalization_rules.map((rule) => (
            <div key={rule.title} className="rounded-[22px] border border-[#D9E3EA] bg-white px-5 py-4 shadow-sm">
              <p className="text-[15px] font-semibold text-iris-text-primary">{rule.title}</p>
              <p className="mt-2 text-[13px] leading-6 text-iris-text-secondary">{rule.body}</p>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === 'Validation & Data Quality' ? (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryChip label="Total Fields" value={formatCount(payload.validation.total_fields)} />
            <SummaryChip label="Fields with Issues" tone="warning" value={formatCount(payload.validation.fields_with_issues)} />
            <SummaryChip label="Fields Corrected" tone="success" value={formatCount(payload.validation.fields_corrected)} />
            <SummaryChip label="Fields Inferred" tone="info" value={formatCount(payload.validation.fields_inferred)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {payload.validation.filter_pills.map((pill) => (
              <span key={pill} className="rounded-full bg-[#F4F7FA] px-3.5 py-2 text-[12px] font-semibold text-iris-text-secondary">
                {pill}
              </span>
            ))}
          </div>

          <PanelTable
            columns={['Field Name', 'Checked', 'Issues', 'Corrected', 'Inferred', 'Status', 'Method Used']}
            rows={payload.validation.field_validations.map((row) => [
              row.field_name,
              formatCount(row.checked),
              formatCount(row.issues),
              formatCount(row.corrected),
              formatCount(row.inferred),
              row.status,
              row.method_used,
            ])}
            title="Validation & Data Quality"
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[22px] border border-[#D9E3EA] bg-white px-5 py-4 shadow-sm">
              <p className="text-[15px] font-semibold text-iris-text-primary">Risk Indicators</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MetricLine label="Imputed Count" value={`${formatCount(payload.validation.risk_indicators.imputed_count)} Fields`} />
                <MetricLine label="Inferred Count" value={`${formatCount(payload.validation.risk_indicators.inferred_count)} Fields`} />
                <MetricLine label="Confidence" value={`${(payload.validation.risk_indicators.confidence * 100).toFixed(1)}%`} />
                <MetricLine label="Risk Level" value={payload.validation.risk_indicators.risk_level} />
              </div>
            </div>

            <div className="rounded-[22px] border border-[#D9E3EA] bg-white px-5 py-4 shadow-sm">
              <p className="text-[15px] font-semibold text-iris-text-primary">Contextual Controls</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {payload.validation.actions.map((action) => (
                  <button key={action} className="btn-secondary" type="button">
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'Normalized Output' ? (
        <PanelTable
          columns={payload.normalized_output.columns}
          rows={payload.normalized_output.rows.map((row) => [
            row.member_id,
            row.full_name,
            String(row.dob),
            String(row.age),
            row.monthly_pension.toLocaleString('en-GB', { maximumFractionDigits: 2 }),
            row.gender,
            row.spouse_flag,
            row.event_type,
            row.event_date,
          ])}
          title="Normalized Output"
        />
      ) : null}
    </div>
  )
}

function PanelTable({
  columns,
  rows,
  title,
}: {
  columns: string[]
  rows: Array<Array<string>>
  title: string
}) {
  return (
    <div className="rounded-[24px] border border-[#D9E3EA] bg-white shadow-sm">
      <div className="border-b border-[#E9EEF3] px-5 py-4">
        <p className="text-[16px] font-semibold text-iris-text-primary">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[13px]">
          <thead className="bg-[#F7F9FB]">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-[#EEF2F5]">
                {row.map((value, columnIndex) => (
                  <td key={`${rowIndex}-${columnIndex}`} className="px-4 py-3 text-iris-text-primary">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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

function SummaryChip({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'warning' | 'success' | 'info'
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-[#F9E79F] bg-[#FEF9E7] text-[#9A7D0A]'
      : tone === 'success'
        ? 'border-[#CFE9D9] bg-[#F3FCF6] text-[#117A65]'
        : tone === 'info'
          ? 'border-[#D6EAF8] bg-[#F5FBFF] text-[#1A5276]'
          : 'border-[#D9E3EA] bg-white text-iris-text-primary'

  return (
    <div className={`rounded-[20px] border px-4 py-4 shadow-sm ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-2 text-[24px] font-bold">{value}</p>
    </div>
  )
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      <p className="mt-1.5 text-[14px] font-semibold text-iris-text-primary">{value}</p>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-GB').format(value)
}
