/** New York-i (ET) időkezelés — a backtest és az élő engine közös modulja. */

const etFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

export interface EtParts {
  date: string
  /** percek 0:00 ET-től */
  minutes: number
  time: string
  seconds: number
}

export function toEt(tSec: number): EtParts {
  const parts = etFormatter.formatToParts(new Date(tSec * 1000))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
  const hour = Number(get("hour")) % 24
  const minute = Number(get("minute"))
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + minute,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    seconds: Number(get("second")),
  }
}

/** 9:30 ET percben */
export const RTH_OPEN_MIN = 9 * 60 + 30

/** Az ET és az UTC közötti eltolás másodpercben az adott pillanatban (EDT: -4h). */
export function etOffsetSeconds(tSec: number): number {
  const et = toEt(tSec)
  const d = new Date(tSec * 1000)
  const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes()
  let diff = et.minutes - utcMinutes
  // nap-átfordulás kezelése
  if (diff > 720) diff -= 1440
  if (diff < -720) diff += 1440
  return diff * 60
}
