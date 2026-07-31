"use client"

import { useState } from "react"
import type { Catalyst, CatalystSeverity, MarketContext } from "@/lib/crypto/types"

interface Props {
  context: MarketContext
  onCreated?: () => void
}

export function ContextStrip({ context, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const allNews = [
    ...context.btcCatalysts,
    ...context.sol.catalysts,
    ...context.doge.catalysts,
  ]
  // dedup by title
  const seen = new Set<string>()
  const news = allNews.filter((c) => {
    if (seen.has(c.title)) return false
    seen.add(c.title)
    return true
  }).slice(0, 6)

  return (
    <section className="rounded-lg border border-line bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <SettlementBadge s={context.settlement} />
        <span className="text-sm">
          <span className="text-xs text-muted">SOL OI 1h: </span>
          <span className="num font-medium">{fmtDelta(context.sol.oiDelta1hPct)}</span>
          <span className="ml-1 text-xs text-muted">({context.sol.oiRegime})</span>
        </span>
        <span className="text-sm">
          <span className="text-xs text-muted">DOGE OI 1h: </span>
          <span className="num font-medium">{fmtDelta(context.doge.oiDelta1hPct)}</span>
          <span className="ml-1 text-xs text-muted">({context.doge.oiRegime})</span>
        </span>
        {context.doge.catalystMode ? (
          <span className="rounded-full bg-warn/15 px-2.5 py-1 text-xs font-semibold text-warn">
            DOGE KATALIZÁTOR · RVOL≥{context.doge.rvolGate}
          </span>
        ) : (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
            DOGE RVOL≥{context.doge.rvolGate}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium hover:border-accent"
        >
          + Manuális katalizátor
        </button>
      </div>

      {open && <ManualCatalystForm onDone={() => { setOpen(false); onCreated?.() }} />}

      {news.length > 0 && (
        <ul className="space-y-1.5 border-t border-line pt-3">
          {news.map((c) => (
            <NewsRow key={c.id ?? c.title} c={c} />
          ))}
        </ul>
      )}
      {news.length === 0 && (
        <p className="border-t border-line pt-3 text-xs text-muted">
          Nincs aktív hír/katalizátor. CryptoPanic vagy manuális bejegyzés után itt jelennek meg.
        </p>
      )}
    </section>
  )
}

function SettlementBadge({
  s,
}: {
  s: MarketContext["settlement"]
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        s.inFreeze ? "bg-warn/15 text-warn" : "bg-surface-2 text-muted"
      }`}
    >
      {s.inFreeze
        ? `SETTLEMENT FREEZE · ${s.nextUtc} UTC`
        : `Settlement ${s.nextUtc} UTC · ${s.minutesLeft}p`}
    </span>
  )
}

function NewsRow({ c }: { c: Catalyst }) {
  const sev =
    c.severity === "high"
      ? "text-loss"
      : c.severity === "med"
        ? "text-warn"
        : "text-muted"
  const body = (
    <span className="text-xs">
      <span className={`font-semibold uppercase ${sev}`}>{c.severity}</span>
      <span className="text-muted"> · {c.symbols.join(",")} · {c.ageMin}p · </span>
      <span>{c.title}</span>
    </span>
  )
  return (
    <li>
      {c.url ? (
        <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline">
          {body}
        </a>
      ) : (
        body
      )}
    </li>
  )
}

function ManualCatalystForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("")
  const [symbols, setSymbols] = useState<string[]>(["DOGE"])
  const [severity, setSeverity] = useState<CatalystSeverity>("high")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function toggleSym(s: string) {
    setSymbols((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch("/api/crypto/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, symbols, severity }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "hiba")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border border-line bg-surface-2/50 p-3">
      <input
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        placeholder="Pl. Elon Musk tweetelt DOGE-ról"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <div className="flex flex-wrap items-center gap-2">
        {["SOL", "DOGE", "BTC"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggleSym(s)}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              symbols.includes(s)
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-line text-muted"
            }`}
          >
            {s}
          </button>
        ))}
        <select
          className="rounded-md border border-line bg-surface px-2 py-1 text-xs"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as CatalystSeverity)}
        >
          <option value="high">high</option>
          <option value="med">med</option>
          <option value="low">low</option>
        </select>
        <button
          type="submit"
          disabled={busy || !title || symbols.length === 0}
          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "…" : "Mentés"}
        </button>
      </div>
      {err && <p className="text-xs text-loss">{err}</p>}
    </form>
  )
}

function fmtDelta(n: number | null): string {
  if (n == null) return "—"
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`
}
