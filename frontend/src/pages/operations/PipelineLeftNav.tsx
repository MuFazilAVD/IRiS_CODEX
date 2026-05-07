import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { OperationsPipelineStep, OperationsStepId } from '../../types/api'

interface PipelineLeftNavProps {
  currentStepId: OperationsStepId
  processId: string
  filename: string
  health: string
  steps: OperationsPipelineStep[]
  onSelect: (stepId: OperationsStepId) => void
}

export function PipelineLeftNav({
  currentStepId,
  processId,
  filename,
  health,
  steps,
  onSelect,
}: PipelineLeftNavProps) {
  return (
    <aside className="rounded-[24px] border border-iris-border bg-white p-5 shadow-sm">
      <Link
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-iris-blue transition hover:text-iris-navy"
        to="/claims/cession-files"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Queue
      </Link>

      <div className="mt-5 rounded-[18px] border border-[#D9E3EA] bg-[#F8FAFC] px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-iris-text-muted">Pipeline</p>
        <p className="mt-2 text-[15px] font-semibold text-iris-text-primary">{filename}</p>
        <p className="mt-1 font-mono text-[12px] text-iris-text-secondary">{processId}</p>
      </div>

      <div className="mt-5 space-y-2">
        {steps.map((step, index) => {
          const isCurrent = currentStepId === step.id
          return (
            <button
              key={step.id}
              className={`flex w-full items-start gap-3 rounded-[18px] border px-4 py-3 text-left transition ${
                isCurrent
                  ? 'border-[#9DD7D4] bg-[#F2FBFB]'
                  : 'border-[#E3EAF0] bg-white hover:border-[#C4D4E0] hover:bg-[#FAFCFD]'
              }`}
              onClick={() => onSelect(step.id)}
              type="button"
            >
              <div className="flex flex-col items-center">
                <span className={`mt-0.5 h-3 w-3 rounded-full ${dotClass(step.status)}`} />
                {index < steps.length - 1 ? <span className="mt-1 h-10 w-px bg-[#D9E3EA]" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-iris-text-primary">{step.label}</p>
                <p className="mt-1 text-[12px] text-iris-text-secondary">{step.subtitle}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(step.status)}`}>
                {step.status.replace('_', ' ')}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 rounded-[18px] border border-[#D9E3EA] bg-white px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-semibold text-iris-text-primary">Pipeline Health</p>
          <span className="rounded-full bg-[#E8F8F5] px-2.5 py-1 text-[11px] font-semibold text-[#117A65]">{health}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EAF1F4]">
          <div className="h-full w-full rounded-full bg-[linear-gradient(90deg,#00BCD4_0%,#1A6B9A_100%)]" />
        </div>
      </div>
    </aside>
  )
}

function dotClass(status: OperationsPipelineStep['status']) {
  if (status === 'complete') {
    return 'bg-[#2ECC71]'
  }
  if (status === 'in_progress') {
    return 'bg-[#00BCD4]'
  }
  return 'bg-[#B9C6D2]'
}

function statusClass(status: OperationsPipelineStep['status']) {
  if (status === 'complete') {
    return 'bg-[#D5F5E3] text-[#1E8449]'
  }
  if (status === 'in_progress') {
    return 'bg-[#EBF5FB] text-[#1A5276]'
  }
  return 'bg-[#F2F4F7] text-[#667582]'
}
