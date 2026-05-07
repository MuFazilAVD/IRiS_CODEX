import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface BreadcrumbItem {
  label: string
  to?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-[12px] text-iris-text-secondary">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center gap-1">
          {item.to ? (
            <Link className="hover:text-iris-blue" to={item.to}>
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-iris-text-primary">{item.label}</span>
          )}
          {index < items.length - 1 ? <ChevronRight className="h-3.5 w-3.5 text-iris-text-muted" /> : null}
        </div>
      ))}
    </nav>
  )
}
