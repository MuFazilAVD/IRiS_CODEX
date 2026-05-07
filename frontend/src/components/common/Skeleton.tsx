import type { CSSProperties, ReactNode } from 'react'

export function Skeleton({
  className = '',
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return <div className={`skeleton-block ${className}`.trim()} style={style} aria-hidden="true" />
}

export function SkeletonText({
  lines = 3,
  widths,
}: {
  lines?: number
  widths?: string[]
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className="h-3.5 rounded-full" style={{ width: widths?.[index] ?? '100%' }} />
      ))}
    </div>
  )
}

export function SkeletonCard({
  children,
  className = '',
}: {
  children?: ReactNode
  className?: string
}) {
  return <div className={`rounded-xl border border-iris-border bg-white p-4 shadow-sm ${className}`.trim()}>{children}</div>
}

export function TableSkeleton({
  columns,
  rows = 5,
}: {
  columns: number
  rows?: number
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-[13px]">
        <thead className="bg-[#F8F9FA]">
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index} className="px-4 py-3 text-left">
                <Skeleton className="h-3 w-20 rounded-full" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-t border-[#EEF2F5]">
              {Array.from({ length: columns }).map((_, columnIndex) => (
                <td key={columnIndex} className="px-4 py-3">
                  <Skeleton className="h-4 rounded-full" style={{ width: `${Math.max(35, 88 - columnIndex * 7)}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function KpiGridSkeleton({
  count = 6,
  density = 'default',
}: {
  count?: number
  density?: 'default' | 'compact'
}) {
  const compact = density === 'compact'

  return (
    <div className={compact ? 'dashboard-kpi-grid' : 'compact-kpi-grid'}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} className={compact ? 'min-h-[76px] rounded-lg p-3' : 'min-h-[88px]'}>
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className={compact ? 'mt-3 h-6 w-16 rounded-md' : 'mt-4 h-8 w-20 rounded-lg'} />
          <Skeleton className={compact ? 'mt-2 h-2.5 w-24 rounded-full' : 'mt-3 h-3 w-28 rounded-full'} />
          <Skeleton className={compact ? 'mt-1.5 h-2.5 w-28 rounded-full' : 'mt-2 h-3 w-32 rounded-full'} />
        </SkeletonCard>
      ))}
    </div>
  )
}
