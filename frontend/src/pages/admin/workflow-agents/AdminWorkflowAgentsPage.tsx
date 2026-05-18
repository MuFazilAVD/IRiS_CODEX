import type { ReactNode } from 'react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Save } from 'lucide-react'

import { api } from '../../../api/client'
import { Breadcrumbs } from '../../../components/common/Breadcrumbs'
import { PageHeader } from '../../../components/common/PageHeader'
import { TableSkeleton } from '../../../components/common/Skeleton'
import { useUiStore } from '../../../store/uiStore'
import type { AdminWorkflowAgentRecord, AdminWorkflowAgentsPayload } from '../../../types/api'

type AgentDraft = Record<string, AdminWorkflowAgentRecord>

export function AdminWorkflowAgentsPage() {
  const pushToast = useUiStore((state) => state.pushToast)
  const [drafts, setDrafts] = useState<AgentDraft>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const workflowAgentsQuery = useQuery({
    queryKey: ['admin-workflow-agents'],
    queryFn: async () => (await api.get<AdminWorkflowAgentsPayload>('/admin/workflow-agents')).data,
  })

  const agents = workflowAgentsQuery.data?.items ?? []

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

  async function handleSave(agent: AdminWorkflowAgentRecord) {
    const draft = agentDraft(agent)
    setSavingKey(agent.key)
    try {
      await api.patch(`/admin/workflow-agents/${agent.key}`, {
        enabled: draft.enabled,
        confidence_threshold: Number(draft.confidence_threshold),
        hitl_behavior: draft.hitl_behavior,
        escalation_rule: draft.escalation_rule,
        retry_limit: Number(draft.retry_limit),
        fallback_mode: draft.fallback_mode,
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
        title="Workflow Agents"
        subtitle="Configure agent enablement, confidence thresholds, HITL behavior, escalation, retries, and fallbacks for the cession workflow."
        action={
          <button className="btn-secondary" onClick={() => void workflowAgentsQuery.refetch()} type="button">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      <section className="rounded-[24px] border border-iris-border bg-white shadow-sm">
        <div className="border-b border-[#E8EDF2] px-6 py-5">
          <p className="text-[18px] font-bold text-iris-text-primary">Cession Workflow Agent Controls</p>
          <p className="mt-1 text-[13px] text-iris-text-secondary">
            Each step can run autonomously, pause for approval, or fall back according to the governance controls below.
          </p>
        </div>

        {workflowAgentsQuery.isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={6} rows={6} />
          </div>
        ) : (
          <div className="grid gap-5 p-6 xl:grid-cols-2">
            {agents.map((agent) => {
              const draft = agentDraft(agent)
              const dirty = JSON.stringify(draft) !== JSON.stringify(agent)

              return (
                <article key={agent.key} className="rounded-[22px] border border-[#DCE4EB] bg-[#FBFCFD] shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E8EDF2] px-5 py-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">{agent.step_label}</p>
                      <h2 className="mt-2 text-[20px] font-bold text-iris-text-primary">{agent.agent_name}</h2>
                      <p className="mt-2 max-w-2xl text-[13px] leading-6 text-iris-text-secondary">{agent.description}</p>
                    </div>
                    <div className="rounded-full border border-[#D7E2EA] bg-white px-3 py-1.5 text-[12px] font-semibold text-iris-text-secondary">
                      {draft.enabled ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>

                  <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
                    <Field label="Enabled">
                      <label className="flex items-center gap-3 rounded-xl border border-[#D7E2EA] bg-white px-4 py-3">
                        <input
                          checked={draft.enabled}
                          className="h-4 w-4"
                          onChange={(event) => updateDraft(agent, { enabled: event.target.checked })}
                          type="checkbox"
                        />
                        <span className="text-[13px] font-medium text-iris-text-primary">Run this agent automatically</span>
                      </label>
                    </Field>

                    <Field label="Confidence Threshold">
                      <input
                        className="field-input"
                        max={1}
                        min={0}
                        onChange={(event) => updateDraft(agent, { confidence_threshold: Number(event.target.value) })}
                        step="0.01"
                        type="number"
                        value={draft.confidence_threshold}
                      />
                    </Field>

                    <Field label="HITL Behavior">
                      <select
                        className="field-input"
                        onChange={(event) => updateDraft(agent, { hitl_behavior: event.target.value })}
                        value={draft.hitl_behavior}
                      >
                        <option value="pause_for_approval">Pause for approval</option>
                        <option value="pause_for_correction">Pause for correction</option>
                      </select>
                    </Field>

                    <Field label="Retry Limit">
                      <select
                        className="field-input"
                        onChange={(event) => updateDraft(agent, { retry_limit: Number(event.target.value) })}
                        value={draft.retry_limit}
                      >
                        {[0, 1, 2, 3].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Fallback Mode">
                      <select
                        className="field-input"
                        onChange={(event) => updateDraft(agent, { fallback_mode: event.target.value })}
                        value={draft.fallback_mode}
                      >
                        <option value="manual_review">Manual review</option>
                        <option value="skip_step">Skip step</option>
                        <option value="deterministic_rule">Deterministic rule</option>
                      </select>
                    </Field>

                    <Field label="Escalation Rule">
                      <textarea
                        className="field-input min-h-[96px]"
                        onChange={(event) => updateDraft(agent, { escalation_rule: event.target.value })}
                        value={draft.escalation_rule}
                      />
                    </Field>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8EDF2] px-5 py-4">
                    <div className="flex flex-wrap gap-2 text-[12px] text-iris-text-secondary">
                      <span className="rounded-full bg-white px-3 py-1.5">Step: {agent.step_id}</span>
                      <span className="rounded-full bg-white px-3 py-1.5">Threshold: {draft.confidence_threshold.toFixed(2)}</span>
                      <span className="rounded-full bg-white px-3 py-1.5">Fallback: {titleCase(draft.fallback_mode)}</span>
                    </div>
                    <button className="btn-primary" disabled={!dirty || savingKey === agent.key} onClick={() => void handleSave(agent)} type="button">
                      <Save className="h-4 w-4" />
                      {savingKey === agent.key ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
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

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function extractErrorMessage(caughtError: unknown) {
  const maybeMessage = caughtError as { response?: { data?: { details?: string } } }
  return maybeMessage.response?.data?.details
}
