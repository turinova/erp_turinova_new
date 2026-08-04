"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

type Position = {
  symbol: string
  positionAmt: number
  entryPrice: number
  markPrice: number
  unRealizedProfit: number
  leverage: number
  liquidationPrice: number
}

type OpenOrder = {
  orderId: number
  symbol: string
  side: string
  type: string
  price: string
  stopPrice: string
  origQty: string
  reduceOnly: boolean
  status?: string
  source?: "order" | "algo"
  closePosition?: boolean
}

type LiveTrade = {
  id: string
  pair: string
  side: string
  kind: string
  qty: number
  leverage: number
  riskUsd: number
  openedAt: string
  phase: string
  note?: string
  smoke?: boolean
}

type SignalPreview = {
  symbol: string
  kind: string
  entry: number | null
  stop: number | null
  target: number | null
  reason: string
  estRiskUsd: number | null
}

type DeskState = {
  configured: boolean
  connected: boolean
  error: string | null
  equity: { balance: number; available: number; unrealized: number; asset?: string; multiAssets?: boolean } | null
  positions: Position[]
  openOrders: OpenOrder[]
  settings: {
    autoTrade: boolean
    riskPercent: number
    leverageCap: number
    maxDailyFires: number
    maxDailyLossUsd: number
    symbols: ("SOL" | "DOGE")[]
    killedToday: boolean
  }
  liveTrades: LiveTrade[]
  warnings?: string[]
  daily?: {
    fires: number
    maxFires: number
    dayPnlUsd: number
    maxLossUsd: number
    killed: boolean
  }
  signalPreview?: SignalPreview[]
  lastError?: string | null
  lastErrorAt?: string | null
  fetchedAt?: string
}

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  })
}

