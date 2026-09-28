import { Search } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CategoryTiles } from '@/components/storefront/category-tiles'
import { StorefrontFrame } from '@/components/storefront/storefront-chrome'
import { childCategories, getStorefrontShell } from '@/lib/storefront/shell'
import {
  graph,
  jsonLdString,
  organizationNode,
  websiteNode
} from '@/lib/storefront/structured-data'
import { siteUrl, STOREFRONT_HOME, STOREFRONT_SEARCH } from '@/lib/storefront/url'

export const revalidate = 60

type PageProps = { params: Promise<{ site: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const shell = await getStorefrontShell((await params).site)
  if (!shell) return { title: 'Bolt' }
  const top = childCategories(shell.categories, null)
  const names = top.slice(0, 6).map((c) => c.name)
  const image = shell.seller.logoUrl ?? top.find((c) => c.cover)?.cover?.imageUrl
  const description = names.length
    ? `${shell.seller.name} webbolt: ${names.join(', ')}.`
    : `${shell.seller.name} webbolt.`
  return {
    title: { absolute: `${shell.seller.name} · Webbolt` },
    description: description.slice(0, 160),
    alternates: { canonical: siteUrl(shell.tenant.base, STOREFRONT_HOME) },
    openGraph: {
      type: 'website',
      url: siteUrl(shell.tenant.base, STOREFRONT_HOME),
      siteName: shell.seller.name,
      locale: 'hu_HU',
      title: shell.seller.name,
      ...(image ? { images: [{ url: image }] } : {})
    }
  }
}

export default async function StorefrontHomePage({ params }: PageProps) {
  const shell = await getStorefrontShell((await params).site)
  if (!shell) notFound()
  const { seller, settings, categories, tenant } = shell
  const top = childCategories(categories, null)

  const jsonLd = graph([
    organizationNode(seller, settings, tenant.base),
    websiteNode(seller, tenant.base)
  ])

  return (
    <StorefrontFrame seller={seller} settings={settings} categories={categories}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-8 lg:px-8 lg:pt-12">
        <h1 className="text-[22px] font-bold tracking-tight text-ink">{seller.name}</h1>

        <form
          action={STOREFRONT_SEARCH}
          method="get"
          role="search"
          className="mt-4 flex h-11 max-w-[640px] items-center gap-2 rounded-md border border-stone-300 bg-white px-3 focus-within:border-ink"
        >
          <Search className="size-4 shrink-0 text-ink-secondary" aria-hidden />
          <label htmlFor="bolt-q" className="sr-only">
            Keresés a boltban
          </label>
          <input
            id="bolt-q"
            name="q"
            type="search"
            placeholder="Termék, cikkszám vagy méret"
            autoComplete="off"
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-muted"
          />
          <button
            type="submit"
            className="h-8 shrink-0 cursor-pointer rounded-md bg-primary px-3 text-[14px] font-medium text-white hover:bg-primary-hover"
          >
            Keresés
          </button>
        </form>

        <section aria-labelledby="bolt-cats" className="mt-8">
          <h2 id="bolt-cats" className="text-[15px] font-semibold text-ink">
            Kategóriák
          </h2>
          {top.length === 0 ? (
            <p className="mt-3 text-[14px] text-ink-secondary">
              Még nincs közzétett termék.
            </p>
          ) : (
            <div className="mt-3">
              <CategoryTiles categories={top} size="lg" labelledBy="bolt-cats" />
            </div>
          )}
        </section>
      </main>
    </StorefrontFrame>
  )
}
