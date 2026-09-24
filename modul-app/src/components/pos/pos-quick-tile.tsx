'use client'

import { useMemo } from 'react'
import { Package } from 'lucide-react'

import { extractPosNameHints } from '@/lib/pos/quick-items'
import { cn } from '@/lib/utils'

type Props = {
  /** Pulton megjelenő név (label vagy teljes katalógusnév). */
  name: string
  /** Cikkszám — mindig teljes, soha truncate. */
  sku?: string | null
  /** Teljes katalógusnév — title + méret/szín chip forrás. */
  fullName?: string
  priceLabel: string
  imageUrl?: string | null
  onHand?: number | null
  unitShortform?: string
  qtyBadge?: number | null
  zeroStock?: boolean
  flash?: boolean
  compact?: boolean
  disabled?: boolean
  className?: string
  onClick?: () => void
}

/**
 * Text-first gyors gomb: 3 sor név + SKU + méret/szín chip + ár/készlet.
 */
export function PosQuickTile({
  name,
  sku,
  fullName,
  priceLabel,
  imageUrl,
  onHand,
  unitShortform = 'db',
  qtyBadge,
  zeroStock = false,
  flash = false,
  compact = false,
  disabled = false,
  className,
  onClick
}: Props) {
  const stockLabel =
    onHand == null
      ? null
      : Number.isInteger(onHand)
        ? String(onHand)
        : onHand.toLocaleString('hu-HU', { maximumFractionDigits: 1 })

  const skuText = sku?.trim() || ''
  const hintSource = fullName?.trim() || name
  const hints = useMemo(
    () => extractPosNameHints(hintSource),
    [hintSource]
  )

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={
        [fullName && fullName !== name ? fullName : name, skuText]
          .filter(Boolean)
          .join(' · ')
      }
      className={cn(
        'relative flex w-full flex-col rounded-md border bg-surface text-left transition-colors',
        'hover:bg-subtle active:bg-subtle disabled:opacity-50',
        flash && 'ring-2 ring-ink bg-subtle',
        zeroStock
          ? 'border-warning bg-warning-soft/40'
          : 'border-border',
        compact ? 'min-h-[5.25rem] gap-1.5 p-2' : 'min-h-[6.75rem] gap-2 p-2.5',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className={cn(
              'shrink-0 rounded-[5px] border border-border object-cover',
              compact ? 'size-9' : 'size-11'
            )}
          />
        ) : (
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-[5px] border border-dashed border-border text-ink-muted',
              compact ? 'size-9' : 'size-11'
            )}
            aria-hidden
          >
            <Package className={compact ? 'size-3.5' : 'size-4'} />
          </span>
        )}

        <div className="min-w-0 flex-1 pt-0.5">
          <div
            className={cn(
              'line-clamp-3 font-semibold leading-snug break-words',
              compact ? 'text-[13px]' : 'text-[14px] sm:text-[15px]',
              zeroStock ? 'text-ink-secondary' : 'text-ink'
            )}
          >
            {name}
          </div>
          {skuText ? (
            <div
              className={cn(
                'mt-0.5 font-medium tabular-nums tracking-tight text-ink-secondary break-all',
                compact ? 'text-[12px]' : 'text-[13px]'
              )}
            >
              {skuText}
            </div>
          ) : null}
          {hints.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {hints.map((h) => (
                <span
                  key={h}
                  className="rounded bg-subtle px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-ink"
                >
                  {h}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {qtyBadge != null && qtyBadge > 1 ? (
          <span className="shrink-0 rounded bg-ink px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-surface">
            ×{qtyBadge}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-end justify-between gap-2">
        {stockLabel != null ? (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
              zeroStock
                ? 'bg-warning-soft text-warning-ink'
                : 'bg-subtle text-ink-secondary'
            )}
          >
            {zeroStock ? 'Nincs' : `${stockLabel} ${unitShortform}`}
          </span>
        ) : (
          <span />
        )}
        {priceLabel.trim() ? (
          <span
            className={cn(
              'shrink-0 font-semibold tabular-nums tracking-tight whitespace-nowrap text-ink',
              compact ? 'text-[14px]' : 'text-[16px] sm:text-[17px]'
            )}
          >
            {priceLabel}
          </span>
        ) : null}
      </div>
    </button>
  )
}
