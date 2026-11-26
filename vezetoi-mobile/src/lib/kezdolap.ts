import type { SupabaseClient } from '@supabase/supabase-js'

import { budapestTodayYmd } from '@/lib/date'
import { getJelenletDay } from '@/lib/jelenlet'

/**
 * A Kezdőlap üzleti számai a modul-app mobil API-ból jönnek (`/api/m/v1/kezdolap`).
 * Itt csak a „Bent most” sor marad, ami a Jelenlét tab saját adatforrása.
 */
export type BentMost = {
  bentCount: number
  activeCount: number
}

export async function getBentMost(
  supabase: SupabaseClient,
  tenantId: string
): Promise<BentMost | null> {
  const day = await getJelenletDay(supabase, tenantId, budapestTodayYmd())
  if (day.loadError) throw new Error(day.loadError)
  return { bentCount: day.counts.bent, activeCount: day.workingCount }
}
