import type { SupabaseClient } from "@supabase/supabase-js"
import type { Bar } from "../backtest/types"
import type { CryptoSnapshot, SymbolSnapshot } from "./types"
import {
  applyNetR,
  DEFAULT_PAPER_COSTS,
  DEFAULT_TP1_FRAC,
  describePaperCostModel,
  PAPER_EVAL_VERSION,
  partialCostR,
  roundTripCostR,
  type ExitReason,
  type PaperCostParams,
} from "./paper-costs"
import {
  BE_FEE_BUFFER_PCT,
  beStopPrice,
  chandelierTrail,
  mfeR,
  ratchetStop,
  TRAIL_ACTIVATE_R,
  TRAIL_ATR_MULT,
} from "./stop-policy"
import { atr as atrWilder, aggregate } from "./indicators"

/**
 * Crypto paper trading motor — az NQ-stól függetlenül, a crypto_signals
 * táblába dolgozik. A crypto 24/7 megy, ezért nincs session-zárás:
 * a pozíció max. 12 órán át él, utána a záróáron expired.
 *
 * Exit terv (ha a target ≥ tp1R):
 *   ~35% @ +1.25R → SL @ BE+fee → +2R MFE-nél ATR trail → runner @ target / trail / expire
 * Ha a target < tp1R (pl. szűk MR), nincs partial — full exit a targeten.
 * Konzervatív: egy gyertyán belül stop/BE előtt a targetnél.
 *
 * paper-v2: gross R + fee/slip → net R (r_multiple), exit_reason audit.
 */

const MAX_HOLD_SEC = 12 * 3600
/** Survivor: kisebb partial → több runner, kevesebb fee a 1R-en */
export const PARTIAL_FRAC = DEFAULT_TP1_FRAC
const DEFAULT_TP1_R = 1.25
const FILL_MODEL = "ohlc_conservative_v1"

/** Paper / live exit policy — A/B és desk finomhangoláshoz */
export type ExitEvalPolicy = {
  beFeeBufferPct: number
  trailEnabled: boolean
  trailActivateR: number
  trailAtrMult: number
  /** partial scale-out R (1.25 = +1.25R) */
  tp1R: number
  /** TP1 méret arány (0.35 = 35%) */
  tp1Frac: number
  /** true = runner csak trail/BE/expire — nincs merev TP2 */
  runnerOnly: boolean
}

/** Régi: exact BE, nincs trail, 50%@1R */
export const EXIT_POLICY_LEGACY: ExitEvalPolicy = {
  beFeeBufferPct: 0,
  trailEnabled: false,
  trailActivateR: 1.5,
  trailAtrMult: 1.75,
  tp1R: 1.0,
  tp1Frac: 0.5,
  runnerOnly: false,
}

/** Survivor: BE+fee + késleltetett ATR trail, 35%@1.25R */
export const EXIT_POLICY_V2: ExitEvalPolicy = {
  beFeeBufferPct: BE_FEE_BUFFER_PCT,
  trailEnabled: true,
  trailActivateR: TRAIL_ACTIVATE_R,
  trailAtrMult: TRAIL_ATR_MULT,
  tp1R: DEFAULT_TP1_R,
  tp1Frac: PARTIAL_FRAC,
  runnerOnly: false,
}

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
  evaluated: number
  stuckOpen: number
  missingBars: number
  costModel: string
}

export type PaperOutcome = {
  status: "win" | "loss" | "expired"
  exit_price: number | null
  exited_at: string
  r_multiple_gross: number
  r_multiple: number
  fees_r: number
  slippage_r: number
  exit_reason: ExitReason
  partial: boolean
  scale_plan: string | null
  tp1_price: number | null
  fill_model: string
  eval_version: string
}

/** Élő UI / chart: TP1 ár, ha a partial terv aktív. */
export function partialTp1Price(
  entry: number,
  stop: number,
  target: number,
  tp1R: number = DEFAULT_TP1_R
): number | null {
  const risk = Math.abs(entry - stop)
  if (risk <= 0) return null
  const toTarget = Math.abs(target - entry)
  if (toTarget < tp1R * risk - 1e-9) return null
  const isLong = target > entry
  return isLong ? entry + tp1R * risk : entry - tp1R * risk
}

