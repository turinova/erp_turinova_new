'use client'

import { ChevronDown, Ruler } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import { Stars } from '@/components/storefront/pdp-reviews'
import type {
  PublicPdpVariant,
  PublicPdpVariantAxis
} from '@/lib/storefront/pdp'
import { formatFt } from '@/lib/storefront/format'
import { unitPriceLabel } from '@/lib/storefront/unit-price'
import { productPath } from '@/lib/storefront/url'
import { cn } from '@/lib/utils'

type ReviewSummary = {
  average: number
  count: number
}

type StorefrontPdpVariantsProps = {
  axes: PublicPdpVariantAxis[]
  variants: PublicPdpVariant[]
  /** „Kulcsadatok” horgony — a méret-jellegű tengely mellett jelenik meg. */
  fitAnchor?: string | null
  /** P0: értékelés a kiválasztott opció kártyáján (aktuális termék). */
  reviews?: ReviewSummary | null
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

function OptionThumb({
  url,
  label,
  dimmed
}: {
  url: string | null
  label: string
  dimmed?: boolean
}) {
  return (
    <span
      className={cn(
        'size-12 shrink-0 overflow-hidden rounded-md bg-stone-100',
        dimmed && 'opacity-40'
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="size-full object-contain p-0.5 mix-blend-multiply"
        />
      ) : (
        <span className="flex size-full items-center justify-center px-1 text-center text-[10px] font-medium leading-tight text-ink-secondary">
          {label.slice(0, 3)}
        </span>
      )}
    </span>
  )
}

function OptionRating({ reviews }: { reviews: ReviewSummary }) {
  if (reviews.count <= 0) return null
  return (
    <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-ink-secondary">
      <Stars value={reviews.average} />
      <span className="tabular-nums">{reviews.count}</span>
    </span>
  )
}

/** Íz / egyéb: thumb dropdown — soha nincs ár a listában. */
function DropdownAxis({
  axis,
  options,
  fitAnchor,
  reviews
}: {
  axis: PublicPdpVariantAxis
  options: AxisOption[]
  fitAnchor?: string | null
  reviews?: ReviewSummary | null
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((o) => o.selected) ?? options[0]
  const others = Math.max(0, options.length - 1)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!selected) return null

  return (
    <div ref={rootRef} className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-medium text-ink">{axis.name}</p>
        {fitAnchor ? <FitLink anchor={fitAnchor} /> : null}
      </div>

      <div className="rounded-lg bg-stone-100 p-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex w-full cursor-pointer items-center gap-3 rounded-md border-2 bg-white px-2.5 py-2 text-left transition-colors',
            open ? 'border-ink' : 'border-ink hover:border-stone-500'
          )}
        >
          <OptionThumb url={selected.target.imageUrl} label={selected.label} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-ink">
              {selected.label}
            </span>
            {reviews && selected.selected ? <OptionRating reviews={reviews} /> : null}
            {!selected.inStock ? (
              <span className="mt-0.5 block text-[12px] text-ink-muted">Elfogyott</span>
            ) : null}
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-ink-secondary transition-transform',
              open && 'rotate-180'
            )}
            aria-hidden
          />
        </button>

        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={axis.name}
            className="mt-2 max-h-72 space-y-1.5 overflow-y-auto"
          >
            {options.map((o) => (
              <li key={o.label} role="option" aria-selected={o.selected}>
                <Link
                  href={productPath(o.target.slug)}
                  scroll={false}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md border-2 bg-white px-2.5 py-2 transition-colors',
                    o.selected
                      ? 'border-ink'
                      : 'border-transparent hover:border-stone-300'
                  )}
                >
                  <OptionThumb
                    url={o.target.imageUrl}
                    label={o.label}
                    dimmed={!o.inStock}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate text-[14px] font-semibold',
                        o.inStock ? 'text-ink' : 'text-ink-secondary'
                      )}
                    >
                      {o.label}
                    </span>
                    {o.selected && reviews ? <OptionRating reviews={reviews} /> : null}
                    {!o.inStock ? (
                      <span className="mt-0.5 block text-[12px] text-ink-muted">Elfogyott</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : others > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-1.5 w-full cursor-pointer py-1 text-center text-[13px] font-semibold text-ink hover:underline"
          >
            +{others} egyéb lehetőség
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** Kiszerelés: Vilgain chip-sor — ár csak a nem aktív opciókon. */
function PackChipsAxis({
  axis,
  options,
  fitAnchor
}: {
  axis: PublicPdpVariantAxis
  options: AxisOption[]
  fitAnchor?: string | null
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-medium text-ink">{axis.name}</p>
        {fitAnchor ? <FitLink anchor={fitAnchor} /> : null}
      </div>
      <ul className="flex flex-wrap gap-2">
        {options.map((o) => {
          const unit = !o.selected
            ? unitPriceLabel(o.target.priceGross, o.target.netContent)
            : null
          return (
            <li key={o.label}>
              <Link
                href={productPath(o.target.slug)}
                scroll={false}
                aria-current={o.selected ? 'true' : undefined}
                className={cn(
                  'flex min-h-11 min-w-[4.5rem] cursor-pointer flex-col items-center justify-center rounded-md border px-3 py-1.5 text-center leading-tight tabular-nums transition-colors',
                  o.selected
                    ? 'border-ink bg-ink text-white'
                    : o.inStock
                      ? 'border-stone-300 bg-white text-ink hover:border-ink'
                      : 'border-dashed border-stone-300 bg-stone-50 text-ink-secondary hover:border-stone-400'
                )}
              >
                <span className="text-[14px] font-medium">{o.label}</span>
                {!o.selected ? (
                  <span className="text-[13px] font-medium text-ink">
                    {formatFt(o.target.priceGross)}
                  </span>
                ) : null}
                {unit ? (
                  <span
                    className={cn(
                      'text-[11px]',
                      o.selected ? 'text-white/80' : 'text-ink-secondary'
                    )}
                  >
                    {unit}
                  </span>
                ) : null}
                {!o.inStock ? (
                  <span
                    className={cn(
                      'text-[11px]',
                      o.selected ? 'text-white/80' : 'text-ink-secondary'
                    )}
                  >
                    Elfogyott
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function StorefrontPdpVariants({
  axes,
  variants,
  fitAnchor,
  reviews
}: StorefrontPdpVariantsProps) {
  const current = variants.find((v) => v.current)
  if (!current || axes.length === 0 || variants.length <= 1) return null

  const fitAxisKey = axes.find((a) => a.kind === 'grid')?.key ?? null
  const reviewSummary =
    reviews && reviews.count > 0
      ? { average: reviews.average, count: reviews.count }
      : null

  return (
    <div className="space-y-4">
      {axes.map((axis) => {
        const options = optionsFor(variants, axes, axis, current)
        if (options.length === 0) return null
        const isPack = axis.key === '__pack'
        const showFit = Boolean(fitAnchor && axis.key === fitAxisKey)

        if (isPack) {
          return (
            <PackChipsAxis
              key={axis.key}
              axis={axis}
              options={options}
              fitAnchor={showFit ? fitAnchor : null}
            />
          )
        }

        if (axis.kind === 'swatch') {
          const currentLabel = current.values[axis.key]?.label
          return (
            <div key={axis.key} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px] text-ink">
                  <span className="text-ink-secondary">{axis.name}: </span>
                  <span className="font-medium">{currentLabel || 'Válassz'}</span>
                </p>
                {showFit && fitAnchor ? <FitLink anchor={fitAnchor} /> : null}
              </div>
              <ul className="flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {options.map((o) => (
                  <li key={o.label} className="w-14 shrink-0">
                    <Link
                      href={productPath(o.target.slug)}
                      scroll={false}
                      aria-label={`${o.label}${o.inStock ? '' : ' — elfogyott'}`}
                      aria-current={o.selected ? 'true' : undefined}
                      className="group block cursor-pointer"
                    >
                      <span
                        className={cn(
                          'relative block size-14 overflow-hidden rounded-md border-2 bg-stone-100 transition-colors',
                          o.selected
                            ? 'border-ink'
                            : 'border-transparent group-hover:border-stone-300'
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
                        <span
                          aria-hidden
                          className="block text-center text-[11px] leading-tight text-ink-muted"
                        >
                          elfogyott
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        }

        return (
          <DropdownAxis
            key={axis.key}
            axis={axis}
            options={options}
            fitAnchor={showFit ? fitAnchor : null}
            reviews={reviewSummary}
          />
        )
      })}
    </div>
  )
}
