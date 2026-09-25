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
import { createServiceClient } from '@/lib/supabase/service'
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
}

export type StorefrontShell = {
  admin: SupabaseClient
  tenant: StorefrontTenant
  seller: StorefrontSeller
  settings: StorefrontSettings
  categories: StorefrontCategory[]
}

export function buildSeller(
  company: TenantCompanyRow | null,
  tenant: StorefrontTenant
): StorefrontSeller {
  return {
    name: company?.name?.trim() || tenant.name || 'Bolt',
    logoUrl: company?.logo_url ?? null,
    email: company?.email ?? null,
    phone: company?.phone_number ?? null,
    website: company?.website ?? null,
    address:
      [company?.postal_code, company?.city, company?.address]
        .map((p) => p?.trim())
        .filter(Boolean)
        .join(' ') || null,
    taxNumber: company?.tax_number ?? null,
    registrationNumber: company?.company_registration_number ?? null,
    vatId: company?.vat_id ?? null
  }
}

async function loadCategories(
  admin: SupabaseClient,
  tenantId: string
): Promise<StorefrontCategory[]> {
  const [catsRes, prodRes] = await Promise.all([
    admin
      .from('web_categories')
      .select('id, name, slug, parent_id, sort_order, google_taxonomy_id')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .limit(500),
    admin
      .from('accessories')
      .select('web_category_id')
      .eq('tenant_id', tenantId)
      .eq('sellable_web', true)
      .eq('active', true)
      .is('deleted_at', null)
      .not('web_slug', 'is', null)
      .not('web_category_id', 'is', null)
      .limit(10000)
  ])
  if (catsRes.error) {
    console.error('loadCategories', catsRes.error.message)
    return []
  }
  if (prodRes.error) console.error('loadCategories counts', prodRes.error.message)

  const rows = (catsRes.data ?? []) as Record<string, unknown>[]
  const ids = new Set(rows.map((r) => String(r.id)))
  const own = new Map<string, number>()
  for (const p of (prodRes.data ?? []) as { web_category_id: string }[]) {
    own.set(p.web_category_id, (own.get(p.web_category_id) ?? 0) + 1)
  }

  const base = rows.map((r) => {
    const parent = (r.parent_id as string | null) ?? null
    return {
      id: String(r.id),
      name: String(r.name),
      rawSlug:
        (typeof r.slug === 'string' && r.slug.trim()) || slugifyHu(String(r.name)),
      parentId: parent && ids.has(parent) ? parent : null,
      sortOrder: Number(r.sort_order ?? 100),
      googleTaxonomyId: (r.google_taxonomy_id as string | null) ?? null
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

  const total = new Map<string, number>()
  for (const c of base) {
    const n = own.get(c.id) ?? 0
    if (n === 0) continue
    const seen = new Set<string>()
    let cursor: string | null = c.id
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor)
      total.set(cursor, (total.get(cursor) ?? 0) + n)
      cursor = byId.get(cursor)?.parentId ?? null
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
      productCount: total.get(c.id) ?? 0
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
    const [company, settings, categories] = await Promise.all([
      getTenantCompany(admin, tenant.id).catch(() => null),
      getStorefrontSettings(admin, tenant.id),
      loadCategories(admin, tenant.id)
    ])
    return {
      admin,
      tenant,
      seller: buildSeller(company, tenant),
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