export function describeExitPlan(
  entry: number,
  stop: number,
  target: number,
  policy: ExitEvalPolicy = EXIT_POLICY_V2
): string {
  const tp1 = partialTp1Price(entry, stop, target, policy.tp1R)
  if (tp1 == null) return `Full size a targetig (cél < ${policy.tp1R}R — nincs scale)`
  const pct = Math.round((policy.tp1Frac ?? PARTIAL_FRAC) * 100)
  const rest = 100 - pct
  const runner = policy.runnerOnly
    ? "runner trail-only"
    : `${rest}% runner @ ~${(Math.abs(target - entry) / Math.abs(entry - stop)).toFixed(1)}R`
  return `${pct}% @ ${policy.tp1R}R → SL@BE+fee → trail @ ${policy.trailActivateR}R · ${runner}`
}

export { describePaperCostModel, PAPER_EVAL_VERSION }

export async function recordAndEvaluateCryptoSignals(
  supabase: SupabaseClient,
  snapshot: CryptoSnapshot,
  barsBySymbol: Record<string, Bar[]>
): Promise<PaperWriteResult> {
  const result: PaperWriteResult = {
    attempted: 0,
    saved: 0,
    errors: [],
    evaluated: 0,
    stuckOpen: 0,
    missingBars: 0,
    costModel: describePaperCostModel(),
  }

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
    if (!bars || bars.length === 0) {
      result.missingBars++
      const barTimeSec = Math.floor(new Date(row.bar_time).getTime() / 1000)
      if (nowSec >= barTimeSec + MAX_HOLD_SEC) {
        const gap = dataGapExpire(row, nowSec)
        const ok = await patchOutcome(supabase, row.id, gap, result.errors)
        if (ok) {
          result.evaluated++
          result.stuckOpen++
        }
      }
      continue
    }

    const outcome = evaluateCryptoSignal(row, bars, nowSec)
    if (outcome) {
      const ok = await patchOutcome(supabase, row.id, outcome, result.errors)
      if (ok) result.evaluated++
    }
  }

  return result
}

