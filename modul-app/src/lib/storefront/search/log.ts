import type { SupabaseClient } from '@supabase/supabase-js'

import { normSearch } from './normalize'

export type SearchLogEntry = {
  q: string
  source: 'page' | 'suggest' | 'click'
  results?: number | null
  corrected?: string | null
  relaxed?: boolean
  clickedId?: string | null
}

/** Hibát nem dob: a naplózás nem akaszthatja meg a keresést. */
export async function logSearch(
  admin: SupabaseClient,
  tenantId: string,
  entry: SearchLogEntry
): Promise<void> {
  const q = entry.q.trim().slice(0, 120)
  const qNorm = normSearch(q)
  if (!qNorm) return
  const { error } = await admin.from('storefront_search_log').insert({
    tenant_id: tenantId,
    q,
    q_norm: qNorm,
    source: entry.source,
    results: entry.results ?? null,
    corrected: entry.corrected ?? null,
    relaxed: entry.relaxed ?? false,
    clicked_id: entry.clickedId ?? null
  })
  if (error && error.code !== '42P01') console.error('logSearch', error.message)
}
