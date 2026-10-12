import type { Metadata } from 'next'

import { PosAdoptionClient } from '@/components/pos/pos-adoption-client'
import { getSessionUser } from '@/lib/auth/session'
import {
  getDailySalesTarget,
  listPosAdoptionAwards,
  loadPosAdoptionStats,
  startOfWeekMonday,
  toLocalDateStr,
  type PosAdoptionRange
} from '@/lib/pos/adoption'
import { loadPosSearchMissStats } from '@/lib/pos/discovery'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'POS használat' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function parseRange(raw: string | undefined): PosAdoptionRange {
  if (raw === 'week' || raw === 'month') return raw
  return 'today'
}

export default async function PosHasznalatPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const range = parseRange(typeof sp.range === 'string' ? sp.range : undefined)

  const user = await getSessionUser()
  const canWrite = Boolean(user && user.role !== 'viewer')

  if (!user?.tenantId || user.isDevSession) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">POS használat</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {user?.isDevSession
            ? 'Dev bypass módban nincs tenant adatbázis. Futtasd a 20260593_pos_adoption.sql migrációt.'
            : 'Nincs munkamenet.'}
        </p>
      </div>
    )
  }

  const supabase = await createClient()
  if (!supabase) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">POS használat</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          Az adatbázis kapcsolat nem elérhető.
        </p>
      </div>
    )
  }

  let loadError: string | null = null
  const stats = await loadPosAdoptionStats(supabase, user.tenantId, range).catch(
    (err) => {
      loadError =
        err instanceof Error
          ? err.message
          : 'Nem sikerült betölteni a POS használatot.'
      return null
    }
  )

  if (loadError || !stats) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">POS használat</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError ?? 'Ismeretlen hiba.'}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260593_pos_adoption.sql
          </code>{' '}
          fájlt.
        </p>
      </div>
    )
  }

  const [awards, dailyTarget, searchMisses] = await Promise.all([
    listPosAdoptionAwards(supabase, user.tenantId, 8),
    getDailySalesTarget(supabase, user.tenantId),
    loadPosSearchMissStats(supabase, user.tenantId, 14, 15)
  ])
  const weekStart = toLocalDateStr(startOfWeekMonday())

  return (
    <PosAdoptionClient
      initialRange={range}
      initialStats={stats}
      awards={awards}
      weekStart={weekStart}
      dailyTarget={dailyTarget}
      canWrite={canWrite}
      searchMisses={searchMisses}
    />
  )
}
