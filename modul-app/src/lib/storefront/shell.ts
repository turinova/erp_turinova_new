/**
 * Storefront közös adat (fejléc, lábléc, kategóriafa) — kérésenként egyszer.
 */

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getTenantCompany, type TenantCompanyRow } from '@/lib/company/queries'
import {
  resolveStorefrontTenant,
  type StorefrontTenant
} from '@/lib/storefront/resolve-tenant'
import { slugifyHu } from '@/lib/storefront/url'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { createServiceClient } from '@/lib/supabase/service'
import { sellerDefaultsOf } from '@/lib/webshop/legal/context'
import { joinAddress } from '@/lib/webshop/legal/derive'
import { getWebshopLegalSettings } from '@/lib/webshop/legal/settings'
import type { WebshopLegalSettings } from '@/lib/webshop/legal/types'
import {
  getStorefrontSettings,
  type StorefrontSettings
} from '@/lib/webshop/settings'

export type StorefrontSeller = {
  name: string
  logoUrl: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  taxNumber: string | null
  registrationNumber: string | null
  vatId: string | null
}

export type StorefrontCategory = {
  id: string
  name: string
  slug: string
  parentId: string | null
  sortOrder: number
  googleTaxonomyId: string | null
  /** Saját + leszármazott kategóriák közzétett termékei. */
  productCount: number
  /** Kézi borító, különben a legtöbb rendelésben szereplő (raktáron lévő) termék képe; szülőnél a leszármazottakból. */
  cover: { imageUrl: string; title: string } | null
  /** Legkisebb bruttó ár a saját + leszármazott termékek közül. */
  priceFrom: number | null
  /** Kézi bevezető a H1 alatt (≤300 kar.). */
  intro: string | null
}

type CoverRow = {
  web_category_id: string
  accessory_id: string | null
  image_url: string | null
  title: string | null
  manual: boolean
  in_stock: boolean
  is_part: boolean
  group_orders: number
  group_size: number
  min_price_gross: number | null
  group_count: number | null
}

type CoverCandidate = {
  imageUrl: string
  title: string
  inStock: boolean
  isPart: boolean
  orders: number
  size: number
}

function betterCover(a: CoverCandidate, b: CoverCandidate): number {
  return (
    Number(b.inStock) - Number(a.inStock) ||
    Number(a.isPart) - Number(b.isPart) ||
    b.orders - a.orders ||
    b.size - a.size
  )
}

async function loadCategoryRows(admin: SupabaseClient, tenantId: string) {
  const query = (cols: string) =>
    admin
      .from('web_categories')
      .select(cols)
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .limit(500)
  const res = await query('id, name, slug, parent_id, sort_order, google_taxonomy_id, intro')
  // 42703: a 20260550 migráció előtt nincs intro oszlop — a bolt enélkül is menjen.
  if (res.error?.code === '42703') {
    return query('id, name, slug, parent_id, sort_order, google_taxonomy_id')
  }
  return res
}

/** 20260550 előtt: kategóriánként az első képes termék (hogy a csempe ne legyen üres). */
async function firstImages(admin: SupabaseClient, tenantId: string): Promise<Map<string, string>> {
  const { data, error } = await fetchAllPages<{ web_category_id: string; image_url: string | null }>(
    (from, to) =>
      admin
        .from('storefront_products')
        .select('web_category_id, image_url')
        .eq('tenant_id', tenantId)
        .eq('sellable_web', true)
        .eq('active', true)
        .is('deleted_at', null)
        .not('web_category_id', 'is', null)
        .not('image_url', 'is', null)
        .order('id', { ascending: true })
        .range(from, to),
    20000
  )
  if (error) console.error('loadCategories images', error)
  const out = new Map<string, string>()
  for (const r of data) {
    const url = r.image_url?.trim()
    if (url && !out.has(r.web_category_id)) out.set(r.web_category_id, url)
  }
  return out
}

export type StorefrontShell = {
  admin: SupabaseClient
  tenant: StorefrontTenant
  seller: StorefrontSeller
  settings: StorefrontSettings
  categories: StorefrontCategory[]
}

