import Link from 'next/link'

import { SECTION_TITLE } from '@/components/storefront/pdp-section'
import type { StorefrontCard } from '@/lib/storefront/catalog'
import { formatFt } from '@/lib/storefront/format'
import { productPath } from '@/lib/storefront/url'

export function ProductGrid({
  items,
  eagerFirst = false
}: {
  items: StorefrontCard[]
  eagerFirst?: boolean
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((c, i) => (
        <li key={c.id}>
          <Link href={productPath(c.slug)} className="group block cursor-pointer space-y-2">
            <div className="aspect-square overflow-hidden rounded-md bg-stone-100">
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.imageUrl}
                  alt=""
                  loading={eagerFirst && i < 4 ? 'eager' : 'lazy'}
                  className="size-full object-contain p-3 mix-blend-multiply"
                />
              ) : null}
            </div>
            <p className="line-clamp-2 text-[14px] leading-snug text-ink group-hover:underline">
              {c.title}
            </p>
            <p className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
              <span className="font-semibold tabular-nums text-ink">{formatFt(c.priceGross)}</span>
              <span className={c.inStock ? 'text-green-700' : 'text-ink-secondary'}>
                {c.inStock ? 'Raktáron' : 'Nincs készleten'}
              </span>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Vízszintes sáv mobilon, rács desktopon (PDP ajánlók). */
export type RailCard = Omit<StorefrontCard, 'inStock'> & { inStock?: boolean }

export function ProductRail({
  title,
  items,
  moreHref,
  moreLabel
}: {
  title: string
  items: RailCard[]
  moreHref?: string
  moreLabel?: string
}) {
  if (items.length === 0) return null
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 px-4 lg:px-0">
        <h2 className={SECTION_TITLE}>{title}</h2>
        {moreHref ? (
          <Link
            href={moreHref}
            className="shrink-0 cursor-pointer text-[14px] font-medium text-ink underline underline-offset-2"
          >
            {moreLabel ?? 'Összes'}
          </Link>
        ) : null}
      </div>
      <ul className="flex snap-x gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-4 lg:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((c) => (
          <li
            key={c.id}
            className="w-[42vw] max-w-[180px] shrink-0 snap-start lg:w-auto lg:max-w-none"
          >
            <Link href={productPath(c.slug)} className="group block cursor-pointer space-y-2">
              <div className="aspect-square overflow-hidden rounded-md bg-stone-100">
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.imageUrl}
                    alt=""
                    loading="lazy"
                    className="size-full object-contain p-3 mix-blend-multiply"
                  />
                ) : null}
              </div>
              <p className="line-clamp-2 text-[13px] leading-snug text-ink group-hover:underline">
                {c.title}
              </p>
              <p className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
                <span className="font-semibold tabular-nums text-ink">
                  {formatFt(c.priceGross)}
                </span>
                {c.inStock === false ? (
                  <span className="text-[12px] text-ink-secondary">Nincs készleten</span>
                ) : null}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Pagination({
  page,
  total,
  pageSize,
  hrefFor
}: {
  page: number
  total: number
  pageSize: number
  hrefFor: (page: number) => string
}) {
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const link =
    'inline-flex h-9 cursor-pointer items-center rounded-md border border-stone-200 px-3 text-[14px] font-medium text-ink hover:bg-stone-50'
  return (
    <nav
      aria-label="Lapozás"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4"
    >
      <p className="text-[13px] tabular-nums text-ink-secondary">
        {from}–{to} / {total} termék
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={link} rel="prev">
            Előző oldal
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className={link} rel="next">
            Következő oldal
          </Link>
        ) : null}
      </div>
    </nav>
  )
}
