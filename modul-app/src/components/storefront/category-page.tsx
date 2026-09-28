import { Check, ChevronLeft, Phone, X } from 'lucide-react'
import Link from 'next/link'

import { CatalogFilterSheet, FilterChip, SortChip } from '@/components/storefront/catalog-filters'
import { CATALOG_TOOLBAR_ID, CHIP, CHIP_IDLE, CHIP_ON } from '@/components/storefront/catalog-ui'
import { CategoryBreadcrumb } from '@/components/storefront/category-breadcrumb'
import { CategoryTiles } from '@/components/storefront/category-tiles'
import { LoadMore } from '@/components/storefront/load-more'
import { ProductGrid } from '@/components/storefront/product-grid'
import { StorefrontFrame } from '@/components/storefront/storefront-chrome'
import type { CategoryListing, CategoryMatrix } from '@/lib/storefront/catalog'
import { categoryFaq, factSentence, trustParts, type FaqItem } from '@/lib/storefront/category-facts'
import { categoryIndexing, facetLandingHref, type CategoryView } from '@/lib/storefront/category-view'
import { CATALOG_PARAM, catalogHref, type CatalogParams } from '@/lib/storefront/catalog-params'
import { formatFt } from '@/lib/storefront/format'
import { childCategories, type StorefrontCategory, type StorefrontSeller } from '@/lib/storefront/shell'
import {
  breadcrumbNode,
  categoryCrumbs,
  faqNode,
  graph,
  itemListNode,
  jsonLdString,
  orgId,
  websiteId
} from '@/lib/storefront/structured-data'
import { categoryPath, siteUrl, STOREFRONT_HOME } from '@/lib/storefront/url'
import { cn } from '@/lib/utils'

const QUICK_VALUES = 4
const HELP_CARD_AFTER = 8
const HUB_MIN_SUBS = 2
const RELATED_MAX = 12

const H2 = 'text-[16px] font-semibold tracking-tight text-ink'

