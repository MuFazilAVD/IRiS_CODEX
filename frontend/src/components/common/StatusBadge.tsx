import type { ReactNode } from 'react'

const badgeClasses: Record<string, string> = {
  active: 'bg-[#D5F5E3] text-[#1E8449]',
  inactive: 'bg-[#F2F3F4] text-[#717D7E]',
  invited: 'border border-[#D5DBDB] bg-white text-[#626567]',
  onboarding: 'bg-[#D6EAF8] text-[#1A5276]',
  cleared: 'border border-[#82E0AA] bg-[#D5F5E3] text-[#1E8449]',
  pending: 'border border-[#F9E79F] bg-[#FEF9E7] text-[#9A7D0A]',
  review: 'border border-[#F1948A] bg-[#FDEDEC] text-[#922B21]',
  critical: 'bg-[#FDEDEC] text-[#922B21]',
  high: 'bg-[#FEF5E7] text-[#784212]',
  medium: 'bg-[#FEF9E7] text-[#7D6608]',
  low: 'bg-[#EBF5FB] text-[#1A5276]',
  open: 'bg-[#EBF5FB] text-[#1A5276]',
  in_progress: 'bg-[#FEF5E7] text-[#784212]',
  pending_review: 'bg-[#FDEDEC] text-[#922B21]',
  resolved: 'bg-[#D5F5E3] text-[#1E8449]',
  closed: 'bg-[#F2F3F4] text-[#717D7E]',
  hold: 'border border-[#CE93D8] bg-[#EDE7F6] text-[#4A148C]',
  readonly: 'bg-[#F5F5F5] text-[#757575]',
  draft: 'bg-[#EBF5FB] text-[#1A5276]',
  suspended: 'bg-[#FEF5E7] text-[#784212]',
  locked: 'border border-[#F8C471] bg-[#FEF5E7] text-[#AF601A]',
  editable: 'bg-[#EBF5FB] text-[#1A5276]',
  terminated: 'bg-[#FDEDEC] text-[#922B21]',
  'run-off': 'bg-[#F4ECF7] text-[#6C3483]',
  approved: 'bg-[#D5F5E3] text-[#1E8449]',
  healthy: 'border border-[#D5DBDB] bg-white text-[#626567]',
  degraded: 'border border-[#F8C471] bg-[#FEF5E7] text-[#AF601A]',
  escalated: 'border border-[#F1948A] bg-[#FDEDEC] text-[#922B21]',
  under_review: 'bg-[#EBF5FB] text-[#1A5276]',
  standard: 'bg-[#F2F3F4] text-[#626567]',
  sensitive: 'border border-[#F1948A] bg-[#FFF1F1] text-[#922B21]',
  pending_approval: 'border border-[#F9E79F] bg-[#FEF9E7] text-[#9A7D0A]',
  disputed: 'border border-[#F4C8C9] bg-[#FFF1F1] text-[#922B21]',
  held: 'bg-[#F2F3F4] text-[#626567]',
  monitoring: 'bg-[#EBF5FB] text-[#1A5276]',
  paid: 'bg-[#D5F5E3] text-[#1E8449]',
  ready: 'bg-[#EBF5FB] text-[#1A5276]',
  complete: 'bg-[#D5F5E3] text-[#1E8449]',
  variance_review: 'border border-[#B9E3FB] bg-[#F0F8FF] text-[#1E6BB8]',
  ready_for_payment: 'border border-[#D8E0E8] bg-[#F7F9FB] text-[#41566B]',
  pending_reconciliation: 'border border-[#B9E3FB] bg-[#F0F8FF] text-[#1E6BB8]',
  compliance_hold: 'border border-[#D8E0E8] bg-[#F7F9FB] text-[#41566B]',
  accept: 'border border-[#B6E5C6] bg-[#EDF9F1] text-[#1E8449]',
  adjust: 'border border-[#F8D7A6] bg-[#FFF5E8] text-[#AF601A]',
  review_pending: 'border border-[#F4C8C9] bg-[#FFF1F1] text-[#922B21]',
}

interface StatusBadgeProps {
  status: string
  children?: ReactNode
}

export function StatusBadge({ status, children }: StatusBadgeProps) {
  const normalized = status.toLowerCase()
  return (
    <span className={`inline-flex rounded px-2 py-1 text-[11px] font-semibold ${badgeClasses[normalized] ?? 'bg-slate-100 text-slate-700'}`}>
      {children ?? normalized.replace('_', ' ')}
    </span>
  )
}
