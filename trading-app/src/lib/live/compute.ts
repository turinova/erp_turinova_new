import { RTH_OPEN_MIN, toEt } from "../et-time"
import { positionSize } from "../r-calculator"
import type { Bar, BarFile } from "../backtest/types"
import type { LiveFeed } from "./fetch-live"

export type LiveStatus = "closed" | "preopen" | "orb_forming" | "active"

export type LiveSignalKind =
  | "ORB_LONG"
  | "ORB_SHORT"
  | "FADE_LONG"
  | "FADE_SHORT"
  | "VWAP_LONG"
  | "VWAP_SHORT"
  | "PB_LONG"
  | "PB_SHORT"
  | "NONE"

export interface LiveSignal {
  kind: LiveSignalKind
  reason: string
  entry: number | null
  stop: number | null
  target15: number | null
  target20: number | null
  contracts: number | null
}

export interface LiveSnapshot {
  status: LiveStatus
  etDate: string
  etTime: string
  secondsToOpen: number | null
  secondsToLock: number | null
  /** chart gyertyák (ma 7:00 ET-től) */
  bars: Bar[]
  vwapSeries: { t: number; v: number }[]
  orbHigh: number | null
  orbLow: number | null
  orbLocked: boolean
  overnightHigh: number | null
  overnightLow: number | null
  lastPrice: number | null
  lastBarEt: string | null
  /** az utolsó gyertya epoch ideje (a signal-horgonyzáshoz) */
  lastBarT: number | null
  vwap: number | null
  vwapSide: "above" | "below" | "at" | null
  /** aktuális (utolsó lezárt) 5 perces slot RVOL-ja a 20 napos átlaghoz */
  rvol: number | null
  signal: LiveSignal
  /** napi guardrail üzenet (a route tölti ki a journal alapján) */
  guardrail: string | null
  source: "tradovate" | "yahoo"
  dataNote: string
}

interface ComputeInput {
  feed: LiveFeed
  /** historikus 5m gyertyák az RVOL-átlaghoz (opcionális) */
  history: BarFile | null
  orbMinutes: number
  accountSize: number
  riskPerTradePct: number
  cutoffHourEt: number
  nowSec?: number
}

