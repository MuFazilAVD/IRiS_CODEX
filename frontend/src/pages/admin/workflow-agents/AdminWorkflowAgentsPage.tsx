import type { ReactNode } from 'react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, RefreshCw, Save } from 'lucide-react'
import { GearSix, Robot } from '@phosphor-icons/react'

import { api } from '../../../api/client'
import { Breadcrumbs } from '../../../components/common/Breadcrumbs'
import { PageHeader } from '../../../components/common/PageHeader'
import { TableSkeleton } from '../../../components/common/Skeleton'
import { useUiStore } from '../../../store/uiStore'
import type { AdminWorkflowAgentRecord, AdminWorkflowAgentsPayload } from '../../../types/api'

type AgentDraft = Record<string, AdminWorkflowAgentRecord>

type WorkflowGroupCard = {
  id: string
  title: string
  description: string
  helperText: string
  live: boolean
  agents: AdminWorkflowAgentRecord[]
}

const CEDANT_WORKFLOW_DUMMIES: AdminWorkflowAgentRecord[] = [
  {
    key: 'cedant_intake',
    step_id: 'cedant-intake',
    step_label: 'Intake',
    execution_type: 'agent',
    agent_name: 'Cedant Intake Agent',
    description: 'Capture inbound cedant submissions and prepare the onboarding handoff.',
    enabled: true,
    confidence_threshold: 0.9,
    always_pause_for_hitl: false,
    hitl_behavior: 'pause_for_approval',
    escalation_team: 'Operations Team',
    retry_limit: 1,
    fallback_mode: 'manual_review',
  },
  {
    key: 'cedant_matching',
    step_id: 'cedant-matching',
    step_label: 'Mapping',
    execution_type: 'agent',
    agent_name: 'Cedant Mapping Agent',
    description: 'Preview placeholder for cedant and treaty matching automation.',
    enabled: true,
    confidence_threshold: 0.88,
    always_pause_for_hitl: false,
    hitl_behavior: 'pause_for_approval',
    escalation_team: 'Operations Team',
    retry_limit: 1,
    fallback_mode: 'manual_review',
  },
]

const COMPLIANCE_WORKFLOW_DUMMIES: AdminWorkflowAgentRecord[] = [
  {
    key: 'compliance_screening',
    step_id: 'compliance-screening',
    step_label: 'Screening',
    execution_type: 'agent',
    agent_name: 'Compliance Screening Agent',
    description: 'Preview placeholder for compliance watchlist orchestration.',
    enabled: true,
    confidence_threshold: 0.94,
    always_pause_for_hitl: true,
    hitl_behavior: 'pause_for_approval',
    escalation_team: 'Compliance Team',
    retry_limit: 0,
    fallback_mode: 'manual_review',
  },
  {
    key: 'compliance_disposition',
    step_id: 'compliance-disposition',
    step_label: 'Disposition',
    execution_type: 'agent',
    agent_name: 'Compliance Disposition Agent',
    description: 'Preview placeholder for compliance case disposition support.',
    enabled: true,
    confidence_threshold: 0.91,
    always_pause_for_hitl: true,
    hitl_behavior: 'pause_for_approval',
    escalation_team: 'Compliance Team',
    retry_limit: 1,
    fallback_mode: 'manual_review',
  },
  {
    key: 'compliance_reporting',
    step_id: 'compliance-reporting',
    step_label: 'Reporting',
    execution_type: 'agent',
    agent_name: 'Compliance Reporting Agent',
    description: 'Preview placeholder for compliance evidence packaging and reporting.',
    enabled: true,
    confidence_threshold: 0.89,
    always_pause_for_hitl: false,
    hitl_behavior: 'pause_for_approval',
    escalation_team: 'Compliance Team',
    retry_limit: 0,
    fallback_mode: 'manual_review',
  },
]

