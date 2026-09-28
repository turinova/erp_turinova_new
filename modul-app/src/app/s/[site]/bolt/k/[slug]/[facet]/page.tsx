import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CategoryPageView } from '@/components/storefront/category-page'
import {
  categoryMetadata,
  loadCategoryView,
  paramsKey,
  type RawSearchParams
} from '@/lib/storefront/category-view'

type PageProps = {
  params: Promise<{ site: string; slug: string; facet: string }>
  searchParams: Promise<RawSearchParams>
}

/** Egyértékű szűrőoldal, pl. /bolt/k/profilfogantyuk/128-mm (doc 40 §3h). */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ site, slug, facet }, sp] = await Promise.all([params, searchParams])
  const view = await loadCategoryView(site, slug, facet, paramsKey(sp))
  if (!view?.listing.preset) return { title: 'Oldal nem található' }
  return categoryMetadata(view)
}

export default async function StorefrontCategoryFacetPage({ params, searchParams }: PageProps) {
  const [{ site, slug, facet }, sp] = await Promise.all([params, searchParams])
  const view = await loadCategoryView(site, slug, facet, paramsKey(sp))
  if (!view?.listing.preset) notFound()
  return <CategoryPageView view={view} />
}
