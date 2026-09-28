import type { SupabaseClient } from '@supabase/supabase-js'

export const SEARCH_REPORT_DAYS = 30

export type SearchReportRow = {
  qNorm: string
  q: string
  searches: number
  zero: number
  avgResults: number | null
  clicks: number
  lastAt: string
}

export type SearchSynonymRow = {
  id: string
  terms: string[]
  global: boolean
}

export type SearchAdminData =
  | { ok: false; missingMigration: boolean }
  | {
      ok: true
      report: SearchReportRow[]
      synonyms: SearchSynonymRow[]
    }

const MISSING = new Set(['42P01', '42883', 'PGRST202', 'PGRST205'])

export async function loadSearchAdmin(
  supabase: SupabaseClient,
  tenantId: string
): Promise<SearchAdminData> {
  const [reportRes, synRes] = await Promise.all([
    supabase.rpc('storefront_search_report', { p_tenant: tenantId, p_days: SEARCH_REPORT_DAYS }),
    supabase
      .from('storefront_search_synonyms')
      .select('id, tenant_id, terms')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .order('created_at', { ascending: false })
      .limit(500)
  ])
  const err = reportRes.error ?? synRes.error
  if (err) {
    console.error('loadSearchAdmin', err.message)
    return { ok: false, missingMigration: MISSING.has(err.code ?? '') }
  }
  return {
    ok: true,
    report: ((reportRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      qNorm: String(r.q_norm),
      q: String(r.q ?? r.q_norm),
      searches: Number(r.searches ?? 0),
      zero: Number(r.zero ?? 0),
      avgResults: r.avg_results == null ? null : Number(r.avg_results),
      clicks: Number(r.clicks ?? 0),
      lastAt: String(r.last_at)
    })),
    synonyms: ((synRes.data ?? []) as { id: string; tenant_id: string | null; terms: string[] }[]).map(
      (r) => ({ id: r.id, terms: r.terms ?? [], global: r.tenant_id == null })
    )
  }
}
