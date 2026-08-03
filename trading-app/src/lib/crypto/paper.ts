import type { SupabaseClient } from "@supabase/supabase-js"
import type { Bar } from "../backtest/types"
import type { CryptoSnapshot, SymbolSnapshot } from "./types"

/**
 * Crypto paper trading motor — az NQ-stól függetlenül, a crypto_signals
 * táblába dolgozik. A crypto 24/7 megy, ezért nincs session-zárás:
 * a pozíció max. 12 órán át él, utána a záróáron expired.
 * Konzervatív feltevés: ha egy gyertyán belül a stop ÉS a target is
 * elérhető lett volna, stopnak számoljuk.
 */

const MAX_HOLD_SEC = 12 * 3600

export interface CryptoSignalRow {
  id: string
  symbol: string
  kind: string
  bar_time: string
  entry: number
  stop: number
  target: number
}

export type PaperWriteResult = {
  attempted: number
  saved: number
  errors: string[]
}

export async function recordAndEvaluateCryptoSignals(
  supabase: SupabaseClient,
  snapshot: CryptoSnapshot,
  barsBySymbol: Record<string, Bar[]>
): Promise<PaperWriteResult> {
  const result: PaperWriteResult = { attempted: 0, saved: 0, errors: [] }

  for (const s of snapshot.symbols) {
    const sig = s.signal
    if (
      sig.kind === "NONE" ||
      sig.entry == null ||
      sig.stop == null ||
      sig.target == null ||
      s.lastBarT == null
    )
      continue

    result.attempted++
    const write = await upsertSignal(supabase, snapshot, s)
    if (write.ok) result.saved++
    else {
      result.errors.push(`${s.symbol} ${sig.kind}: ${write.error}`)
      console.error("Crypto paper upsert hiba:", write.error)
    }
  }

  const { data: open, error: openErr } = await supabase
    .from("crypto_signals")
    .select("id, symbol, kind, bar_time, entry, stop, target")
    .eq("status", "open")

  if (openErr) {
    result.errors.push(`open select: ${openErr.message}`)
    console.error("Crypto paper open select hiba:", openErr.message)
    return result
  }

  if (!open || open.length === 0) return result

  const nowSec = Math.floor(Date.now() / 1000)
  for (const row of open as CryptoSignalRow[]) {
    const bars = barsBySymbol[row.symbol]
    if (!bars) continue
    const outcome = evaluateCryptoSignal(row, bars, nowSec)
    if (outcome) {
      const { error } = await supabase.from("crypto_signals").update(outcome).eq("id", row.id)
      if (error) {
        result.errors.push(`evaluate ${row.kind}: ${error.message}`)
        console.error("Crypto paper evaluate hiba:", error.message)
      }
    }
  }

  return result
}

async function upsertSignal(
  supabase: SupabaseClient,
  snapshot: CryptoSnapshot,
  s: SymbolSnapshot
): Promise<{ ok: boolean; error?: string }> {
  const sig = s.signal
  const base = {
    date: snapshot.utcDate,
    symbol: s.symbol,
    kind: sig.kind,
    bar_time: new Date((s.lastBarT as number) * 1000).toISOString(),
    entry: sig.entry as number,
    stop: sig.stop as number,
    target: sig.target as number,
    reason: sig.reason,
    btc_regime: snapshot.btc.regime,
    funding_rate: s.fundingRate,
    rvol: s.rvol,
    source: snapshot.source,
  }

  const withContext = {
    ...base,
    oi_delta_1h: s.oiDelta1hPct,
    catalyst_mode: s.catalystMode,
    settlement_freeze: snapshot.context?.settlement.inFreeze ?? false,
    context_note: [
      s.oiRegime !== "unknown" ? `OI:${s.oiRegime}` : null,
      s.catalystMode ? "catalyst" : null,
      snapshot.context?.settlement.inFreeze ? "settlement-freeze" : null,
    ]
      .filter(Boolean)
      .join(" · ") || null,
  }

  const opts = { onConflict: "date,symbol,kind", ignoreDuplicates: true } as const

  let { error } = await supabase.from("crypto_signals").upsert(withContext, opts)

  // 005 oszlopok hiányozhatnak — próbáljuk kontextus nélkül
  if (error && /oi_delta_1h|catalyst_mode|settlement_freeze|context_note|column/i.test(error.message)) {
    console.warn("Crypto paper: kontextus-oszlopok hiányoznak, mentés alapmezőkkel. Futtasd: sql/005_crypto_context.sql")
    ;({ error } = await supabase.from("crypto_signals").upsert(base, opts))
  }

  if (error) {
    let hint = error.message
    if (/check|kind|violates/i.test(error.message)) {
      hint += " — futtasd a sql/006_crypto_setups_v2.sql scriptet (FVG kind-ok)."
    } else if (/relation|does not exist|schema cache/i.test(error.message)) {
      hint += " — futtasd a sql/004_crypto_signals.sql scriptet."
    }
    return { ok: false, error: hint }
  }

  return { ok: true }
}

export function evaluateCryptoSignal(
  s: CryptoSignalRow,
  bars: Bar[],
  nowSec: number
): Record<string, unknown> | null {
  const isLong = s.kind.endsWith("LONG")
  const entry = Number(s.entry)
  const stop = Number(s.stop)
  const target = Number(s.target)
  const risk = Math.abs(entry - stop)
  if (!risk) return null

  const barTimeSec = Math.floor(new Date(s.bar_time).getTime() / 1000)
  const deadline = barTimeSec + MAX_HOLD_SEC
  const after = bars.filter((b) => b.t > barTimeSec)

  let lastClose: { price: number; t: number } | null = null
  for (const b of after) {
    lastClose = { price: b.c, t: b.t }

    const hitStop = isLong ? b.l <= stop : b.h >= stop
    const hitTarget = isLong ? b.h >= target : b.l <= target
    if (hitStop) return outcome("loss", stop, entry, risk, isLong, b.t)
    if (hitTarget) return outcome("win", target, entry, risk, isLong, b.t)

    if (b.t >= deadline) {
      return outcome("expired", b.c, entry, risk, isLong, b.t)
    }
  }

  if (nowSec >= deadline) {
    if (lastClose) return outcome("expired", lastClose.price, entry, risk, isLong, lastClose.t)
    return { status: "expired", exited_at: new Date().toISOString() }
  }

  return null
}

function outcome(
  status: "win" | "loss" | "expired",
  exitPrice: number,
  entry: number,
  risk: number,
  isLong: boolean,
  tSec: number
): Record<string, unknown> {
  const r = ((exitPrice - entry) / risk) * (isLong ? 1 : -1)
  return {
    status,
    exit_price: exitPrice,
    exited_at: new Date(tSec * 1000).toISOString(),
    r_multiple: Math.round(r * 100) / 100,
  }
}