export function AdminWorkflowAgentsPage() {
  const pushToast = useUiStore((state) => state.pushToast)
  const [drafts, setDrafts] = useState<AgentDraft>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [expandedWorkflows, setExpandedWorkflows] = useState<Record<string, boolean>>({})

  const workflowAgentsQuery = useQuery({
    queryKey: ['admin-workflow-agents'],
    queryFn: async () => (await api.get<AdminWorkflowAgentsPayload>('/admin/workflow-agents')).data,
  })

  const liveAgents = (workflowAgentsQuery.data?.items ?? []).filter((agent) => agent.execution_type === 'agent')
  const workflowGroups: WorkflowGroupCard[] = [
    {
      id: 'cession',
      title: 'Cession Workflow',
      description: 'Live automation controls for the cession workflow.',
      helperText: 'Configurable',
      live: true,
      agents: liveAgents,
    },
    {
      id: 'cedant',
      title: 'Cedant Workflow',
      description: 'Placeholder agent stack for future cedant workflow automation.',
      helperText: 'Preview only',
      live: false,
      agents: CEDANT_WORKFLOW_DUMMIES,
    },
    {
      id: 'compliance',
      title: 'Compliance Workflow',
      description: 'Placeholder agent stack for future compliance workflow automation.',
      helperText: 'Preview only',
      live: false,
      agents: COMPLIANCE_WORKFLOW_DUMMIES,
    },
  ]

  function agentDraft(agent: AdminWorkflowAgentRecord) {
    return drafts[agent.key] ?? agent
  }

  function updateDraft(agent: AdminWorkflowAgentRecord, patch: Partial<AdminWorkflowAgentRecord>) {
    setDrafts((current) => ({
      ...current,
      [agent.key]: {
        ...agentDraft(agent),
        ...patch,
      },
    }))
  }

  function toggleWorkflow(workflowId: string) {
    setExpandedWorkflows((current) => ({
      ...current,
      [workflowId]: !current[workflowId],
    }))
  }

  async function handleSave(agent: AdminWorkflowAgentRecord) {
    const draft = agentDraft(agent)
    setSavingKey(agent.key)
    try {
      await api.patch(`/admin/workflow-agents/${agent.key}`, {
        confidence_threshold: Number(draft.confidence_threshold),
        always_pause_for_hitl: draft.always_pause_for_hitl,
        retry_limit: Number(draft.retry_limit),
      })
      setDrafts((current) => {
        const next = { ...current }
        delete next[agent.key]
        return next
      })
      await workflowAgentsQuery.refetch()
      pushToast({
        tone: 'success',
        message: `${draft.agent_name} configuration updated.`,
      })
    } catch (caughtError: unknown) {
      pushToast({
        tone: 'error',
        message: extractErrorMessage(caughtError) ?? 'Unable to save workflow agent configuration.',
      })
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Administration' }, { label: 'Workflow Agents' }]} />
      <PageHeader
        title="Workflow Automation"
        subtitle="Expand a workflow to review its agent stack. Only cession agents are currently configurable; cedant and compliance workflows are preview placeholders."
        action={
          <button className="btn-secondary" onClick={() => void workflowAgentsQuery.refetch()} type="button">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      <section className="rounded-[24px] border border-iris-border bg-white shadow-sm">
        {workflowAgentsQuery.isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={1} rows={6} />
          </div>
        ) : (
          <div className="space-y-4 p-6">
            {workflowGroups.map((workflow) => {
              const expanded = Boolean(expandedWorkflows[workflow.id])

              return (
                <article key={workflow.id} className="overflow-hidden rounded-[22px] border border-[#DCE4EB] bg-[#FBFCFD] shadow-sm">
                  <button
                    className="w-full px-5 py-5 text-left transition hover:bg-[#F7FAFC]"
                    onClick={() => toggleWorkflow(workflow.id)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">{workflow.title}</p>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                              workflow.live
                                ? 'border-[#C8DCEB] bg-[#EFF7FD] text-[#155A82]'
                                : 'border-[#D7E2EA] bg-[#F8FAFC] text-[#4E6475]'
                            }`}
                          >
                            {workflow.helperText}
                          </span>
                        </div>
                        <p className="mt-2 text-[15px] font-semibold text-iris-text-primary">{workflow.agents.length} agents</p>
                        <p className="mt-1 text-[13px] leading-6 text-iris-text-secondary">{workflow.description}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {workflow.agents.map((agent) => (
                            <WorkflowAgentPill key={agent.key} label={agent.agent_name} />
                          ))}
                        </div>
                      </div>
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D7E2EA] bg-white text-iris-text-secondary">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                    </div>
                  </button>

                  {expanded ? (
                    <div className="border-t border-[#E8EDF2] px-5 py-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">Agents</p>
                        <p className="text-[12px] text-iris-text-secondary">Scroll horizontally to view the full workflow stack.</p>
                      </div>
                      <div className="overflow-x-auto pb-2 [scrollbar-width:thin]">
                        <div className="grid min-w-full grid-flow-col gap-4 auto-cols-[minmax(280px,85%)] md:auto-cols-[minmax(340px,48%)] xl:auto-cols-[calc((100%-2rem)/3)]">
                        {workflow.agents.map((agent) => {
                          const draft = agentDraft(agent)
                          const readOnly = !workflow.live
                          const dirty = workflow.live ? hasAgentChanges(agent, draft) : false

                          return (
                            <WorkflowAgentConfigCard
                              key={agent.key}
                              agent={draft}
                              busy={savingKey === agent.key}
                              dirty={dirty}
                              onChange={(patch) => updateDraft(agent, patch)}
                              onSave={() => void handleSave(agent)}
                              readOnly={readOnly}
                            />
                          )
                        })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function WorkflowAgentConfigCard({
  agent,
  busy,
  dirty,
  onChange,
  onSave,
  readOnly,
}: {
  agent: AdminWorkflowAgentRecord
  busy: boolean
  dirty: boolean
  onChange: (patch: Partial<AdminWorkflowAgentRecord>) => void
  onSave: () => void
  readOnly: boolean
}) {
  return (
    <article className="h-full snap-start rounded-[18px] border border-[#DCE4EB] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(13,27,42,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">{agent.step_label}</p>
            <ExecutionTypeBadge executionType={agent.execution_type} />
          </div>
          <h2 className="mt-2 text-[16px] font-bold text-iris-text-primary">{agent.agent_name}</h2>
          <p className="mt-1 text-[12px] leading-5 text-iris-text-secondary">{agent.description}</p>
        </div>
        {readOnly ? (
          <span className="rounded-full border border-[#D7E2EA] bg-[#F8FAFC] px-3 py-1 text-[11px] font-semibold text-[#4E6475]">
            Dummy
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Confidence Threshold">
            <input
              className="field-input"
              disabled={readOnly}
              max={1}
              min={0}
              onChange={(event) => onChange({ confidence_threshold: Number(event.target.value) })}
              step="0.01"
              type="number"
              value={agent.confidence_threshold}
            />
          </Field>

          <Field label="Retry Limit">
            <select
              className="field-input"
              disabled={readOnly}
              onChange={(event) => onChange({ retry_limit: Number(event.target.value) })}
              value={agent.retry_limit}
            >
              {[0, 1, 2, 3].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Human Review">
          <SkeuomorphicSwitch
            checked={agent.always_pause_for_hitl}
            disabled={readOnly}
            onChange={(checked) => onChange({ always_pause_for_hitl: checked })}
            title="Always pause for review"
          />
        </Field>

        <Field label="Escalation Team">
          <div className="rounded-xl border border-[#D7E2EA] bg-[#F8FAFC] px-4 py-3 text-[13px] font-semibold text-iris-text-primary">
            {agent.escalation_team}
          </div>
        </Field>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[12px] text-iris-text-secondary">
          {readOnly ? 'Preview placeholder only.' : `Step: ${agent.step_id}`}
        </span>
        {readOnly ? null : (
          <button className="btn-primary" disabled={!dirty || busy} onClick={onSave} type="button">
            <Save className="h-4 w-4" />
            {busy ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>
    </article>
  )
}

function WorkflowAgentPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[#D7E2EA] bg-white px-3 py-1.5 text-[11px] font-semibold text-iris-text-secondary">
      {label}
    </span>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="block">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      {children}
    </div>
  )
}

function SkeuomorphicSwitch({
  checked,
  disabled = false,
  onChange,
  title,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  title: string
}) {
  return (
    <button
      aria-checked={checked}
      className={`w-full rounded-xl border border-[#D7E2EA] bg-white px-4 py-3 text-left shadow-[0_1px_0_rgba(13,27,42,0.05)] transition ${
        disabled
          ? 'cursor-not-allowed opacity-70'
          : 'hover:border-[#C5D4DF] hover:bg-[#FCFDFE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(26,107,154,0.18)]'
      }`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="min-w-0 flex-1 pr-2 text-[13px] font-semibold text-iris-text-primary">{title}</span>
        <div className="flex shrink-0 items-center">
          <span
            aria-hidden="true"
            className={`relative inline-flex h-[22px] w-[38px] rounded-full border p-[2px] transition ${
              checked
                ? 'border-[#1A6B9A] bg-[#1A6B9A]'
                : 'border-[#D6E0E8] bg-[#E8EEF3]'
            }`}
          >
            <span
              className={`h-[14px] w-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(13,27,42,0.14)] transition-transform ${
                checked ? 'translate-x-[16px]' : 'translate-x-0'
              }`}
            />
          </span>
        </div>
      </div>
    </button>
  )
}

function ExecutionTypeBadge({ executionType }: { executionType: 'agent' | 'system' }) {
  const isAgent = executionType === 'agent'
  const Icon = isAgent ? Robot : GearSix

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
        isAgent
          ? 'border-[#C8DCEB] bg-[#EFF7FD] text-[#155A82]'
          : 'border-[#D7E2EA] bg-[#F8FAFC] text-[#4E6475]'
      }`}
    >
      <Icon className="h-3.5 w-3.5" weight="fill" />
      {isAgent ? 'Agent' : 'System'}
    </span>
  )
}

function hasAgentChanges(agent: AdminWorkflowAgentRecord, draft: AdminWorkflowAgentRecord) {
  return (
    agent.confidence_threshold !== draft.confidence_threshold ||
    agent.always_pause_for_hitl !== draft.always_pause_for_hitl ||
    agent.retry_limit !== draft.retry_limit
  )
}

function extractErrorMessage(caughtError: unknown) {
  const maybeMessage = caughtError as { response?: { data?: { details?: string } } }
  return maybeMessage.response?.data?.details
}
