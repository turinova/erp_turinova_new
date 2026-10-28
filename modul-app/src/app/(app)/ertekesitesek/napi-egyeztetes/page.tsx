import type { Metadata } from 'next'
import { Suspense } from 'react'

import { DailyReconciliationClient } from '@/components/daily-reconciliation/daily-reconciliation-client'
import { getSessionUser } from '@/lib/auth/session'
import {
  currentYearMonth,
  parseYearMonth,
  todayBudapest
} from '@/lib/daily-reconciliation/parse'
import { getDailyReconciliationMonth } from '@/lib/daily-reconciliation/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Napi zárás'
}

type SearchParams = Promise<{
  month?: string
  date?: string
}>

export default async function NapiEgyeztetesPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  const yearMonth = params.month?.match(/^\d{4}-\d{2}$/)
    ? params.month
    : currentYearMonth()
  const { year, month } = parseYearMonth(yearMonth)
  const normalizedYm = `${year}-${String(month).padStart(2, '0')}`

  const today = todayBudapest()
  const initialDate =
    params.date?.match(/^\d{4}-\d{2}-\d{2}$/) &&
    params.date.startsWith(normalizedYm)
      ? params.date
      : today.startsWith(normalizedYm)
        ? today
        : `${normalizedYm}-01`

  let loadError: string | null = null
  let days: Awaited<ReturnType<typeof getDailyReconciliationMonth>>['days'] =
    []
  let summary: Awaited<
    ReturnType<typeof getDailyReconciliationMonth>
  >['summary'] = {
    workdayCount: 0,
    filledCount: 0,
    okCount: 0,
    varianceCount: 0,
    partialCount: 0,
    emptyCount: 0,
    missingPastCount: 0,
    accuracyPct: null,
    streak: 0,
    bonusTier: 0,
    bonusStaffFt: 0,
    bonusManagerFt: 0,
    bonusFt: 0
  }

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const result = await getDailyReconciliationMonth(supabase, {
          tenantId: user.tenantId,
          yearMonth: normalizedYm
        })
        days = result.days
        summary = result.summary
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni az egyeztetést.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Napi zárás</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260615_daily_reconciliation.sql
          </code>{' '}
          fájlt a Supabase SQL Editorben, majd frissítsd az oldalt.
        </p>
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <DailyReconciliationClient
        yearMonth={normalizedYm}
        days={days}
        summary={summary}
        canWrite={canWrite}
        initialDate={initialDate}
      />
    </Suspense>
  )
}
