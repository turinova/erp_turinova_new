/** Kumulatív R görbe egyszerű SVG-vel — chart lib nélkül. */
export function EquityCurve({ rValues }: { rValues: number[] }) {
  const points: number[] = [0]
  for (const r of rValues) points.push(points[points.length - 1] + r)

  const w = 800
  const h = 220
  const pad = 24
  const min = Math.min(...points, 0)
  const max = Math.max(...points, 0)
  const span = max - min || 1

  const x = (i: number) => pad + (i / (points.length - 1 || 1)) * (w - 2 * pad)
  const y = (v: number) => h - pad - ((v - min) / span) * (h - 2 * pad)

  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ")
  const zeroY = y(0)
  const last = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label="Equity curve R-ben"
    >
      {/* nulla vonal */}
      <line
        x1={pad}
        x2={w - pad}
        y1={zeroY}
        y2={zeroY}
        stroke="rgba(148,163,184,0.25)"
        strokeDasharray="4 4"
      />
      {/* görbe alatti kitöltés */}
      <path
        d={`${path} L${x(points.length - 1)},${zeroY} L${x(0)},${zeroY} Z`}
        fill={last >= 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"}
      />
      <path
        d={path}
        fill="none"
        stroke={last >= 0 ? "#22c55e" : "#ef4444"}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* utolsó pont */}
      <circle
        cx={x(points.length - 1)}
        cy={y(last)}
        r="4"
        fill={last >= 0 ? "#22c55e" : "#ef4444"}
      />
      <text
        x={x(points.length - 1) - 8}
        y={y(last) - 10}
        textAnchor="end"
        fontSize="13"
        fontFamily="var(--font-geist-mono)"
        fill={last >= 0 ? "#22c55e" : "#ef4444"}
      >
        {last > 0 ? "+" : ""}
        {last.toFixed(1)}R
      </text>
    </svg>
  )
}