export function CategoryPageView({ view }: { view: CategoryView }) {
  const { shell, category, chain, params, page, listing, base, heading } = view
  const { tenant, seller, settings, categories } = shell
  const { items, total, facets, summary, matrix, preset } = listing

  const parent = chain.length > 1 ? chain[chain.length - 2]! : null
  const siblings = childCategories(categories, category.parentId)
  const subs = childCategories(categories, category.id)
  const hub = !preset && listing.activeCount === 0 && subs.length >= HUB_MIN_SUBS
  const related = siblings.filter((s) => s.id !== category.id).slice(0, RELATED_MAX)
  const nextHref =
    items.length < total
      ? catalogHref(base, params, { [CATALOG_PARAM.page]: String(page + 1) })
      : null

  const skip = preset?.param ?? null
  const intro = preset ? null : category.intro
  const facts = factSentence(summary, skip)
  const trust = trustParts(settings)
  const faqSubject = preset ? `${preset.label} ${category.name.toLocaleLowerCase('hu')}` : category.name
  const faq = page === 1 ? categoryFaq(faqSubject, summary, settings, skip) : []

  const { canonical } = categoryIndexing(view)
  const pageUrl = siteUrl(tenant.base, canonical)
  const crumbs = categoryCrumbs(seller.name, chain)
  const jsonLd = graph([
    {
      '@type': 'CollectionPage',
      '@id': `${pageUrl}#page`,
      url: pageUrl,
      name: heading,
      ...(intro || facts ? { description: intro ?? facts } : {}),
      ...(category.cover ? { image: category.cover.imageUrl } : {}),
      isPartOf: { '@id': websiteId(tenant.base) },
      publisher: { '@id': orgId(tenant.base) },
      mainEntity: itemListNode(items, tenant.base, { total })
    },
    breadcrumbNode(
      preset ? [...crumbs, { name: preset.label, path: canonical }] : crumbs,
      tenant.base
    ),
    ...(faq.length ? [faqNode(`${pageUrl}#faq`, faq)] : [])
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
        <MobileTrail chain={chain} presetLabel={preset?.label ?? null} />

        <div className="flex min-h-12 items-center gap-1 lg:mt-3 lg:min-h-0 lg:justify-between lg:gap-4">
          <Link
            href={preset ? base : parent ? categoryPath(parent.slug) : STOREFRONT_HOME}
            prefetch={false}
            aria-label={`Vissza: ${preset ? category.name : parent ? parent.name : 'Összes kategória'}`}
            className="-ml-2.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-stone-100 lg:hidden"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <div className="flex min-w-0 items-baseline gap-2 py-1 lg:py-0">
            <h1 className="line-clamp-3 text-[20px] font-bold leading-tight tracking-tight text-ink [text-wrap:balance] lg:line-clamp-1 lg:text-[22px]">
              {heading}
            </h1>
            <p className="shrink-0 text-[13px] tabular-nums text-ink-secondary">{total} termék</p>
          </div>
          <SortChip
            base={base}
            params={params}
            sort={listing.sort}
            options={listing.sortOptions}
            className="hidden lg:inline-flex"
          />
        </div>

        {intro || facts || trust.length ? (
          <div className="mb-2 max-w-[760px] space-y-1 lg:mt-1">
            {intro ? <p className="text-[14px] text-ink">{intro}</p> : null}
            {facts ? <p className="text-[13.5px] text-ink-secondary">{facts}</p> : null}
            {trust.length ? (
              <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-secondary">
                <Check className="size-3.5 text-ink" aria-hidden />
                {trust.join(' · ')}
              </p>
            ) : null}
          </div>
        ) : null}

        <ChipRow view={view} subs={hub ? [] : subs} />

        {hub ? (
          <section aria-labelledby="k-subs" className="mt-4 lg:mt-6">
            <h2 id="k-subs" className="sr-only">
              Alkategóriák
            </h2>
            <CategoryTiles categories={subs} size="md" labelledBy="k-subs" />
            <h2 className={cn(H2, 'mt-8')}>Összes termék</h2>
          </section>
        ) : null}

        <div className="mt-3 lg:mt-6 lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
          <FacetSidebar view={view} subs={hub ? [] : subs} />
          <div>
            {items.length === 0 ? (
              <EmptyState listing={listing} base={base} params={params} categoryName={category.name} />
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

            {matrix && page === 1 ? <MatrixTable view={view} matrix={matrix} /> : null}
            {faq.length ? <FaqSection items={faq} /> : null}
            {related.length && page === 1 ? (
              <nav aria-labelledby="k-related" className="mt-10">
                <h2 id="k-related" className={H2}>
                  Kapcsolódó kategóriák
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {related.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={categoryPath(s.slug)}
                        prefetch={false}
                        className={cn(CHIP, CHIP_IDLE)}
                      >
                        {s.name}
                        <span className="tabular-nums text-ink-secondary">{s.productCount}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>
        </div>
      </main>
      <CatalogFilterSheet
        categorySlug={category.slug}
        base={base}
        params={params}
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

/** Mobilon egy soros útvonal a H1 fölött (desktopon a teljes morzsamenü látszik). */
function MobileTrail({ chain, presetLabel }: { chain: StorefrontCategory[]; presetLabel: string | null }) {
  const trail = presetLabel ? chain : chain.slice(0, -1)
  // Főkategórián a vissza-nyíl már ugyanezt mondja.
  if (trail.length === 0) return null
  return (
    <nav aria-label="Útvonal" className="truncate pt-1 text-[12px] text-ink-secondary lg:hidden">
      <Link href={STOREFRONT_HOME} prefetch={false} className="hover:text-ink">
        Kategóriák
      </Link>
      {trail.map((c) => (
        <span key={c.id}>
          {' / '}
          <Link href={categoryPath(c.slug)} prefetch={false} className="hover:text-ink">
            {c.name}
          </Link>
        </span>
      ))}
    </nav>
  )
}

type ListingProps = { listing: CategoryListing; base: string; params: CatalogParams }

function priceLabel(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${formatFt(min)} – ${formatFt(max)}`
  if (min != null) return `${formatFt(min)}-tól`
  return `${formatFt(max ?? 0)}-ig`
}

/** Szűrőérték linkje: egyedüli szűrőként az indexelhető útvonalas oldalra visz. */
function valueHref(view: CategoryView, param: string, value: string, count: number) {
  const landing = facetLandingHref(view, param, value, count)
  return landing
    ? { href: landing, rel: undefined }
    : { href: catalogHref(view.base, view.params, { [param]: value }), rel: 'nofollow' as const }
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

function ChipRow({ view, subs }: { view: CategoryView; subs: StorefrontCategory[] }) {
  const { listing, base, params } = view
  const active = activeChips({ listing, base, params })
  const quick = listing.facets[0]
  const quickValues = quick
    ? quick.values.filter((v) => !v.selected && v.count > 0).slice(0, QUICK_VALUES)
    : []
  const showQuick = quick != null && !quick.values.some((v) => v.selected)
  const lengths = quick ? lengthRatios(quick.values.map((v) => ({ value: v.value, label: v.label }))) : null

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
          ? quickValues.map((v) => {
              const link = valueHref(view, quick.param, v.value, v.count)
              const len = lengths?.get(v.value)
              return (
                <li key={`${quick.param}-${v.value}`} className="lg:hidden">
                  <Link
                    href={link.href}
                    rel={link.rel}
                    prefetch={false}
                    className={cn(CHIP, CHIP_IDLE, 'tabular-nums')}
                  >
                    {len != null ? <SizeGlyph ratio={len} /> : null}
                    {v.label}
                  </Link>
                </li>
              )
            })
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

/** Hosszértékek (mm / cm / m) aránya a legnagyobbhoz — csak ha mind hossz. */
function lengthRatios(values: { value: string; label: string }[]): Map<string, number> | null {
  const toMm: Record<string, number> = { mm: 1, cm: 10, m: 1000 }
  const parsed = values.map((v) => {
    const m = /^(\d+(?:[.,]\d+)?)\s*(mm|cm|m)$/.exec(v.label.trim())
    return m ? { value: v.value, mm: Number(m[1]!.replace(',', '.')) * toMm[m[2]!]! } : null
  })
  if (parsed.length < 2 || parsed.some((p) => p == null)) return null
  const max = Math.max(...parsed.map((p) => p!.mm))
  if (!(max > 0)) return null
  return new Map(parsed.map((p) => [p!.value, p!.mm / max]))
}

/** Méret-sziluett: két furat és a köztük lévő távolság, a legnagyobb értékhez arányítva. */
function SizeGlyph({ ratio }: { ratio: number }) {
  const w = 4 + Math.round(Math.max(0.15, ratio) * 16)
  const x0 = (22 - w) / 2
  return (
    <svg aria-hidden width="22" height="10" viewBox="0 0 22 10" className="shrink-0 text-ink-secondary">
      <line x1={x0} y1="5" x2={x0 + w} y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={x0} cy="5" r="1.8" fill="currentColor" />
      <circle cx={x0 + w} cy="5" r="1.8" fill="currentColor" />
    </svg>
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
function FacetSidebar({ view, subs }: { view: CategoryView; subs: StorefrontCategory[] }) {
  const { listing, base, params } = view
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
            {f.values.map((v) => {
              if (v.count === 0 && !v.selected) {
                return (
                  <li key={v.value}>
                    <span className={cn(SIDE_ROW, 'cursor-default text-ink-muted hover:bg-transparent')}>
                      <SideCheck on={false} />
                      <span className="flex-1">{v.label}</span>
                      <span className="text-[13px] tabular-nums">0</span>
                    </span>
                  </li>
                )
              }
              const link = v.selected
                ? { href: catalogHref(base, params, { [f.param]: undefined }), rel: 'nofollow' as const }
                : valueHref(view, f.param, v.value, v.count)
              return (
                <li key={v.value}>
                  <Link href={link.href} rel={link.rel} aria-pressed={v.selected} className={SIDE_ROW}>
                    <SideCheck on={v.selected} />
                    <span className="flex-1">{v.label}</span>
                    <span className="text-[13px] tabular-nums text-ink-secondary">{v.count}</span>
                  </Link>
                </li>
              )
            })}
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

/** Két fő jellemző metszete: gyors ugrás a pontos párosra (pl. 128 mm × matt fekete). */
function MatrixTable({ view, matrix }: { view: CategoryView; matrix: CategoryMatrix }) {
  const { base, params, listing } = view
  const counts = new Map(
    listing.summary.facets.map((f) => [f.param, new Map(f.values.map((v) => [v.value, v.count]))])
  )
  const axisLink = (param: string, value: string) =>
    valueHref(view, param, value, counts.get(param)?.get(value) ?? 0)
  return (
    <section aria-labelledby="k-matrix" className="mt-10">
      <h2 id="k-matrix" className={H2}>
        {matrix.row.name} és {matrix.col.name.toLocaleLowerCase('hu')} szerint
      </h2>
      <div className="mt-3 overflow-x-auto rounded-md border border-stone-200">
        <table className="w-full border-collapse text-[13px] tabular-nums">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-stone-50 px-3 py-2 text-left font-medium text-ink-secondary"
              >
                {matrix.row.name}
              </th>
              {matrix.col.values.map((c) => {
                const link = axisLink(matrix.col.param, c.value)
                return (
                  <th key={c.value} scope="col" className="px-3 py-2 text-left font-medium text-ink">
                    <Link href={link.href} rel={link.rel} prefetch={false} className="hover:underline">
                      {c.label}
                    </Link>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {matrix.row.values.map((r) => {
              const link = axisLink(matrix.row.param, r.value)
              return (
                <tr key={r.value} className="border-b border-stone-100 last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 text-left font-medium text-ink"
                  >
                    <Link href={link.href} rel={link.rel} prefetch={false} className="hover:underline">
                      {r.label}
                    </Link>
                  </th>
                  {matrix.col.values.map((c) => {
                    const n = matrix.cells[`${r.value}|${c.value}`] ?? 0
                    return (
                      <td key={c.value} className="px-3 py-1.5">
                        {n > 0 ? (
                          <Link
                            href={catalogHref(base, params, {
                              [matrix.row.param]: r.value,
                              [matrix.col.param]: c.value,
                              [CATALOG_PARAM.page]: undefined
                            })}
                            rel="nofollow"
                            prefetch={false}
                            aria-label={`${r.label}, ${c.label}: ${n} termék`}
                            className="inline-flex min-h-8 min-w-8 items-center font-medium text-ink underline underline-offset-2"
                          >
                            {n}
                          </Link>
                        ) : (
                          <span className="text-ink-muted" aria-label="nincs">
                            –
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <section aria-labelledby="k-faq" className="mt-10 max-w-[760px]">
      <h2 id="k-faq" className={H2}>
        Gyakori kérdések
      </h2>
      <dl className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
        {items.map((q) => (
          <div key={q.question} className="py-3">
            <dt className="text-[14px] font-medium text-ink">{q.question}</dt>
            <dd className="mt-1 text-[14px] text-ink-secondary">{q.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
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
