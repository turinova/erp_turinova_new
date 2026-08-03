"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { LiveChart } from "./LiveChart"
import type { LiveSnapshot } from "@/lib/live/compute"

const POLL_MS = 45_000

const STATUS_LABEL: Record<LiveSnapshot["status"], string> = {
  closed: "Zárva",
  preopen: "Nyitás előtt",
  orb_forming: "ORB formálódik",
  active: "Élő session",
}

const STATUS_STYLE: Record<LiveSnapshot["status"], string> = {
  closed: "bg-zinc-500/15 text-muted",
  preopen: "bg-sky-500/15 text-accent",
  orb_forming: "bg-amber-500/15 text-warn",
  active: "bg-emerald-500/15 text-win",
}

const SIGNAL_LABEL: Record<string, string> = {
  ORB_LONG: "ORB LONG",
  ORB_SHORT: "ORB SHORT",
  FADE_LONG: "FADE LONG",
  FADE_SHORT: "FADE SHORT",
  VWAP_LONG: "VWAP REV. LONG",
  VWAP_SHORT: "VWAP REV. SHORT",
  PB_LONG: "PULLBACK LONG",
  PB_SHORT: "PULLBACK SHORT",
}

export function LiveSession() {
  const [snap, setSnap] = useState<LiveSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [notifyOn, setNotifyOn] = useState(false)
  const lastSignalRef = useRef<string>("NONE")

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/live", { cache: "no-store" })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const data: LiveSnapshot = await res.json()
      setSnap(data)
      setError(null)
      setCountdown(data.secondsToOpen ?? data.secondsToLock ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ismeretlen hiba")
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  // helyi másodperc-számláló a következő pollig
  useEffect(() => {
    if (countdown == null) return
    const id = setInterval(
      () => setCountdown((c) => (c != null && c > 0 ? c - 1 : c)),
      1000
    )
    return () => clearInterval(id)
  }, [countdown != null])

  // böngésző-értesítés, ha új érvényes signal jelenik meg
  useEffect(() => {
    if (!snap) return
    const kind = snap.signal.kind
    if (kind !== "NONE" && kind !== lastSignalRef.current && notifyOn) {
      new Notification(`MNQ signal: ${kind}`, {
        body: snap.signal.reason,
      })
    }
    lastSignalRef.current = kind
  }, [snap, notifyOn])

  const enableNotifications = async () => {
    if (!("Notification" in window)) return
    const perm = await Notification.requestPermission()
    setNotifyOn(perm === "granted")
  }

  if (error && !snap) {
    return (
      <section className="rounded-lg border border-red-500/30 bg-red-500/5 p-5 text-sm text-loss">
        Élő adat hiba: {error}
      </section>
    )
  }
  if (!snap) {
    return (
      <section className="rounded-lg border border-line bg-surface p-5 text-sm text-muted">
        Élő adatok betöltése…
      </section>
    )
  }

  const sig = snap.signal
  const isLong = sig.kind.endsWith("_LONG")
  const isShort = sig.kind.endsWith("_SHORT")

  return (
    <div className="space-y-4">
      {snap.guardrail && (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-sm text-warn">
          <span className="font-semibold">Guardrail aktív:</span> {snap.guardrail}{" "}
          Zárd le a napot — a statisztika szerint innen már csak rontani szoktál.
        </section>
      )}
      {/* Státuszsor */}
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-5 py-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[snap.status]}`}
        >
          {STATUS_LABEL[snap.status]}
        </span>
        <span className="num text-sm text-muted">{snap.etTime} ET</span>
        {countdown != null && countdown > 0 && (
          <span className="num text-sm text-warn">
            {snap.status === "preopen" ? "Nyitásig" : "ORB lockig"}:{" "}
            {formatCountdown(countdown)}
          </span>
        )}
        <span className="ml-auto text-xs text-muted">{snap.dataNote}</span>
        {!notifyOn && (
          <button
            onClick={enableNotifications}
            className="rounded border border-line px-2.5 py-1 text-xs text-muted hover:text-foreground"
          >
            Értesítések be
          </button>
        )}
      </section>

      {/* Signal panel */}
      <section
        className={`rounded-lg border p-5 ${
          isLong
            ? "border-emerald-500/40 bg-emerald-500/5"
            : isShort
              ? "border-red-500/40 bg-red-500/5"
              : "border-line bg-surface"
        }`}
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">
            {sig.kind === "NONE" ? "Nincs signal" : SIGNAL_LABEL[sig.kind] ?? sig.kind}
          </h2>
          {sig.contracts != null &&
            (sig.contracts > 0 ? (
              <span className="num text-sm text-muted">
                Méret: <span className="text-foreground">{sig.contracts} MNQ</span>
              </span>
            ) : (
              <span className="text-xs text-warn">
                0 MNQ — a stop túl messze van a kockázati kerethez
              </span>
            ))}
        </div>
        <p className="mt-1 text-sm text-muted">{sig.reason}</p>
        {sig.entry != null && sig.stop != null && (
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Entry" value={sig.entry} />
            <Stat label="Stop" value={sig.stop} />
            <Stat label="Target 1.5R" value={sig.target15} />
            <Stat label="Target 2R" value={sig.target20} />
          </div>
        )}
      </section>

      {/* Chart */}
      <section className="rounded-lg border border-line bg-surface p-4">
        {snap.bars.length > 0 ? (
          <LiveChart
            bars={snap.bars}
            vwapSeries={snap.vwapSeries}
            orbHigh={snap.orbHigh}
            orbLow={snap.orbLow}
          />
        ) : (
          <p className="py-16 text-center text-sm text-muted">
            Ma még nincs chart-adat (hétvége vagy nyitás előtt).
          </p>
        )}
      </section>

      {/* Élő mérőszámok */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <Metric label="Utolsó ár" value={snap.lastPrice} suffix={snap.lastBarEt ? ` (${snap.lastBarEt})` : ""} />
        <Metric label="ORB High" value={snap.orbHigh} pending={!snap.orbLocked} />
        <Metric label="ORB Low" value={snap.orbLow} pending={!snap.orbLocked} />
        <Metric
          label="VWAP"
          value={snap.vwap}
          suffix={
            snap.vwapSide ? ` (${snap.vwapSide === "above" ? "felette" : snap.vwapSide === "below" ? "alatta" : "rajta"})` : ""
          }
        />
        <Metric label="RVOL (5m)" value={snap.rvol} highlight={snap.rvol != null && snap.rvol >= 1.2} />
        <Metric
          label="Gap (open−prev)"
          text={
            snap.gapPts != null && snap.gapDir
              ? `${snap.gapPts > 0 ? "+" : ""}${snap.gapPts.toFixed(1)} · ${
                  snap.gapDir === "up"
                    ? "fel (ORB long)"
                    : snap.gapDir === "down"
                      ? "le (ORB short)"
                      : "flat"
                }`
              : "—"
          }
          highlight={snap.gapDir === "up" || snap.gapDir === "down"}
        />
        <Metric
          label="Overnight H/L"
          text={
            snap.overnightHigh != null
              ? `${snap.overnightHigh} / ${snap.overnightLow}`
              : "—"
          }
        />
      </section>

      <section className="rounded-lg border border-line bg-surface px-5 py-3 text-xs text-muted">
        <span className="font-medium text-foreground">ORB filterek (backtestelt):</span>{" "}
        VWAP egyezés · RVOL ≥ 1.2 · min. range · chase-tiltás ·{" "}
        <span className="text-foreground">gap-alignment</span> (gap ellen historikusan
        −1.8R / 40% win — tiltva). ATR-sáv / retest / first-bar a mintán nem javított,
        nincs bekapcsolva.
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="num text-foreground">{value != null ? value.toFixed(2) : "—"}</div>
    </div>
  )
}

function Metric({
  label,
  value,
  text,
  suffix = "",
  pending = false,
  highlight = false,
}: {
  label: string
  value?: number | null
  text?: string
  suffix?: string
  pending?: boolean
  highlight?: boolean
}) {
  const display =
    text ?? (value != null ? `${value.toLocaleString("en-US")}${suffix}` : pending ? "…" : "—")
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num mt-0.5 text-sm ${highlight ? "text-win" : "text-foreground"}`}>
        {display}
      </div>
    </div>
  )
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}ó ${m % 60}p`
  }
  return `${m}:${String(s).padStart(2, "0")}`
}