export function computeLiveSnapshot(input: ComputeInput): LiveSnapshot {
  const now = input.nowSec ?? Math.floor(Date.now() / 1000)
  const nowEt = toEt(now)
  const lockMin = RTH_OPEN_MIN + input.orbMinutes
  const cutoffMin = input.cutoffHourEt * 60

  // csak a "most" előtti gyertyák (szimulált időpontnál is korrekt)
  const allBars = input.feed.bars.filter((b) => b.t <= now)
  const todayBars = allBars.filter((b) => toEt(b.t).date === nowEt.date)
  const rthBars = todayBars.filter((b) => toEt(b.t).minutes >= RTH_OPEN_MIN)

  // overnight: előző nap 18:00-tól ma 9:30-ig
  const overnightBars = allBars.filter((b) => {
    const et = toEt(b.t)
    if (et.date === nowEt.date) return et.minutes < RTH_OPEN_MIN
    return et.minutes >= 18 * 60
  })
  const overnightHigh = overnightBars.length
    ? Math.max(...overnightBars.map((b) => b.h))
    : null
  const overnightLow = overnightBars.length
    ? Math.min(...overnightBars.map((b) => b.l))
    : null

  // státusz
  const isWeekend = [0, 6].includes(new Date(now * 1000).getUTCDay()) // közelítés, a bar-hiány is jelez
  let status: LiveStatus
  if (nowEt.minutes < RTH_OPEN_MIN) status = "preopen"
  else if (nowEt.minutes < lockMin) status = "orb_forming"
  else if (nowEt.minutes < cutoffMin) status = "active"
  else status = "closed"
  if (isWeekend || (status !== "preopen" && rthBars.length === 0)) {
    status = "closed"
  }

  // VWAP az RTH gyertyákon
  let cumPV = 0
  let cumV = 0
  const vwapSeries: { t: number; v: number }[] = []
  for (const b of rthBars) {
    const typical = (b.h + b.l + b.c) / 3
    cumPV += typical * b.v
    cumV += b.v
    vwapSeries.push({
      t: b.t,
      v: cumV > 0 ? Math.round((cumPV / cumV) * 100) / 100 : b.c,
    })
  }
  const vwap = vwapSeries.length ? vwapSeries[vwapSeries.length - 1].v : null

  // ORB
  const orbBars = rthBars.filter((b) => toEt(b.t).minutes < lockMin)
  const orbComplete = nowEt.minutes >= lockMin && orbBars.length > 0
  const orbHigh = orbBars.length ? Math.max(...orbBars.map((b) => b.h)) : null
  const orbLow = orbBars.length ? Math.min(...orbBars.map((b) => b.l)) : null

  const last = rthBars.length
    ? rthBars[rthBars.length - 1]
    : todayBars.length
      ? todayBars[todayBars.length - 1]
      : null
  const lastPrice = last?.c ?? null

  const vwapSide =
    lastPrice == null || vwap == null
      ? null
      : Math.abs(lastPrice - vwap) < 2
        ? "at"
        : lastPrice > vwap
          ? "above"
          : "below"

  const rvol = computeRvol(rthBars, input.history, nowEt.date)

  const signal = computeSignal({
    status,
    rthBars,
    orbComplete,
    orbHigh,
    orbLow,
    orbMinutes: input.orbMinutes,
    vwapSeries,
    rvol,
    accountSize: input.accountSize,
    riskPerTradePct: input.riskPerTradePct,
  })

  // chart: ma 7:00 ET-től; ha még nincs ilyen gyertya (kora reggel),
  // az utolsó ~2 óra overnight adatát mutatjuk kontextusnak
  let chartBars = todayBars.filter((b) => toEt(b.t).minutes >= 7 * 60)
  if (chartBars.length === 0) {
    chartBars = allBars.slice(-120)
  }

  const ageMin = last ? Math.round((now - last.t) / 60) : null

  return {
    status,
    etDate: nowEt.date,
    etTime: nowEt.time,
    secondsToOpen:
      status === "preopen" ? (RTH_OPEN_MIN - nowEt.minutes) * 60 - nowEt.seconds : null,
    secondsToLock:
      status === "orb_forming" ? (lockMin - nowEt.minutes) * 60 - nowEt.seconds : null,
    bars: chartBars,
    vwapSeries,
    orbHigh: orbComplete ? orbHigh : null,
    orbLow: orbComplete ? orbLow : null,
    orbLocked: orbComplete,
    overnightHigh,
    overnightLow,
    lastPrice,
    lastBarEt: last ? toEt(last.t).time : null,
    lastBarT: last?.t ?? null,
    vwap,
    vwapSide,
    rvol,
    signal,
    guardrail: null,
    source: input.feed.source,
    dataNote:
      input.feed.source === "tradovate"
        ? `Tradovate real-time feed (${input.feed.symbol}).`
        : ageMin != null && ageMin > 3
          ? `Utolsó gyertya ${ageMin} perce (Yahoo delay) — entry-időzítésre a TradingView a mérvadó.`
          : "Yahoo feed — kb. valós idejű, de nem garantált.",
  }
}

/** Az utolsó lezárt 5 perces slot volumene vs. az előző 20 session azonos slotja. */
function computeRvol(
  rthBars: Bar[],
  history: BarFile | null,
  todayDate: string
): number | null {
  if (!history || rthBars.length < 5) return null

  // mai 1m gyertyák → 5m slotok
  const slotVol = new Map<number, number>()
  for (const b of rthBars) {
    const et = toEt(b.t)
    const slot = Math.floor((et.minutes - RTH_OPEN_MIN) / 5)
    slotVol.set(slot, (slotVol.get(slot) ?? 0) + b.v)
  }
  const lastSlot = Math.max(...slotVol.keys())
  // az utolsó slot lehet csonka → az utolsó ELŐTTI lezárt slotot mérjük, ha van
  const slot = lastSlot > 0 ? lastSlot - 1 : lastSlot
  const current = slotVol.get(slot)
  if (!current) return null

  // historikus átlag ugyanarra a slotra (max 20 legutóbbi session, a mai nélkül)
  const byDate = new Map<string, number>()
  for (const b of history.bars) {
    const et = toEt(b.t)
    if (et.date === todayDate) continue
    if (et.minutes < RTH_OPEN_MIN) continue
    const s = Math.floor((et.minutes - RTH_OPEN_MIN) / 5)
    if (s !== slot) continue
    byDate.set(et.date, b.v)
  }
  const samples = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-20)
    .map(([, v]) => v)
    .filter((v) => v > 0)
  if (samples.length < 5) return null

  const avg = samples.reduce((a, b) => a + b, 0) / samples.length
  return avg > 0 ? Math.round((current / avg) * 100) / 100 : null
}

