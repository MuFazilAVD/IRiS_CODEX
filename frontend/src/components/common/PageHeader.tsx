import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle: string
  action?: ReactNode
  eyebrow?: string
}

export function PageHeader({ title, subtitle, action, eyebrow }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-iris-text-muted">{eyebrow}</p> : null}
        <h1 className="text-[28px] font-bold leading-tight text-iris-text-primary">{title}</h1>
        <p className="mt-1.5 text-[13px] text-iris-text-secondary">{subtitle}</p>
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  )
}
