import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

export function EmptyState({
  title,
  description,
  icon,
  action,
  compact = false,
  className = '',
}: {
  title: string
  description: string
  icon?: ReactNode
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-[22px] border border-dashed border-[#D6DEE6] bg-[#FBFCFD] text-center ${
        compact ? 'px-5 py-6' : 'px-6 py-10'
      } ${className}`.trim()}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF4F8] text-iris-blue">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="mt-4 text-[16px] font-semibold text-iris-text-primary">{title}</p>
      <p className="mt-2 max-w-[420px] text-[13px] leading-6 text-iris-text-secondary">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function EmptyTableRow({
  colSpan,
  title,
  description,
  icon,
  action,
}: {
  colSpan: number
  title: string
  description: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <tr>
      <td className="px-4 py-6" colSpan={colSpan}>
        <EmptyState action={action} compact description={description} icon={icon} title={title} />
      </td>
    </tr>
  )
}
