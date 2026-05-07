import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import type { GraphConfig } from '../../types/api'

export function DonutChart({ graph }: { graph: GraphConfig }) {
  const data = graph.data.labels.map((label, index) => ({
    name: label,
    value: graph.data.datasets[0]?.data[index] ?? 0,
    color: graph.data.datasets[0]?.colors?.[index] ?? '#0D1B2A',
  }))

  return (
    <div className="panel-card">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-iris-text-primary">{graph.title}</h3>
        {graph.subtitle ? <p className="text-[11px] text-iris-text-secondary">{graph.subtitle}</p> : null}
      </div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius={60} outerRadius={84} dataKey="value" paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-iris-text-secondary">
        {data.map((entry) => (
          <span key={entry.name} className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
        ))}
      </div>
    </div>
  )
}
