/**
 * Lean manuális előfizetés — egy igazság: access_until (nap).
 * Státusz mindig származtatott; UI nem szerkeszt enumot.
 */

export type AccessSource = 'trial' | 'paid' | 'manual'

export type DerivedAccessStatus =
  | 'unset'
  | 'trial'
  | 'ok'
  | 'grace'
  | 'expired'

/** Grace ablak lejárat után (nap). */
export const ACCESS_GRACE_DAYS = 14

/** Default próba új cégnél. */
export const DEFAULT_TRIAL_DAYS = 14

export type AccessMeta = {
  label: string
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info'
  /** Operátor (platform) rövid címke */
  opsLabel: string
  /** Tenant-facing státusz címke */
  tenantLabel: string
}

export const ACCESS_META: Record<DerivedAccessStatus, AccessMeta> = {
  unset: {
    label: 'Nincs beállítva',
    tone: 'neutral',
    opsLabel: 'Nincs beállítva',
    tenantLabel: 'Nincs beállítva'
  },
  trial: {
    label: 'Próba',
    tone: 'info',
    opsLabel: 'Próba',
    tenantLabel: 'Próbaidő'
  },
  ok: {
    label: 'Rendben',
    tone: 'success',
    opsLabel: 'Rendben',
    tenantLabel: 'Aktív'
  },
  grace: {
    label: 'Lejárt — grace',
    tone: 'warning',
    opsLabel: 'Lejárt — grace',
    tenantLabel: 'Fizetés rendezetlen'
  },
  expired: {
    label: 'Lejárt',
    tone: 'danger',
    opsLabel: 'Lejárt',
    tenantLabel: 'Lemondva'
  }
}

/** YYYY-MM-DD Europe/Budapest ma. */
export function todayInBudapest(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now)
}

/** ISO / date string → YYYY-MM-DD (vágás, nincs TZ shift). */
export function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  return todayInBudapest(d)
}

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split('-').map(Number)
  return { y, m, d }
}

function formatYmd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Napok száma a → b (b − a), dátum-only. */
export function daysBetween(fromYmd: string, toYmd: string): number {
  const a = parseYmd(fromYmd)
  const b = parseYmd(toYmd)
  const t0 = Date.UTC(a.y, a.m - 1, a.d)
  const t1 = Date.UTC(b.y, b.m - 1, b.d)
  return Math.round((t1 - t0) / 86_400_000)
}

export function addCalendarDays(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return formatYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** Hónap hozzáadás naptári nappal (overflow → hónap utolsó napja). */
export function addCalendarMonths(ymd: string, months: number): string {
  const { y, m, d } = parseYmd(ymd)
  const targetMonthIndex = m - 1 + months
  const targetY = y + Math.floor(targetMonthIndex / 12)
  const targetM0 = ((targetMonthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetY, targetM0 + 1, 0)).getUTCDate()
  const day = Math.min(d, lastDay)
  return formatYmd(targetY, targetM0 + 1, day)
}

export function deriveAccessStatus(input: {
  accessUntil: string | null | undefined
  accessSource?: AccessSource | string | null
  today?: string
}): DerivedAccessStatus {
  const until = toDateOnly(input.accessUntil)
  if (!until) return 'unset'
  const today = input.today ?? todayInBudapest()
  if (until >= today) {
    return input.accessSource === 'trial' ? 'trial' : 'ok'
  }
  const past = daysBetween(until, today)
  if (past <= ACCESS_GRACE_DAYS) return 'grace'
  return 'expired'
}

/** Relatív hint: „még N nap” / „N napja lejárt”. */
export function accessRelativeHint(
  accessUntil: string | null | undefined,
  today = todayInBudapest()
): string | null {
  const until = toDateOnly(accessUntil)
  if (!until) return null
  const delta = daysBetween(today, until)
  if (delta > 0) return `még ${delta} nap`
  if (delta === 0) return 'ma jár le'
  return `${Math.abs(delta)} napja lejárt`
}

export function formatAccessDateHu(ymd: string | null | undefined): string | null {
  const d = toDateOnly(ymd)
  if (!d) return null
  const { y, m, day } = (() => {
    const p = parseYmd(d)
    return { y: p.y, m: p.m, day: p.d }
  })()
  try {
    return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'long' }).format(
      new Date(Date.UTC(y, m - 1, day))
    )
  } catch {
    return d
  }
}

export function tenantAccessMessage(input: {
  status: DerivedAccessStatus
  accessUntil: string | null | undefined
}): string {
  const label = formatAccessDateHu(input.accessUntil)
  switch (input.status) {
    case 'ok':
      return label
        ? `Az előfizetésed ${label}-ig érvényes.`
        : 'Az előfizetésed aktív.'
    case 'trial':
      return label
        ? `Próbaidő alatt vagy — a próba ${label}-ig tart.`
        : 'Próbaidő alatt vagy.'
    case 'grace':
      return 'A fizetés nincs rendezve. Hívd vagy írd meg nekünk.'
    case 'expired':
      return 'Az előfizetés le van állítva. Ha újra kell, vedd fel velünk a kapcsolatot.'
    default:
      return 'Még nincs beállított előfizetés. Hívd vagy írd meg nekünk.'
  }
}

/** Hosszabbítás bázisa: max(jelenlegi, ma). */
export function extendAccessUntil(
  current: string | null | undefined,
  months: number,
  today = todayInBudapest()
): string {
  const base = toDateOnly(current)
  const from = !base || base < today ? today : base
  return addCalendarMonths(from, months)
}

export function trialAccessUntil(
  days = DEFAULT_TRIAL_DAYS,
  today = todayInBudapest()
): string {
  return addCalendarDays(today, days)
}

export function stopAccessUntil(today = todayInBudapest()): string {
  return addCalendarDays(today, -1)
}

/**
 * Legacy mezők szinkronja (billing_status / trial_ends_at / paid_through),
 * amíg régi olvasók / riportok léteznek.
 */
export function legacyFieldsFromAccess(input: {
  accessUntil: string | null
  accessSource: AccessSource | null
  today?: string
}): {
  billing_status: 'none' | 'trial' | 'active' | 'past_due' | 'canceled'
  trial_ends_at: string | null
  paid_through: string | null
} {
  const status = deriveAccessStatus({
    accessUntil: input.accessUntil,
    accessSource: input.accessSource,
    today: input.today
  })
  const until = toDateOnly(input.accessUntil)
  const iso = until ? `${until}T12:00:00.000Z` : null

  switch (status) {
    case 'unset':
      return {
        billing_status: 'none',
        trial_ends_at: null,
        paid_through: null
      }
    case 'trial':
      return {
        billing_status: 'trial',
        trial_ends_at: iso,
        paid_through: null
      }
    case 'ok':
      return {
        billing_status: 'active',
        trial_ends_at: null,
        paid_through: iso
      }
    case 'grace':
      return {
        billing_status: 'past_due',
        trial_ends_at: input.accessSource === 'trial' ? iso : null,
        paid_through: input.accessSource === 'trial' ? null : iso
      }
    case 'expired':
      return {
        billing_status: 'canceled',
        trial_ends_at: null,
        paid_through: iso
      }
  }
}

export function parseAccessSource(
  value: string | null | undefined
): AccessSource | null {
  if (value === 'trial' || value === 'paid' || value === 'manual') return value
  return null
}
