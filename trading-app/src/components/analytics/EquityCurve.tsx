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
        fill={last >= 0 ? "rgba(21,128,61,0.10)" : "rgba(185,28,28,0.10)"}
      />
      <path
        d={path}
        fill="none"
        stroke={last >= 0 ? "#15803d" : "#b91c1c"}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* utolsó pont */}
      <circle
        cx={x(points.length - 1)}
        cy={y(last)}
        r="4"
        fill={last >= 0 ? "#15803d" : "#b91c1c"}
      />
      <text
        x={x(points.length - 1) - 8}
        y={y(last) - 10}
        textAnchor="end"
        fontSize="13"
        fontFamily="var(--font-geist-mono)"
        fill={last >= 0 ? "#15803d" : "#b91c1c"}
      >
        {last > 0 ? "+" : ""}
        {last.toFixed(1)}R
      </text>
    </svg>
  )
}
