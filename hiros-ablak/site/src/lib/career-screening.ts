/**
 * Bolti eladó 2. körös szűrő — közös link, DB nélkül.
 * Határidő: péntek 23:59 Europe/Budapest (kiküldés utáni hét).
 */

export const SCREENING_DEADLINE = new Date("2026-11-21T23:59:59+01:00")

export function isScreeningOpen(now = new Date()): boolean {
  const override = process.env.CAREER_SCREENING_DEADLINE?.trim()
  const deadline = override ? new Date(override) : SCREENING_DEADLINE
  if (Number.isNaN(deadline.getTime())) return now.getTime() <= SCREENING_DEADLINE.getTime()
  return now.getTime() <= deadline.getTime()
}

export function screeningDeadlineLabel(): string {
  const override = process.env.CAREER_SCREENING_DEADLINE?.trim()
  const deadline = override ? new Date(override) : SCREENING_DEADLINE
  const d = Number.isNaN(deadline.getTime()) ? SCREENING_DEADLINE : deadline
  return d.toLocaleString("hu-HU", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export const SCREENING_START = [
  { value: "immediate", label: "Azonnal" },
  { value: "2weeks", label: "2 héten belül" },
  { value: "1month", label: "1 hónapon belül" },
  { value: "later", label: "Később" },
] as const

export const SCREENING_YES_NO = [
  { value: "yes", label: "Igen" },
  { value: "no", label: "Nem" },
] as const

export const SCREENING_ENERGY = [
  { value: "up", label: "Feltölt" },
  { value: "down", label: "Kimerít" },
] as const

/** Szabad szöveg: ennyi karakter után mehet a beküldés / tovább. */
export const SITU_MIN_CHARS = 10
export const SITU_MAX_CHARS = 1200

/** Strictebb e-mail: van @, domain, TLD. */
export function isValidScreeningEmail(email: string): boolean {
  const e = email.trim()
  if (e.length < 6 || e.length > 200) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
}

/** Csak számjegyek. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

/**
 * HU mobil/vezetékes megjelenítés: +36 30 132 9999
 * A felhasználó törölheti a +36-ot; gépelés közben újraépül.
 */
export function formatHuPhoneDisplay(value: string): string {
  let d = digitsOnly(value)
  if (d.startsWith("36")) d = d.slice(2)
  else if (d.startsWith("06")) d = d.slice(2)
  else if (d.startsWith("0")) d = d.slice(1)
  d = d.slice(0, 9)
  if (!d) return ""
  const a = d.slice(0, 2)
  const b = d.slice(2, 5)
  const c = d.slice(5, 9)
  let out = "+36"
  if (a) out += ` ${a}`
  if (b) out += ` ${b}`
  if (c) out += ` ${c}`
  return out
}

/** API-hoz: legalább 9 nemzeti számjegy (+36 után). */
export function huPhoneNationalDigits(value: string): string {
  let d = digitsOnly(value)
  if (d.startsWith("36")) d = d.slice(2)
  else if (d.startsWith("06")) d = d.slice(2)
  else if (d.startsWith("0")) d = d.slice(1)
  return d.slice(0, 9)
}

export function formatSalaryDisplay(value: string): string {
  const d = digitsOnly(value).slice(0, 9)
  if (!d) return ""
  return Number.parseInt(d, 10).toLocaleString("hu-HU")
}

export function parseSalaryNumber(value: string): number {
  const d = digitsOnly(value)
  if (!d) return NaN
  return Number.parseInt(d, 10)
}

export const SCREENING_EXPERIENCE = [
  { value: "bolt", label: "Igen, bolti vagy áruházi munka" },
  { value: "ugyfel", label: "Igen, más ügyfélkezelés" },
  { value: "none", label: "Még nincs, betanulnék" },
] as const

export const SCREENING_SCALE_VALUES = ["1", "2", "3", "4", "5"] as const

export const START_LABELS: Record<string, string> = Object.fromEntries(
  SCREENING_START.map((o) => [o.value, o.label]),
)

export const ENERGY_LABELS: Record<string, string> = Object.fromEntries(
  SCREENING_ENERGY.map((o) => [o.value, o.label]),
)

export const EXPERIENCE_LABELS: Record<string, string> = Object.fromEntries(
  SCREENING_EXPERIENCE.map((o) => [o.value, o.label]),
)
