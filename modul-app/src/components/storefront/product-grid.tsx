import { Check, Clock, Star } from 'lucide-react'
import Link from 'next/link'

import { SECTION_TITLE } from '@/components/storefront/pdp-section'
import type { StorefrontCard } from '@/lib/storefront/catalog'
import { formatFt } from '@/lib/storefront/format'
import { productPath } from '@/lib/storefront/url'
import type { StorefrontSettings } from '@/lib/webshop/settings'

type CardSettings = Pick<
  StorefrontSettings,
  'deliveryDaysMin' | 'deliveryDaysMax' | 'lowStockThreshold'
> & { imageAspect?: StorefrontSettings['imageAspect'] }
import { cn } from '@/lib/utils'

const LOW_STOCK_CARD_MAX = 5

type Availability = { text: string; tone: 'ok' | 'low' | 'none' }

/** Kártyán egy sor: vagy szállítási idő, vagy „Utolsó N db”, vagy nincs készlet. */
function availabilityOf(
  c: StorefrontCard,
  settings: CardSettings
): Availability {
  if (!c.inStock) return { text: 'Nincs készleten', tone: 'none' }
  const qty = c.stockQty ?? null
  if (qty != null && qty <= Math.min(settings.lowStockThreshold, LOW_STOCK_CARD_MAX)) {
    return { text: `Utolsó ${qty} db`, tone: 'low' }
  }
  const { deliveryDaysMin: min, deliveryDaysMax: max } = settings
  if (min != null && max != null) {
    return { text: min === max ? `${min} munkanap alatt` : `${min}–${max} munkanap`, tone: 'ok' }
  }
  if (max != null) return { text: `Max. ${max} munkanap`, tone: 'ok' }
  return { text: 'Raktáron', tone: 'ok' }
}

const huRating = new Intl.NumberFormat('hu-HU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})

export function ProductCard({
  card: c,
  settings,
  priority = false,
  eager = false
}: {
  card: StorefrontCard
  settings: CardSettings
  priority?: boolean
  eager?: boolean
}) {
  const avail = availabilityOf(c, settings)
  const meta = [c.specLine, c.variantLabel].filter(Boolean).join(' · ')
  return (
    <Link
      href={productPath(c.slug)}
      prefetch={false}
      className="group flex h-full cursor-pointer flex-col gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-md bg-stone-50',
          settings.imageAspect === 'portrait' ? 'aspect-[4/5]' : 'aspect-square'
        )}
      >
        {c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.imageUrl}
            alt=""
            width={300}
            height={300}
            loading={eager || priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            className="size-full object-contain p-2.5 mix-blend-multiply"
          />
        ) : null}
        {c.badge ? (
          <span className="absolute left-2 top-2 rounded-sm bg-white px-1.5 py-0.5 text-[12px] font-medium text-ink shadow-sm">
            {c.badge}
          </span>
        ) : null}
      </div>
      <p className="line-clamp-2 min-h-[2.6em] text-[14px] leading-[1.3] text-ink group-hover:underline">
        {c.title}
      </p>
      {meta ? <p className="truncate text-[13px] text-ink-secondary">{meta}</p> : null}
      {c.rating ? (
        <p className="flex items-center gap-1 text-[12px] text-ink-secondary">
          <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
          <span className="tabular-nums text-ink">{huRating.format(c.rating.average)}</span>
          <span className="tabular-nums">({c.rating.count})</span>
          <span className="sr-only">értékelés</span>
        </p>
      ) : null}
      <p className="mt-auto flex flex-wrap items-baseline gap-x-1.5 pt-0.5">
        <span className="text-[16px] font-semibold tabular-nums text-ink">{formatFt(c.priceGross)}</span>
        {c.unitPrice ? (
          <span className="text-[12px] tabular-nums text-ink-secondary">{c.unitPrice}</span>
        ) : null}
      </p>
      <p
        className={cn(
          'flex items-center gap-1 text-[13px]',
          avail.tone === 'ok' && 'text-green-800',
          avail.tone === 'low' && 'text-amber-800',
          avail.tone === 'none' && 'text-ink-secondary'
        )}
      >
        {avail.tone === 'ok' ? (
          <Check className="size-3.5 shrink-0" aria-hidden />
        ) : avail.tone === 'low' ? (
          <Clock className="size-3.5 shrink-0" aria-hidden />
        ) : null}
        <span className="truncate">{avail.text}</span>
      </p>
    </Link>
  )
}

export function ProductGrid({
  items,
  settings,
  eagerFirst = false,
  insertAt,
  insert
}: {
  items: StorefrontCard[]
  settings: CardSettings
  eagerFirst?: boolean
  /** Segítő kártya helye (0-tól), ha van elég termék. */
  insertAt?: number
  insert?: React.ReactNode
}) {
  const cells: React.ReactNode[] = items.map((c, i) => (
    <li key={c.id}>
      <ProductCard
        card={c}
        settings={settings}
        priority={eagerFirst && i === 0}
        eager={eagerFirst && i < 2}
      />
    </li>
  ))
  if (insert && insertAt != null && insertAt < items.length) {
    cells.splice(
      insertAt,
      0,
      <li key="grid-insert" className="col-span-2 sm:col-span-3 xl:col-span-4">
        {insert}
      </li>
    )
  }
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 xl:grid-cols-4">{cells}</ul>
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
                {c.unitPrice ? (
                  <span className="text-[12px] tabular-nums text-ink-secondary">{c.unitPrice}</span>
                ) : null}
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
