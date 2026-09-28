import { ArrowRight, FolderOpen, Search, SlidersHorizontal } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { after } from 'next/server'

import { LoadMore } from '@/components/storefront/load-more'
import { ProductGrid } from '@/components/storefront/product-grid'
import { RecordSearch } from '@/components/storefront/recently-viewed'
import { SearchClickTracker } from '@/components/storefront/search-click-tracker'
import { StorefrontFrame } from '@/components/storefront/storefront-chrome'
import { CATALOG_PAGE_SIZE, parsePageParam } from '@/lib/storefront/catalog-params'
import { runSearch } from '@/lib/storefront/search/engine'
import { logSearch } from '@/lib/storefront/search/log'
import { childCategories, getStorefrontShell } from '@/lib/storefront/shell'
import { categoryPath, productPath, STOREFRONT_SEARCH } from '@/lib/storefront/url'

type PageProps = {
  params: Promise<{ site: string }>
  searchParams: Promise<{
    q?: string | string[]
    page?: string | string[]
    pontos?: string | string[]
  }>
}

/** A kereső RPC ennyi találatot ad vissza egyszerre (storefront_search_v2). */
const SEARCH_MAX_SHOWN = 192

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

function searchHref(q: string, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ q, ...extra })
  return `${STOREFRONT_SEARCH}?${p.toString()}`
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const q = first((await searchParams).q).trim()
  const shell = await getStorefrontShell((await params).site)
  const name = shell?.seller.name ?? 'Bolt'
  return {
    title: { absolute: q ? `„${q}” keresés · ${name}` : `Keresés · ${name}` },
    robots: { index: false, follow: true }
  }
}

export default async function StorefrontSearchPage({ params, searchParams }: PageProps) {
  const sp = await searchParams
  const q = first(sp.q).trim().slice(0, 120)
  const page = parsePageParam(first(sp.page))
  const exact = first(sp.pontos) === '1'
  const shell = await getStorefrontShell((await params).site)
  if (!shell) notFound()
  const { admin, tenant, seller, settings, categories } = shell

  const limit = Math.min(page * CATALOG_PAGE_SIZE, SEARCH_MAX_SHOWN)
  const result = q
    ? await runSearch(admin, tenant.id, categories, q, { limit, exact })
    : null
  const items = result?.items ?? []
  const total = result?.total ?? 0

  if (q && page === 1) {
    after(() =>
      logSearch(admin, tenant.id, {
        q,
        source: 'page',
        results: total,
        corrected: result?.corrected ?? null,
        relaxed: result?.relaxed ?? false
      })
    )
  }
  if (result?.exactSlug && page === 1) redirect(productPath(result.exactSlug))

  const top = childCategories(categories, null)
  const intent = result?.intent ?? null
  const hitCategories = (result?.categories ?? []).filter((c) => c.id !== intent?.categoryId)
  const nextHref =
    items.length < total && items.length < SEARCH_MAX_SHOWN
      ? searchHref(q, { page: String(page + 1), ...(exact ? { pontos: '1' } : {}) })
      : null

  return (
    <StorefrontFrame seller={seller} settings={settings} categories={categories}>
      {q && total > 0 ? <RecordSearch term={q} /> : null}
      <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-5 lg:px-8 lg:pt-8">
        <form
          action={STOREFRONT_SEARCH}
          method="get"
          role="search"
          className="flex h-11 max-w-[560px] items-center gap-2 rounded-md border border-stone-300 bg-white px-3 focus-within:border-ink"
        >
          <Search className="size-4 shrink-0 text-ink-secondary" aria-hidden />
          <label htmlFor="kereses-q" className="sr-only">
            Keresés a boltban
          </label>
          <input
            id="kereses-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Termék, méret, szín vagy cikkszám"
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

        {q ? (
          <h1 className="mt-6 text-[18px] font-bold tracking-tight text-ink">
            {total > 0
              ? `${total} találat erre: „${result?.corrected ?? q}”`
              : `Nincs találat erre: „${q}”`}
          </h1>
        ) : (
          <h1 className="mt-6 text-[18px] font-bold tracking-tight text-ink">Keresés</h1>
        )}

        {result?.corrected && total > 0 ? (
          <p className="mt-1 text-[14px] text-ink-secondary">
            Elgépelést javítottunk. Inkább erre keresnél:{' '}
            <Link
              href={searchHref(q, { pontos: '1' })}
              className="cursor-pointer font-medium text-ink underline underline-offset-2"
            >
              „{q}”
            </Link>
            ?
          </p>
        ) : null}

        {result?.relaxed && total > 0 ? (
          <p className="mt-1 text-[14px] text-ink-secondary">
            Nem találtunk minden szóra egyező terméket — ezek állnak a legközelebb.
          </p>
        ) : null}

        {intent || hitCategories.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {intent ? (
              <Link
                href={intent.href}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-stone-300 px-3 text-[14px] font-medium text-ink hover:border-ink"
              >
                {intent.facets.length > 0 ? (
                  <SlidersHorizontal className="size-4" aria-hidden />
                ) : (
                  <FolderOpen className="size-4" aria-hidden />
                )}
                {intent.facets.length > 0 ? `Szűrve: ${intent.label}` : `Kategória: ${intent.label}`}
                <ArrowRight className="size-4 text-ink-secondary" aria-hidden />
              </Link>
            ) : null}
            {hitCategories.map((c) => (
              <Link
                key={c.id}
                href={categoryPath(c.slug)}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-stone-300 px-3.5 text-[14px] text-ink hover:border-ink"
              >
                {c.name}
                <span className="tabular-nums text-ink-secondary">{c.count}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="mt-5">
            <SearchClickTracker q={q}>
              <ProductGrid items={items} settings={settings} eagerFirst />
            </SearchClickTracker>
            <LoadMore shown={items.length} total={total} nextHref={nextHref} />
          </div>
        ) : (
          <div className="mt-4 space-y-5 text-[14px] text-ink-secondary">
            {q ? (
              <p>
                Próbáld rövidebben vagy más szóval (pl. csak „fogantyú 160”).
                {seller.email ? (
                  <>
                    {' '}
                    Nem találod?{' '}
                    <a
                      href={`mailto:${seller.email}?subject=${encodeURIComponent(`Termékkeresés: ${q}`)}`}
                      className="cursor-pointer font-medium text-ink underline underline-offset-2"
                    >
                      Írd meg, mit keresel
                    </a>
                    .
                  </>
                ) : null}
              </p>
            ) : null}
            {top.length > 0 ? (
              <div>
                <p className="font-medium text-ink">Kategóriák</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {top.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={categoryPath(c.slug)}
                        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-stone-300 px-3.5 text-ink hover:border-ink"
                      >
                        {c.name}
                        <span className="tabular-nums text-ink-secondary">
                          {c.productCount}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </StorefrontFrame>
  )
}
