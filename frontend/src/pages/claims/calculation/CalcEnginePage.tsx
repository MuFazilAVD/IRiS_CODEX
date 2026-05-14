import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { api } from '../../../api/client'
import { Breadcrumbs } from '../../../components/common/Breadcrumbs'
import { PageHeader } from '../../../components/common/PageHeader'
import { StatusBadge } from '../../../components/common/StatusBadge'
import { useUiStore } from '../../../store/uiStore'
import { formatCurrency } from '../../../utils/formatters'
import type { ClaimsCalculationContractOption, ClaimsCalculationResult } from '../../../types/api'

type PeriodOption = {
  label: string
  start: string
  end: string
}

const CALCULATION_OPTIONS = [
  { value: 'settlement', label: 'Settlement' },
  { value: 'fixed_leg', label: 'Fixed Leg' },
  { value: 'floating_leg', label: 'Floating Leg' },
  { value: 'ae_ratio', label: 'A/E Ratio' },
]

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: 'Q1 2024', start: '2024-01-01', end: '2024-03-31' },
  { label: 'Q2 2024', start: '2024-04-01', end: '2024-06-30' },
  { label: 'Q3 2024', start: '2024-07-01', end: '2024-09-30' },
  { label: 'Q4 2024', start: '2024-10-01', end: '2024-12-31' },
  { label: 'Q1 2025', start: '2025-01-01', end: '2025-03-31' },
  { label: 'Q2 2025', start: '2025-04-01', end: '2025-06-30' },
]