/** ERP cégadat az alapérték; a webshop jogi beállításai felülírják. */
export function buildSeller(
  company: TenantCompanyRow | null,
  tenant: StorefrontTenant,
  legal?: WebshopLegalSettings
): StorefrontSeller {
  const d = sellerDefaultsOf(company, tenant.name || 'Bolt')
  return {
    name: legal?.sellerName ?? d.sellerName,
    logoUrl: company?.logo_url ?? null,
    email: legal?.email ?? d.email,
    phone: legal?.phone ?? d.phone,
    website: d.website,
    address: joinAddress([
      legal?.postalCode ?? d.postalCode,
      legal?.city ?? d.city,
      legal?.address ?? d.address
    ]),
    taxNumber: legal?.taxNumber ?? d.taxNumber,
    registrationNumber: legal?.registrationNumber ?? d.registrationNumber,
    vatId: legal?.vatId ?? d.vatId
  }
}

async function loadCategories(
  admin: SupabaseClient,
  tenantId: string
): Promise<StorefrontCategory[]> {
  const [catsRes, prodRes, coverRes] = await Promise.all([
    loadCategoryRows(admin, tenantId),
    admin.rpc('storefront_category_counts', { p_tenant: tenantId }),
    admin.rpc('storefront_category_covers', { p_tenant: tenantId, p_days: 180 })
  ])
  if (catsRes.error) {
    console.error('loadCategories', catsRes.error.message)
    return []
  }
  if (prodRes.error) console.error('loadCategories counts', prodRes.error.message)
  if (coverRes.error) console.error('loadCategories covers', coverRes.error.message)

  const rows = (catsRes.data ?? []) as unknown as Record<string, unknown>[]
  const ids = new Set(rows.map((r) => String(r.id)))
  const own = new Map<string, number>()
  for (const p of (prodRes.data ?? []) as { web_category_id: string; product_count: number }[]) {
    own.set(p.web_category_id, Number(p.product_count))
  }
  // A lista kártyát (variánscsoportot) számol — a csempe és a menü is ezt mutatja
  // (a 20260550 korábbi változatában még nincs group_count: ott marad a termékszám).
  for (const r of (coverRes.data ?? []) as CoverRow[]) {
    if (r.group_count != null) own.set(r.web_category_id, Number(r.group_count))
  }
  const fallbackImages = coverRes.error ? await firstImages(admin, tenantId) : null

  const base = rows.map((r) => {
    const parent = (r.parent_id as string | null) ?? null
    return {
      id: String(r.id),
      name: String(r.name),
      rawSlug:
        (typeof r.slug === 'string' && r.slug.trim()) || slugifyHu(String(r.name)),
      parentId: parent && ids.has(parent) ? parent : null,
      sortOrder: Number(r.sort_order ?? 100),
      googleTaxonomyId: (r.google_taxonomy_id as string | null) ?? null,
      intro: typeof r.intro === 'string' && r.intro.trim() ? r.intro.trim() : null
    }
  })

  const byId = new Map(base.map((c) => [c.id, c]))
  const used = new Set<string>()
  const slugOf = new Map<string, string>()
  for (const c of [...base].sort((a, b) => a.id.localeCompare(b.id))) {
    let slug = c.rawSlug || c.id.slice(0, 8)
    if (used.has(slug) && c.parentId) {
      slug = `${byId.get(c.parentId)?.rawSlug ?? 'k'}-${slug}`
    }
    if (used.has(slug)) slug = `${slug}-${c.id.slice(0, 6)}`
    used.add(slug)
    slugOf.set(c.id, slug)
  }

  const coverRows = new Map(
    ((coverRes.data ?? []) as CoverRow[]).map((r) => [r.web_category_id, r])
  )
  const manualCover = new Map<string, { imageUrl: string; title: string }>()
  const autoCover = new Map<string, CoverCandidate>()
  const priceFrom = new Map<string, number>()

  const ancestors = (id: string): string[] => {
    const out: string[] = []
    const seen = new Set<string>()
    let cursor: string | null = id
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor)
      out.push(cursor)
      cursor = byId.get(cursor)?.parentId ?? null
    }
    return out
  }

  const total = new Map<string, number>()
  for (const c of base) {
    const n = own.get(c.id) ?? 0
    const chain = ancestors(c.id)
    if (n > 0) {
      for (const id of chain) total.set(id, (total.get(id) ?? 0) + n)
    }
    const fallback = fallbackImages?.get(c.id)
    const cover: CoverRow | undefined =
      coverRows.get(c.id) ??
      (fallback
        ? {
            web_category_id: c.id,
            accessory_id: '',
            image_url: fallback,
            title: c.name,
            manual: false,
            in_stock: false,
            is_part: false,
            group_orders: 0,
            group_size: 0,
            min_price_gross: null,
            group_count: null
          }
        : undefined)
    if (!cover) continue
    if (cover.manual && cover.image_url) {
      manualCover.set(c.id, { imageUrl: cover.image_url, title: cover.title ?? c.name })
    }
    const min = cover.min_price_gross == null ? null : Number(cover.min_price_gross)
    const candidate: CoverCandidate | null =
      cover.image_url
        ? {
            imageUrl: cover.image_url,
            title: cover.title ?? c.name,
            inStock: cover.in_stock,
            isPart: cover.is_part,
            orders: Number(cover.group_orders ?? 0),
            size: Number(cover.group_size ?? 0)
          }
        : null
    for (const id of chain) {
      if (min != null && Number.isFinite(min)) {
        const prev = priceFrom.get(id)
        if (prev == null || min < prev) priceFrom.set(id, min)
      }
      if (candidate) {
        const prev = autoCover.get(id)
        if (!prev || betterCover(candidate, prev) < 0) autoCover.set(id, candidate)
      }
    }
  }

  return base
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: slugOf.get(c.id)!,
      parentId: c.parentId,
      sortOrder: c.sortOrder,
      googleTaxonomyId: c.googleTaxonomyId,
      productCount: total.get(c.id) ?? 0,
      cover: manualCover.get(c.id) ?? (() => {
        const a = autoCover.get(c.id)
        return a ? { imageUrl: a.imageUrl, title: a.title } : null
      })(),
      priceFrom: priceFrom.get(c.id) ?? null,
      intro: c.intro
    }))
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'hu')
    )
}

