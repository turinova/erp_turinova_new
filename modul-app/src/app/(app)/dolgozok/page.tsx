import type { Metadata } from 'next'

import { EmployeesListClient } from '@/components/jelenlet/employees-list-client'
import { getSessionUser } from '@/lib/auth/session'
import { budapestYearMonth } from '@/lib/jelenlet/hours'
import { listEmployees } from '@/lib/jelenlet/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Dolgozók' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function DolgozokPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q : ''
  const pageRaw = typeof sp.page === 'string' ? Number(sp.page) : 1
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
  const activeRaw = typeof sp.active === 'string' ? sp.active : 'all'
  const active =
    activeRaw === 'active' || activeRaw === 'inactive' ? activeRaw : 'all'

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

  let rows: Awaited<ReturnType<typeof listEmployees>>['rows'] = []
  let total = 0
  let limit = 25
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const result = await listEmployees(supabase, {
          tenantId: user.tenantId,
          q: q || undefined,
          active,
          page,
          limit: 25,
          year,
          month
        })
        rows = result.rows
        total = result.total
        limit = result.limit
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a dolgozókat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Futtasd a jelenlét migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Dolgozók</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
      </div>
    )
  }

  return (
    <EmployeesListClient
      rows={rows}
      total={total}
      page={page}
      limit={limit}
      q={q}
      active={active}
      year={year}
      month={month}
      canWrite={canWrite}
    />
  )
}
