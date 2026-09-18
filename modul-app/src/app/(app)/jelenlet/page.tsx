import type { Metadata } from 'next'

import { JelenletCalendarClient } from '@/components/jelenlet/jelenlet-calendar-client'
import { getSessionUser } from '@/lib/auth/session'
import { budapestYearMonth } from '@/lib/jelenlet/hours'
import { getCalendarMonth } from '@/lib/jelenlet/queries'
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

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        data = await getCalendarMonth(supabase, {
          tenantId: user.tenantId,
          year,
          month
        })
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

  return <JelenletCalendarClient data={data} canWrite={canWrite} />
}
