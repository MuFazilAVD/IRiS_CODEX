import type { ReactNode } from 'react'
import { SearchX } from 'lucide-react'

import { EmptyTableRow } from './EmptyState'

interface DataTableColumn<T> {
  key: keyof T | string
  label: string
  render?: (value: unknown, row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  emptyMessage: string
  emptyDescription?: string
}

export function DataTable<T extends object>({ columns, data, emptyMessage, emptyDescription }: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-iris-border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-[#F8F9FA]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.label}
                  className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <EmptyTableRow
                colSpan={columns.length}
                description={emptyDescription ?? 'Try clearing one or more filters to bring matching rows back into view.'}
                icon={<SearchX className="h-5 w-5" />}
                title={emptyMessage}
              />
            ) : (
              data.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-[#F0F2F5] text-[13px] text-iris-text-primary hover:bg-[#F8F9FA]">
                  {columns.map((column) => {
                    const value = row[column.key as keyof T]
                    return (
                      <td key={column.label} className={`px-3 py-2.5 ${column.className ?? ''}`}>
                        {column.render ? column.render(value, row) : String(value ?? '—')}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
