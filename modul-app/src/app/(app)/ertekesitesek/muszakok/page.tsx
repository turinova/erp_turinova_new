import type { Metadata } from 'next'

import { PosShiftsListClient } from '@/components/pos/pos-shifts-list-client'
import { getSessionUser } from '@/lib/auth/session'
import { listPosShifts } from '@/lib/pos/shifts'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Műszakok' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function MuszakokPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const pageRaw = typeof sp.page === 'string' ? Number(sp.page) : 1
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
  const statusRaw = typeof sp.status === 'string' ? sp.status : 'all'
  const status =
    statusRaw === 'open' || statusRaw === 'closed' ? statusRaw : ('all' as const)
  const diffOnly = sp.diff === '1' || sp.diff === 'true'

  const user = await getSessionUser()
  let rows: Awaited<ReturnType<typeof listPosShifts>> = {
    rows: [],
    total: 0,
    page: 1,
    limit: 25
  }
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        rows = await listPosShifts(supabase, {
          tenantId: user.tenantId,
          page,
          limit: 25,
          status,
          diffOnly
        })
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a műszakokat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Futtasd a POS műszak migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Műszakok</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260514_pos_shifts_and_registers.sql
          </code>{' '}
          fájlt.
        </p>
      </div>
    )
  }

  return (
    <PosShiftsListClient
      initialRows={rows.rows}
      total={rows.total}
      page={rows.page}
      limit={rows.limit}
      status={status}
      diffOnly={diffOnly}
    />
  )
}
