import { randomBytes } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { FeedConfig, FeedKind, FeedSourceRow } from './build'

export type OpenAiFeedSettings = {
  enabled: boolean
  token: string
  siteBaseUrl: string
  sheetPath: string
  linearPath: string
  country: string
  currency: string
  pickupText: string
  returnPolicyUrl: string
  returnDays: number
  lastFetchedAt: string | null
  lastItemCount: number | null
}

const SETTINGS_COLUMNS =
  'tenant_id, enabled, token, site_base_url, sheet_path, linear_path, country, currency, pickup_text, return_policy_url, return_days, last_fetched_at, last_item_count'

type SettingsRow = {
  tenant_id: string
  enabled: boolean
  token: string
  site_base_url: string
  sheet_path: string
  linear_path: string
  country: string
  currency: string
  pickup_text: string
  return_policy_url: string
  return_days: number
  last_fetched_at: string | null
  last_item_count: number | null
}

function mapSettings(r: SettingsRow): OpenAiFeedSettings {
  return {
    enabled: r.enabled,
    token: r.token,
    siteBaseUrl: r.site_base_url,
    sheetPath: r.sheet_path,
    linearPath: r.linear_path,
    country: r.country,
    currency: r.currency,
    pickupText: r.pickup_text,
    returnPolicyUrl: r.return_policy_url,
    returnDays: r.return_days,
    lastFetchedAt: r.last_fetched_at,
    lastItemCount: r.last_item_count
  }
}

export function newFeedToken(): string {
  return randomBytes(24).toString('base64url')
}

export async function getOpenAiFeedSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ available: boolean; settings: OpenAiFeedSettings | null }> {
  const { data, error } = await supabase
    .from('product_feeds')
    .select(SETTINGS_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('kind', 'openai')
    .maybeSingle()
  if (error) {
    console.error('getOpenAiFeedSettings', error.message)
    return { available: false, settings: null }
  }
  return { available: true, settings: data ? mapSettings(data as SettingsRow) : null }
}

export async function getOpenAiFeedByToken(
  service: SupabaseClient,
  token: string
): Promise<{ tenantId: string; settings: OpenAiFeedSettings; sellerName: string } | null> {
  const { data, error } = await service
    .from('product_feeds')
    .select(SETTINGS_COLUMNS)
    .eq('token', token)
    .eq('kind', 'openai')
    .eq('enabled', true)
    .maybeSingle()
  if (error || !data) return null
  const row = data as SettingsRow
  const { data: company } = await service
    .from('tenant_companies')
    .select('name')
    .eq('tenant_id', row.tenant_id)
    .maybeSingle()
  return { tenantId: row.tenant_id, settings: mapSettings(row), sellerName: company?.name?.trim() || '' }
}

export function feedConfig(settings: OpenAiFeedSettings, sellerName: string): FeedConfig {
  return {
    siteBaseUrl: settings.siteBaseUrl,
    sheetPath: settings.sheetPath,
    linearPath: settings.linearPath,
    country: settings.country,
    currency: settings.currency,
    sellerName,
    pickupText: settings.pickupText,
    returnPolicyUrl: settings.returnPolicyUrl,
    returnDays: settings.returnDays
  }
}

type MaterialRow = {
  id: string
  name: string
  slug: string | null
  indexable_on_site: boolean | null
  feed_excluded: boolean | null
  image_url: string | null
  length_mm: number | null
  width_mm: number | null
  thickness_mm: number | null
  price_net: number | null
  on_stock: boolean | null
  material_type?: string | null
  manufacturers: { name: string | null } | { name: string | null }[] | null
  tax_rates: { rate_percent: number | null } | { rate_percent: number | null }[] | null
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

const PAGE = 1000

async function loadTable(supabase: SupabaseClient, tenantId: string, kind: FeedKind): Promise<FeedSourceRow[]> {
  const table = kind === 'sheet' ? 'sheet_materials' : 'linear_materials'
  const cols = `id, name, slug, indexable_on_site, feed_excluded, image_url, length_mm, width_mm, thickness_mm, price_net, on_stock,${kind === 'linear' ? ' material_type,' : ''} manufacturers ( name ), tax_rates ( rate_percent )`
  const out: FeedSourceRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(cols)
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .order('name')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Feed betöltés (${table}): ${error.message}`)
    const rows = (data ?? []) as unknown as MaterialRow[]
    for (const r of rows) {
      out.push({
        kind,
        id: r.id,
        name: r.name,
        brand: one(r.manufacturers)?.name ?? null,
        materialType: r.material_type ?? null,
        slug: r.slug,
        indexable: Boolean(r.indexable_on_site),
        excluded: Boolean(r.feed_excluded),
        imageUrl: r.image_url,
        lengthMm: r.length_mm,
        widthMm: r.width_mm,
        thicknessMm: r.thickness_mm,
        priceNet: r.price_net,
        vatPercent: one(r.tax_rates)?.rate_percent ?? null,
        onStock: Boolean(r.on_stock)
      })
    }
    if (rows.length < PAGE) break
  }
  return out
}

export async function loadFeedRows(supabase: SupabaseClient, tenantId: string): Promise<FeedSourceRow[]> {
  const [sheet, linear] = await Promise.all([
    loadTable(supabase, tenantId, 'sheet'),
    loadTable(supabase, tenantId, 'linear')
  ])
  return [...sheet, ...linear]
}
