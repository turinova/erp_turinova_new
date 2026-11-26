import type { SupabaseClient } from '@supabase/supabase-js'

import { addDaysYmd, budapestTodayYmd } from '@/lib/home/date'

/** Google csillagátlag + értékelésszám (Places API New, naponta), docs/55. */

const REFRESH_MS = 3 * 60 * 60 * 1000
const REFRESH_BATCH = 20
/** Budapesti órák [7, 19) — éjjel nem kérdezünk (Places díj tenantonként összeadódik). */
const REFRESH_HOUR_FROM = 7
const REFRESH_HOUR_TO = 19

function budapestHour(d = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', hour: '2-digit', hourCycle: 'h23' }).format(d)
  )
}

export type TopbarGoogleRating = {
  rating: number
  count: number
  placeId: string
  delta30d: number | null
  /** Napi értékelésszám az utolsó 30 napból, növekvő dátum szerint. */
  series: number[]
  fetchedAt: string | null
}

/** Navbar jelvény: null, ha nincs Place ID / adat / migráció. */
export async function getTopbarGoogleRating(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TopbarGoogleRating | null> {
  const [companyRes, snapRes] = await Promise.all([
    supabase
      .from('tenant_companies')
      .select('google_place_id, google_rating, google_rating_count, google_rating_fetched_at')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('google_rating_snapshots')
      .select('rating_count')
      .eq('tenant_id', tenantId)
      .gte('ymd', addDaysYmd(budapestTodayYmd(), -30))
      .order('ymd', { ascending: true })
      .limit(31)
  ])
  const c = companyRes.error ? null : companyRes.data
  if (!c?.google_place_id || c.google_rating == null || c.google_rating_count == null) return null

  const count = c.google_rating_count as number
  const series = snapRes.error ? [] : (snapRes.data ?? []).map((r) => r.rating_count as number)
  const base = series[0]
  return {
    rating: Number(c.google_rating),
    count,
    placeId: c.google_place_id as string,
    delta30d: base != null && series.length >= 2 ? Math.max(0, count - base) : null,
    series,
    fetchedAt: c.google_rating_fetched_at ?? null
  }
}

export type GoogleRatingSummary = {
  rating: number | null
  count: number | null
  /** Értékelésszám változás az utolsó 30 napban (null = nincs elég pillanatkép). */
  delta30d: number | null
  fetchedAt: string | null
  hasPlaceId: boolean
  /** false = a 20261027 migráció még nincs lefuttatva. */
  available: boolean
}

export async function getGoogleRatingSummary(
  supabase: SupabaseClient,
  tenantId: string
): Promise<GoogleRatingSummary> {
  const empty: GoogleRatingSummary = {
    rating: null,
    count: null,
    delta30d: null,
    fetchedAt: null,
    hasPlaceId: false,
    available: false
  }
  const [companyRes, snapRes] = await Promise.all([
    supabase
      .from('tenant_companies')
      .select('google_place_id, google_rating, google_rating_count, google_rating_fetched_at')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('google_rating_snapshots')
      .select('rating_count')
      .eq('tenant_id', tenantId)
      .gte('ymd', addDaysYmd(budapestTodayYmd(), -30))
      .order('ymd', { ascending: true })
      .limit(1)
      .maybeSingle()
  ])
  if (companyRes.error) return empty

  const c = companyRes.data
  const count = c?.google_rating_count ?? null
  const base = snapRes.error ? null : (snapRes.data?.rating_count ?? null)
  return {
    rating: c?.google_rating != null ? Number(c.google_rating) : null,
    count,
    delta30d: count != null && base != null ? Math.max(0, count - base) : null,
    fetchedAt: c?.google_rating_fetched_at ?? null,
    hasPlaceId: Boolean(c?.google_place_id),
    available: true
  }
}

async function fetchPlaceRating(
  placeId: string,
  apiKey: string
): Promise<{ rating: number | null; count: number } | null> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'rating,userRatingCount' },
    cache: 'no-store'
  })
  if (!res.ok) {
    console.error('fetchPlaceRating', res.status)
    return null
  }
  const body = (await res.json()) as { rating?: number; userRatingCount?: number }
  return {
    rating: typeof body.rating === 'number' ? Math.round(body.rating * 10) / 10 : null,
    count: typeof body.userRatingCount === 'number' ? body.userRatingCount : 0
  }
}

/** Cron: tenantonként 3 óránként, 7–19 óra között frissít. Kulcs nélkül csendben kimarad. */
export async function refreshGoogleRatings(admin: SupabaseClient): Promise<{ refreshed: number }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return { refreshed: 0 }
  const hour = budapestHour()
  if (hour < REFRESH_HOUR_FROM || hour >= REFRESH_HOUR_TO) return { refreshed: 0 }

  const staleBefore = new Date(Date.now() - REFRESH_MS).toISOString()
  const { data, error } = await admin
    .from('tenant_companies')
    .select('tenant_id, google_place_id')
    .not('google_place_id', 'is', null)
    .or(`google_rating_fetched_at.is.null,google_rating_fetched_at.lt.${staleBefore}`)
    .limit(REFRESH_BATCH)
  if (error) {
    if (error.code !== '42703') console.error('refreshGoogleRatings', error.message)
    return { refreshed: 0 }
  }

  const today = budapestTodayYmd()
  let refreshed = 0
  for (const row of data ?? []) {
    const nowIso = new Date().toISOString()
    const result = await fetchPlaceRating(row.google_place_id as string, apiKey)
    if (!result) {
      // Hibás Place ID se kérdezzen óránként újra.
      await admin
        .from('tenant_companies')
        .update({ google_rating_fetched_at: nowIso })
        .eq('tenant_id', row.tenant_id)
      continue
    }
    await admin
      .from('tenant_companies')
      .update({
        google_rating: result.rating,
        google_rating_count: result.count,
        google_rating_fetched_at: nowIso
      })
      .eq('tenant_id', row.tenant_id)
    await admin.from('google_rating_snapshots').upsert(
      { tenant_id: row.tenant_id, ymd: today, rating: result.rating, rating_count: result.count },
      { onConflict: 'tenant_id,ymd' }
    )
    refreshed += 1
  }
  return { refreshed }
}
