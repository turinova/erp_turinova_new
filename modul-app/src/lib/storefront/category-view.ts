/**
 * Kategória oldal + egyértékű szűrőoldal közös betöltése (doc 40 §3d, §3h).
 * A metadata és az oldal ugyanazt a (kérésenként gyorsítótárazott) listát használja.
 */

import type { Metadata } from 'next'
import { cache } from 'react'

import {
  FACET_PAGE_MIN,
  listCategoryProducts,
  type CategoryListing
} from '@/lib/storefront/catalog'
import { factSentence, titleRange } from '@/lib/storefront/category-facts'
import { CATALOG_PARAM, parsePageParam, type CatalogParams } from '@/lib/storefront/catalog-params'
import {
  categoryChain,
  getStorefrontShell,
  type StorefrontCategory,
  type StorefrontShell
} from '@/lib/storefront/shell'
import { categoryFacetPath, categoryPath, siteUrl } from '@/lib/storefront/url'

export type RawSearchParams = Record<string, string | string[] | undefined>

export type CategoryView = {
  shell: StorefrontShell
  category: StorefrontCategory
  chain: StorefrontCategory[]
  /** URL-paraméterek + az útvonalas szűrő (linkek ebből épülnek). */
  params: CatalogParams
  page: number
  listing: CategoryListing
  /** A kategória tiszta címe (szűrő nélkül). */
  base: string
  /** H1: kategória, útvonalas szűrőnél „Kategória, 128 mm”. */
  heading: string
  /** Útvonalas szűrőoldal kérése volt-e (érvénytelen értéknél is). */
  facetRequested: boolean
  /** Csak az útvonalas szűrő aktív (lapozáson kívül nincs más paraméter). */
  presetOnly: boolean
}

export function flatParams(raw: RawSearchParams): CatalogParams {
  const out: CatalogParams = {}
  for (const [k, v] of Object.entries(raw)) out[k] = Array.isArray(v) ? v[0] : v
  return out
}

export function paramsKey(raw: RawSearchParams): string {
  return JSON.stringify(
    Object.entries(flatParams(raw))
      .filter(([, v]) => v != null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
  )
}

function findCategory(categories: StorefrontCategory[], slug: string) {
  const s = decodeURIComponent(slug).toLowerCase()
  return categories.find((c) => c.slug === s) ?? null
}

export const loadCategoryView = cache(
  async (site: string, slug: string, facet: string | null, key: string): Promise<CategoryView | null> => {
    const shell = await getStorefrontShell(site)
    if (!shell) return null
    const category = findCategory(shell.categories, slug)
    if (!category) return null
    const sp = Object.fromEntries(JSON.parse(key) as [string, string][]) as CatalogParams
    const page = parsePageParam(sp[CATALOG_PARAM.page])
    const facetValue = facet ? decodeURIComponent(facet).toLowerCase() : null
    const listing = await listCategoryProducts(
      shell.admin,
      shell.tenant.id,
      shell.categories,
      category,
      sp,
      page,
      { reviewsEnabled: shell.settings.reviewsEnabled, facetValue, withOrders: true }
    )
    const preset = listing.preset
    const params: CatalogParams = preset ? { ...sp, [preset.param]: preset.value } : sp
    const others = Object.keys(sp).filter((k) => k !== CATALOG_PARAM.page && k !== preset?.param)
    return {
      shell,
      category,
      chain: categoryChain(shell.categories, category.id),
      params,
      page,
      listing,
      base: categoryPath(category.slug),
      heading: preset ? `${category.name}, ${preset.label}` : category.name,
      facetRequested: facet != null,
      presetOnly: preset != null && others.length === 0
    }
  }
)

/** Egyetlen szűrőérték (és semmi más) → az útvonalas oldal címe, ha elég termék van hozzá. */
export function facetLandingHref(
  view: Pick<CategoryView, 'category' | 'params'>,
  param: string,
  value: string,
  count: number
): string | null {
  if (count < FACET_PAGE_MIN) return null
  const others = Object.entries(view.params).filter(
    ([k, v]) => v && k !== param && k !== CATALOG_PARAM.page
  )
  return others.length === 0 ? categoryFacetPath(view.category.slug, value) : null
}

/** Az aktuális oldal kanonikus címe + indexelhetőség. */
export function categoryIndexing(view: CategoryView): { canonical: string; index: boolean } {
  const { listing, category, base } = view
  const preset = listing.preset
  if (preset) {
    const eligible = listing.total >= FACET_PAGE_MIN
    return {
      canonical: eligible ? categoryFacetPath(category.slug, preset.value) : base,
      index: eligible && view.presetOnly
    }
  }
  const filtered = Object.keys(view.params).some((k) => k !== CATALOG_PARAM.page)
  return { canonical: base, index: !filtered }
}

export function categoryMetadata(view: CategoryView): Metadata {
  const { shell, category, listing, heading } = view
  const { canonical, index } = categoryIndexing(view)
  const url = siteUrl(shell.tenant.base, canonical)
  const skip = listing.preset?.param ?? null
  const range = titleRange(listing.summary, skip)
  const count = listing.summary.total
  const title = `${heading}${range ? ` ${range}` : ''}${count > 0 ? ` – ${count} termék` : ''} · ${shell.seller.name}`
  const facts = factSentence(listing.summary, skip)
  const description = [listing.preset ? null : category.intro, facts ? `${heading}: ${facts}` : null]
    .filter(Boolean)
    .join(' ')
  const image = category.cover?.imageUrl ?? listing.items.find((i) => i.imageUrl)?.imageUrl ?? null
  return {
    title: { absolute: title },
    description: (description || `${heading} — ${shell.seller.name}`).slice(0, 160),
    alternates: { canonical: url },
    robots: index ? undefined : { index: false, follow: true },
    openGraph: {
      type: 'website',
      url,
      siteName: shell.seller.name,
      title: heading,
      ...(image ? { images: [{ url: image }] } : {})
    }
  }
}
