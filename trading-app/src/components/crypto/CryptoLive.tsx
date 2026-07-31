"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CryptoChart } from "./CryptoChart"
import { CRYPTO_KIND_LABEL, type CryptoSnapshot, type SymbolSnapshot } from "@/lib/crypto/types"

const POLL_MS = 45_000

export function CryptoLive() {
  const [snap, setSnap] = useState<CryptoSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const lastNotifiedRef = useRef<string>("")

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/crypto", { cache: "no-store" })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const data: CryptoSnapshot = await res.json()
      setSnap(data)
      setError(null)

      // böngésző-notifikáció új signalra
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
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission()
    }
    return () => clearInterval(id)
  }, [load])

  if (loading && !snap) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center text-sm text-muted">
        Crypto feed betöltése…
      </div>
    )
  }

  if (error && !snap) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-400">
        Nem sikerült betölteni a crypto feedet: {error}
      </div>
    )
  }

  if (!snap) return null

  return (
    <div className="space-y-5">
      {/* BTC/ETH kontextus */}
      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <RegimeBadge regime={snap.btc.regime} />
          <Metric label="BTC" value={fmtPrice(snap.btc.btcPrice)} sub={fmtPct(snap.btc.btcChange24hPct)} />
          <Metric label="ETH" value={fmtPrice(snap.btc.ethPrice)} sub={fmtPct(snap.btc.ethChange24hPct)} />
          <Metric
            label="BTC vs VWAP"
            value={snap.btc.btcVwapDistAtr != null ? `${snap.btc.btcVwapDistAtr >= 0 ? "+" : ""}${snap.btc.btcVwapDistAtr.toFixed(1)}×ATR` : "—"}
          />
          <Metric
            label="BTC 15p lendület"
            value={snap.btc.btcShock15m != null ? `${snap.btc.btcShock15m >= 0 ? "+" : ""}${snap.btc.btcShock15m.toFixed(1)}×ATR` : "—"}
          />
          <span className="ml-auto text-xs text-muted">
            {snap.utcTime} UTC · {snap.source} {error ? "· frissítési hiba, régi adat" : ""}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">{snap.btc.note}</p>
      </section>

      {snap.guardrail && (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-400">
          {snap.guardrail}
        </section>
      )}

      {/* SOL + DOGE panelek */}
      {snap.symbols.map((s) => (
        <SymbolPanel key={s.symbol} s={s} />
      ))}
    </div>
  )
}

function SymbolPanel({ s }: { s: SymbolSnapshot }) {
  const sig = s.signal
  const hasSignal = sig.kind !== "NONE"
  const isLong = sig.kind.endsWith("_LONG") || sig.kind.endsWith("LONG")

  const levels = [
    s.prevDayHigh != null ? { price: s.prevDayHigh, title: "PD H", color: "#f59e0b" } : null,
    s.prevDayLow != null ? { price: s.prevDayLow, title: "PD L", color: "#f59e0b" } : null,
    s.usOpenHigh != null ? { price: s.usOpenHigh, title: "US H", color: "#a78bfa" } : null,
    s.usOpenLow != null ? { price: s.usOpenLow, title: "US L", color: "#a78bfa" } : null,
  ].filter((l): l is { price: number; title: string; color: string } => l != null)

  return (
    <section className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3">
        <span className="text-base font-semibold">{s.symbol}/USDT</span>
        <Metric label="Ár" value={fmtPrice(s.lastPrice)} sub={fmtPct(s.change24hPct)} />
        <Metric
          label="VWAP-táv"
          value={s.vwapDistAtr != null ? `${s.vwapDistAtr >= 0 ? "+" : ""}${s.vwapDistAtr.toFixed(1)}×ATR` : "—"}
        />
        <Metric label="RVOL" value={s.rvol != null ? s.rvol.toFixed(2) : "—"} />
        <Metric label="ADX" value={s.adx != null ? s.adx.toFixed(0) : "—"} />
        <Metric
          label="Funding"
          value={s.fundingRate != null ? `${(s.fundingRate * 100).toFixed(4)}%` : "—"}
        />
        <Metric
          label="Prev day H/L"
          value={s.prevDayHigh != null && s.prevDayLow != null ? `${fmtPrice(s.prevDayHigh)} / ${fmtPrice(s.prevDayLow)}` : "—"}
        />
      </div>

      <div
        className={`mx-4 mt-4 rounded-md border p-3 text-sm ${
          hasSignal
            ? isLong
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-red-500/40 bg-red-500/10"
            : "border-line bg-surface-2/50"
        }`}
      >
        {hasSignal ? (
          <div className="space-y-1">
            <p className={`font-semibold ${isLong ? "text-emerald-400" : "text-red-400"}`}>
              {CRYPTO_KIND_LABEL[sig.kind] ?? sig.kind}
              {sig.ageBars != null && sig.ageBars > 0 && (
                <span className="ml-2 text-xs font-normal text-muted">{sig.ageBars} perce</span>
              )}
            </p>
            <p className="text-xs text-muted">{sig.reason}</p>
            <p className="num text-xs">
              Entry <b>{fmtPrice(sig.entry)}</b> · Stop <b>{fmtPrice(sig.stop)}</b> · Target (2R){" "}
              <b>{fmtPrice(sig.target)}</b>
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted">{sig.reason || "Nincs signal"}</p>
        )}
      </div>

      <div className="p-4">
        <CryptoChart bars={s.chartBars} vwapSeries={s.vwapSeries} levels={levels} />
      </div>
    </section>
  )
}

function RegimeBadge({ regime }: { regime: "risk_on" | "risk_off" | "neutral" }) {
  const cfg = {
    risk_on: { label: "RISK-ON", cls: "bg-emerald-500/15 text-emerald-400" },
    risk_off: { label: "RISK-OFF", cls: "bg-red-500/15 text-red-400" },
    neutral: { label: "SEMLEGES", cls: "bg-zinc-500/15 text-zinc-300" },
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
          className={`num ml-1 text-xs ${sub.startsWith("+") ? "text-emerald-400" : sub.startsWith("-") ? "text-red-400" : "text-muted"}`}
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
