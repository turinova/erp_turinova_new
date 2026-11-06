export const MIGRATION_DEADLINE_ISO = '2026-11-08T23:59:59+01:00'
export const MIGRATION_DEADLINE_DAY = '2026-11-08'
export const MIGRATION_DEADLINE_LABEL = '2026. november 8., vasárnap 23:59'
export const MIGRATION_DEADLINE_SHORT = 'november 8-ig'
export const MIGRATION_SWITCH_LABEL = 'November 9-től'

export const NEW_SYSTEM_URL = 'https://turinova.hu'
export const NEW_SYSTEM_LABEL = 'turinova.hu'
export const ARCHIVE_URL = 'https://archiv.turinova.hu'
export const ARCHIVE_LABEL = 'archiv.turinova.hu'

export const SUPPORT_PHONE_LABEL = '06 30 999 2800'
export const SUPPORT_PHONE_TEL = '+36309992800'

/** Új fiók létrehozása a régi portálon zárva Nov 9-ig (átállás). */
export const REGISTRATION_CLOSED = true
export const REGISTRATION_CLOSED_TITLE = 'A regisztráció átmenetileg szünetel'
export const REGISTRATION_CLOSED_MESSAGE =
  'Új fiókot jelenleg nem lehet létrehozni. November 9-től az új rendszerben (turinova.hu) újra megnyílik a regisztráció.'
export const REGISTRATION_CLOSED_API_ERROR =
  'A regisztráció átmenetileg szünetel. November 9-től újra megnyílik az új rendszerben (turinova.hu).'

export type MigrationPhase = 'before' | 'lastDay' | 'after'

export interface MigrationNotice {
  phase: MigrationPhase
  daysLeft: number
}

function budapestDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

/** Calendar days are counted in Europe/Budapest, so the result is stable across server regions. */
export function getMigrationNotice(now: Date = new Date()): MigrationNotice {
  if (now.getTime() > new Date(MIGRATION_DEADLINE_ISO).getTime()) {
    return { phase: 'after', daysLeft: 0 }
  }

  const today = Date.parse(`${budapestDay(now)}T00:00:00Z`)
  const deadline = Date.parse(`${MIGRATION_DEADLINE_DAY}T00:00:00Z`)
  const daysLeft = Math.max(0, Math.round((deadline - today) / 86_400_000))

  return { phase: daysLeft === 0 ? 'lastDay' : 'before', daysLeft }
}

export function migrationCountdownLabel(notice: MigrationNotice): string | null {
  if (notice.phase === 'after') return null
  if (notice.phase === 'lastDay') return 'Ma éjfélig'
  if (notice.daysLeft === 1) return 'Holnap éjfélig'

  return `Még ${notice.daysLeft} nap`
}