export const getStorefrontShell = cache(
  async (site?: string): Promise<StorefrontShell | null> => {
    const admin = createServiceClient()
    if (!admin) return null
    const tenant = await resolveStorefrontTenant(admin, site)
    if (!tenant) return null
    const [company, settings, legal, categories] = await Promise.all([
      getTenantCompany(admin, tenant.id).catch(() => null),
      getStorefrontSettings(admin, tenant.id),
      getWebshopLegalSettings(admin, tenant.id),
      loadCategories(admin, tenant.id)
    ])
    return {
      admin,
      tenant,
      seller: buildSeller(company, tenant, legal),
      settings,
      categories
    }
  }
)

export function categoryChain(
  categories: StorefrontCategory[],
  id: string | null
): StorefrontCategory[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const out: StorefrontCategory[] = []
  const seen = new Set<string>()
  let cursor = id ? byId.get(id) : undefined
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id)
    out.unshift(cursor)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  return out
}

export function descendantIds(
  categories: StorefrontCategory[],
  id: string
): string[] {
  const children = new Map<string, string[]>()
  for (const c of categories) {
    if (!c.parentId) continue
    const list = children.get(c.parentId) ?? []
    list.push(c.id)
    children.set(c.parentId, list)
  }
  const out: string[] = []
  const stack = [id]
  const seen = new Set<string>()
  while (stack.length > 0) {
    const cur = stack.pop()!
    if (seen.has(cur)) continue
    seen.add(cur)
    out.push(cur)
    stack.push(...(children.get(cur) ?? []))
  }
  return out
}

export function childCategories(
  categories: StorefrontCategory[],
  parentId: string | null
): StorefrontCategory[] {
  return categories.filter((c) => c.parentId === parentId && c.productCount > 0)
}
