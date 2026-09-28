import Link from 'next/link'

import { formatFt } from '@/lib/storefront/format'
import type { StorefrontCategory } from '@/lib/storefront/shell'
import { categoryPath } from '@/lib/storefront/url'
import { cn } from '@/lib/utils'

/** Ennyi csempe képe töltődik azonnal (a többi lusta). */
const EAGER_TILES = 4

/**
 * Kategória-választó csempék (kezdőlap, szülő-kategória). Kép nélkül is teljes értékű:
 * a név dönt, a kép segít (egyforma testvéreknél, pl. Normál / Csillapított, nem is tud mást).
 */
export function CategoryTiles({
  categories,
  size = 'md',
  labelledBy
}: {
  categories: StorefrontCategory[]
  /** lg: kezdőlap (2 oszlop mobilon), md: alkategóriák (3 oszlop mobilon). */
  size?: 'md' | 'lg'
  labelledBy?: string
}) {
  if (categories.length === 0) return null
  // md mobilon vízszintes sáv (≈2,5 csempe): az „Összes termék” rács egy görgetésnyivel közelebb van.
  return (
    <ul
      aria-labelledby={labelledBy}
      className={cn(
        size === 'lg'
          ? 'grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4'
          : '-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-x-3 sm:gap-y-5 sm:overflow-visible sm:px-0 lg:grid-cols-6 [&::-webkit-scrollbar]:hidden'
      )}
    >
      {categories.map((c, i) => (
        <li key={c.id} className={size === 'md' ? 'w-[36vw] max-w-[160px] shrink-0 snap-start sm:w-auto sm:max-w-none' : undefined}>
          <Link
            href={categoryPath(c.slug)}
            className="group flex h-full cursor-pointer flex-col gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          >
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-stone-50">
              {c.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.cover.imageUrl}
                  alt=""
                  width={240}
                  height={240}
                  loading={i < EAGER_TILES ? 'eager' : 'lazy'}
                  decoding="async"
                  className={cn('size-full object-contain mix-blend-multiply', size === 'lg' ? 'p-3' : 'p-2')}
                />
              ) : (
                <span aria-hidden className="px-2 text-center text-[13px] font-medium text-ink-muted">
                  {c.name}
                </span>
              )}
            </div>
            <p
              className={cn(
                'line-clamp-2 font-medium leading-[1.3] text-ink group-hover:underline',
                size === 'lg' ? 'text-[15px]' : 'text-[13px] sm:text-[14px]'
              )}
            >
              {c.name}
            </p>
            <p className="text-[12px] tabular-nums text-ink-secondary sm:text-[13px]">
              {c.productCount} termék
              {c.priceFrom != null ? (
                <span className="max-sm:block sm:before:content-['_·_']">{formatFt(c.priceFrom)}-tól</span>
              ) : null}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
