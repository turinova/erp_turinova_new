import type { SupabaseClient } from '@supabase/supabase-js'

import {
  addDaysYmd,
  budapestTodayYmd,
  budapestYesterdayYmd
} from '@/lib/date'

const BACKLOG_MAX_AGE_DAYS = 90

export type GyartasGlance = {
  orderCount: number
  staleOrderCount: number
}

/** Elmaradás: lejárt gyártási nap, még nem kész — glance db (méter később). */
export async function getGyartasGlance(
  supabase: SupabaseClient,
  tenantId: string
): Promise<GyartasGlance> {
  const yesterday = budapestYesterdayYmd()
  const windowStart = addDaysYmd(budapestTodayYmd(), -BACKLOG_MAX_AGE_DAYS)

  const { data, error } = await supabase
    .from('quotes')
    .select('id, ready_at, finished_at, production_date')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .is('archived_at', null)
    .not('order_number', 'is', null)
    .not('production_date', 'is', null)
    .lte('production_date', yesterday)
    .in('status', ['ordered', 'in_production'])

  if (error) {
    console.error('getGyartasGlance', error.message)
    return { orderCount: 0, staleOrderCount: 0 }
  }

  const open = (data ?? []).filter(
    (q) => !(q.ready_at || q.finished_at)
  )
  const inWindow = open.filter((q) => {
    const d = q.production_date as string
    return d >= windowStart
  })

  return {
    orderCount: inWindow.length,
    staleOrderCount: open.length - inWindow.length
  }
}
