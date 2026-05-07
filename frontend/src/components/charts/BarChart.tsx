import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { GraphConfig } from '../../types/api'

export function BarChart({ graph }: { graph: GraphConfig }) {
  const data = graph.data.labels.map((label, index) => {
    const row: Record<string, string | number> = { label }
    graph.data.datasets.forEach((dataset) => {
      row[dataset.label ?? 'value'] = dataset.data[index] ?? 0
    })
    return row
  })

  const horizontal = graph.type === 'bar_horizontal'

  return (
    <div className="panel-card">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-iris-text-primary">{graph.title}</h3>
        {graph.subtitle ? <p className="text-[11px] text-iris-text-secondary">{graph.subtitle}</p> : null}
      </div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} barGap={4}>
            <CartesianGrid stroke="#F0F2F5" vertical={!horizontal} horizontal={horizontal} />
            <XAxis
              type={horizontal ? 'number' : 'category'}
              dataKey={horizontal ? undefined : 'label'}
              tick={{ fill: '#90A4AE', fontSize: 11 }}
            />
            <YAxis
              type={horizontal ? 'category' : 'number'}
              dataKey={horizontal ? 'label' : undefined}
              tick={{ fill: '#90A4AE', fontSize: 11 }}
            />
            <Tooltip />
            <Legend />
            {graph.data.datasets.map((dataset) => (
              <Bar key={dataset.label} dataKey={dataset.label ?? 'value'} fill={dataset.color ?? '#0D1B2A'} radius={[6, 6, 0, 0]} />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
