import type { SupabaseClient } from '@supabase/supabase-js'

import {
  currentYearMonth,
  todayBudapest,
  type DayChipStatus
} from '@/lib/daily-reconciliation/parse'
import {
  getDailyReconciliationMonth,
  type DailyReconMonthSummary
} from '@/lib/daily-reconciliation/queries'

export type HomeNapiZarasSnapshot = {
  yearMonth: string
  today: string
  /** Vasárnap / nem munkanap. */
  todayIsWorkday: boolean
  todayStatus: DayChipStatus | null
  summary: DailyReconMonthSummary
}

export async function getHomeNapiZarasSnapshot(
  supabase: SupabaseClient,
  tenantId: string
): Promise<HomeNapiZarasSnapshot> {
  const yearMonth = currentYearMonth()
  const today = todayBudapest()
  const month = await getDailyReconciliationMonth(supabase, {
    tenantId,
    yearMonth
  })
  const todayDay = month.days.find((d) => d.date === today) ?? null

  return {
    yearMonth,
    today,
    todayIsWorkday: Boolean(todayDay),
    todayStatus: todayDay?.status ?? null,
    summary: month.summary
  }
}