async function patchOutcome(
  supabase: SupabaseClient,
  id: string,
  outcome: PaperOutcome,
  errors: string[]
): Promise<boolean> {
  const full = {
    status: outcome.status,
    exit_price: outcome.exit_price,
    exited_at: outcome.exited_at,
    r_multiple: outcome.r_multiple,
    r_multiple_gross: outcome.r_multiple_gross,
    fees_r: outcome.fees_r,
    slippage_r: outcome.slippage_r,
    exit_reason: outcome.exit_reason,
    scale_plan: outcome.scale_plan,
    partial: outcome.partial,
    tp1_price: outcome.tp1_price,
    fill_model: outcome.fill_model,
    eval_version: outcome.eval_version,
  }

  let { error } = await supabase.from("crypto_signals").update(full).eq("id", id)

  if (error && /r_multiple_gross|fees_r|exit_reason|scale_plan|eval_version|fill_model|column/i.test(error.message)) {
    console.warn(
      "Crypto paper: audit oszlopok hiányoznak — csak alapmezők. Futtasd: sql/008_crypto_paper_audit.sql"
    )
    ;({ error } = await supabase
      .from("crypto_signals")
      .update({
        status: outcome.status,
        exit_price: outcome.exit_price,
        exited_at: outcome.exited_at,
        r_multiple: outcome.r_multiple,
      })
      .eq("id", id))
  }

  if (error) {
    errors.push(`evaluate: ${error.message}`)
    console.error("Crypto paper evaluate hiba:", error.message)
    return false
  }
  return true
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

function splitCostR(totalCostR: number, costs: PaperCostParams = DEFAULT_PAPER_COSTS): {
  fees_r: number
  slippage_r: number
} {
  const feePart = costs.feeBpsPerSide
  const slipPart = costs.slipBpsPerFill
  const sum = feePart + slipPart
  if (sum <= 0) return { fees_r: 0, slippage_r: 0 }
  return {
    fees_r: Math.round(((totalCostR * feePart) / sum) * 1000) / 1000,
    slippage_r: Math.round(((totalCostR * slipPart) / sum) * 1000) / 1000,
  }
}

function finalize(
  status: "win" | "loss" | "expired",
  exitPrice: number | null,
  tSec: number,
  grossR: number,
  costR: number,
  exitReason: ExitReason,
  opts: { partial: boolean; tp1: number | null; scale?: string | null }
): PaperOutcome {
  const { fees_r, slippage_r } = splitCostR(costR)
  return {
    status,
    exit_price: exitPrice,
    exited_at: new Date(tSec * 1000).toISOString(),
    r_multiple_gross: Math.round(grossR * 100) / 100,
    r_multiple: applyNetR(grossR, costR),
    fees_r,
    slippage_r,
    exit_reason: exitReason,
    partial: opts.partial,
    scale_plan: opts.scale ?? (opts.partial ? "partial_1r_be_2r" : null),
    tp1_price: opts.tp1,
    fill_model: FILL_MODEL,
    eval_version: PAPER_EVAL_VERSION,
  }
}

function dataGapExpire(s: CryptoSignalRow, nowSec: number): PaperOutcome {
  const entry = Number(s.entry)
  const stop = Number(s.stop)
  const risk = Math.abs(entry - stop) || 1
  const costR = roundTripCostR(entry, entry, risk)
  return finalize("expired", null, nowSec, 0, costR, "data_gap", {
    partial: false,
    tp1: partialTp1Price(entry, stop, Number(s.target)),
  })
}

export function evaluateCryptoSignal(
  s: CryptoSignalRow,
  bars: Bar[],
  nowSec: number,
  costs: PaperCostParams = DEFAULT_PAPER_COSTS,
  policy: ExitEvalPolicy = EXIT_POLICY_V2
): PaperOutcome | null {
  const isLong = s.kind.endsWith("LONG")
  const dir = isLong ? ("long" as const) : ("short" as const)
  const entry = Number(s.entry)
  const stop = Number(s.stop)
  const target = Number(s.target)
  const risk = Math.abs(entry - stop)
  if (!risk) return null

  const barTimeSec = Math.floor(new Date(s.bar_time).getTime() / 1000)
  const deadline = barTimeSec + MAX_HOLD_SEC
  const after = bars.filter((b) => b.t > barTimeSec)

  const tp1R = Math.max(0.5, policy.tp1R)
  const tp1Frac = Math.min(0.9, Math.max(0.1, policy.tp1Frac ?? PARTIAL_FRAC))
  const runnerFrac = 1 - tp1Frac
  const tp1 = partialTp1Price(entry, stop, target, tp1R)
  const usePartial = tp1 != null
  const bePrice = beStopPrice(entry, dir, policy.beFeeBufferPct)

  let atrLive = atrWilder(aggregate(bars, 5)) ?? risk / 0.85

  let tp1Done = false
  let trailArmed = false
  let liveStop = stop
  let highWater = entry
  let lowWater = entry
  let lastClose: { price: number; t: number } | null = null

  for (const b of after) {
    lastClose = { price: b.c, t: b.t }
    const atrNow = atrWilder(aggregate(bars.filter((x) => x.t <= b.t), 5))
    if (atrNow != null && atrNow > 0) atrLive = atrNow

    if (!usePartial || !tp1Done) {
      const hitStop = isLong ? b.l <= stop : b.h >= stop
      const hitTp1 = usePartial
        ? isLong
          ? b.h >= (tp1 as number)
          : b.l <= (tp1 as number)
        : false
      const hitTarget = isLong ? b.h >= target : b.l <= target

      if (hitStop) {
        const gross = -1
        const costR = roundTripCostR(entry, stop, risk, costs)
        return finalize("loss", stop, b.t, gross, costR, "stop", {
          partial: false,
          tp1,
        })
      }
      if (hitTarget) {
        const gross = targetR(entry, target, risk, isLong)
        const costR = roundTripCostR(entry, target, risk, costs)
        const reason: ExitReason = usePartial ? "gap_target" : "target_lt_1r"
        return finalize("win", target, b.t, gross, costR, reason, {
          partial: false,
          tp1,
        })
      }

      if (usePartial && hitTp1) {
        tp1Done = true
        liveStop = bePrice
        highWater = isLong ? Math.max(highWater, b.h, tp1 as number) : highWater
        lowWater = isLong ? lowWater : Math.min(lowWater, b.l, tp1 as number)
        continue
      }
    } else {
      highWater = Math.max(highWater, b.h)
      lowWater = Math.min(lowWater, b.l)
      const extreme = isLong ? highWater : lowWater
      const mfe = mfeR({ entry, stop, extreme, dir })

      if (policy.trailEnabled && !trailArmed && mfe >= policy.trailActivateR) {
        trailArmed = true
      }
      if (policy.trailEnabled && trailArmed) {
        const trail = chandelierTrail({
          extreme,
          atr: atrLive,
          dir,
          mult: policy.trailAtrMult,
        })
        liveStop = ratchetStop(liveStop, ratchetStop(bePrice, trail, dir), dir)
      }

      const hitProtective = isLong ? b.l <= liveStop : b.h >= liveStop
      const hitTarget = !policy.runnerOnly && (isLong ? b.h >= target : b.l <= target)

      if (hitProtective && hitTarget) {
        const exitPx = liveStop
        const runner = targetR(entry, exitPx, risk, isLong)
        const gross = tp1Frac * tp1R + runnerFrac * Math.max(0, runner)
        const costR = partialCostR(entry, tp1 as number, exitPx, risk, costs, tp1Frac)
        const reason: ExitReason = trailArmed ? "tp1_then_trail" : "tp1_then_be"
        return finalize("win", exitPx, b.t, gross, costR, reason, {
          partial: true,
          tp1,
          scale: trailArmed ? "partial_trail" : "partial_be",
        })
      }
      if (hitProtective) {
        const exitPx = liveStop
        const runner = targetR(entry, exitPx, risk, isLong)
        const gross = tp1Frac * tp1R + runnerFrac * runner
        const costR = partialCostR(entry, tp1 as number, exitPx, risk, costs, tp1Frac)
        const reason: ExitReason = trailArmed ? "tp1_then_trail" : "tp1_then_be"
        return finalize(gross >= 0 ? "win" : "loss", exitPx, b.t, gross, costR, reason, {
          partial: true,
          tp1,
          scale: trailArmed ? "partial_trail" : "partial_be",
        })
      }
      if (hitTarget) {
        const runner = targetR(entry, target, risk, isLong)
        const gross = tp1Frac * tp1R + runnerFrac * runner
        const costR = partialCostR(entry, tp1 as number, target, risk, costs, tp1Frac)
        return finalize("win", target, b.t, gross, costR, "tp1_then_tp2", {
          partial: true,
          tp1,
          scale: "partial_tp2",
        })
      }
    }

    if (b.t >= deadline) {
      return expireAt(b.c, entry, stop, target, risk, isLong, b.t, tp1Done, tp1, costs, tp1R, tp1Frac)
    }
  }

  if (nowSec >= deadline) {
    if (lastClose) {
      return expireAt(
        lastClose.price,
        entry,
        stop,
        target,
        risk,
        isLong,
        lastClose.t,
        tp1Done,
        tp1,
        costs,
        tp1R,
        tp1Frac
      )
    }
    const costR = roundTripCostR(entry, entry, risk, costs)
    return finalize("expired", null, nowSec, 0, costR, "data_gap", {
      partial: tp1Done,
      tp1,
      scale: tp1Done ? "partial_be" : null,
    })
  }

  return null
}

function targetR(entry: number, target: number, risk: number, isLong: boolean): number {
  return ((target - entry) / risk) * (isLong ? 1 : -1)
}

function expireAt(
  price: number,
  entry: number,
  _stop: number,
  _target: number,
  risk: number,
  isLong: boolean,
  tSec: number,
  tp1Done: boolean,
  tp1: number | null,
  costs: PaperCostParams,
  tp1R: number = DEFAULT_TP1_R,
  tp1Frac: number = PARTIAL_FRAC
): PaperOutcome {
  const openR = ((price - entry) / risk) * (isLong ? 1 : -1)
  if (tp1Done && tp1 != null) {
    const frac = Math.min(0.9, Math.max(0.1, tp1Frac))
    const gross = frac * tp1R + (1 - frac) * openR
    const costR = partialCostR(entry, tp1, price, risk, costs, frac)
    return finalize("expired", price, tSec, gross, costR, "tp1_then_expire", {
      partial: true,
      tp1,
      scale: "partial_expire",
    })
  }
  const costR = roundTripCostR(entry, price, risk, costs)
  return finalize("expired", price, tSec, openR, costR, "expire", {
    partial: false,
    tp1,
  })
}
