import type { Metadata } from 'next'

import { JelenletCalendarClient } from '@/components/jelenlet/jelenlet-calendar-client'
import { getSessionUser } from '@/lib/auth/session'
import { budapestTodayYmd, budapestYearMonth } from '@/lib/jelenlet/hours'
import { getCalendarMonth } from '@/lib/jelenlet/queries'
import {
  DEFAULT_ATTENDANCE_GRACE_MINUTES,
  getAttendanceGraceMinutes,
  listSheetEmployees
} from '@/lib/jelenlet/sheet-data'
import type { SheetEmployee } from '@/lib/jelenlet/sheet-engine'
import { getJelenletToday, type JelenletTodayData } from '@/lib/jelenlet/today-queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Jelenlét' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function JelenletPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const now = budapestYearMonth()
  const yearRaw = typeof sp.year === 'string' ? Number(sp.year) : now.year
  const monthRaw = typeof sp.month === 'string' ? Number(sp.month) : now.month
  const year =
    Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100
      ? yearRaw
      : now.year
  const month =
    Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12
      ? monthRaw
      : now.month

  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let loadError: string | null = null
  let data: Awaited<ReturnType<typeof getCalendarMonth>> | null = null
  let today: JelenletTodayData | null = null
  let totalsRules: { graceMinutes: number; employees: Record<string, SheetEmployee> } = {
    graceMinutes: DEFAULT_ATTENDANCE_GRACE_MINUTES,
    employees: {}
  }
  const isCurrentMonth = year === now.year && month === now.month

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const [month_, today_, grace, policies] = await Promise.all([
          getCalendarMonth(supabase, { tenantId: user.tenantId, year, month }),
          isCurrentMonth
            ? getJelenletToday(supabase, {
                tenantId: user.tenantId,
                workDate: budapestTodayYmd()
              }).catch(() => null)
            : Promise.resolve(null),
          getAttendanceGraceMinutes(supabase, user.tenantId),
          listSheetEmployees(supabase, user.tenantId).catch(() => ({}))
        ])
        data = month_
        today = today_
        totalsRules = { graceMinutes: grace, employees: policies }
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a naptárat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Futtasd a jelenlét migrációt.'
  }

  if (loadError || !data) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Jelenlét</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError ?? 'Nincs adat.'}
        </p>
      </div>
    )
  }

  return <JelenletCalendarClient data={data} canWrite={canWrite} today={today} totalsRules={totalsRules} />
}
