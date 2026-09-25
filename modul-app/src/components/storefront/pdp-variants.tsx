import Link from 'next/link'
import { Ruler } from 'lucide-react'

import type {
  PublicPdpVariant,
  PublicPdpVariantAxis
} from '@/lib/storefront/pdp'
import { formatFt } from '@/lib/storefront/format'
import { unitPriceLabel } from '@/lib/storefront/unit-price'
import { productPath } from '@/lib/storefront/url'
import { cn } from '@/lib/utils'

type StorefrontPdpVariantsProps = {
  axes: PublicPdpVariantAxis[]
  variants: PublicPdpVariant[]
  /** „Kulcsadatok” horgony — a méret-jellegű tengely mellett jelenik meg. */
  fitAnchor?: string | null
}

type AxisOption = {
  label: string
  sort: number | null
  target: PublicPdpVariant
  selected: boolean
  inStock: boolean
}

function norm(v: string | null | undefined): string {
  return (v || '').trim().toLocaleLowerCase('hu')
}

/**
 * Egy tengely-értékhez azt a testvért választjuk, amelyik a többi tengelyen a
 * legtöbbet megtartja az aktuálisból; egyenlőségnél a raktáron lévőt.
 */
function resolveTarget(
  variants: PublicPdpVariant[],
  axes: PublicPdpVariantAxis[],
  axisKey: string,
  label: string,
  current: PublicPdpVariant
): PublicPdpVariant | null {
  let best: PublicPdpVariant | null = null
  let bestScore = -1
  for (const v of variants) {
    if (norm(v.values[axisKey]?.label) !== norm(label)) continue
    let score = 0
    for (const a of axes) {
      if (a.key === axisKey) continue
      if (norm(v.values[a.key]?.label) === norm(current.values[a.key]?.label)) score += 10
    }
    if (v.inStock) score += 1
    if (v.current) score += 100
    if (score > bestScore) {
      best = v
      bestScore = score
    }
  }
  return best
}

function optionsFor(
  variants: PublicPdpVariant[],
  axes: PublicPdpVariantAxis[],
  axis: PublicPdpVariantAxis,
  current: PublicPdpVariant
): AxisOption[] {
  const seen = new Map<string, { label: string; sort: number | null }>()
  for (const v of variants) {
    const val = v.values[axis.key]
    if (!val) continue
    const k = norm(val.label)
    if (!seen.has(k)) seen.set(k, val)
  }
  return [...seen.values()]
    .sort((a, b) => {
      if (a.sort != null && b.sort != null && a.sort !== b.sort) return a.sort - b.sort
      return a.label.localeCompare(b.label, 'hu', { numeric: true })
    })
    .map((val) => {
      const target = resolveTarget(variants, axes, axis.key, val.label, current)
      if (!target) return null
      return {
        label: val.label,
        sort: val.sort,
        target,
        selected: norm(current.values[axis.key]?.label) === norm(val.label),
        inStock: target.inStock
      } satisfies AxisOption
    })
    .filter((o): o is AxisOption => o != null)
}

function FitLink({ anchor }: { anchor: string }) {
  return (
    <a
      href={`#${anchor}`}
      className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-ink underline underline-offset-2"
    >
      <Ruler className="size-3.5" aria-hidden />
      Kulcsadatok
    </a>
  )
}

export function StorefrontPdpVariants({
  axes,
  variants,
  fitAnchor
}: StorefrontPdpVariantsProps) {
  const current = variants.find((v) => v.current)
  if (!current || axes.length === 0 || variants.length <= 1) return null

  const fitAxisKey = axes.find((a) => a.kind === 'grid')?.key ?? null

  return (
    <div className="space-y-4">
      {axes.map((axis) => {
        const options = optionsFor(variants, axes, axis, current)
        if (options.length === 0) return null
        const currentLabel = current.values[axis.key]?.label
        const showPrice = new Set(options.map((o) => o.target.priceGross)).size > 1
        const showUnit =
          axis.key === '__pack' ||
          new Set(options.map((o) => o.target.netContent?.quantity ?? null)).size > 1

        return (
          <div key={axis.key} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] text-ink">
                <span className="text-ink-secondary">{axis.name}: </span>
                <span className="font-medium">{currentLabel || 'Válassz'}</span>
              </p>
              {fitAnchor && axis.key === fitAxisKey ? (
                <FitLink anchor={fitAnchor} />
              ) : null}
            </div>

            {axis.kind === 'swatch' ? (
              <ul className="flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {options.map((o) => (
                  <li key={o.label} className="w-14 shrink-0">
                    <Link
                      href={productPath(o.target.slug)}
                      scroll={false}
                      aria-label={`${o.label}${showPrice ? `, ${formatFt(o.target.priceGross)}` : ''}${o.inStock ? '' : ' — elfogyott'}`}
                      aria-current={o.selected ? 'true' : undefined}
                      className="group block cursor-pointer"
                    >
                      <span
                        className={cn(
                          'relative block size-14 overflow-hidden rounded-md border-2 bg-stone-100 transition-colors',
                          o.selected ? 'border-ink' : 'border-transparent group-hover:border-stone-300'
                        )}
                      >
                      {o.target.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={o.target.imageUrl}
                          alt=""
                          className={cn(
                            'size-full object-contain p-1 mix-blend-multiply',
                            !o.inStock && 'opacity-40'
                          )}
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center px-1 text-center text-[11px] font-medium leading-tight text-ink-secondary">
                          {o.label}
                        </span>
                      )}
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          'mt-1 block truncate text-center text-[12px] leading-tight',
                          o.selected ? 'font-medium text-ink' : 'text-ink-secondary'
                        )}
                      >
                        {o.label}
                      </span>
                      {!o.inStock ? (
                        <span aria-hidden className="block text-center text-[11px] leading-tight text-ink-muted">
                          elfogyott
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className={cn('grid gap-2', showPrice || showUnit ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3 sm:grid-cols-4')}>
                {options.map((o) => {
                  const unit = showUnit ? unitPriceLabel(o.target.priceGross, o.target.netContent) : null
                  return (
                  <li key={o.label}>
                    <Link
                      href={productPath(o.target.slug)}
                      scroll={false}
                      aria-current={o.selected ? 'true' : undefined}
                      className={cn(
                        'flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-md border px-2 py-1.5 text-center leading-tight tabular-nums transition-colors',
                        o.selected
                          ? 'border-ink bg-ink text-white'
                          : o.inStock
                            ? 'border-stone-300 bg-white text-ink hover:border-ink'
                            : 'border-dashed border-stone-300 bg-stone-50 text-ink-secondary hover:border-stone-400'
                      )}
                    >
                      <span className="text-[14px] font-medium">{o.label}</span>
                      {showPrice ? (
                        <span className="text-[13px]">{formatFt(o.target.priceGross)}</span>
                      ) : null}
                      {unit ? (
                        <span className={cn('text-[11px]', o.selected ? 'text-white/80' : 'text-ink-secondary')}>
                          {unit}
                        </span>
                      ) : null}
                      {!o.inStock ? (
                        <span className={cn('text-[11px]', o.selected ? 'text-white/80' : 'text-ink-secondary')}>
                          Elfogyott
                        </span>
                      ) : null}
                    </Link>
                  </li>
                  )
                })}
              </ul>
            )}

          </div>
        )
      })}
    </div>
  )
}
