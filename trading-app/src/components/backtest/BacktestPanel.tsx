"use client"

import { useEffect, useState } from "react"
import { EquityCurve } from "@/components/analytics/EquityCurve"
import { formatR } from "@/lib/format"
import {
  DEFAULT_CONFIG,
  STRATEGY_LABELS,
  type BacktestConfig,
  type BacktestResult,
  type StrategyId,
  type StrategyStats,
} from "@/lib/backtest/types"

const ALL_STRATEGIES = Object.keys(STRATEGY_LABELS) as StrategyId[]

export function BacktestPanel() {
  const [config, setConfig] = useState<BacktestConfig>(DEFAULT_CONFIG)
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTrades, setShowTrades] = useState(false)

  async function run(cfg: BacktestConfig) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      setResult(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba a futtatás közben")
    } finally {
      setLoading(false)
    }
  }

  // első betöltéskor lefut az alapértelmezett konfiggal
  useEffect(() => {
    run(DEFAULT_CONFIG)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleStrategy(s: StrategyId) {
    setConfig((c) => ({
      ...c,
      strategies: c.strategies.includes(s)
        ? c.strategies.filter((x) => x !== s)
        : [...c.strategies, s],
    }))
  }

  return (
    <div className="space-y-6">
      {/* Konfiguráció */}
      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Konfiguráció</h2>

        <div className="mb-4">
          <p className="mb-1.5 text-xs text-muted">Stratégiák</p>
          <div className="flex flex-wrap gap-2">
            {ALL_STRATEGIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleStrategy(s)}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  config.strategies.includes(s)
                    ? "bg-accent/15 font-medium text-accent"
                    : "bg-surface-2 text-muted hover:text-foreground"
                }`}
              >
                {STRATEGY_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumField
            label="ORB (perc)"
            value={config.orbMinutes}
            onChange={(v) => setConfig((c) => ({ ...c, orbMinutes: v }))}
            step={5}
          />
          <NumField
            label="Target (R)"
            value={config.targetR}
            onChange={(v) => setConfig((c) => ({ ...c, targetR: v }))}
            step={0.5}
          />
          <NumField
            label="Min. ORB range (pont)"
            value={config.minRangePoints}
            onChange={(v) => setConfig((c) => ({ ...c, minRangePoints: v }))}
            step={5}
          />
          <NumField
            label="Session vége (ET óra)"
            value={config.cutoffHourEt}
            onChange={(v) => setConfig((c) => ({ ...c, cutoffHourEt: v }))}
            step={1}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={config.vwapFilter}
              onChange={(e) =>
                setConfig((c) => ({ ...c, vwapFilter: e.target.checked }))
              }
              className="h-4 w-4 accent-[var(--accent)]"
            />
            VWAP filter (ORB)
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={config.volumeFilter}
              onChange={(e) =>
                setConfig((c) => ({ ...c, volumeFilter: e.target.checked }))
              }
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Volume filter (RVOL ≥ {config.rvolThreshold})
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={config.gapFilter}
              onChange={(e) =>
                setConfig((c) => ({ ...c, gapFilter: e.target.checked }))
              }
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Gap-alignment (ORB) — A/B: +0.8R vs −1.8R
          </label>

          <button
            onClick={() => run(config)}
            disabled={loading || config.strategies.length === 0}
            className="ml-auto rounded-md bg-accent/15 px-6 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
          >
            {loading ? "Futtatás..." : "Backtest futtatása"}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">
          {error}
        </div>
      )}

      {result && (
        <>
          <p className="text-xs text-muted">
            {result.symbol} · {result.sessionCount} session ·{" "}
            {result.firstDate} → {result.lastDate}
          </p>

          {/* Stratégia-táblázat */}
          <section className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-3 font-medium">Stratégia</th>
                  <th className="num px-4 py-3 text-right font-medium">Trade</th>
                  <th className="num px-4 py-3 text-right font-medium">Win%</th>
                  <th className="num px-4 py-3 text-right font-medium">Nettó R</th>
                  <th className="num px-4 py-3 text-right font-medium">Átlag R</th>
                  <th className="num px-4 py-3 text-right font-medium">PF</th>
                  <th className="num px-4 py-3 text-right font-medium">Max DD</th>
                  <th className="num px-4 py-3 text-right font-medium">Long / Short R</th>
                </tr>
              </thead>
              <tbody>
                {[...result.perStrategy, result.combined].map((s) => (
                  <StatRow
                    key={s.strategy}
                    stats={s}
                    isCombined={s.strategy === "combined"}
                  />
                ))}
              </tbody>
            </table>
          </section>

          {/* Equity curve */}
          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="mb-4 text-sm font-semibold">
              Equity curve (összes kiválasztott stratégia, R)
            </h2>
            {result.equityR.length > 0 ? (
              <EquityCurve rValues={diffs(result.equityR)} />
            ) : (
              <p className="text-sm text-muted">Nincs trade ezzel a konfigurációval.</p>
            )}
          </section>

          {/* Trade lista */}
          <section className="rounded-lg border border-line bg-surface">
            <button
              onClick={() => setShowTrades(!showTrades)}
              className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold"
            >
              Trade lista ({result.trades.length})
              <span className="text-muted">{showTrades ? "▲" : "▼"}</span>
            </button>
            {showTrades && (
              <div className="max-h-[32rem] overflow-y-auto border-t border-line">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="px-4 py-2.5 font-medium">Dátum</th>
                      <th className="px-4 py-2.5 font-medium">Stratégia</th>
                      <th className="px-4 py-2.5 font-medium">Irány</th>
                      <th className="num px-4 py-2.5 text-right font-medium">Entry (ET)</th>
                      <th className="num px-4 py-2.5 text-right font-medium">Exit (ET)</th>
                      <th className="px-4 py-2.5 font-medium">Kilépés</th>
                      <th className="num px-4 py-2.5 text-right font-medium">R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i} className="border-b border-line last:border-b-0">
                        <td className="num px-4 py-2">{t.date}</td>
                        <td className="px-4 py-2">{STRATEGY_LABELS[t.strategy]}</td>
                        <td className="px-4 py-2">
                          <span
                            className={
                              t.direction === "long" ? "text-win" : "text-loss"
                            }
                          >
                            {t.direction === "long" ? "Long" : "Short"}
                          </span>
                        </td>
                        <td className="num px-4 py-2 text-right">
                          {t.entry} <span className="text-muted">{t.entryTimeEt}</span>
                        </td>
                        <td className="num px-4 py-2 text-right">
                          {t.exit} <span className="text-muted">{t.exitTimeEt}</span>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted">
                          {t.exitReason === "target"
                            ? "Target"
                            : t.exitReason === "stop"
                              ? "Stop"
                              : "Cutoff"}
                        </td>
                        <td
                          className={`num px-4 py-2 text-right font-semibold ${
                            t.r > 0 ? "text-win" : t.r < 0 ? "text-loss" : "text-muted"
                          }`}
                        >
                          {formatR(t.r)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function StatRow({
  stats,
  isCombined,
}: {
  stats: StrategyStats
  isCombined: boolean
}) {
  return (
    <tr
      className={`border-b border-line last:border-b-0 ${
        isCombined ? "bg-surface-2/60 font-medium" : ""
      }`}
    >
      <td className="px-4 py-3">
        {isCombined
          ? "Összesen"
          : STRATEGY_LABELS[stats.strategy as StrategyId]}
      </td>
      <td className="num px-4 py-3 text-right">{stats.trades}</td>
      <td className="num px-4 py-3 text-right">{stats.winRate.toFixed(0)}%</td>
      <td
        className={`num px-4 py-3 text-right font-semibold ${
          stats.netR > 0 ? "text-win" : stats.netR < 0 ? "text-loss" : ""
        }`}
      >
        {formatR(stats.netR)}
      </td>
      <td className="num px-4 py-3 text-right">{stats.avgR.toFixed(2)}</td>
      <td className="num px-4 py-3 text-right">{stats.profitFactor ?? "—"}</td>
      <td className="num px-4 py-3 text-right text-loss">
        -{stats.maxDrawdownR.toFixed(1)}
      </td>
      <td className="num px-4 py-3 text-right text-xs">
        <span className={stats.longNetR >= 0 ? "text-win" : "text-loss"}>
          {formatR(stats.longNetR)}
        </span>{" "}
        /{" "}
        <span className={stats.shortNetR >= 0 ? "text-win" : "text-loss"}>
          {formatR(stats.shortNetR)}
        </span>
      </td>
    </tr>
  )
}

function NumField({
  label,
  value,
  onChange,
  step,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step: number
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-muted">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="num w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </div>
  )
}

/** kumulatív equity → trade-enkénti R különbségek (az EquityCurve inputja) */
function diffs(equity: number[]): number[] {
  const out: number[] = []
  let prev = 0
  for (const e of equity) {
    out.push(Math.round((e - prev) * 100) / 100)
    prev = e
  }
  return out
}
