export type OpeningStatus =
  | { isOpen: true; closesAt: string; label: "Most nyitva" }
  | { isOpen: false; nextOpen: string; label: "Zárva" }

const TZ = "Europe/Budapest"

function getNowInTimeZone(): {
  day: number // 1..7 (Mon..Sun)
  hour: number
  minute: number
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date())

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon"
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10)
  const minute = parseInt(
    parts.find((p) => p.type === "minute")?.value ?? "0",
    10,
  )

  const dayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  }

  return { day: dayMap[weekday] ?? 1, hour, minute }
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function fmtTime(h: number, m: number) {
  return `${pad2(h)}:${pad2(m)}`
}

function minutesOfDay(h: number, m: number) {
  return h * 60 + m
}

function dayNameHu(day: number) {
  return (
    {
      1: "H",
      2: "K",
      3: "Sze",
      4: "Cs",
      5: "P",
      6: "Szo",
      7: "V",
    } as const
  )[day as 1 | 2 | 3 | 4 | 5 | 6 | 7]
}

type DayHours =
  | { kind: "open"; open: [number, number]; close: [number, number] }
  | { kind: "closed" }

const WEEK: Record<number, DayHours> = {
  1: { kind: "open", open: [8, 0], close: [17, 0] }, // Mon
  2: { kind: "open", open: [8, 0], close: [17, 0] }, // Tue
  3: { kind: "open", open: [8, 0], close: [17, 0] }, // Wed
  4: { kind: "open", open: [8, 0], close: [17, 0] }, // Thu
  5: { kind: "open", open: [8, 0], close: [17, 0] }, // Fri
  6: { kind: "open", open: [8, 0], close: [12, 0] }, // Sat
  7: { kind: "closed" }, // Sun
}

export function getOpeningStatus(): OpeningStatus {
  const now = getNowInTimeZone()
  const today = WEEK[now.day]

  const nowMin = minutesOfDay(now.hour, now.minute)

  if (today.kind === "open") {
    const openMin = minutesOfDay(today.open[0], today.open[1])
    const closeMin = minutesOfDay(today.close[0], today.close[1])
    if (nowMin >= openMin && nowMin < closeMin) {
      return {
        isOpen: true,
        label: "Most nyitva",
        closesAt: fmtTime(today.close[0], today.close[1]),
      }
    }
  }

  // Find next opening
  for (let offset = 0; offset < 7; offset++) {
    const day = ((now.day - 1 + offset) % 7) + 1
    const hours = WEEK[day]
    if (hours.kind === "closed") continue

    const openMin = minutesOfDay(hours.open[0], hours.open[1])
    if (offset === 0 && nowMin < openMin) {
      return {
        isOpen: false,
        label: "Zárva",
        nextOpen: `Ma ${fmtTime(hours.open[0], hours.open[1])}`,
      }
    }

    if (offset > 0) {
      return {
        isOpen: false,
        label: "Zárva",
        nextOpen: `${dayNameHu(day)} ${fmtTime(hours.open[0], hours.open[1])}`,
      }
    }
  }

  // Fallback
  return { isOpen: false, label: "Zárva", nextOpen: "H 08:00" }
}

export function getOpeningHoursScheduleLines() {
  return [
    { label: "H–P", value: "8:00–17:00" },
    { label: "Szo", value: "8:00–12:00" },
    { label: "V", value: "zárva" },
  ] as const
}

export function getTodayDayIndexBudapest() {
  return getNowInTimeZone().day
}

