"use client"

import { useMemo, useState, type ReactNode } from "react"
import {
  DEFAULT_SIM_PARAMS,
  simulateBankroll,
  type RiskMode,
  type SimParams,
  type SimTradeInput,
} from "@/lib/crypto/bankroll-sim"
import { CRYPTO_KIND_LABEL } from "@/lib/crypto/types"

type Props = {
  trades: SimTradeInput[]
  paperNetR: number
  winCount: number
  closedCount: number
}

function fmtUsd(n: number, digits = 0): string {
  const abs = Math.abs(n)
  const d = abs >= 100 ? 0 : abs >= 10 ? 1 : 2
  const s = n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits || d,
    maximumFractionDigits: digits || d,
  })
  return s
}

function fmtSignedUsd(n: number): string {
  if (n > 0) return `+${fmtUsd(n)}`
  if (n < 0) return `−${fmtUsd(Math.abs(n))}`
  return fmtUsd(0)
}

export function SignalsBankrollViz({ trades, paperNetR, winCount, closedCount }: Props) {
  const [startUsd, setStartUsd] = useState(DEFAULT_SIM_PARAMS.startUsd)
  const [riskMode, setRiskMode] = useState<RiskMode>(DEFAULT_SIM_PARAMS.riskMode)
  const [riskPercent, setRiskPercent] = useState(DEFAULT_SIM_PARAMS.riskPercent)
  const [riskFixedUsd, setRiskFixedUsd] = useState(DEFAULT_SIM_PARAMS.riskFixedUsd)
  const [leverageCap, setLeverageCap] = useState(DEFAULT_SIM_PARAMS.leverageCap)
  const [compound, setCompound] = useState(DEFAULT_SIM_PARAMS.compound)

  const params: SimParams = useMemo(
    () => ({
      startUsd: Math.max(1, startUsd || 0),
      riskMode,
      riskPercent: Math.max(0, riskPercent || 0),
      riskFixedUsd: Math.max(0, riskFixedUsd || 0),
      leverageCap: Math.max(1, leverageCap || 1),
      compound,
    }),
    [startUsd, riskMode, riskPercent, riskFixedUsd, leverageCap, compound]
  )

  const sim = useMemo(() => simulateBankroll(trades, params), [trades, params])

  const pct =
    params.startUsd > 0 ? ((sim.finalEquity - params.startUsd) / params.startUsd) * 100 : 0

  if (trades.length === 0) {
    return (
      <section className="rounded-lg border border-line bg-surface p-6 text-sm text-muted">
        Még nincs lezárt signal — a kalkulátor akkor él, ha van win/loss/expired R-rel.
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {/* R ELI */}
      <section className="rounded-lg border border-line bg-surface-2/60 px-4 py-3 text-sm">
        <p className="font-medium text-foreground/90">Mi az az R? (dollárban)</p>
        <p className="mt-1 text-muted">
          <span className="text-foreground/80">1R = amennyi dollárt szándékosan kockáztatsz</span>{" "}
          egy trade-en (stopig ennyit veszítenél). A naplóban a +2R / −1R csak arány — itt
          átváltjuk pénzre a beállításaiddal. Példa: 1R = $8 → +2R = +$16, −1R = −$8.
        </p>
      </section>

      {/* CONTROLS */}
      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Kupac-kalkulátor</h2>
            <p className="text-xs text-muted">
              Végigjátssza az eddigi lezárt signalokat. Papír-mese — nem élő egyenleg.
            </p>
          </div>
          <p className="text-xs text-muted">
            Papír nettó:{" "}
            <span className={paperNetR >= 0 ? "text-win" : "text-loss"}>
              {paperNetR >= 0 ? "+" : ""}
              {paperNetR.toFixed(2)}R
            </span>
            {" · "}
            {winCount}/{closedCount} nyert
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Field label="Start tőke ($)">
            <input
              type="number"
              min={1}
              step={10}
              value={startUsd}
              onChange={(e) => setStartUsd(Number(e.target.value))}
              className="num w-full rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-sm"
            />
          </Field>

          <Field label="Risk mód">
            <select
              value={riskMode}
              onChange={(e) => setRiskMode(e.target.value as RiskMode)}
              className="w-full rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-sm"
            >
              <option value="percent">% a tőkéből / trade</option>
              <option value="fixed">Fix $ / trade (1R)</option>
            </select>
          </Field>

          {riskMode === "percent" ? (
            <Field label={`Risk / trade (${riskPercent}%)`}>
              <input
                type="range"
                min={1}
                max={25}
                step={1}
                value={riskPercent}
                onChange={(e) => setRiskPercent(Number(e.target.value))}
                className="w-full"
              />
            </Field>
          ) : (
            <Field label="Fix 1R ($)">
              <input
                type="number"
                min={1}
                step={1}
                value={riskFixedUsd}
                onChange={(e) => setRiskFixedUsd(Number(e.target.value))}
                className="num w-full rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-sm"
              />
            </Field>
          )}

          <Field label={`Max leverage (${leverageCap}x)`}>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={leverageCap}
              onChange={(e) => setLeverageCap(Number(e.target.value))}
              className="w-full"
            />
          </Field>

          <Field label="Compound">
            <button
              type="button"
              onClick={() => setCompound((c) => !c)}
              className={`w-full rounded-md border px-2.5 py-1.5 text-sm ${
                compound
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-line bg-surface-2 text-muted"
              }`}
            >
              {compound ? "Be — % a jelenlegi kupacból" : "Ki — mindig a startból"}
            </button>
          </Field>

          <Field label="Gyors preset">
            <div className="flex gap-1">
              {[
                { label: "$100·8%", s: 100, p: 8, lev: 40 },
                { label: "$500·10%", s: 500, p: 10, lev: 40 },
                { label: "$100·2%", s: 100, p: 2, lev: 20 },
              ].map((pr) => (
                <button
                  key={pr.label}
                  type="button"
                  onClick={() => {
                    setStartUsd(pr.s)
                    setRiskMode("percent")
                    setRiskPercent(pr.p)
                    setLeverageCap(pr.lev)
                    setCompound(true)
                  }}
                  className="flex-1 rounded-md border border-line bg-surface-2 px-1 py-1.5 text-[11px] text-muted hover:border-accent/40 hover:text-foreground"
                >
                  {pr.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </section>

      {/* HERO SCORE */}
      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="border-b border-line p-5 lg:border-b-0 lg:border-r">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              Most ennyi lenne a kupacod
            </p>
            <p
              className={`num mt-1 text-4xl font-semibold tracking-tight sm:text-5xl ${
                sim.netPnl > 0 ? "text-win" : sim.netPnl < 0 ? "text-loss" : ""
              }`}
            >
              {fmtUsd(sim.finalEquity, sim.finalEquity >= 100 ? 0 : 2)}
            </p>
            <p className="mt-2 text-sm text-muted">
              Start {fmtUsd(params.startUsd)} →{" "}
              <span className={sim.netPnl >= 0 ? "text-win" : "text-loss"}>
                {fmtSignedUsd(sim.netPnl)}
              </span>
              {" · "}
              <span className={pct >= 0 ? "text-win" : "text-loss"}>
                {pct >= 0 ? "+" : ""}
                {pct.toFixed(0)}%
              </span>
            </p>
            {sim.ruined && (
              <p className="mt-2 text-sm text-loss">
                Kinullázva a #{(sim.ruinedAtIndex ?? 0) + 1}. trade után.
              </p>
            )}
            {sim.cappedCount > 0 && (
              <p className="mt-2 text-xs text-warn">
                {sim.cappedCount} trade-nél a {params.leverageCap}x cap csökkentette a risket
                (stop túl szűk volt a teljes %-hoz).
              </p>
            )}
          </div>
          <div className="p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
              Kupac útja ($)
            </p>
            <EquitySvg path={sim.equityPath} start={params.startUsd} />
          </div>
        </div>
      </section>

      {/* LEGO STRIP */}
      <section className="rounded-lg border border-line bg-surface p-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
          Téglák — minden tipp dollárban
        </p>
        <p className="mb-3 text-xs text-muted">
          Zöld fölfelé = nyertél. Piros lefelé = buktál. Magasság ≈ |dollár|.
        </p>
        <LegoStrip steps={sim.steps} />
      </section>

      {/* SETUP RACE */}
      {sim.setupRace.length > 0 && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
            Csapatbajnokság — melyik setup hozott $$-t
          </p>
          <p className="mb-3 text-xs text-muted">Ugyanazzal a kalkulátor-beállítással.</p>
          <SetupRace rows={sim.setupRace} />
        </section>
      )}

      {/* STEP LIST */}
      <section className="overflow-x-auto rounded-lg border border-line bg-surface">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
          Trade-enként — mi történt a kupaccal
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">Coin / setup</th>
              <th className="px-4 py-2.5 font-medium">1R ($)</th>
              <th className="px-4 py-2.5 font-medium">Lev</th>
              <th className="px-4 py-2.5 font-medium">Eredmény</th>
              <th className="px-4 py-2.5 font-medium">Kupac után</th>
            </tr>
          </thead>
          <tbody>
            {sim.steps.map((s, i) => (
              <tr key={s.id} className="border-b border-line/50 last:border-0">
                <td className="num px-4 py-2.5 text-muted">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <span className="font-medium">{s.symbol}</span>
                  <span className="text-muted">
                    {" "}
                    · {CRYPTO_KIND_LABEL[s.kind] ?? s.kind}
                  </span>
                  {s.capped && (
                    <span className="ml-2 text-[10px] uppercase text-warn">cap</span>
                  )}
                </td>
                <td className="num px-4 py-2.5">{fmtUsd(s.actualRiskUsd, 2)}</td>
                <td className="num px-4 py-2.5 text-muted">
                  {s.leverageUsed > 0 ? `${s.leverageUsed.toFixed(1)}x` : "—"}
                </td>
                <td
                  className={`num px-4 py-2.5 ${
                    s.pnlUsd > 0 ? "text-win" : s.pnlUsd < 0 ? "text-loss" : ""
                  }`}
                >
                  {fmtSignedUsd(s.pnlUsd)}
                  <span className="ml-1 text-xs text-muted">
                    ({s.rMultiple >= 0 ? "+" : ""}
                    {s.rMultiple.toFixed(2)}R)
                  </span>
                </td>
                <td className="num px-4 py-2.5 font-medium">{fmtUsd(s.equityAfter, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs text-muted">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  )
}

function EquitySvg({ path, start }: { path: number[]; start: number }) {
  const w = 560
  const h = 140
  const pad = 8
  if (path.length < 2) {
    return <div className="flex h-[140px] items-center text-xs text-muted">Nincs adat</div>
  }
  const min = Math.min(...path, start)
  const max = Math.max(...path, start)
  const span = Math.max(max - min, 1)
  const pts = path.map((v, i) => {
    const x = pad + (i / (path.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (v - min) / span) * (h - pad * 2)
    return `${x},${y}`
  })
  const line = pts.join(" ")
  const last = path[path.length - 1]
  const up = last >= start
  const zeroY = pad + (1 - (start - min) / span) * (h - pad * 2)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[140px] w-full" role="img" aria-label="Equity">
      <line
        x1={pad}
        x2={w - pad}
        y1={zeroY}
        y2={zeroY}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeDasharray="4 4"
      />
      <polyline
        fill="none"
        stroke={up ? "#34d399" : "#f87171"}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={line}
        className="animate-[dash_1.2s_ease-out]"
      />
      {path.map((v, i) => {
        const x = pad + (i / (path.length - 1)) * (w - pad * 2)
        const y = pad + (1 - (v - min) / span) * (h - pad * 2)
        const prev = i === 0 ? start : path[i - 1]
        const col = v >= prev ? "#34d399" : "#f87171"
        return <circle key={i} cx={x} cy={y} r={3.2} fill={col} />
      })}
    </svg>
  )
}

function LegoStrip({
  steps,
}: {
  steps: ReturnType<typeof simulateBankroll>["steps"]
}) {
  const maxAbs = Math.max(...steps.map((s) => Math.abs(s.pnlUsd)), 1)
  return (
    <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ minHeight: 120 }}>
      {steps.map((s, i) => {
        const h = Math.max(8, (Math.abs(s.pnlUsd) / maxAbs) * 96)
        const win = s.pnlUsd > 0
        const flat = s.pnlUsd === 0
        return (
          <div
            key={s.id}
            className="group flex w-10 shrink-0 flex-col items-center justify-end"
            title={`${s.symbol} ${fmtSignedUsd(s.pnlUsd)} (${s.rMultiple >= 0 ? "+" : ""}${s.rMultiple.toFixed(2)}R)`}
          >
            <div className="flex h-24 w-full flex-col items-center justify-end">
              {!flat && win && (
                <div
                  className="w-full rounded-sm bg-emerald-500/80 transition-all duration-500"
                  style={{ height: h, animationDelay: `${i * 40}ms` }}
                />
              )}
              {!flat && !win && (
                <div
                  className="w-full rounded-sm bg-red-500/80 transition-all duration-500"
                  style={{ height: h, animationDelay: `${i * 40}ms` }}
                />
              )}
              {flat && <div className="h-2 w-full rounded-sm border border-line" />}
            </div>
            <span className="mt-1 text-[9px] font-medium text-muted">{s.symbol.slice(0, 3)}</span>
            <span
              className={`text-[9px] num ${win ? "text-win" : s.pnlUsd < 0 ? "text-loss" : "text-muted"}`}
            >
              {s.pnlUsd === 0 ? "0" : s.pnlUsd > 0 ? `+${Math.round(s.pnlUsd)}` : Math.round(s.pnlUsd)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function SetupRace({
  rows,
}: {
  rows: ReturnType<typeof simulateBankroll>["setupRace"]
}) {
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.netUsd)), 1)
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => {
        const pct = (Math.abs(r.netUsd) / maxAbs) * 100
        const pos = r.netUsd >= 0
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`
        return (
          <li key={r.key} className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 text-sm">
            <span className="text-center text-xs">{medal}</span>
            <div className="min-w-0">
              <div className="mb-0.5 flex justify-between gap-2">
                <span className="truncate font-medium">{r.key}</span>
                <span className="text-xs text-muted">
                  {r.wins}/{r.trades}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-sm bg-surface-2">
                <div
                  className={`h-full rounded-sm ${pos ? "bg-emerald-500/70" : "bg-red-500/70"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <span className={`num w-20 text-right font-medium ${pos ? "text-win" : "text-loss"}`}>
              {fmtSignedUsd(r.netUsd)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
