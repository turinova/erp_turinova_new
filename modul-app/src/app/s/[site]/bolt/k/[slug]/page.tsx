import { Check, ChevronLeft, Phone, X } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CatalogFilterSheet, FilterChip, SortChip } from '@/components/storefront/catalog-filters'
import { CATALOG_TOOLBAR_ID, CHIP, CHIP_IDLE, CHIP_ON } from '@/components/storefront/catalog-ui'
import { CategoryBreadcrumb } from '@/components/storefront/category-breadcrumb'
import { LoadMore } from '@/components/storefront/load-more'
import { ProductGrid } from '@/components/storefront/product-grid'
import { StorefrontFrame } from '@/components/storefront/storefront-chrome'
import { listCategoryProducts, type CategoryListing } from '@/lib/storefront/catalog'
import {
  CATALOG_PARAM,
  catalogHref,
  parsePageParam,
  type CatalogParams
} from '@/lib/storefront/catalog-params'
import { formatFt } from '@/lib/storefront/format'
import {
  categoryChain,
  childCategories,
  getStorefrontShell,
  type StorefrontCategory,
  type StorefrontSeller
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

const QUICK_VALUES = 4
const HELP_CARD_AFTER = 8

function flatParams(raw: Record<string, string | string[] | undefined>): CatalogParams {
  const out: CatalogParams = {}
  for (const [k, v] of Object.entries(raw)) out[k] = Array.isArray(v) ? v[0] : v
  return out
}

function findCategory(categories: StorefrontCategory[], slug: string) {
  const s = decodeURIComponent(slug).toLowerCase()
  return categories.find((c) => c.slug === s) ?? null
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
  const filtered = Object.keys(sp).some((k) => k !== CATALOG_PARAM.page)
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
  const page = parsePageParam(sp[CATALOG_PARAM.page])
  const { admin, tenant, seller, settings, categories } = shell
  const listing = await listCategoryProducts(admin, tenant.id, categories, category, sp, page, {
    reviewsEnabled: settings.reviewsEnabled
  })
  const { items, total, facets } = listing

  const chain = categoryChain(categories, category.id)
  const parent = chain.length > 1 ? chain[chain.length - 2]! : null
  const siblings = childCategories(categories, category.parentId)
  const subs = childCategories(categories, category.id)
  const base = categoryPath(category.slug)
  const nextHref =
    items.length < total
      ? catalogHref(base, sp, { [CATALOG_PARAM.page]: String(page + 1) })
      : null

  const jsonLd = graph([
    {
      '@type': 'CollectionPage',
      '@id': siteUrl(tenant.base, `${base}#page`),
      url: siteUrl(tenant.base, base),
      name: category.name,
      isPartOf: { '@id': websiteId(tenant.base) },
      publisher: { '@id': orgId(tenant.base) },
      mainEntity: itemListNode(items, tenant.base, 0)
    },
    breadcrumbNode(categoryCrumbs(seller.name, chain), tenant.base)
  ])

  return (
    <StorefrontFrame seller={seller} settings={settings} categories={categories}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-2 lg:px-8 lg:pt-6">
        <div className="hidden lg:block">
          <CategoryBreadcrumb
            home={{ label: seller.name, href: STOREFRONT_HOME }}
            chain={chain}
            siblings={siblings}
          />
        </div>

        <div className="flex min-h-12 items-center gap-1 lg:mt-3 lg:min-h-0 lg:justify-between lg:gap-4">
          <Link
            href={parent ? categoryPath(parent.slug) : STOREFRONT_HOME}
            prefetch={false}
            aria-label={`Vissza: ${parent ? parent.name : 'Összes kategória'}`}
            className="-ml-2.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-stone-100 lg:hidden"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="truncate text-[20px] font-bold tracking-tight text-ink lg:text-[22px]">
              {category.name}
            </h1>
            <p className="shrink-0 text-[13px] tabular-nums text-ink-secondary">{total} termék</p>
          </div>
          <SortChip
            base={base}
            params={sp}
            sort={listing.sort}
            options={listing.sortOptions}
            className="hidden lg:inline-flex"
          />
        </div>

        <ChipRow listing={listing} base={base} params={sp} subs={subs} />

        <div className="mt-3 lg:mt-6 lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
          <FacetSidebar listing={listing} base={base} params={sp} subs={subs} />
          <div>
            {items.length === 0 ? (
              <EmptyState listing={listing} base={base} params={sp} categoryName={category.name} />
            ) : (
              <>
                <ProductGrid
                  items={items}
                  settings={settings}
                  eagerFirst
                  insertAt={
                    (seller.phone || seller.email) && total > HELP_CARD_AFTER + 4
                      ? HELP_CARD_AFTER
                      : undefined
                  }
                  insert={<HelpCard seller={seller} />}
                />
                <LoadMore shown={items.length} total={total} nextHref={nextHref} />
              </>
            )}
          </div>
        </div>
      </main>
      <CatalogFilterSheet
        categorySlug={category.slug}
        base={base}
        params={sp}
        facets={facets}
        sort={listing.sort}
        sortOptions={listing.sortOptions}
        total={total}
        priceBounds={listing.priceBounds}
        activeCount={listing.activeCount}
      />
    </StorefrontFrame>
  )
}

type ListingProps = { listing: CategoryListing; base: string; params: CatalogParams }

function priceLabel(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${formatFt(min)} – ${formatFt(max)}`
  if (min != null) return `${formatFt(min)}-tól`
  return `${formatFt(max ?? 0)}-ig`
}

/** Aktív szűrők egy helyen: chip-sor (mobil) és oldalsáv (desktop) ugyanezt használja. */
function activeChips({ listing, base, params }: ListingProps) {
  const out: { key: string; label: string; href: string }[] = []
  for (const f of listing.facets) {
    for (const v of f.values) {
      if (v.selected) {
        out.push({
          key: f.param,
          label: v.label,
          href: catalogHref(base, params, { [f.param]: undefined })
        })
      }
    }
  }
  if (listing.inStockOnly) {
    out.push({
      key: CATALOG_PARAM.inStock,
      label: 'Raktáron',
      href: catalogHref(base, params, { [CATALOG_PARAM.inStock]: undefined })
    })
  }
  if (listing.priceMin != null || listing.priceMax != null) {
    out.push({
      key: 'ar',
      label: priceLabel(listing.priceMin, listing.priceMax),
      href: catalogHref(base, params, {
        [CATALOG_PARAM.priceMin]: undefined,
        [CATALOG_PARAM.priceMax]: undefined
      })
    })
  }
  return out
}

function ChipRow({
  listing,
  base,
  params,
  subs
}: ListingProps & { subs: StorefrontCategory[] }) {
  const active = activeChips({ listing, base, params })
  const quick = listing.facets[0]
  const quickValues = quick
    ? quick.values.filter((v) => !v.selected && v.count > 0).slice(0, QUICK_VALUES)
    : []
  const showQuick = quick != null && !quick.values.some((v) => v.selected)

  return (
    <div
      id={CATALOG_TOOLBAR_ID}
      className={cn('relative -mx-4 lg:mx-0 lg:mt-3', active.length === 0 && 'lg:hidden')}
    >
      <ul
        aria-label="Szűrés, rendezés és alkategóriák"
        className="flex gap-2 overflow-x-auto px-4 py-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        <li className="lg:hidden">
          <FilterChip activeCount={listing.activeCount} />
        </li>
        <li className="lg:hidden">
          <SortChip base={base} params={params} sort={listing.sort} options={listing.sortOptions} />
        </li>
        {active.map((a) => (
          <li key={a.key}>
            <Link href={a.href} rel="nofollow" prefetch={false} className={cn(CHIP, CHIP_ON)}>
              <Check className="size-4" aria-hidden />
              {a.label}
              <X className="size-3.5 opacity-80" aria-hidden />
              <span className="sr-only">— szűrő kikapcsolása</span>
            </Link>
          </li>
        ))}
        {!listing.inStockOnly ? (
          <li className="lg:hidden">
            <Link
              href={catalogHref(base, params, { [CATALOG_PARAM.inStock]: '1' })}
              rel="nofollow"
              prefetch={false}
              className={cn(CHIP, CHIP_IDLE)}
            >
              Raktáron
            </Link>
          </li>
        ) : null}
        {showQuick
          ? quickValues.map((v) => (
              <li key={`${quick.param}-${v.value}`} className="lg:hidden">
                <Link
                  href={catalogHref(base, params, { [quick.param]: v.value })}
                  rel="nofollow"
                  prefetch={false}
                  className={cn(CHIP, CHIP_IDLE, 'tabular-nums')}
                >
                  {v.label}
                </Link>
              </li>
            ))
          : null}
        {subs.map((s) => (
          <li key={s.id} className="lg:hidden">
            <Link href={categoryPath(s.slug)} prefetch={false} className={cn(CHIP, CHIP_IDLE, 'bg-stone-50')}>
              {s.name}
              <span className="tabular-nums text-ink-secondary">{s.productCount}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white lg:hidden"
      />
    </div>
  )
}

const SIDE_TITLE = 'mb-2 text-[13px] font-semibold text-ink'
const SIDE_ROW =
  'flex min-h-8 cursor-pointer items-center gap-2 rounded px-1 text-[14px] text-ink hover:bg-stone-50'

function SideCheck({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
        on ? 'border-ink bg-ink text-white' : 'border-stone-400 bg-white'
      )}
    >
      {on ? <Check className="size-3" /> : null}
    </span>
  )
}

/** Desktop: azonnali (link) szűrők; mobilon a sheet helyettesíti. */
function FacetSidebar({
  listing,
  base,
  params,
  subs
}: ListingProps & { subs: StorefrontCategory[] }) {
  const hidden = new Set<string>([
    CATALOG_PARAM.priceMin,
    CATALOG_PARAM.priceMax,
    CATALOG_PARAM.page
  ])
  return (
    <aside aria-label="Szűrők" className="hidden space-y-6 lg:block">
      {subs.length > 0 ? (
        <nav aria-label="Alkategóriák">
          <h2 className={SIDE_TITLE}>Kategóriák</h2>
          <ul>
            {subs.map((s) => (
              <li key={s.id}>
                <Link href={categoryPath(s.slug)} className={cn(SIDE_ROW, 'justify-between')}>
                  {s.name}
                  <span className="text-[13px] tabular-nums text-ink-secondary">{s.productCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div>
        <h2 className={SIDE_TITLE}>Elérhetőség</h2>
        <Link
          href={catalogHref(base, params, {
            [CATALOG_PARAM.inStock]: listing.inStockOnly ? undefined : '1'
          })}
          rel="nofollow"
          aria-pressed={listing.inStockOnly}
          className={SIDE_ROW}
        >
          <SideCheck on={listing.inStockOnly} />
          Csak raktáron lévők
        </Link>
      </div>

      {listing.facets.map((f) => (
        <div key={f.param}>
          <h2 className={SIDE_TITLE}>{f.name}</h2>
          <ul>
            {f.values.map((v) => (
              <li key={v.value}>
                {v.count === 0 && !v.selected ? (
                  <span className={cn(SIDE_ROW, 'cursor-default text-ink-muted hover:bg-transparent')}>
                    <SideCheck on={false} />
                    <span className="flex-1">{v.label}</span>
                    <span className="text-[13px] tabular-nums">0</span>
                  </span>
                ) : (
                  <Link
                    href={catalogHref(base, params, { [f.param]: v.selected ? undefined : v.value })}
                    rel="nofollow"
                    aria-pressed={v.selected}
                    className={SIDE_ROW}
                  >
                    <SideCheck on={v.selected} />
                    <span className="flex-1">{v.label}</span>
                    <span className="text-[13px] tabular-nums text-ink-secondary">{v.count}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <form method="get" action={base}>
        <h2 className={SIDE_TITLE}>Ár (Ft)</h2>
        {Object.entries(params)
          .filter(([k, v]) => v && !hidden.has(k))
          .map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[12px] text-ink-secondary">
            Legalább
            <input
              name={CATALOG_PARAM.priceMin}
              inputMode="numeric"
              defaultValue={listing.priceMin ?? ''}
              placeholder={listing.priceBounds ? String(listing.priceBounds.min) : undefined}
              className="h-8 w-full rounded-md border border-stone-300 px-2 text-[14px] tabular-nums text-ink outline-none focus-visible:border-ink"
            />
          </label>
          <label className="space-y-1 text-[12px] text-ink-secondary">
            Legfeljebb
            <input
              name={CATALOG_PARAM.priceMax}
              inputMode="numeric"
              defaultValue={listing.priceMax ?? ''}
              placeholder={listing.priceBounds ? String(listing.priceBounds.max) : undefined}
              className="h-8 w-full rounded-md border border-stone-300 px-2 text-[14px] tabular-nums text-ink outline-none focus-visible:border-ink"
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-2 h-8 w-full cursor-pointer rounded-md border border-stone-300 text-[13px] font-medium text-ink hover:border-ink"
        >
          Ár szűrése
        </button>
      </form>

      {listing.activeCount > 0 ? (
        <Link
          href={base}
          className="inline-block cursor-pointer text-[13px] font-medium text-ink underline underline-offset-2"
        >
          Összes szűrő törlése
        </Link>
      ) : null}
    </aside>
  )
}

function EmptyState({
  listing,
  base,
  params,
  categoryName
}: ListingProps & { categoryName: string }) {
  const best = listing.relax[0]
  return (
    <div className="rounded-md bg-stone-50 px-4 py-6 text-[15px] text-ink">
      <p className="font-medium">Nincs a szűrésnek megfelelő termék.</p>
      {best ? (
        <p className="mt-2 text-[14px] text-ink-secondary">
          Ha elhagyod ezt a szűrőt: „{best.label}”, {best.count} terméket találsz.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {best ? (
          <Link
            href={catalogHref(base, params, best.patch)}
            className="inline-flex h-11 cursor-pointer items-center rounded-md bg-primary px-4 text-[15px] font-medium text-white hover:bg-primary-hover"
          >
            „{best.label}” elhagyása
          </Link>
        ) : null}
        <Link
          href={base}
          className="inline-flex h-11 cursor-pointer items-center rounded-md border border-stone-300 bg-white px-4 text-[15px] font-medium text-ink hover:border-ink"
        >
          Összes {categoryName.toLowerCase()}
        </Link>
      </div>
    </div>
  )
}

function HelpCard({ seller }: { seller: StorefrontSeller }) {
  const tel = seller.phone?.replace(/[^\d+]/g, '')
  if (!tel && !seller.email) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
      <p className="text-[14px] text-ink">
        <span className="font-medium">Nem biztos, melyik kell?</span>{' '}
        <span className="text-ink-secondary">Írd meg a méretet, segítünk választani.</span>
      </p>
      <a
        href={tel ? `tel:${tel}` : `mailto:${seller.email}`}
        className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-stone-300 bg-white px-3.5 text-[14px] font-medium text-ink hover:border-ink"
      >
        {tel ? <Phone className="size-4" aria-hidden /> : null}
        {tel ? seller.phone : 'Írj nekünk'}
      </a>
    </div>
  )
}