export function BinanceDesk() {
  const [state, setState] = useState<DeskState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [flashOk, setFlashOk] = useState<boolean | null>(null)
  const [autoAck, setAutoAck] = useState(false)

  const load = useCallback(async (sync = false) => {
    try {
      const res = await fetch(`/api/crypto/binance${sync ? "?sync=1" : "?preview=0"}`, {
        cache: "no-store",
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
      setState((prev) => {
        if (!sync && prev?.signalPreview?.length && !body.signalPreview?.length) {
          return { ...body, signalPreview: prev.signalPreview }
        }
        return body
      })
    } catch (e) {
      setFlash(e instanceof Error ? e.message : "betöltési hiba")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(true)
    const fast = setInterval(() => void load(false), 3_000)
    const slow = setInterval(() => void load(true), 15_000)
    return () => {
      clearInterval(fast)
      clearInterval(slow)
    }
  }, [load])

  async function post(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true)
    setFlash(null)
    setFlashOk(null)
    try {
      const res = await fetch("/api/crypto/binance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? body?.message ?? `HTTP ${res.status}`)
      const msg =
        typeof body.message === "string"
          ? body.message
          : Array.isArray(body.logs)
            ? (body.logs as string[]).join(" · ")
            : null
      if (msg) {
        setFlash(msg)
        setFlashOk(body.ok !== false)
      } else if (action === "smoke") {
        setFlash(body.ok === false ? "Smoke sikertelen (nincs üzenet)" : "Smoke lefutott")
        setFlashOk(body.ok !== false)
      }
      if (body.configured != null) setState((prev) => ({ ...(prev as DeskState), ...body }))
      else await load(true)
      if (action === "settings" && body.settings?.autoTrade === false) setAutoAck(false)
    } catch (e) {
      setFlash(e instanceof Error ? e.message : "hiba")
      setFlashOk(false)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !state) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center text-sm text-muted">
        Binance desk betöltése…
      </div>
    )
  }
  if (!state) {
    return (
      <div className="space-y-3 rounded-lg border border-red-500/40 bg-red-500/5 p-6">
        <p className="text-sm font-medium text-loss">Desk nem töltődött be</p>
        <p className="text-sm text-muted">
          {flash ?? "API hiba — nézd a Network tabot (/api/crypto/binance)."}
        </p>
        <p className="text-xs text-muted">
          Productionön kell: Vercel → Environment Variables →{" "}
          <code className="text-[11px]">BINANCE_API_KEY</code> +{" "}
          <code className="text-[11px]">BINANCE_API_SECRET</code> (Redeploy után).
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            void load(true)
          }}
          className="rounded-md border border-line px-3 py-1.5 text-sm"
        >
          Újra
        </button>
      </div>
    )
  }

  const s = state.settings
  const daily = state.daily
  const eq = state.equity
  const total = eq ? eq.balance + eq.unrealized : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/crypto" className="text-accent underline">
          ← Crypto live
        </Link>
        <Link href="/crypto/signals" className="text-accent underline">
          Paper napló
        </Link>
      </div>

      {s.autoTrade && (
        <section className="rounded-lg border-2 border-red-500/60 bg-red-500/10 px-4 py-3">
          <p className="text-sm font-bold text-loss">AUTO ÉLŐ — fire → Binance valódi pénz</p>
          <p className="mt-1 text-xs text-muted">
            Risk {s.riskPercent}% · max {s.leverageCap}x · {s.symbols.join(", ")} · napi max{" "}
            {s.maxDailyFires} fire / −${s.maxDailyLossUsd} kill
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void post("settings", { autoTrade: false })}
            className="mt-2 rounded-md border border-red-500/50 px-3 py-1.5 text-xs text-loss"
          >
            Auto azonnal KI
          </button>
        </section>
      )}

      {(state.warnings?.length ?? 0) > 0 && (
        <section className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-warn">
          {state.warnings!.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </section>
      )}

      {state.lastError && (
        <section className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-loss">
          <p className="font-medium">Utolsó hiba</p>
          <p className="mt-0.5 text-xs">
            {state.lastError}
            {state.lastErrorAt && (
              <span className="ml-2 text-muted">
                {new Date(state.lastErrorAt).toLocaleString("hu-HU")}
              </span>
            )}
          </p>
        </section>
      )}

      {flash && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            flashOk === false
              ? "border-red-500/50 bg-red-500/10 text-loss"
              : flashOk === true
                ? "border-emerald-500/40 bg-emerald-500/10 text-win"
                : "border-line bg-surface-2"
          }`}
        >
          {flash}
        </div>
      )}

      {busy && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-warn">
          Binance művelet fut… (smoke / order — várj 1–3 mp)
        </div>
      )}

      {/* Equity hero */}
      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium ${
              state.connected
                ? "bg-emerald-500/15 text-win"
                : "bg-red-500/15 text-loss"
            }`}
          >
            {state.connected ? "Binance OK" : "Kapcsolat hiba"}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void post("ping")}
            className="rounded-md border border-line px-3 py-1.5 text-xs"
          >
            Ping
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load(true)}
            className="rounded-md border border-line px-3 py-1.5 text-xs"
          >
            Frissít
          </button>
          {state.fetchedAt && (
            <span className="text-[11px] text-muted">
              élő · {new Date(state.fetchedAt).toLocaleTimeString("hu-HU")}
            </span>
          )}
        </div>

        {eq && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-line bg-surface-2/60 px-4 py-3">
              <div className="text-[11px] text-muted">Kupac (bal+uPnL)</div>
              <div
                className={`num mt-1 text-3xl font-semibold ${
                  (total ?? 0) >= (eq.balance || 0) ? "text-win" : "text-loss"
                }`}
              >
                {fmtUsd(total ?? 0)}
              </div>
            </div>
            <Metric label="Balance" value={fmtUsd(eq.balance)} />
            <Metric
              label={`Available${eq.asset ? ` (${eq.asset})` : ""}`}
              value={fmtUsd(eq.available)}
              tone={eq.available < 5 ? "neg" : undefined}
            />
            <Metric
              label="Unrealized"
              value={fmtUsd(eq.unrealized)}
              tone={eq.unrealized >= 0 ? "pos" : "neg"}
            />
          </div>
        )}

        {daily && (
          <p className="mt-3 text-xs text-muted">
            Mai nap: {daily.fires}/{daily.maxFires} fire · nap PnL{" "}
            <span className={daily.dayPnlUsd >= 0 ? "text-win" : "text-loss"}>
              {fmtUsd(daily.dayPnlUsd)}
            </span>{" "}
            · kill −{fmtUsd(daily.maxLossUsd)}
            {daily.killed ? " · KILLED" : ""}
          </p>
        )}
      </section>

      {/* Signal preview */}
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Ha most fire lenne…</h2>
        <p className="mt-1 text-xs text-muted">Élő /crypto snapshot (15 mp-enként frissül sync-kel).</p>
        <div className="mt-3 space-y-2">
          {(state.signalPreview ?? []).map((p) => (
            <div
              key={p.symbol}
              className={`rounded-md border px-3 py-2 text-sm ${
                p.kind !== "NONE" ? "border-accent/30 bg-accent/5" : "border-line"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{p.symbol}</span>
                <span className={p.kind !== "NONE" ? "text-accent" : "text-muted"}>
                  {p.kind === "NONE" ? "nincs signal" : p.kind}
                </span>
              </div>
              {p.kind !== "NONE" && (
                <p className="mt-1 num text-xs text-muted">
                  Entry {p.entry} · Stop {p.stop} · TP {p.target}
                  {p.estRiskUsd != null && ` · ~1R ${fmtUsd(p.estRiskUsd)}`}
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted">{p.reason}</p>
            </div>
          ))}
          {!state.signalPreview?.length && (
            <p className="text-xs text-muted">Várj a következő sync-re, vagy nyomj Frissít.</p>
          )}
        </div>
      </section>

      {/* Settings */}
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Live beállítások</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-muted">
            Risk / trade ({s.riskPercent}%)
            <input
              type="range"
              min={2}
              max={15}
              value={s.riskPercent}
              disabled={busy}
              onChange={(e) => void post("settings", { riskPercent: Number(e.target.value) })}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-xs text-muted">
            Max leverage ({s.leverageCap}x)
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={s.leverageCap}
              disabled={busy}
              onChange={(e) => void post("settings", { leverageCap: Number(e.target.value) })}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-xs text-muted">
            Napi max fire ({s.maxDailyFires})
            <input
              type="range"
              min={1}
              max={15}
              value={s.maxDailyFires}
              disabled={busy}
              onChange={(e) => void post("settings", { maxDailyFires: Number(e.target.value) })}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-xs text-muted">
            Napi loss kill (${s.maxDailyLossUsd})
            <input
              type="range"
              min={10}
              max={80}
              step={5}
              value={s.maxDailyLossUsd}
              disabled={busy}
              onChange={(e) => void post("settings", { maxDailyLossUsd: Number(e.target.value) })}
              className="mt-2 w-full"
            />
          </label>
          <div className="text-xs text-muted">
            Coinok (auto/manuál)
            <div className="mt-1 flex gap-2">
              {(["SOL", "DOGE"] as const).map((sym) => {
                const on = s.symbols.includes(sym)
                return (
                  <button
                    key={sym}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const next = on ? s.symbols.filter((x) => x !== sym) : [...s.symbols, sym]
                      if (!next.length) return
                      void post("settings", { symbols: next })
                    }}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-sm ${
                      on ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-muted"
                    }`}
                  >
                    {sym}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-line bg-surface-2/40 p-3">
          <p className="text-xs font-medium">Auto-trade</p>
          {!s.autoTrade ? (
            <>
              <label className="mt-2 flex items-start gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={autoAck}
                  onChange={(e) => setAutoAck(e.target.checked)}
                  className="mt-0.5"
                />
                Értem: a /crypto fire valódi Binance Futures order lesz a fenti riskkel.
              </label>
              <button
                type="button"
                disabled={busy || !autoAck || s.killedToday}
                onClick={() => void post("settings", { autoTrade: true, confirmAuto: true })}
                className="mt-2 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-sm text-loss disabled:opacity-40"
              >
                Auto BE kapcsolása
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void post("settings", { autoTrade: false })}
              className="mt-2 rounded-md border border-line px-3 py-1.5 text-sm"
            >
              Auto KI
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !state.connected}
            onClick={() => {
              if (!confirm("Smoke test: apró SOL long → azonnal zár. Mehet?")) return
              void post("smoke")
            }}
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm text-warn"
          >
            Minimal smoke test (~$6 SOL){busy ? "…" : ""}
          </button>
          <button
            type="button"
            disabled={busy || !state.connected}
            onClick={() => void post("openLive", { symbol: "SOL" })}
            className="rounded-md border border-emerald-600/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-win"
          >
            Nyiss most: SOL signal
          </button>
          <button
            type="button"
            disabled={busy || !state.connected}
            onClick={() => void post("openLive", { symbol: "DOGE" })}
            className="rounded-md border border-emerald-600/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-win"
          >
            Nyiss most: DOGE signal
          </button>
          <button
            type="button"
            disabled={busy || !state.connected || state.positions.length === 0}
            onClick={() => {
              if (!confirm("Tényleg bezárod az ÖSSZES futures pozíciót?")) return
              void post("closeAll")
            }}
            className="rounded-md border border-red-600/40 bg-red-500/10 px-3 py-1.5 text-sm text-loss"
          >
            Zárj mindent
          </button>
        </div>
      </section>

      {/* Positions */}
      <section className="overflow-x-auto rounded-lg border border-line bg-surface">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Nyitott pozíciók</h2>
        {state.positions.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">Nincs nyitott futures pozíció.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Symbol</th>
                <th className="px-4 py-2.5 font-medium">Side</th>
                <th className="px-4 py-2.5 font-medium">Size</th>
                <th className="px-4 py-2.5 font-medium">Entry</th>
                <th className="px-4 py-2.5 font-medium">Mark</th>
                <th className="px-4 py-2.5 font-medium">uPnL</th>
                <th className="px-4 py-2.5 font-medium">Lev</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {state.positions.map((p) => {
                const long = p.positionAmt > 0
                return (
                  <tr key={p.symbol} className="border-b border-line/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{p.symbol}</td>
                    <td className={`px-4 py-2.5 ${long ? "text-win" : "text-loss"}`}>
                      {long ? "LONG" : "SHORT"}
                    </td>
                    <td className="num px-4 py-2.5">{Math.abs(p.positionAmt)}</td>
                    <td className="num px-4 py-2.5">{p.entryPrice}</td>
                    <td className="num px-4 py-2.5">{p.markPrice}</td>
                    <td
                      className={`num px-4 py-2.5 font-semibold ${
                        p.unRealizedProfit >= 0 ? "text-win" : "text-loss"
                      }`}
                    >
                      {fmtUsd(p.unRealizedProfit)}
                    </td>
                    <td className="num px-4 py-2.5">{p.leverage}x</td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (!confirm(`Zárod a ${p.symbol} pozíciót?`)) return
                          void post("close", { symbol: p.symbol })
                        }}
                        className="text-xs text-loss underline"
                      >
                        Zár
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Orders */}
      <section className="overflow-x-auto rounded-lg border border-line bg-surface">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
          Nyitott orderek (limit + algo SL/TP)
        </h2>
        {state.openOrders.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">Nincs open / algo order.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Symbol</th>
                <th className="px-4 py-2.5 font-medium">Forrás</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Side</th>
                <th className="px-4 py-2.5 font-medium">Trigger</th>
                <th className="px-4 py-2.5 font-medium">Qty</th>
              </tr>
            </thead>
            <tbody>
              {state.openOrders.map((o) => (
                <tr key={`${o.source}-${o.orderId}`} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-2.5">{o.symbol}</td>
                  <td className="px-4 py-2.5 text-[10px] uppercase text-muted">
                    {o.source === "algo" ? "algo" : "order"}
                  </td>
                  <td className="px-4 py-2.5">
                    {o.type}
                    {o.closePosition ? " · CP" : ""}
                  </td>
                  <td className="px-4 py-2.5">{o.side}</td>
                  <td className="num px-4 py-2.5">
                    {o.stopPrice && o.stopPrice !== "0" ? o.stopPrice : o.price}
                  </td>
                  <td className="num px-4 py-2.5">{o.origQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Log */}
      <section className="overflow-x-auto rounded-lg border border-line bg-surface">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Bridge napló</h2>
        {state.liveTrades.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">
            Üres. Először: <b>Minimal smoke test</b>, aztán auto.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Idő</th>
                <th className="px-4 py-2.5 font-medium">Pair</th>
                <th className="px-4 py-2.5 font-medium">Kind</th>
                <th className="px-4 py-2.5 font-medium">Qty/Lev</th>
                <th className="px-4 py-2.5 font-medium">Fázis</th>
                <th className="px-4 py-2.5 font-medium">Megj.</th>
              </tr>
            </thead>
            <tbody>
              {state.liveTrades.map((t) => (
                <tr key={t.id} className="border-b border-line/50 last:border-0">
                  <td className="num px-4 py-2.5 text-xs text-muted">
                    {new Date(t.openedAt).toLocaleString("hu-HU")}
                  </td>
                  <td className="px-4 py-2.5">
                    {t.pair} {t.side}
                    {t.smoke ? " · smoke" : ""}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{t.kind}</td>
                  <td className="num px-4 py-2.5">
                    {t.qty} · {t.leverage}x
                  </td>
                  <td className="px-4 py-2.5 text-xs">{t.phase}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{t.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "pos" | "neg"
}) {
  return (
    <div className="rounded-md border border-line bg-surface-2/50 px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div
        className={`num text-lg font-semibold ${
          tone === "pos" ? "text-win" : tone === "neg" ? "text-loss" : ""
        }`}
      >
        {value}
      </div>
    </div>
  )
}
