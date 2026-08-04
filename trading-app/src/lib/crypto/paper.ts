import type { SupabaseClient } from "@supabase/supabase-js"
import type { Bar } from "../backtest/types"
import type { CryptoSnapshot, SymbolSnapshot } from "./types"

/**
 * Crypto paper trading motor — az NQ-stól függetlenül, a crypto_signals
 * táblába dolgozik. A crypto 24/7 megy, ezért nincs session-zárás:
 * a pozíció max. 12 órán át él, utána a záróáron expired.
 *
 * Exit terv (ha a target ≥ 1R):
 *   50% @ +1R → stop a maradékon BE-re → 50% @ 2R (vagy BE / expire)
 * Ha a target < 1R (pl. szűk MR), nincs partial — full exit a targeten.
 * Konzervatív: egy gyertyán belül stop/BE előtt a targetnél.
 */

const MAX_HOLD_SEC = 12 * 3600
const PARTIAL_FRAC = 0.5
const TP1_R = 1.0

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

/** Élő UI / chart: TP1 ár, ha a partial terv aktív. */
export function partialTp1Price(entry: number, stop: number, target: number): number | null {
  const risk = Math.abs(entry - stop)
  if (risk <= 0) return null
  const toTarget = Math.abs(target - entry)
  if (toTarget < TP1_R * risk - 1e-9) return null
  const isLong = target > entry
  return isLong ? entry + TP1_R * risk : entry - TP1_R * risk
}

export function describeExitPlan(entry: number, stop: number, target: number): string {
  const tp1 = partialTp1Price(entry, stop, target)
  if (tp1 == null) return "Full size a targetig (cél < 1R — nincs scale)"
  return "50% @ 1R → stop BE · 50% runner @ 2R"
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
      // DB csak az ismert oszlopokat kapja (partial/scale_plan csak engine meta)
      const patch = {
        status: outcome.status,
        exit_price: outcome.exit_price ?? null,
        exited_at: outcome.exited_at ?? null,
        r_multiple: outcome.r_multiple ?? null,
      }
      const { error } = await supabase.from("crypto_signals").update(patch).eq("id", row.id)
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

  const tp1 = partialTp1Price(entry, stop, target)
  const usePartial = tp1 != null

  let tp1Done = false
  let lastClose: { price: number; t: number } | null = null

  for (const b of after) {
    lastClose = { price: b.c, t: b.t }

    if (!usePartial || !tp1Done) {
      const hitStop = isLong ? b.l <= stop : b.h >= stop
      const hitTp1 = usePartial
        ? isLong
          ? b.h >= (tp1 as number)
          : b.l <= (tp1 as number)
        : false
      const hitTarget = isLong ? b.h >= target : b.l <= target

      // konzervatív: stop előbb; ha a target is elért partial előtt → full size (gap-through)
      if (hitStop) return outcome("loss", stop, entry, risk, isLong, b.t, false)
      if (hitTarget) return outcome("win", target, entry, risk, isLong, b.t, false)

      if (usePartial && hitTp1) {
        // TP1 fill ezen a gyertyán — a wick-et nem számoljuk BE-nek;
        // a runner stopja a következő báron lép érvénybe.
        tp1Done = true
        continue
      }
    } else {
      // runner: stop = BE (entry)
      const hitBe = isLong ? b.l <= entry : b.h >= entry
      const hitTarget = isLong ? b.h >= target : b.l <= target
      if (hitBe && hitTarget) return blended("win", entry, entry, risk, isLong, b.t, TP1_R, 0)
      if (hitBe) return blended("win", entry, entry, risk, isLong, b.t, TP1_R, 0)
      if (hitTarget)
        return blended("win", target, entry, risk, isLong, b.t, TP1_R, targetR(entry, target, risk, isLong))
    }

    if (b.t >= deadline) {
      return expireAt(b.c, entry, risk, isLong, b.t, tp1Done)
    }
  }

  if (nowSec >= deadline) {
    if (lastClose) return expireAt(lastClose.price, entry, risk, isLong, lastClose.t, tp1Done)
    return { status: "expired", exited_at: new Date().toISOString(), partial: tp1Done }
  }

  return null
}

function targetR(entry: number, target: number, risk: number, isLong: boolean): number {
  return ((target - entry) / risk) * (isLong ? 1 : -1)
}

function expireAt(
  price: number,
  entry: number,
  risk: number,
  isLong: boolean,
  tSec: number,
  tp1Done: boolean
): Record<string, unknown> {
  const openR = ((price - entry) / risk) * (isLong ? 1 : -1)
  if (tp1Done) {
    return blended("expired", price, entry, risk, isLong, tSec, TP1_R, openR)
  }
  return outcome("expired", price, entry, risk, isLong, tSec, false)
}

function blended(
  status: "win" | "loss" | "expired",
  exitPrice: number,
  entry: number,
  risk: number,
  isLong: boolean,
  tSec: number,
  firstLegR: number,
  secondLegR: number
): Record<string, unknown> {
  const r = PARTIAL_FRAC * firstLegR + (1 - PARTIAL_FRAC) * secondLegR
  return {
    status,
    exit_price: exitPrice,
    exited_at: new Date(tSec * 1000).toISOString(),
    r_multiple: Math.round(r * 100) / 100,
    partial: true,
    scale_plan: "partial_1r_be_2r",
  }
}

function outcome(
  status: "win" | "loss" | "expired",
  exitPrice: number,
  entry: number,
  risk: number,
  isLong: boolean,
  tSec: number,
  partial: boolean
): Record<string, unknown> {
  const r = ((exitPrice - entry) / risk) * (isLong ? 1 : -1)
  return {
    status,
    exit_price: exitPrice,
    exited_at: new Date(tSec * 1000).toISOString(),
    r_multiple: Math.round(r * 100) / 100,
    ...(partial ? { partial: true, scale_plan: "partial_1r_be_2r" } : {}),
  }
}
