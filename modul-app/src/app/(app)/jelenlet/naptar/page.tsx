import type { Metadata } from 'next'

import { WorkCalendarClient } from '@/components/jelenlet/work-calendar-client'
import { getSessionUser } from '@/lib/auth/session'
import { listWorkCalendarDays } from '@/lib/jelenlet/work-calendar-queries'
import type {
  HrWorkCalendarRow,
  WorkCalendarDayType
} from '@/lib/jelenlet/types'
import { WORK_CALENDAR_DAY_TYPES } from '@/lib/jelenlet/types'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Munkarend / ünnepek' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function JelenletNaptarPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const nowYear = new Date().getFullYear()
  const yearRaw = typeof sp.year === 'string' ? Number(sp.year) : nowYear
  const year =
    Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100
      ? yearRaw
      : nowYear

  const typeRaw = typeof sp.type === 'string' ? sp.type : 'all'
  const dayTypeFilter: WorkCalendarDayType | 'all' =
    typeRaw === 'all'
      ? 'all'
      : WORK_CALENDAR_DAY_TYPES.includes(typeRaw as WorkCalendarDayType)
        ? (typeRaw as WorkCalendarDayType)
        : 'all'

  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let rows: HrWorkCalendarRow[] = []
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        rows = await listWorkCalendarDays(supabase, user.tenantId, {
          year,
          dayType: dayTypeFilter
        })
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a naptárt.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Futtasd a jelenlét migrációkat.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Munkarend / ünnepek</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260520_hr_work_calendar_page.sql
          </code>{' '}
          fájlt is, majd frissítsd az oldalt.
        </p>
      </div>
    )
  }

  return (
    <WorkCalendarClient
      initialRows={rows}
      year={year}
      dayTypeFilter={dayTypeFilter}
      canWrite={canWrite}
    />
  )
}
