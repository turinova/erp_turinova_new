import { EquityCurve } from "@/components/analytics/EquityCurve"
import { formatR } from "@/lib/format"
import { getAllSessions, getAllTrades } from "@/lib/data"
import {
  REGIME_LABELS,
  SETUP_LABELS,
  type Regime,
  type SetupType,
  type Trade,
  type TradingSession,
} from "@/lib/types"

export const metadata = { title: "Analytics" }

const GO_LIVE_TRADES = 60
const GO_LIVE_NET_R = 20

export default async function AnalyticsPage() {
  const [allTrades, sessions] = await Promise.all([
    getAllTrades(),
    getAllSessions(),
  ])
  const trades = [...allTrades].sort((a, b) =>
    a.tradedAt.localeCompare(b.tradedAt)
  )
  const executed = trades.filter((t) => t.setupType !== "skip")
  const rValues = executed.map((t) => t.rMultiple ?? 0)

  if (executed.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Analytics</h1>
        </header>
        <div className="rounded-lg border border-line bg-surface p-10 text-center">
          <p className="text-sm text-muted">
            Még nincs elég adat — rögzítsd az első trade-eket a journalban, és
            itt jönnek a statisztikák.
          </p>
        </div>
      </div>
    )
  }

  const netR = sum(rValues)
  const wins = executed.filter((t) => t.result === "win")
  const losses = executed.filter((t) => t.result === "loss")
  const decided = wins.length + losses.length
  const winRate = decided > 0 ? (wins.length / decided) * 100 : 0
  const avgWin = wins.length > 0 ? sum(wins.map((t) => t.rMultiple ?? 0)) / wins.length : 0
  const avgLoss =
    losses.length > 0 ? sum(losses.map((t) => t.rMultiple ?? 0)) / losses.length : 0
  const maxDd = maxDrawdown(rValues)
  const violations = executed.filter((t) => !t.followedPlan).length
  const violationPct = executed.length > 0 ? (violations / executed.length) * 100 : 0

  const setupStats = bySetup(executed)
  const regimeStats = byRegime(executed, sessions)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-muted">
          {executed.length} végrehajtott trade · {trades.length - executed.length}{" "}
          logolt skip
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Nettó R" value={formatR(netR)} tone={netR >= 0 ? "win" : "loss"} />
        <Stat label="Win rate" value={`${winRate.toFixed(0)}%`} sub={`${wins.length}W / ${losses.length}L`} />
        <Stat label="Átlag win / loss" value={`${formatR(avgWin)} / ${formatR(avgLoss)}`} />
        <Stat label="Max drawdown" value={formatR(-maxDd)} tone="loss" />
      </div>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Equity curve (R)</h2>
        <EquityCurve rValues={rValues} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold">Setup statisztika</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="pb-2 font-medium">Setup</th>
                <th className="num pb-2 text-right font-medium">Trade</th>
                <th className="num pb-2 text-right font-medium">Win%</th>
                <th className="num pb-2 text-right font-medium">Nettó R</th>
              </tr>
            </thead>
            <tbody>
              {setupStats.map((s) => (
                <tr key={s.setup} className="border-b border-line last:border-b-0">
                  <td className="py-2.5">{SETUP_LABELS[s.setup]}</td>
                  <td className="num py-2.5 text-right">{s.count}</td>
                  <td className="num py-2.5 text-right">{s.winRate.toFixed(0)}%</td>
                  <td
                    className={`num py-2.5 text-right font-semibold ${
                      s.netR > 0 ? "text-win" : s.netR < 0 ? "text-loss" : ""
                    }`}
                  >
                    {formatR(s.netR)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold">
            Rezsim mátrix — melyik setup melyik napon működik
          </h2>
          {regimeStats.length === 0 ? (
            <p className="text-sm text-muted">
              Még nincs rezsim-címkézett session — a session lezárásakor add meg
              a rezsimet (trend/range/choppy).
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="pb-2 font-medium">Rezsim</th>
                  <th className="num pb-2 text-right font-medium">Trade</th>
                  <th className="num pb-2 text-right font-medium">Nettó R</th>
                </tr>
              </thead>
              <tbody>
                {regimeStats.map((s) => (
                  <tr key={s.regime} className="border-b border-line last:border-b-0">
                    <td className="py-2.5">{REGIME_LABELS[s.regime]}</td>
                    <td className="num py-2.5 text-right">{s.count}</td>
                    <td
                      className={`num py-2.5 text-right font-semibold ${
                        s.netR > 0 ? "text-win" : s.netR < 0 ? "text-loss" : ""
                      }`}
                    >
                      {formatR(s.netR)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-muted">
            Szabályszegés: <span className="num">{violationPct.toFixed(0)}%</span>{" "}
            ({violations} trade nem terv szerint)
          </p>
        </section>
      </div>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Go-live checklist (3 hónap demo után)</h2>
        <div className="space-y-3">
          <Progress
            label={`${GO_LIVE_TRADES} trade teljesítve`}
            current={executed.length}
            target={GO_LIVE_TRADES}
          />
          <Progress
            label={`+${GO_LIVE_NET_R}R nettó eredmény`}
            current={Math.max(netR, 0)}
            target={GO_LIVE_NET_R}
          />
        </div>
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: "win" | "loss"
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`num mt-1.5 text-xl font-semibold ${
          tone === "win" ? "text-win" : tone === "loss" ? "text-loss" : ""
        }`}
      >
        {value}
      </p>
      {sub && <p className="num mt-1 text-xs text-muted">{sub}</p>}
    </div>
  )
}

function Progress({
  label,
  current,
  target,
}: {
  label: string
  current: number
  target: number
}) {
  const pct = Math.min((current / target) * 100, 100)
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="num">
          {Number.isInteger(current) ? current : current.toFixed(1)} / {target}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${pct >= 100 ? "bg-win" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function sum(ns: number[]): number {
  return Math.round(ns.reduce((a, b) => a + b, 0) * 100) / 100
}

function maxDrawdown(rValues: number[]): number {
  let peak = 0
  let equity = 0
  let dd = 0
  for (const r of rValues) {
    equity += r
    peak = Math.max(peak, equity)
    dd = Math.max(dd, peak - equity)
  }
  return Math.round(dd * 100) / 100
}

function bySetup(trades: Trade[]) {
  const setups = [...new Set(trades.map((t) => t.setupType))] as SetupType[]
  return setups
    .map((setup) => {
      const ts = trades.filter((t) => t.setupType === setup)
      const wins = ts.filter((t) => t.result === "win").length
      const decided = ts.filter((t) => t.result != null && t.result !== "be").length
      return {
        setup,
        count: ts.length,
        winRate: decided > 0 ? (wins / decided) * 100 : 0,
        netR: sum(ts.map((t) => t.rMultiple ?? 0)),
      }
    })
    .sort((a, b) => b.netR - a.netR)
}

function byRegime(trades: Trade[], sessions: TradingSession[]) {
  const sessionRegime = new Map(sessions.map((s) => [s.id, s.regime]))
  const regimes = [
    ...new Set(
      trades.map((t) => sessionRegime.get(t.sessionId)).filter((r): r is Regime => !!r)
    ),
  ]
  return regimes
    .map((regime) => {
      const ts = trades.filter((t) => sessionRegime.get(t.sessionId) === regime)
      return {
        regime,
        count: ts.length,
        netR: sum(ts.map((t) => t.rMultiple ?? 0)),
      }
    })
    .sort((a, b) => b.netR - a.netR)
}
