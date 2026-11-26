import { addDaysYmd, budapestTodayYmd, toBudapestYmdFromIso } from '@/lib/home/date'

const timeFmt = new Intl.DateTimeFormat('hu-HU', {
  timeZone: 'Europe/Budapest',
  hour: '2-digit',
  minute: '2-digit'
})
const dateFmt = new Intl.DateTimeFormat('hu-HU', {
  timeZone: 'Europe/Budapest',
  month: 'short',
  day: 'numeric'
})

/** „ma 10:00”, „holnap 10:00”, egyébként „nov. 29. 10:00”. */
export function formatReviewWhen(iso: string, today = budapestTodayYmd()): string {
  const d = new Date(iso)
  const ymd = toBudapestYmdFromIso(iso)
  const time = timeFmt.format(d)
  if (ymd === today) return `ma ${time}`
  if (ymd === addDaysYmd(today, 1)) return `holnap ${time}`
  if (ymd === addDaysYmd(today, -1)) return `tegnap ${time}`
  return `${dateFmt.format(d)} ${time}`
}

export function formatReviewDate(iso: string): string {
  return dateFmt.format(new Date(iso))
}