function computeSignal(input: {
  status: LiveStatus
  rthBars: Bar[]
  orbComplete: boolean
  orbHigh: number | null
  orbLow: number | null
  orbMinutes: number
  vwapSeries: { t: number; v: number }[]
  rvol: number | null
  accountSize: number
  riskPerTradePct: number
}): LiveSignal {
  const none = (reason: string): LiveSignal => ({
    kind: "NONE",
    reason,
    entry: null,
    stop: null,
    target15: null,
    target20: null,
    contracts: null,
  })

  if (input.status === "closed") return none("A session zárva.")
  if (input.status === "preopen") return none("A piac 9:30 ET-kor nyit.")
  if (input.status === "orb_forming" || !input.orbComplete || input.orbHigh == null || input.orbLow == null)
    return none("Az ORB még formálódik — 9:45 ET-kor rögzül.")

  const { rthBars, orbHigh, orbLow } = input
  const lockIdx = rthBars.findIndex(
    (b) => toEt(b.t).minutes >= RTH_OPEN_MIN + input.orbMinutes
  )
  const postOrb = lockIdx >= 0 ? rthBars.slice(lockIdx) : []
  if (postOrb.length === 0) return none("Várakozás az első ORB utáni gyertyára.")

  // breakout és fade detektálás 1m záróárakon
  let breakoutDir: "up" | "down" | null = null
  let breakoutIdx = -1
  let breakoutClose = 0
  let extreme = 0
  let fade: { dir: "long" | "short"; entry: number; stop: number } | null = null

  for (let i = 0; i < postOrb.length; i++) {
    const b = postOrb[i]
    if (!breakoutDir) {
      if (b.c > orbHigh) {
        breakoutDir = "up"
        breakoutIdx = i
        breakoutClose = b.c
        extreme = b.h
      } else if (b.c < orbLow) {
        breakoutDir = "down"
        breakoutIdx = i
        breakoutClose = b.c
        extreme = b.l
      }
      continue
    }
    // breakout után: extrém frissítés + fade figyelés (30 percen belül)
    if (breakoutDir === "up") {
      extreme = Math.max(extreme, b.h)
      if (i - breakoutIdx <= 30 && b.c < orbHigh && !fade) {
        fade = { dir: "short", entry: b.c, stop: extreme }
      }
    } else {
      extreme = Math.min(extreme, b.l)
      if (i - breakoutIdx <= 30 && b.c > orbLow && !fade) {
        fade = { dir: "long", entry: b.c, stop: extreme }
      }
    }
  }

  const lastBar = postOrb[postOrb.length - 1]
  const lastVwap = input.vwapSeries.length
    ? input.vwapSeries[input.vwapSeries.length - 1].v
    : null

  const size = (entry: number, stop: number) =>
    positionSize(input.accountSize, input.riskPerTradePct, entry, stop)

  // aktív fade setup? (a fade jelzés érvényes, amíg az ár a range-ben van)
  if (fade && lastBar.c <= orbHigh && lastBar.c >= orbLow) {
    const risk = Math.abs(fade.entry - fade.stop)
    const dir = fade.dir
    const t15 = dir === "short" ? fade.entry - 1.5 * risk : fade.entry + 1.5 * risk
    const t20 = dir === "short" ? fade.entry - 2 * risk : fade.entry + 2 * risk
    return {
      kind: dir === "short" ? "FADE_SHORT" : "FADE_LONG",
      reason: `Failed breakout: a kitörés visszazárt a range-be. Stop az extrémen (${fade.stop.toFixed(2)}).`,
      entry: fade.entry,
      stop: fade.stop,
      target15: round2(t15),
      target20: round2(t20),
      contracts: size(fade.entry, fade.stop),
    }
  }

  const orbRange = orbHigh - orbLow

  // Nincs kitörés → range nap: VWAP reversion figyelés 10:30 ET után
  if (!breakoutDir) {
    const lastEt = toEt(lastBar.t)
    if (lastEt.minutes >= 10 * 60 + 30 && lastVwap != null && orbRange > 0) {
      const distance = lastBar.c - lastVwap
      if (Math.abs(distance) >= 0.6 * orbRange) {
        const dir = distance > 0 ? "short" : "long"
        const entry = lastBar.c
        const stop = round2(
          dir === "short" ? entry + 0.5 * orbRange : entry - 0.5 * orbRange
        )
        return {
          kind: dir === "short" ? "VWAP_SHORT" : "VWAP_LONG",
          reason: `Range nap: az ár ${Math.abs(distance).toFixed(2)} pontra nyúlt a VWAP-tól (${lastVwap.toFixed(2)}) — reversion vissza a VWAP-ra (ez a target).`,
          entry,
          stop,
          target15: null,
          target20: round2(lastVwap),
          contracts: size(entry, stop),
        }
      }
      return none(
        "Range nap (nincs kitörés 10:30-ig) — VWAP reversion figyelés, az ár még közel a VWAP-hoz."
      )
    }
    return none("Az ár az ORB range-en belül — nincs kitörés.")
  }

  // ORB signal: entry a kitörési gyertya záróárán horgonyozva.
  // Ha valamelyik filter blokkol, az okot megjegyezzük, és még
  // megnézzük a momentum pullback setupot.
  let blockReason = "Volt kitörés, de az ár visszatért a range-be — várakozás új setuppra."
  const barsSinceBreakout = postOrb.length - 1 - breakoutIdx

  if (barsSinceBreakout > 30) {
    blockReason =
      "A kitörés több mint 30 perce történt — az ORB entry-ablak lezárult, már csak pullback vagy fade setup élhet."
  } else if (breakoutDir === "up" && lastBar.c > orbHigh) {
    const entry = breakoutClose
    const risk = entry - orbLow
    if (lastVwap != null && lastBar.c <= lastVwap) {
      blockReason = "Kitörés felfelé, de az ár nincs a VWAP felett — nincs egyezés."
    } else if (input.rvol != null && input.rvol < 1.2) {
      blockReason = `Kitörés felfelé, de RVOL ${input.rvol} < 1.2 — gyenge volumen.`
    } else if (lastBar.c > entry + 0.75 * risk) {
      blockReason = `A kitörés (${entry.toFixed(2)}) már elfutott — chase tilos, várj pullbackre vagy fade setuppra.`
    } else {
      return {
        kind: "ORB_LONG",
        reason: `Záróár az ORB high (${orbHigh.toFixed(2)}) felett, VWAP OK${input.rvol != null ? `, RVOL ${input.rvol}` : ""}.`,
        entry,
        stop: orbLow,
        target15: round2(entry + 1.5 * risk),
        target20: round2(entry + 2 * risk),
        contracts: size(entry, orbLow),
      }
    }
  } else if (breakoutDir === "down" && lastBar.c < orbLow) {
    const entry = breakoutClose
    const risk = orbHigh - entry
    if (lastVwap != null && lastBar.c >= lastVwap) {
      blockReason = "Kitörés lefelé, de az ár nincs a VWAP alatt — nincs egyezés."
    } else if (input.rvol != null && input.rvol < 1.2) {
      blockReason = `Kitörés lefelé, de RVOL ${input.rvol} < 1.2 — gyenge volumen.`
    } else if (lastBar.c < entry - 0.75 * risk) {
      blockReason = `A kitörés (${entry.toFixed(2)}) már elfutott — chase tilos, várj pullbackre vagy fade setuppra.`
    } else {
      return {
        kind: "ORB_SHORT",
        reason: `Záróár az ORB low (${orbLow.toFixed(2)}) alatt, VWAP OK${input.rvol != null ? `, RVOL ${input.rvol}` : ""}.`,
        entry,
        stop: orbHigh,
        target15: round2(entry - 1.5 * risk),
        target20: round2(entry - 2 * risk),
        contracts: size(entry, orbHigh),
      }
    }
  }

  // Momentum pullback: kitörés utáni ELSŐ VWAP-visszateszt a trend irányába.
  // Csak friss (max 5 perce zárt) visszateszt ad signalt.
  const isUp = breakoutDir === "up"
  let retestIdx = -1
  for (let j = breakoutIdx + 1; j < postOrb.length; j++) {
    const bj = postOrb[j]
    // ellentétes ORB szint záró-ár szerinti átlépése érvényteleníti a trendet
    if (isUp ? bj.c < orbLow : bj.c > orbHigh) break
    const vwapJ = input.vwapSeries[lockIdx + j]?.v
    if (vwapJ == null) continue
    const retest = isUp
      ? bj.l <= vwapJ && bj.c > vwapJ
      : bj.h >= vwapJ && bj.c < vwapJ
    if (retest) {
      retestIdx = j
      break
    }
  }

  if (retestIdx >= 0 && retestIdx >= postOrb.length - 5 && lastVwap != null) {
    const trendIntact = isUp ? lastBar.c > lastVwap : lastBar.c < lastVwap
    if (trendIntact) {
      const rb = postOrb[retestIdx]
      const entry = rb.c
      const stop = isUp ? rb.l : rb.h
      const risk = Math.abs(entry - stop)
      if (risk > 0) {
        return {
          kind: isUp ? "PB_LONG" : "PB_SHORT",
          reason: `Momentum pullback: kitörés után az ár visszatesztelte a VWAP-ot és a trend irányába zárt. Stop a visszateszt-gyertya ${isUp ? "alján" : "tetején"}.`,
          entry,
          stop,
          target15: round2(isUp ? entry + 1.5 * risk : entry - 1.5 * risk),
          target20: round2(isUp ? entry + 2 * risk : entry - 2 * risk),
          contracts: size(entry, stop),
        }
      }
    }
  }

  return none(blockReason)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
