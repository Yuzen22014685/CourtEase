// Custom two-line XAxis tick: first word on line 1, rest on line 2.
// Shared by AnalyticsPage and DashboardPage.
export default function VenueTick({ x, y, payload }) {
  const words = (payload?.value ?? '').split(' ')
  const line1 = words[0] ?? ''
  const line2 = words.slice(1).join(' ')
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill="#6b7280" fontSize={11}>
        <tspan x={0} dy={12}>{line1}</tspan>
        {line2 && <tspan x={0} dy={13}>{line2}</tspan>}
      </text>
    </g>
  )
}
