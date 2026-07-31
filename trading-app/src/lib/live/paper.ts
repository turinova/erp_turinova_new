import type { SupabaseClient } from "@supabase/supabase-js"
import { toEt } from "../et-time"
import type { Bar } from "../backtest/types"
import type { LiveSnapshot } from "./compute"

/**
 * Paper trading motor: az élő signalokat elmenti a live_signals táblába,
 * majd a beérkező 1 perces gyertyákon "papíron" végigköveti őket:
 * stop → loss (-1R), target (2R) → win, session vége → expired (záróáron).
 * Konzervatív feltevés: ha egy gyertyán belül a stop ÉS a target is
 * elérhető lett volna, stopnak számoljuk.
 */

const SESSION_END_MIN = 15 * 60 + 55 // 15:55 ET

export interface SignalRow {
  id: string
  date: string
  kind: string
  bar_time: string
  entry: number
  stop: number
  target: number
}

export async function recordAndEvaluateSignals(
  supabase: SupabaseClient,
  snapshot: LiveSnapshot,
  bars: Bar[],
  source: string
): Promise<void> {
  const sig = snapshot.signal

  // 1) új signal rögzítése (naponta setup-onként egyszer — upsert dedup)
  if (
    sig.kind !== "NONE" &&
    sig.entry != null &&
    sig.stop != null &&
    sig.target20 != null &&
    snapshot.lastBarT != null
  ) {
    await supabase.from("live_signals").upsert(
      {
        date: snapshot.etDate,
        kind: sig.kind,
        bar_time: new Date(snapshot.lastBarT * 1000).toISOString(),
        entry: sig.entry,
        stop: sig.stop,
        target: sig.target20,
        contracts: sig.contracts,
        reason: sig.reason,
        source,
      },
      { onConflict: "date,kind", ignoreDuplicates: true }
    )
  }

  // 2) nyitott signalok kiértékelése
  const { data: open } = await supabase
    .from("live_signals")
    .select("id, date, kind, bar_time, entry, stop, target")
    .eq("status", "open")

  if (!open || open.length === 0) return

  const todayEt = toEt(Math.floor(Date.now() / 1000)).date
  for (const row of open as SignalRow[]) {
    const outcome = evaluateSignal(row, bars, todayEt)
    if (outcome) {
      await supabase.from("live_signals").update(outcome).eq("id", row.id)
    }
  }
}

export function evaluateSignal(
  s: SignalRow,
  bars: Bar[],
  todayEt: string
): Record<string, unknown> | null {
  const isLong = s.kind.endsWith("LONG")
  const entry = Number(s.entry)
  const stop = Number(s.stop)
  const target = Number(s.target)
  const risk = Math.abs(entry - stop)
  if (!risk) return null

  const barTimeSec = Math.floor(new Date(s.bar_time).getTime() / 1000)
  const after = bars.filter(
    (b) => b.t > barTimeSec && toEt(b.t).date === s.date
  )

  let lastClose: { price: number; t: number } | null = null
  for (const b of after) {
    lastClose = { price: b.c, t: b.t }

    const hitStop = isLong ? b.l <= stop : b.h >= stop
    const hitTarget = isLong ? b.h >= target : b.l <= target
    if (hitStop) return outcome("loss", stop, entry, risk, isLong, b.t)
    if (hitTarget) return outcome("win", target, entry, risk, isLong, b.t)

    if (toEt(b.t).minutes >= SESSION_END_MIN) {
      return outcome("expired", b.c, entry, risk, isLong, b.t)
    }
  }

  // régi (nem mai) signal, aminek elfogytak a gyertyái → utolsó ismert áron zárjuk
  if (s.date < todayEt) {
    if (lastClose) {
      return outcome("expired", lastClose.price, entry, risk, isLong, lastClose.t)
    }
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
