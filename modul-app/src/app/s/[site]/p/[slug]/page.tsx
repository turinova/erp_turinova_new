import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { StorefrontPdpView } from '@/components/storefront/pdp-view'
import { loadRequiredCards, loadSimilarCards } from '@/lib/storefront/catalog'
import { getPublicPdpBySlugCached } from '@/lib/storefront/pdp'
import { buildPdpJsonLd } from '@/lib/storefront/pdp-jsonld'
import {
  categoryChain,
  childCategories,
  getStorefrontShell
} from '@/lib/storefront/shell'
import { categoryCrumbs, jsonLdString } from '@/lib/storefront/structured-data'
import { categoryPath, productPath, siteUrl } from '@/lib/storefront/url'

export const revalidate = 60

type PageProps = {
  params: Promise<{ site: string; slug: string }>
}

async function load(site: string, slug: string) {
  const shell = await getStorefrontShell(site)
  if (!shell) return null
  const payload = await getPublicPdpBySlugCached(shell.admin, shell.tenant, slug)
  if (!payload) return null
  return { shell, payload }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { site, slug } = await params
  const data = await load(site, slug)
  if (!data) return { title: 'Termék nem található' }
  const { payload, shell } = data

  const desc =
    payload.product.descriptionShort || payload.product.descriptionLong || undefined
  const url = siteUrl(shell.tenant.base, productPath(payload.product.slug))
  return {
    title: { absolute: `${payload.product.title} · ${payload.seller.name}` },
    description: desc?.slice(0, 160),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      siteName: payload.seller.name,
      locale: 'hu_HU',
      title: payload.product.title,
      description: desc?.slice(0, 160),
      images: payload.product.imageUrl ? [{ url: payload.product.imageUrl }] : undefined
    }
  }
}

export default async function PublicPdpPage({ params }: PageProps) {
  const { site, slug } = await params
  const data = await load(site, slug)
  if (!data) notFound()
  const { shell, payload } = data
  const { product } = payload

  const chain = categoryChain(shell.categories, product.categoryId)
  const leaf = chain[chain.length - 1] ?? null
  const siblings = leaf ? childCategories(shell.categories, leaf.parentId) : []
  const primary = product.keySpecs[0] ?? null

  const [required, similar] = await Promise.all([
    loadRequiredCards(shell.admin, shell.tenant.id, product.id),
    loadSimilarCards(shell.admin, shell.tenant.id, {
      categoryId: product.categoryId,
      excludeIds: [product.id, ...product.variants.map((v) => v.id)],
      primaryAttributeId: primary?.valueNum != null ? primary.attributeId : null,
      primaryValue: primary?.valueNum ?? null,
      limit: 4
    })
  ])

  const pageUrl = siteUrl(shell.tenant.base, productPath(product.slug))
  const jsonLd = buildPdpJsonLd(payload, {
    base: shell.tenant.base,
    pageUrl,
    crumbs: [
      ...categoryCrumbs(payload.seller.name, chain),
      { name: product.title, path: null }
    ],
    required,
    similar
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <StorefrontPdpView
        payload={payload}
        categories={shell.categories}
        chain={chain}
        siblings={siblings}
        required={required}
        similar={similar}
        similarMore={
          leaf && leaf.productCount > similar.length + 1
            ? { href: categoryPath(leaf.slug), count: leaf.productCount }
            : null
        }
      />
    </>
  )
}
