"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LineStyle } from "lightweight-charts"
import { CryptoChart } from "./CryptoChart"
import { ContextStrip } from "./ContextStrip"
import {
  ALL_SETUPS_ENABLED,
  CRYPTO_KIND_LABEL,
  CRYPTO_SETUP_IDS,
  CRYPTO_SETUP_LABEL,
  type CryptoSetupId,
  type CryptoSnapshot,
  type EnabledSetups,
  type SetupBuildup,
  type SymbolSnapshot,
} from "@/lib/crypto/types"
import { describeExitPlan, partialTp1Price } from "@/lib/crypto/paper"

const POLL_MS = 45_000
const STORAGE_KEY = "crypto-enabled-setups"

function loadEnabled(): EnabledSetups {
  if (typeof window === "undefined") return { ...ALL_SETUPS_ENABLED }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...ALL_SETUPS_ENABLED }
    const parsed = JSON.parse(raw) as Partial<EnabledSetups>
    return { ...ALL_SETUPS_ENABLED, ...parsed }
  } catch {
    return { ...ALL_SETUPS_ENABLED }
  }
}

export function CryptoLive() {
  const [snap, setSnap] = useState<CryptoSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState<EnabledSetups | null>(null)
  const lastNotifiedRef = useRef<string>("")

  useEffect(() => {
    setEnabled(loadEnabled())
  }, [])

  const setupsQuery = useMemo(() => {
    if (!enabled) return null
    return CRYPTO_SETUP_IDS.filter((id) => enabled[id]).join(",")
  }, [enabled])

  const load = useCallback(async () => {
    if (setupsQuery == null) return
    try {
      const res = await fetch(`/api/crypto?setups=${encodeURIComponent(setupsQuery)}`, {
        cache: "no-store",
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const data: CryptoSnapshot = await res.json()
      setSnap(data)
      setError(null)

      for (const s of data.symbols) {
        if (s.signal.kind !== "NONE") {
          const key = `${data.utcDate}:${s.symbol}:${s.signal.kind}`
          if (key !== lastNotifiedRef.current && typeof Notification !== "undefined") {
            lastNotifiedRef.current = key
            if (Notification.permission === "granted") {
              new Notification(`${s.symbol}: ${CRYPTO_KIND_LABEL[s.signal.kind] ?? s.signal.kind}`, {
                body: s.signal.reason,
              })
            }
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ismeretlen hiba")
    } finally {
      setLoading(false)
    }
  }, [setupsQuery])

  useEffect(() => {
    if (setupsQuery == null) return
    load()
    const id = setInterval(load, POLL_MS)
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission()
    }
    return () => clearInterval(id)
  }, [load, setupsQuery])

  function toggleSetup(id: CryptoSetupId) {
    setEnabled((prev) => {
      if (!prev) return prev
      const next = { ...prev, [id]: !prev[id] }
      // legalább egy setup maradjon be
      if (!CRYPTO_SETUP_IDS.some((k) => next[k])) return prev
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  if (!enabled || (loading && !snap)) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center text-sm text-muted">
        Crypto feed betöltése…
      </div>
    )
  }

  if (error && !snap) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-sm text-loss">
        Nem sikerült betölteni a crypto feedet: {error}
      </div>
    )
  }

  if (!snap) return null

  return (
    <div className="space-y-5">
      {/* Setup toggle-ök */}
      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Setupok — mi megy ma</p>
          <p className="text-xs text-muted">
            Ha kikapcsolod, nincs fire és nincs paper. Ne vadássz mindent egyszerre.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CRYPTO_SETUP_IDS.map((id) => {
            const on = enabled[id]
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleSetup(id)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  on
                    ? "border-accent/40 bg-accent/10 font-medium text-accent"
                    : "border-line bg-surface-2 text-muted"
                }`}
              >
                {CRYPTO_SETUP_LABEL[id]}
              </button>
            )
          })}
        </div>
      </section>

      {snap.context && <ContextStrip context={snap.context} onCreated={load} />}

      {/* BTC/ETH kontextus */}
      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <RegimeBadge regime={snap.btc.regime} />
          <Metric label="BTC" value={fmtPrice(snap.btc.btcPrice)} sub={fmtPct(snap.btc.btcChange24hPct)} />
          <Metric label="ETH" value={fmtPrice(snap.btc.ethPrice)} sub={fmtPct(snap.btc.ethChange24hPct)} />
          <Metric
            label="BTC vs VWAP"
            value={
              snap.btc.btcVwapDistAtr != null
                ? `${snap.btc.btcVwapDistAtr >= 0 ? "+" : ""}${snap.btc.btcVwapDistAtr.toFixed(1)}×ATR`
                : "—"
            }
          />
          <Metric
            label="BTC 15p lendület"
            value={
              snap.btc.btcShock15m != null
                ? `${snap.btc.btcShock15m >= 0 ? "+" : ""}${snap.btc.btcShock15m.toFixed(1)}×ATR`
                : "—"
            }
          />
          <span className="ml-auto text-xs text-muted">
            {snap.utcTime} UTC · {snap.source} {error ? "· frissítési hiba, régi adat" : ""}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">{snap.btc.note}</p>
      </section>

      {snap.guardrail && (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-warn">
          {snap.guardrail}
        </section>
      )}

      {snap.paper && snap.paper.errors.length > 0 && (
        <section className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-loss">
          <p className="font-medium">Paper mentés sikertelen — a signal él, de nem került a naplóba</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {snap.paper.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Tipikusan: futtasd a{" "}
            <code className="rounded bg-surface-2 px-1">sql/006_crypto_setups_v2.sql</code>{" "}
            (és ha kell a{" "}
            <code className="rounded bg-surface-2 px-1">sql/005_crypto_context.sql</code>) scriptet
            a Supabase SQL editorban.
          </p>
        </section>
      )}

      {snap.paper && snap.paper.saved > 0 && snap.paper.errors.length === 0 && (
        <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-xs text-win">
          Paper napló: {snap.paper.saved} signal mentve →{" "}
          <a href="/crypto/signals" className="underline">
            /crypto/signals
          </a>
        </section>
      )}

      {snap.symbols.map((s) => (
        <SymbolPanel key={s.symbol} s={s} enabled={enabled} />
      ))}
    </div>
  )
}

function SymbolPanel({ s, enabled }: { s: SymbolSnapshot; enabled: EnabledSetups }) {
  const sig = s.signal
  const hasSignal = sig.kind !== "NONE"
  const isLong = sig.kind.endsWith("_LONG") || sig.kind.endsWith("LONG")

  const tp1 =
    hasSignal && sig.entry != null && sig.stop != null && sig.target != null
      ? partialTp1Price(sig.entry, sig.stop, sig.target)
      : null

  const levels = [
    s.prevDayHigh != null ? { price: s.prevDayHigh, title: "PD H", color: "#b45309" } : null,
    s.prevDayLow != null ? { price: s.prevDayLow, title: "PD L", color: "#b45309" } : null,
    s.equalHigh != null ? { price: s.equalHigh, title: "EQH", color: "#c2410c" } : null,
    s.equalLow != null ? { price: s.equalLow, title: "EQL", color: "#c2410c" } : null,
    s.asiaHigh != null ? { price: s.asiaHigh, title: "Asia H", color: "#0d9488" } : null,
    s.asiaLow != null ? { price: s.asiaLow, title: "Asia L", color: "#0d9488" } : null,
    s.londonHigh != null ? { price: s.londonHigh, title: "Lon H", color: "#2563eb" } : null,
    s.londonLow != null ? { price: s.londonLow, title: "Lon L", color: "#2563eb" } : null,
    s.usOpenHigh != null ? { price: s.usOpenHigh, title: "US H", color: "#7c3aed" } : null,
    s.usOpenLow != null ? { price: s.usOpenLow, title: "US L", color: "#7c3aed" } : null,
    hasSignal && sig.entry != null
      ? { price: sig.entry, title: "Entry", color: "#0284c7", style: LineStyle.Solid, width: 2 }
      : null,
    hasSignal && sig.stop != null
      ? { price: sig.stop, title: "Stop", color: "#b91c1c", style: LineStyle.Solid, width: 2 }
      : null,
    tp1 != null
      ? { price: tp1, title: "TP1 1R", color: "#ca8a04", style: LineStyle.Dashed, width: 2 }
      : null,
    hasSignal && sig.target != null
      ? { price: sig.target, title: "TP2", color: "#15803d", style: LineStyle.Solid, width: 2 }
      : null,
  ].filter((l): l is NonNullable<typeof l> => l != null)

  return (
    <section className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3">
        <span className="text-base font-semibold">{s.symbol}/USDT</span>
        <Metric label="Ár" value={fmtPrice(s.lastPrice)} sub={fmtPct(s.change24hPct)} />
        <Metric
          label="VWAP-táv"
          value={
            s.vwapDistAtr != null
              ? `${s.vwapDistAtr >= 0 ? "+" : ""}${s.vwapDistAtr.toFixed(1)}×ATR`
              : "—"
          }
        />
        <Metric label="RVOL" value={s.rvol != null ? s.rvol.toFixed(2) : "—"} />
        <Metric label="ADX" value={s.adx != null ? s.adx.toFixed(0) : "—"} />
        <Metric
          label="OI 1h"
          value={
            s.oiDelta1hPct != null
              ? `${s.oiDelta1hPct >= 0 ? "+" : ""}${s.oiDelta1hPct.toFixed(1)}%`
              : "—"
          }
        />
        <Metric label="OI regime" value={s.oiRegime ?? "—"} />
        {s.catalystMode && (
          <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">
            KATALIZÁTOR
          </span>
        )}
        <Metric
          label="Funding"
          value={s.fundingRate != null ? `${(s.fundingRate * 100).toFixed(4)}%` : "—"}
          sub={s.fundingZ != null ? `z=${s.fundingZ.toFixed(1)}` : undefined}
        />
        <Metric
          label="Prev day H/L"
          value={
            s.prevDayHigh != null && s.prevDayLow != null
              ? `${fmtPrice(s.prevDayHigh)} / ${fmtPrice(s.prevDayLow)}`
              : "—"
          }
        />
      </div>

      <div
        className={`mx-4 mt-4 rounded-md border p-3 text-sm ${
          hasSignal
            ? isLong
              ? "border-emerald-600/40 bg-emerald-500/10"
              : "border-red-600/40 bg-red-500/10"
            : "border-line bg-surface-2/50"
        }`}
      >
        {hasSignal ? (
          <div className="space-y-1">
            <p className={`font-semibold ${isLong ? "text-win" : "text-loss"}`}>
              {CRYPTO_KIND_LABEL[sig.kind] ?? sig.kind}
              {sig.ageBars != null && sig.ageBars > 0 && (
                <span className="ml-2 text-xs font-normal text-muted">{sig.ageBars} perce</span>
              )}
            </p>
            <p className="text-xs text-muted">{sig.reason}</p>
            <p className="num text-xs">
              Entry <b>{fmtPrice(sig.entry)}</b> · Stop <b>{fmtPrice(sig.stop)}</b>
              {tp1 != null && (
                <>
                  {" "}
                  · TP1 <b>{fmtPrice(tp1)}</b>
                </>
              )}{" "}
              · TP2 <b>{fmtPrice(sig.target)}</b>
            </p>
            {sig.entry != null && sig.stop != null && sig.target != null && (
              <p className="text-xs font-medium text-foreground/80">
                Exit: {describeExitPlan(sig.entry, sig.stop, sig.target)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted">{sig.reason || "Nincs setup — várj, ne erőltess"}</p>
        )}
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <CryptoChart bars={s.chartBars} vwapSeries={s.vwapSeries} levels={levels} height={520} />
        </div>
        <aside className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Checklist — hol tart
          </p>
          {(s.buildups ?? []).map((b) => (
            <BuildupCard key={b.id} b={b} active={enabled[b.id]} />
          ))}
        </aside>
      </div>
    </section>
  )
}

function BuildupCard({ b, active }: { b: SetupBuildup; active: boolean }) {
  const pct = b.total ? Math.round((b.done / b.total) * 100) : 0
  return (
    <div
      className={`rounded-md border p-3 ${
        !active
          ? "border-line bg-surface-2/40 opacity-50"
          : b.ready
            ? "border-accent/40 bg-accent/5"
            : "border-line bg-surface-2/30"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {b.label}
          {b.bias !== "none" && (
            <span
              className={`ml-1.5 text-xs font-semibold ${
                b.bias === "long" ? "text-win" : "text-loss"
              }`}
            >
              {b.bias.toUpperCase()}
            </span>
          )}
        </span>
        <span className="num text-xs text-muted">
          {b.done}/{b.total}
        </span>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-all ${
            b.ready ? "bg-accent" : "bg-muted/40"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="space-y-1">
        {b.steps.map((step) => (
          <li key={step.label} className="flex items-start gap-2 text-xs">
            <span className={step.ok ? "text-win" : "text-muted"}>{step.ok ? "✓" : "○"}</span>
            <span className={step.ok ? "text-foreground" : "text-muted"}>
              {step.label}
              {step.detail && <span className="text-muted"> · {step.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
      {!active && <p className="mt-2 text-[11px] text-muted">Kikapcsolva — nem ad signalot</p>}
    </div>
  )
}

function RegimeBadge({ regime }: { regime: "risk_on" | "risk_off" | "neutral" }) {
  const cfg = {
    risk_on: { label: "RISK-ON", cls: "bg-emerald-500/15 text-win" },
    risk_off: { label: "RISK-OFF", cls: "bg-red-500/15 text-loss" },
    neutral: { label: "SEMLEGES", cls: "bg-zinc-500/15 text-muted" },
  }[regime]
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <span className="text-sm">
      <span className="text-xs text-muted">{label}: </span>
      <span className="num font-medium">{value}</span>
      {sub && (
        <span
          className={`num ml-1 text-xs ${
            sub.startsWith("+") ? "text-win" : sub.startsWith("-") ? "text-loss" : "text-muted"
          }`}
        >
          {sub}
        </span>
      )}
    </span>
  )
}

function fmtPrice(n: number | null): string {
  if (n == null) return "—"
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 })
  if (n >= 100) return n.toFixed(2)
  if (n >= 1) return n.toFixed(3)
  return n.toFixed(5)
}

function fmtPct(n: number | null): string {
  if (n == null) return ""
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`
}
