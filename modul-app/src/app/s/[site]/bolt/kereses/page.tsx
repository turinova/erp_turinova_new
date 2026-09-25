import { Search } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Pagination, ProductGrid } from '@/components/storefront/product-grid'
import { StorefrontFrame } from '@/components/storefront/storefront-chrome'
import { CATALOG_PAGE_SIZE, searchCatalog } from '@/lib/storefront/catalog'
import { childCategories, getStorefrontShell } from '@/lib/storefront/shell'
import { categoryPath, STOREFRONT_SEARCH } from '@/lib/storefront/url'

type PageProps = {
  params: Promise<{ site: string }>
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? ''
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
  const page = Math.max(1, Number.parseInt(first(sp.page) || '1', 10) || 1)
  const shell = await getStorefrontShell((await params).site)
  if (!shell) notFound()
  const { admin, tenant, seller, settings, categories } = shell

  const { items, total } = q
    ? await searchCatalog(admin, tenant.id, q, {
        limit: CATALOG_PAGE_SIZE,
        offset: (page - 1) * CATALOG_PAGE_SIZE
      })
    : { items: [], total: 0 }

  const top = childCategories(categories, null)

  return (
    <StorefrontFrame seller={seller} settings={settings} categories={categories}>
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

        {q ? (
          <h1 className="mt-6 text-[18px] font-bold tracking-tight text-ink">
            {total > 0 ? `${total} találat erre: „${q}”` : `Nincs találat erre: „${q}”`}
          </h1>
        ) : (
          <h1 className="mt-6 text-[18px] font-bold tracking-tight text-ink">Keresés</h1>
        )}

        {items.length > 0 ? (
          <div className="mt-5">
            <ProductGrid items={items} eagerFirst />
            <div className="mt-8">
              <Pagination
                page={page}
                total={total}
                pageSize={CATALOG_PAGE_SIZE}
                hrefFor={(p) =>
                  `${STOREFRONT_SEARCH}?q=${encodeURIComponent(q)}${p > 1 ? `&page=${p}` : ''}`
                }
              />
            </div>
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
