import type { ReactNode } from 'react'

export interface SectionPanelItem {
  key: string
  title: string
  index: string
  group: string
}

interface SectionPanelProps {
  sections: SectionPanelItem[]
  activeKey: string
  onSelect: (key: string) => void
  title: string
  subtitle: string
  action?: ReactNode
  children: ReactNode
}

export function SectionPanel({
  sections,
  activeKey,
  onSelect,
  title,
  subtitle,
  action,
  children,
}: SectionPanelProps) {
  const groupedSections = sections.reduce<Record<string, SectionPanelItem[]>>((accumulator, section) => {
    accumulator[section.group] ??= []
    accumulator[section.group].push(section)
    return accumulator
  }, {})

  return (
    <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="nav-scrollbar rounded-xl border border-iris-border bg-white p-4 shadow-sm xl:sticky xl:top-[80px] xl:self-start xl:max-h-[calc(100vh-96px)] xl:overflow-y-auto">
        {Object.entries(groupedSections).map(([group, items]) => (
          <div key={group} className="mb-5 last:mb-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">{group}</p>
            <div className="space-y-1.5">
              {items.map((item) => (
                <button
                  key={item.key}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    activeKey === item.key
                      ? 'border-iris-blue bg-[#F4F9FC] text-iris-text-primary'
                      : 'border-transparent bg-transparent text-iris-text-secondary hover:border-iris-border hover:bg-iris-bg hover:text-iris-text-primary'
                  }`}
                  onClick={() => onSelect(item.key)}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                        activeKey === item.key ? 'bg-iris-blue text-white' : 'bg-[#F0F2F5] text-iris-text-secondary'
                      }`}
                    >
                      {item.index}
                    </span>
                    <span className="text-[13px] font-medium">{item.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>

      <section className="rounded-xl border border-iris-border bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 border-b border-[#EEF2F5] pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-[20px] font-semibold text-iris-text-primary">{title}</h2>
            <p className="mt-1 text-[13px] text-iris-text-secondary">{subtitle}</p>
          </div>
          {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
        </div>
        {children}
      </section>
    </div>
  )
}
