import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'

import { CategoryPageView } from '@/components/storefront/category-page'
import { CATALOG_PARAM } from '@/lib/storefront/catalog-params'
import {
  categoryMetadata,
  facetLandingHref,
  loadCategoryView,
  paramsKey,
  type RawSearchParams
} from '@/lib/storefront/category-view'

type PageProps = {
  params: Promise<{ site: string; slug: string }>
  searchParams: Promise<RawSearchParams>
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ site, slug }, sp] = await Promise.all([params, searchParams])
  const view = await loadCategoryView(site, slug, null, paramsKey(sp))
  if (!view) return { title: 'Kategória nem található' }
  return categoryMetadata(view)
}

export default async function StorefrontCategoryPage({ params, searchParams }: PageProps) {
  const [{ site, slug }, sp] = await Promise.all([params, searchParams])
  const view = await loadCategoryView(site, slug, null, paramsKey(sp))
  if (!view) notFound()

  // ?meret=128-mm (egyedüli szűrő) → /bolt/k/<kategória>/128-mm, ha az indexelhető.
  const keys = Object.keys(view.params).filter((k) => k !== CATALOG_PARAM.page)
  if (keys.length === 1) {
    const facet = view.listing.facets.find((f) => f.param === keys[0])
    const value = facet?.values.find((v) => v.selected)
    const landing = facet && value ? facetLandingHref(view, facet.param, value.value, value.count) : null
    if (landing) {
      permanentRedirect(view.page > 1 ? `${landing}?${CATALOG_PARAM.page}=${view.page}` : landing)
    }
  }

  return <CategoryPageView view={view} />
}
