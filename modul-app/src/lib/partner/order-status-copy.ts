import { toBudapestYmdFromIso } from '@/lib/home/date'
import type { PartnerQuoteListItem } from '@/lib/partner/quotes-queries'

const DAY_MS = 24 * 60 * 60 * 1000

function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`)
}

export function todayYmd(): string {
  return toBudapestYmdFromIso(new Date().toISOString())
}

/** „nov. 7.” — évvel, ha nem az idei. */
export function formatShortDay(ymd: string): string {
  try {
    const sameYear = ymd.slice(0, 4) === todayYmd().slice(0, 4)
    return new Intl.DateTimeFormat('hu-HU', {
      year: sameYear ? undefined : 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(ymdToDate(ymd))
  } catch {
    return ymd
  }
}

export function daysAgo(iso: string): number {
  const then = ymdToDate(toBudapestYmdFromIso(iso)).getTime()
  const now = ymdToDate(todayYmd()).getTime()
  return Math.max(0, Math.round((now - then) / DAY_MS))
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(iso))
}

/** „ma 10:12” · „tegnap” · „5 napja” · régebbi: dátum. */
export function formatRelative(iso: string): string {
  try {
    const d = daysAgo(iso)
    if (d === 0) return `ma ${formatTime(iso)}`
    if (d === 1) return 'tegnap'
    if (d < 14) return `${d} napja`
    return formatShortDay(toBudapestYmdFromIso(iso))
  } catch {
    return iso
  }
}

/** Következő lépés egy mondatban a státusz badge mellett. */
export function orderStatusHint(row: PartnerQuoteListItem): string {
  switch (row.status) {
    case 'draft':
      return 'A cég még nem fogadta el'
    case 'ordered':
      return row.production_date
        ? `Gyártás napja: ${formatShortDay(row.production_date)}`
        : 'Gyártási nap egyeztetés alatt'
    case 'in_production':
      return row.production_date
        ? `Gyártás napja: ${formatShortDay(row.production_date)}`
        : 'Gyártás folyamatban'
    case 'ready':
      return row.ready_at
        ? `Elvihető ${formatShortDay(toBudapestYmdFromIso(row.ready_at))} óta`
        : 'Elvihető'
    case 'finished':
      return row.finished_at
        ? `Átadva: ${formatShortDay(toBudapestYmdFromIso(row.finished_at))}`
        : 'Átadva'
    case 'cancelled':
      return 'Lemondott rendelés'
    default:
      return ''
  }
}

export function contentLabel(row: PartnerQuoteListItem): string {
  const parts = [`${row.panel_quantity} panel`]
  if (row.material_count > 0) parts.push(`${row.material_count} anyag`)
  return parts.join(' · ')
}
