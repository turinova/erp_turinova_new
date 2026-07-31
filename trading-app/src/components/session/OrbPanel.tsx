"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getOrbSignal, type OrbSignalResult } from "@/lib/orb-logic"
import { positionSize, riskInUsd } from "@/lib/r-calculator"
import type { TradingSession, TradingSettings, VwapSide } from "@/lib/types"

export function OrbPanel({
  initialSession,
  settings,
}: {
  initialSession: TradingSession | null
  settings: TradingSettings
}) {
  const router = useRouter()
  const [orbHigh, setOrbHigh] = useState<string>(
    initialSession?.orbHigh != null ? String(initialSession.orbHigh) : ""
  )
  const [orbLow, setOrbLow] = useState<string>(
    initialSession?.orbLow != null ? String(initialSession.orbLow) : ""
  )
  const [locked, setLocked] = useState(!!initialSession?.orbLockedAt)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [price, setPrice] = useState<string>("")
  const [vwapSide, setVwapSide] = useState<VwapSide>(
    initialSession?.vwapSide ?? "at"
  )
  const [volumeConfirmed, setVolumeConfirmed] = useState(false)

  const high = parseFloat(orbHigh)
  const low = parseFloat(orbLow)
  const px = parseFloat(price)
  const canLock = !isNaN(high) && !isNaN(low) && high > low

  const signal: OrbSignalResult | null =
    locked && !isNaN(px)
      ? getOrbSignal({ orbHigh: high, orbLow: low, price: px, vwapSide, volumeConfirmed })
      : null

  const contracts =
    signal && signal.signal !== "SKIP" && signal.stop != null
      ? positionSize(settings.accountSize, settings.riskPerTradePct, px, signal.stop)
      : null

  async function toggleLock() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: locked
          ? JSON.stringify({ action: "unlock" })
          : JSON.stringify({
              action: "lock",
              orbHigh: high,
              orbLow: low,
              vwapSide,
            }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      setLocked(!locked)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mentési hiba")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* ORB rögzítés */}
      <section className="rounded-lg border border-line bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            ORB ({settings.orbMinutes} perc · 9:30–9:45 ET)
          </h2>
          {locked && (
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
              Rögzítve
            </span>
          )}
        </div>

        {error && (
          <p className="mb-3 rounded-md bg-loss/10 px-3 py-2 text-xs text-loss">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="ORB High">
            <input
              type="number"
              step="0.25"
              value={orbHigh}
              onChange={(e) => setOrbHigh(e.target.value)}
              disabled={locked}
              placeholder="pl. 25448.00"
              className="num w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
            />
          </Field>
          <Field label="ORB Low">
            <input
              type="number"
              step="0.25"
              value={orbLow}
              onChange={(e) => setOrbLow(e.target.value)}
              disabled={locked}
              placeholder="pl. 25418.00"
              className="num w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
            />
          </Field>
        </div>

        {canLock && !locked && (
          <p className="num mt-3 text-xs text-muted">
            Range: {(high - low).toFixed(2)} pont (~$
            {riskInUsd(high, low).toFixed(0)} / kontrakt, ha a stop a másik
            oldal)
          </p>
        )}

        <button
          onClick={toggleLock}
          disabled={!canLock || saving}
          className={`mt-4 w-full rounded-md px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            locked
              ? "bg-surface-2 text-muted hover:text-foreground"
              : "bg-accent/15 text-accent hover:bg-accent/25"
          }`}
        >
          {saving
            ? "Mentés..."
            : locked
              ? "Lock feloldása"
              : "ORB lock (9:45 ET)"}
        </button>
      </section>

      {/* Jelzés */}
      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Jelzés</h2>

        {!locked ? (
          <p className="text-sm text-muted">
            Előbb rögzítsd az ORB szinteket — utána itt kapod a valid/skip
            jelzést.
          </p>
        ) : (
          <div className="space-y-4">
            <Field label="Aktuális ár">
              <input
                type="number"
                step="0.25"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="pl. 25455.00"
                className="num w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </Field>

            <Field label="Ár a VWAP-hoz képest">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["above", "Felette"],
                    ["at", "Rajta"],
                    ["below", "Alatta"],
                  ] as const
                ).map(([side, label]) => (
                  <button
                    key={side}
                    onClick={() => setVwapSide(side)}
                    className={`rounded-md px-3 py-2 text-sm transition-colors ${
                      vwapSide === side
                        ? "bg-accent/15 font-medium text-accent"
                        : "bg-surface-2 text-muted hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>

            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={volumeConfirmed}
                onChange={(e) => setVolumeConfirmed(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Volume megerősítés (RVOL ≥ 1.2 a breakout gyertyán)
            </label>

            {signal && (
              <div
                className={`rounded-lg border p-4 ${
                  signal.signal === "LONG_VALID"
                    ? "border-win/40 bg-win/10"
                    : signal.signal === "SHORT_VALID"
                      ? "border-loss/40 bg-loss/10"
                      : "border-line bg-surface-2"
                }`}
              >
                <p
                  className={`text-base font-bold ${
                    signal.signal === "LONG_VALID"
                      ? "text-win"
                      : signal.signal === "SHORT_VALID"
                        ? "text-loss"
                        : "text-muted"
                  }`}
                >
                  {signal.signal === "LONG_VALID"
                    ? "LONG VALID"
                    : signal.signal === "SHORT_VALID"
                      ? "SHORT VALID"
                      : "SKIP"}
                </p>
                <p className="mt-1 text-xs text-muted">{signal.reason}</p>

                {signal.signal !== "SKIP" && (
                  <dl className="num mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <dt className="text-muted">Stop</dt>
                    <dd className="text-right">{signal.stop}</dd>
                    <dt className="text-muted">Target 1.5R</dt>
                    <dd className="text-right">{signal.target15}</dd>
                    <dt className="text-muted">Target 2R</dt>
                    <dd className="text-right">{signal.target20}</dd>
                    <dt className="text-muted">
                      Méret ({settings.riskPerTradePct}% risk)
                    </dt>
                    <dd className="text-right">
                      {contracts === 0
                        ? "0 — túl nagy stop!"
                        : `${contracts} kontrakt (MNQ)`}
                    </dd>
                  </dl>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-muted">{label}</label>
      {children}
    </div>
  )
}
