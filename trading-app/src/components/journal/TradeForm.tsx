"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { computeR, positionSize } from "@/lib/r-calculator"
import { formatR } from "@/lib/format"
import {
  EMOTION_LABELS,
  SETUP_LABELS,
  type EmotionTag,
  type SetupType,
  type TradingSettings,
  type VwapSide,
} from "@/lib/types"

const SETUPS = Object.entries(SETUP_LABELS) as [SetupType, string][]
const EMOTIONS = Object.entries(EMOTION_LABELS) as [EmotionTag, string][]

export function TradeForm({ settings }: { settings: TradingSettings }) {
  const router = useRouter()
  const [setupType, setSetupType] = useState<SetupType>("orb_long")
  const [entry, setEntry] = useState("")
  const [stop, setStop] = useState("")
  const [target, setTarget] = useState("")
  const [exit, setExit] = useState("")
  const [vwapSide, setVwapSide] = useState<VwapSide>("above")
  const [volumeConfirmed, setVolumeConfirmed] = useState(true)
  const [liquiditySwept, setLiquiditySwept] = useState(false)
  const [fvgPresent, setFvgPresent] = useState(false)
  const [followedPlan, setFollowedPlan] = useState(true)
  const [emotion, setEmotion] = useState<EmotionTag>("calm")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSkip = setupType === "skip"
  const e = parseFloat(entry)
  const s = parseFloat(stop)
  const x = parseFloat(exit)
  const r = computeR(
    isNaN(e) ? null : e,
    isNaN(s) ? null : s,
    isNaN(x) ? null : x
  )
  const contracts =
    !isNaN(e) && !isNaN(s) && e !== s
      ? positionSize(settings.accountSize, settings.riskPerTradePct, e, s)
      : null

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupType,
          entryPrice: isSkip ? null : entry,
          stopPrice: isSkip ? null : stop,
          targetPrice: isSkip ? null : target,
          exitPrice: isSkip ? null : exit,
          vwapSide,
          volumeConfirmed,
          liquiditySwept,
          fvgPresent,
          followedPlan,
          emotionTag: emotion,
          notes,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      router.push("/journal")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mentési hiba")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">
          Nem sikerült menteni: {error}
        </div>
      )}

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Setup</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SETUPS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSetupType(value)}
              className={`rounded-md px-3 py-2.5 text-sm transition-colors ${
                setupType === value
                  ? "bg-accent/15 font-medium text-accent"
                  : "bg-surface-2 text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {!isSkip && (
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold">Árak</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PriceField label="Entry" value={entry} onChange={setEntry} />
            <PriceField label="Stop" value={stop} onChange={setStop} />
            <PriceField label="Target" value={target} onChange={setTarget} />
            <PriceField label="Exit" value={exit} onChange={setExit} />
          </div>

          <div className="num mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md bg-surface-2 px-4 py-3 text-sm">
            <span>
              R-multiple:{" "}
              <strong
                className={
                  r == null
                    ? "text-muted"
                    : r > 0
                      ? "text-win"
                      : r < 0
                        ? "text-loss"
                        : ""
                }
              >
                {formatR(r)}
              </strong>
            </span>
            <span className="text-muted">
              Méret ({settings.riskPerTradePct}% risk):{" "}
              <span className="text-foreground">
                {contracts == null ? "—" : `${contracts} kontrakt`}
              </span>
            </span>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Kontextus és fegyelem</h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs text-muted">Ár a VWAP-hoz képest</p>
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
                  type="button"
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
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted">Érzelmi állapot</p>
            <select
              value={emotion}
              onChange={(ev) => setEmotion(ev.target.value as EmotionTag)}
              className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {EMOTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Toggle
            label="Volume megerősítés (RVOL ≥ 1.2)"
            checked={volumeConfirmed}
            onChange={setVolumeConfirmed}
          />
          <Toggle
            label="Terv szerint léptem be"
            checked={followedPlan}
            onChange={setFollowedPlan}
          />
          <Toggle
            label="Liquidity sweep volt előtte (ICT)"
            checked={liquiditySwept}
            onChange={setLiquiditySwept}
          />
          <Toggle
            label="FVG jelen volt (ICT)"
            checked={fvgPresent}
            onChange={setFvgPresent}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs text-muted">Megjegyzés</label>
          <textarea
            value={notes}
            onChange={(ev) => setNotes(ev.target.value)}
            rows={3}
            placeholder="Mi volt a kontextus? Mit csinálnál másképp?"
            className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-accent/15 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/25 disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {saving ? "Mentés..." : "Trade mentése"}
      </button>
    </form>
  )
}

function PriceField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-muted">{label}</label>
      <input
        type="number"
        step="0.25"
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder="0.00"
        className="num w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md bg-surface-2 px-3 py-2.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(ev) => onChange(ev.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      {label}
    </label>
  )
}