export function CalcEnginePage() {
  const navigate = useNavigate()
  const [selectedContractId, setSelectedContractId] = useState('')
  const [selectedCalculationType, setSelectedCalculationType] = useState('settlement')
  const [selectedPeriodFrom, setSelectedPeriodFrom] = useState('Q1 2025')
  const [selectedPeriodTo, setSelectedPeriodTo] = useState('Q1 2025')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ClaimsCalculationResult | null>(null)
  const [approvalState, setApprovalState] = useState<'draft' | 'submitted'>('draft')
  const pushToast = useUiStore((state) => state.pushToast)

  const contractsQuery = useQuery({
    queryKey: ['claims-calculation-contracts'],
    queryFn: async () => (await api.get<ClaimsCalculationContractOption[]>('/claims/calculations/contracts')).data,
  })

  const contractOptions = contractsQuery.data ?? []

  useEffect(() => {
    if (!selectedContractId && contractOptions.length) {
      setSelectedContractId(contractOptions[0].contract_id)
    }
  }, [contractOptions, selectedContractId])

  const selectedContract = useMemo(
    () => contractOptions.find((item) => item.contract_id === selectedContractId) ?? null,
    [contractOptions, selectedContractId],
  )

  const fromPeriod = PERIOD_OPTIONS.find((item) => item.label === selectedPeriodFrom) ?? PERIOD_OPTIONS[0]
  const toPeriod = PERIOD_OPTIONS.find((item) => item.label === selectedPeriodTo) ?? PERIOD_OPTIONS[4]

  async function handleRunCalculation() {
    if (!selectedContract) {
      pushToast({ tone: 'error', message: 'Select a contract before running the calculation.' })
      return
    }

    setBusy(true)
    try {
      const { data } = await api.post<ClaimsCalculationResult>('/claims/calculations/run', {
        contract_id: selectedContract.contract_id,
        calculation_type: selectedCalculationType,
        period_start: fromPeriod.start,
        period_end: toPeriod.end,
      })
      setResult(data)
      setApprovalState('draft')
      pushToast({
        tone: 'success',
        message: `${selectedContract.contract_id} calculation completed for ${data.period}.`,
      })
    } catch (caughtError: unknown) {
      pushToast({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to run the calculation right now.',
      })
    } finally {
      setBusy(false)
    }
  }

  function handleDownload() {
    if (!result || !selectedContract) {
      pushToast({ tone: 'error', message: 'Run a calculation before downloading the output.' })
      return
    }

    downloadBlob(JSON.stringify({ contract: selectedContract, result }, null, 2), `${result.contract_id}-${result.period}.json`, 'application/json;charset=utf-8;')
  }

  function handleExportToSettlement() {
    if (!result) {
      pushToast({ tone: 'error', message: 'Run a calculation before exporting it to settlements.' })
      return
    }
    navigate(`/claims/settlements?contract_id=${result.contract_id}&status=pending_approval`)
  }

  function handleSaveCalculation() {
    if (!result) {
      pushToast({ tone: 'error', message: 'There is no calculation result to save yet.' })
      return
    }
    pushToast({
      tone: 'success',
      message: `${result.contract_id} saved as a deterministic mock calculation session. The approval API is not defined in the current phase specs.`,
    })
  }

  function handleSubmitForApproval() {
    if (!result) {
      pushToast({ tone: 'error', message: 'Run a calculation before submitting it for approval.' })
      return
    }
    setApprovalState('submitted')
    pushToast({
      tone: 'success',
      message: 'Calculation marked as submitted for approval in the UI-only workflow mock.',
    })
  }

  const formulaPanel = calculationFormula(selectedCalculationType, selectedContract?.currency ?? 'USD')
  const outputRows = buildOutputRows(result, selectedContract?.currency ?? 'USD')
  const auditTrail = buildAuditTrail(result, selectedContract, selectedCalculationType, approvalState)

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Claims & Settlement' }, { label: 'Calculation Engine' }]} />
      <PageHeader
        action={
          <button className="btn-secondary" onClick={handleDownload} type="button">
            <Download className="h-4 w-4" />
            Download
          </button>
        }
        title="Calculation Engine"
      />

      <div className="rounded-[24px] border border-iris-border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="ready">Ready</StatusBadge>
              <span className="rounded-full bg-[#F4F9FD] px-2.5 py-1 text-[11px] font-semibold text-iris-blue">
                {selectedCalculationLabel(selectedCalculationType)}
              </span>
            </div>
            <p className="mt-3 text-[16px] font-semibold text-iris-text-primary">
              {selectedContract ? `${selectedContract.cedent_name} · Contract ${selectedContract.contract_id} ${selectedContract.contract_version}` : 'Loading contract context...'}
            </p>
          </div>
          <p className="text-[13px] text-iris-text-secondary">
            Assumption set {selectedContract?.assumption_snapshot ?? 'v2025.Q2'} · Valuation {selectedContract?.valuation_date ?? '2025-03-31'}
          </p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <ContextField label="Cedant" value={selectedContract?.cedent_name ?? '-'} />
          <ContextField label="Contract" value={selectedContract?.contract_id ?? '-'} />
          <ContextField label="Contract Version" value={selectedContract?.contract_version ?? '-'} />
          <ContextField label="Calculation Type" value={selectedCalculationLabel(selectedCalculationType)} />
          <ContextField label="Valuation Date" value={selectedContract?.valuation_date ?? '-'} />
          <ContextField label="Calculation Period" value={`${selectedPeriodFrom} -> ${selectedPeriodTo}`} />
          <ContextField label="Assumption Snapshot" value={selectedContract?.assumption_snapshot ?? '-'} />
          <ContextField label="Scenario Mode" value="Base" />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AssumptionTile label="Mortality Table" value={mortalityTableForCurrency(selectedContract?.currency ?? 'USD')} />
          <AssumptionTile label="Yield Curve" value={`${selectedContract?.currency ?? 'USD'} IRS v2025.Q2`} />
          <AssumptionTile label="FX Rates" value={`${selectedContract?.currency ?? 'USD'} close snapshot`} />
          <AssumptionTile label="Inflation" value="2.40% long-term" />
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr_1fr]">
        <PanelCard subtitle="Select the contract, metric and quarter range for this run." title="Inputs">
          <div className="space-y-3">
            <select className="field-input" value={selectedContractId} onChange={(event) => setSelectedContractId(event.target.value)}>
              {contractOptions.map((item) => (
                <option key={item.contract_id} value={item.contract_id}>
                  {item.contract_id} · {item.cedent_name}
                </option>
              ))}
            </select>
            <select className="field-input" value={selectedCalculationType} onChange={(event) => setSelectedCalculationType(event.target.value)}>
              {CALCULATION_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select className="field-input" value={selectedPeriodFrom} onChange={(event) => setSelectedPeriodFrom(event.target.value)}>
              {PERIOD_OPTIONS.map((item) => (
                <option key={item.label} value={item.label}>
                  From {item.label}
                </option>
              ))}
            </select>
            <select className="field-input" value={selectedPeriodTo} onChange={(event) => setSelectedPeriodTo(event.target.value)}>
              {PERIOD_OPTIONS.map((item) => (
                <option key={item.label} value={item.label}>
                  To {item.label}
                </option>
              ))}
            </select>
            <button className="btn-primary w-full justify-center" disabled={busy || !selectedContractId} onClick={() => void handleRunCalculation()} type="button">
              {busy ? 'Running...' : 'Run Calculation'}
            </button>
          </div>
        </PanelCard>

        <PanelCard subtitle="Formula and controls aligned to the selected calculation type." title="Formula & Parameters">
          <div className="rounded-xl border border-iris-border bg-[#F8FAFC] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">Method</p>
            <p className="mt-3 text-[18px] font-semibold text-iris-text-primary">{formulaPanel.method}</p>
            <p className="mt-4 text-[13px] leading-6 text-iris-text-secondary">{formulaPanel.description}</p>
          </div>
          <div className="mt-3 space-y-2 text-[13px] text-iris-text-secondary">
            {formulaPanel.notes.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </PanelCard>

        <PanelCard subtitle="Run output from the settlement calculation endpoint." title="Output">
          {result ? (
            <div className="overflow-x-auto rounded-xl border border-iris-border">
              <table className="min-w-full text-[13px]">
                <thead className="bg-[#F8F9FA]">
                  <tr>
                    {['Metric', 'Value'].map((label) => (
                      <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {outputRows.map((item) => (
                    <tr key={item.label} className="border-t border-[#EEF2F5]">
                      <td className="px-4 py-3 text-iris-text-primary">{item.label}</td>
                      <td className="px-4 py-3 font-medium text-iris-text-secondary">{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-iris-text-secondary">Run a calculation to populate the output panel.</p>
          )}
        </PanelCard>
      </div>

      {result ? (
        <>
          <div className="mt-5 rounded-[24px] border border-iris-border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[18px] font-bold text-iris-text-primary">
                  {result.contract_id} · {result.period}
                </p>
                <p className="mt-1 text-[13px] text-iris-text-secondary">
                  {selectedContract?.cedent_name} · {selectedCalculationLabel(selectedCalculationType)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={handleExportToSettlement} type="button">
                  Export to Settlement
                </button>
                <button className="btn-primary" onClick={handleSaveCalculation} type="button">
                  Save Calculation
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ResultTile label="Fixed Leg" value={formatMoney(result.fixed_leg, selectedContract?.currency ?? 'USD')} />
              <ResultTile label="Floating Leg" value={formatMoney(result.floating_leg, selectedContract?.currency ?? 'USD')} />
              <ResultTile label="Net Settlement" value={formatSignedMoney(result.net, selectedContract?.currency ?? 'USD')} tone={result.net >= 0 ? 'positive' : 'negative'} />
              <ResultTile label="A/E Ratio" value={result.ae_ratio.toFixed(3)} />
              <ResultTile label="BEL Current" value={formatMoney(result.bel_current, selectedContract?.currency ?? 'USD')} />
              <ResultTile label="BEL Change" value={formatSignedMoney(result.bel_change, selectedContract?.currency ?? 'USD')} tone={result.bel_change >= 0 ? 'positive' : 'negative'} />
              <ResultTile label="Lives (start)" value={formatCount(result.lives_start)} />
              <ResultTile label="Deaths" value={`${result.deaths_actual} actual / ${result.deaths_expected} expected`} />
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-iris-border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[18px] font-bold text-iris-text-primary">Approval Workflow</p>
                <p className="mt-1 text-[13px] text-iris-text-secondary">UI-only workflow state because the current phase specs do not define a save or approval API.</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={approvalState}>{titleCase(approvalState)}</StatusBadge>
                <button className="btn-primary" onClick={handleSubmitForApproval} type="button">
                  Submit for approval
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-iris-border bg-white p-5 shadow-sm">
            <p className="text-[18px] font-bold text-iris-text-primary">Audit Trail</p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-iris-border">
              <table className="min-w-full text-[13px]">
                <thead className="bg-[#F8F9FA]">
                  <tr>
                    {['Timestamp', 'Actor', 'Source', 'Action', 'Detail'].map((label) => (
                      <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditTrail.map((item, index) => (
                    <tr key={`${item.timestamp}-${item.actor}-${index}`} className="border-t border-[#EEF2F5]">
                      <td className="px-4 py-3 text-iris-text-secondary">{item.timestamp}</td>
                      <td className="px-4 py-3 text-iris-text-primary">{item.actor}</td>
                      <td className="px-4 py-3 text-iris-text-secondary">{item.source}</td>
                      <td className="px-4 py-3 text-iris-text-primary">{item.action}</td>
                      <td className="px-4 py-3 text-iris-text-secondary">{item.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function PanelCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-[24px] border border-iris-border bg-white p-5 shadow-sm">
      <p className="text-[18px] font-bold text-iris-text-primary">{title}</p>
      <p className="mt-1 text-[13px] text-iris-text-secondary">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function ContextField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-iris-border bg-[#F8FAFC] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      <p className="mt-2 text-[14px] font-semibold text-iris-text-primary">{value}</p>
    </div>
  )
}

function AssumptionTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-iris-border bg-[#FAFBFC] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
        <span className="rounded-full bg-[#EBF5FB] px-2 py-1 text-[11px] font-semibold text-iris-blue">Override</span>
      </div>
      <p className="mt-3 text-[15px] font-semibold text-iris-text-primary">{value}</p>
    </div>
  )
}

function ResultTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative'
}) {
  const toneClass = tone === 'positive' ? 'text-[#117A65]' : tone === 'negative' ? 'text-[#922B21]' : 'text-iris-text-primary'

  return (
    <div className="rounded-xl border border-iris-border bg-[#FAFBFC] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      <p className={`mt-2 text-[22px] font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function calculationFormula(calculationType: string, currency: string) {
  switch (calculationType) {
    case 'fixed_leg':
      return {
        method: 'Fixed leg accrual engine',
        description: 'Projects fixed-leg cashflows across the selected quarter range using the contract rate and payment cadence.',
        notes: [`Rule applied: fixed-leg schedule / currency ${currency}`, 'Inputs anchored to the live contract register and deterministic phase mock assumptions.'],
      }
    case 'floating_leg':
      return {
        method: 'Floating leg experience projection',
        description: 'Re-estimates mortality-linked payments using the current quarter range and the contract experience factor.',
        notes: [`Rule applied: floating-leg projection / currency ${currency}`, 'Uses the same contract baseline as the settlement output and applies a higher drift factor for the mock run.'],
      }
    case 'ae_ratio':
      return {
        method: 'Actual versus expected ratio',
        description: 'Compares expected deaths to actual deaths over the requested quarter range and rolls the result into BEL change.',
        notes: [`Rule applied: A/E ratio / currency ${currency}`, 'Lives, expected deaths and BEL change are returned from the Phase 9 calculation endpoint.'],
      }
    default:
      return {
        method: 'Settlement calculation engine',
        description: 'Builds fixed leg, floating leg and net settlement output for the selected contract and period range.',
        notes: [`Rule applied: settlement engine / currency ${currency}`, 'Exact Q1 2025 seeded settlements are reused where the mock register has a matching contract-period row.'],
      }
  }
}

function buildOutputRows(result: ClaimsCalculationResult | null, currency: string) {
  if (!result) {
    return []
  }

  return [
    { label: 'Fixed Leg', value: formatMoney(result.fixed_leg, currency) },
    { label: 'Floating Leg', value: formatMoney(result.floating_leg, currency) },
    { label: 'Net', value: formatSignedMoney(result.net, currency) },
    { label: 'A/E Ratio', value: result.ae_ratio.toFixed(3) },
    { label: 'BEL Current', value: formatMoney(result.bel_current, currency) },
    { label: 'BEL Previous', value: formatMoney(result.bel_previous, currency) },
    { label: 'BEL Change', value: formatSignedMoney(result.bel_change, currency) },
    { label: 'Lives (start)', value: formatCount(result.lives_start) },
    { label: 'Deaths', value: `${result.deaths_actual} actual / ${result.deaths_expected} expected` },
  ]
}

function buildAuditTrail(
  result: ClaimsCalculationResult | null,
  contract: ClaimsCalculationContractOption | null,
  calculationType: string,
  approvalState: 'draft' | 'submitted',
) {
  if (!result || !contract) {
    return []
  }

  return [
    {
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      actor: 'Claims Ops',
      source: 'Human',
      action: 'Run started',
      detail: `${contract.contract_id} / ${selectedCalculationLabel(calculationType)}`,
    },
    {
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      actor: 'Settlement Calc Engine',
      source: 'System',
      action: 'Calculation completed',
      detail: `${result.period} / ${result.calculation_id}`,
    },
    {
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      actor: 'Approval Workflow',
      source: 'UI Mock',
      action: approvalState === 'submitted' ? 'Submitted for approval' : 'Draft saved in session',
      detail: approvalState === 'submitted' ? 'Awaiting reviewer action' : 'No backend save API defined',
    },
  ]
}

function selectedCalculationLabel(value: string) {
  return CALCULATION_OPTIONS.find((item) => item.value === value)?.label ?? titleCase(value)
}

function mortalityTableForCurrency(currency: string) {
  if (currency === 'GBP') {
    return 'CMI 2024'
  }
  if (currency === 'CHF') {
    return 'BVG 2020'
  }
  if (currency === 'EUR') {
    return 'DAV 2004R'
  }
  return 'Generational 2025'
}

function formatMoney(amount: number, currency: string) {
  return formatCurrency(amount, currency)
}

function formatSignedMoney(amount: number, currency: string) {
  return `${amount >= 0 ? '+' : '-'}${formatMoney(Math.abs(amount), currency)}`
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-GB').format(value)
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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
  const maybeMessage = caughtError as { response?: { data?: { details?: string } } }
  return maybeMessage.response?.data?.details
}
