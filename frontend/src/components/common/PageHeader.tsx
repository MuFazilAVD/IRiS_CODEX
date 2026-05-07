import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  actionPlacement?: 'inline' | 'below'
}

export function PageHeader({ title, subtitle, action, actionPlacement = 'inline' }: PageHeaderProps) {
  if (actionPlacement === 'below') {
    return (
      <div className="mb-6">
        <h1 className="text-[28px] font-bold leading-tight text-iris-text-primary">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-[13px] text-iris-text-secondary">{subtitle}</p> : null}
        {action ? <div className="mt-4 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    )
  }

  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-iris-text-primary">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-[13px] text-iris-text-secondary">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  )
}
