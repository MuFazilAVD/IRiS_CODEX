import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { GraphConfig } from '../../types/api'

export function LineChart({ graph }: { graph: GraphConfig }) {
  const data = graph.data.labels.map((label, index) => {
    const row: Record<string, string | number> = { label }
    graph.data.datasets.forEach((dataset) => {
      row[dataset.label ?? 'value'] = dataset.data[index] ?? 0
    })
    return row
  })

  return (
    <div className="panel-card">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-iris-text-primary">{graph.title}</h3>
        {graph.subtitle ? <p className="text-[11px] text-iris-text-secondary">{graph.subtitle}</p> : null}
      </div>
      <div className="h-60">
        {graph.type === 'area' ? (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsAreaChart data={data}>
              <CartesianGrid stroke="#F0F2F5" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#90A4AE', fontSize: 11 }} />
              <YAxis tick={{ fill: '#90A4AE', fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {graph.data.datasets.map((dataset) => (
                <Area
                  key={dataset.label}
                  type="monotone"
                  dataKey={dataset.label ?? 'value'}
                  stroke={dataset.color ?? '#0D1B2A'}
                  fill={dataset.color ?? '#0D1B2A'}
                  fillOpacity={0.22}
                  strokeWidth={2.5}
                />
              ))}
            </RechartsAreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={data}>
              <CartesianGrid stroke="#F0F2F5" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#90A4AE', fontSize: 11 }} />
              <YAxis tick={{ fill: '#90A4AE', fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {graph.data.datasets.map((dataset) => (
                <Line
                  key={dataset.label}
                  type="monotone"
                  dataKey={dataset.label ?? 'value'}
                  stroke={dataset.color ?? '#0D1B2A'}
                  strokeDasharray={dataset.dashed ? '5 5' : undefined}
                  strokeWidth={2.5}
                  dot={false}
                />
              ))}
            </RechartsLineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
