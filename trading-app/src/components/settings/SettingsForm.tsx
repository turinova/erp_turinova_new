"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { TradingSettings } from "@/lib/types"

export function SettingsForm({
  initial,
}: {
  initial: TradingSettings & { id: string }
}) {
  const router = useRouter()
  const [accountSize, setAccountSize] = useState(String(initial.accountSize))
  const [riskPct, setRiskPct] = useState(String(initial.riskPerTradePct))
  const [maxTrades, setMaxTrades] = useState(String(initial.maxTradesPerDay))
  const [maxLossR, setMaxLossR] = useState(String(initial.maxDailyLossR))
  const [orbMinutes, setOrbMinutes] = useState(String(initial.orbMinutes))
  const [isDemo, setIsDemo] = useState(initial.isDemoMode)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const riskUsd =
    (parseFloat(accountSize) || 0) * ((parseFloat(riskPct) || 0) / 100)

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: initial.id,
          accountSize,
          riskPerTradePct: riskPct,
          maxTradesPerDay: maxTrades,
          maxDailyLossR: maxLossR,
          orbMinutes,
          isDemoMode: isDemo,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mentési hiba")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      {saved && (
        <div className="rounded-lg border border-win/40 bg-win/10 px-4 py-3 text-sm text-win">
          Beállítások elmentve.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">
          Nem sikerült menteni: {error}
        </div>
      )}

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Számla és kockázat</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Account size (USD)">
            <input
              type="number"
              value={accountSize}
              onChange={(e) => setAccountSize(e.target.value)}
              className="num w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </Field>
          <Field label="Risk / trade (%)">
            <input
              type="number"
              step="0.1"
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
              className="num w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </Field>
          <Field label="Max trade / nap">
            <input
              type="number"
              value={maxTrades}
              onChange={(e) => setMaxTrades(e.target.value)}
              className="num w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </Field>
          <Field label="Napi stop (R)">
            <input
              type="number"
              step="0.5"
              value={maxLossR}
              onChange={(e) => setMaxLossR(e.target.value)}
              className="num w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </Field>
        </div>
        <p className="num mt-4 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
          1 trade kockázata: <span className="text-foreground">${riskUsd.toFixed(0)}</span>{" "}
          — MNQ-n ~{riskUsd > 0 ? Math.floor(riskUsd / 2) : 0} pont stop-táv 1
          kontrakttal
        </p>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Session</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="ORB periódus (perc)">
            <input
              type="number"
              value={orbMinutes}
              onChange={(e) => setOrbMinutes(e.target.value)}
              className="num w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </Field>
          <Field label="Mód">
            <label className="flex cursor-pointer items-center gap-3 rounded-md bg-surface-2 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={isDemo}
                onChange={(e) => setIsDemo(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Demo mód (első 3 hónap)
            </label>
          </Field>
        </div>
        {!isDemo && (
          <p className="mt-4 rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-xs text-loss">
            Élő mód — biztos, hogy megvan a 60 trade és a +20R a demo
            időszakból?
          </p>
        )}
      </section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-accent/15 px-8 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
      >
        {saving ? "Mentés..." : "Mentés"}
      </button>
    </form>
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
