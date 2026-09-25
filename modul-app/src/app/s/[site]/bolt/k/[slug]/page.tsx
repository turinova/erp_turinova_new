import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CategoryBreadcrumb } from '@/components/storefront/category-breadcrumb'
import { Pagination, ProductGrid } from '@/components/storefront/product-grid'
import { StorefrontFrame } from '@/components/storefront/storefront-chrome'
import {
  CATALOG_PAGE_SIZE,
  listCategoryProducts,
  type CatalogFacet
} from '@/lib/storefront/catalog'
import {
  categoryChain,
  childCategories,
  getStorefrontShell,
  type StorefrontCategory
} from '@/lib/storefront/shell'
import {
  breadcrumbNode,
  categoryCrumbs,
  graph,
  itemListNode,
  jsonLdString,
  orgId,
  websiteId
} from '@/lib/storefront/structured-data'
import { categoryPath, siteUrl, STOREFRONT_HOME } from '@/lib/storefront/url'
import { cn } from '@/lib/utils'

type PageProps = {
  params: Promise<{ site: string; slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function flatParams(
  raw: Record<string, string | string[] | undefined>
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = Array.isArray(v) ? v[0] : v
  return out
}

function findCategory(categories: StorefrontCategory[], slug: string) {
  const s = decodeURIComponent(slug).toLowerCase()
  return categories.find((c) => c.slug === s) ?? null
}

function hrefWith(
  base: string,
  params: Record<string, string | undefined>,
  patch: Record<string, string | undefined>
): string {
  const next = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...params, ...patch })) {
    if (v) next.set(k, v)
  }
  const qs = next.toString()
  return qs ? `${base}?${qs}` : base
}

export async function generateMetadata({
  params,
  searchParams
}: PageProps): Promise<Metadata> {
  const [{ site, slug }, sp] = await Promise.all([params, searchParams])
  const shell = await getStorefrontShell(site)
  const category = shell ? findCategory(shell.categories, slug) : null
  if (!shell || !category) return { title: 'Kategória nem található' }
  const url = siteUrl(shell.tenant.base, categoryPath(category.slug))
  const filtered = Object.keys(sp).some((k) => k !== 'page')
  const subs = childCategories(shell.categories, category.id).map((c) => c.name)
  const description = [
    `${category.name} — ${category.productCount} termék a ${shell.seller.name} webboltban.`,
    subs.length ? subs.slice(0, 5).join(', ') + '.' : ''
  ]
    .join(' ')
    .trim()
  return {
    title: { absolute: `${category.name} · ${shell.seller.name}` },
    description: description.slice(0, 160),
    alternates: { canonical: url },
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: { type: 'website', url, siteName: shell.seller.name, title: category.name }
  }
}

export default async function StorefrontCategoryPage({ params, searchParams }: PageProps) {
  const [{ site, slug }, rawSp] = await Promise.all([params, searchParams])
  const shell = await getStorefrontShell(site)
  if (!shell) notFound()
  const category = findCategory(shell.categories, slug)
  if (!category) notFound()

  const sp = flatParams(rawSp)
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)
  const { admin, tenant, seller, settings, categories } = shell
  const { items, total, facets } = await listCategoryProducts(
    admin,
    tenant.id,
    categories,
    category,
    sp,
    page
  )

  const chain = categoryChain(categories, category.id)
  const siblings = childCategories(categories, category.parentId)
  const subs = childCategories(categories, category.id)
  const base = categoryPath(category.slug)
  const activeFilters = facets.filter((f) => f.values.some((v) => v.selected))

  const jsonLd = graph([
    {
      '@type': 'CollectionPage',
      '@id': siteUrl(tenant.base, `${base}#page`),
      url: siteUrl(tenant.base, base),
      name: category.name,
      isPartOf: { '@id': websiteId(tenant.base) },
      publisher: { '@id': orgId(tenant.base) },
      mainEntity: itemListNode(items, tenant.base, (page - 1) * CATALOG_PAGE_SIZE)
    },
    breadcrumbNode(categoryCrumbs(seller.name, chain), tenant.base)
  ])

  return (
    <StorefrontFrame seller={seller} settings={settings} categories={categories}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-5 lg:px-8 lg:pt-8">
        <CategoryBreadcrumb
          home={{ label: seller.name, href: STOREFRONT_HOME }}
          chain={chain}
          siblings={siblings}
        />
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-[22px] font-bold tracking-tight text-ink">{category.name}</h1>
          <p className="text-[13px] tabular-nums text-ink-secondary">{total} termék</p>
        </div>

        {subs.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Alkategóriák">
            {subs.map((s) => (
              <li key={s.id}>
                <Link
                  href={categoryPath(s.slug)}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-stone-300 px-3.5 text-[14px] text-ink hover:border-ink"
                >
                  {s.name}
                  <span className="tabular-nums text-ink-secondary">{s.productCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {facets.length > 0 ? (
          <FacetBar facets={facets} base={base} params={sp} />
        ) : null}

        {activeFilters.length > 0 ? (
          <p className="mt-3 text-[13px]">
            <Link
              href={base}
              className="cursor-pointer font-medium text-ink underline underline-offset-2"
            >
              Szűrők törlése
            </Link>
          </p>
        ) : null}

        <div className="mt-6">
          {items.length === 0 ? (
            <p className="rounded-md bg-stone-50 px-4 py-6 text-[14px] text-ink-secondary">
              Nincs a szűrésnek megfelelő termék.{' '}
              <Link href={base} className="cursor-pointer font-medium text-ink underline">
                Összes {category.name.toLowerCase()} mutatása
              </Link>
            </p>
          ) : (
            <ProductGrid items={items} eagerFirst />
          )}
        </div>

        <div className="mt-8">
          <Pagination
            page={page}
            total={total}
            pageSize={CATALOG_PAGE_SIZE}
            hrefFor={(p) => hrefWith(base, sp, { page: p > 1 ? String(p) : undefined })}
          />
        </div>
      </main>
    </StorefrontFrame>
  )
}

function FacetBar({
  facets,
  base,
  params
}: {
  facets: CatalogFacet[]
  base: string
  params: Record<string, string | undefined>
}) {
  return (
    <div className="mt-5 space-y-3 border-y border-stone-200 py-4">
      {facets.map((f) => (
        <div key={f.param} className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <span className="w-full text-[13px] font-medium text-ink-secondary sm:w-auto sm:min-w-28">
            {f.name}
          </span>
          <ul className="flex flex-wrap gap-1.5">
            {f.values.map((v) => (
              <li key={v.value}>
                <Link
                  href={hrefWith(base, params, {
                    [f.param]: v.selected ? undefined : v.value,
                    page: undefined
                  })}
                  aria-pressed={v.selected}
                  rel="nofollow"
                  className={cn(
                    'inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border px-2.5 text-[13px] tabular-nums',
                    v.selected
                      ? 'border-ink bg-ink font-medium text-white'
                      : 'border-stone-300 text-ink hover:border-ink'
                  )}
                >
                  {v.label}
                  <span className={v.selected ? 'text-white/80' : 'text-ink-secondary'}>
                    {v.selected ? '✕' : v.count}
                  </span>
                  {v.selected ? <span className="sr-only">— szűrő kikapcsolása</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
