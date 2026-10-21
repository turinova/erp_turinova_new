'use client'

import { cn } from '@/lib/utils'

type Props = {
  offsetXMm: number
  offsetYMm: number
  className?: string
}

/**
 * Printer registration schematic — fixed die-cut (centered), print area shifts.
 * Does NOT move label artwork (preview stays centered).
 */
export function LabelAlignmentSchema({
  offsetXMm,
  offsetYMm,
  className
}: Props) {
  // Map ±2 mm → ±28% of schema box
  const tx = Math.max(-28, Math.min(28, offsetXMm * 14))
  const ty = Math.max(-28, Math.min(28, offsetYMm * 14))

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-subtle px-3 py-2.5',
        className
      )}
      aria-hidden
    >
      <p className="mb-2 text-[11px] leading-snug text-ink-muted">
        A tartalom a matricán középen marad. Az eltolás a nyomtatót igazítja,
        ha a papír fizikailag csúszik.
      </p>
      <div className="relative mx-auto h-16 w-28">
        {/* Die-cut / label outline — fixed center */}
        <div className="absolute inset-[12%] rounded-[2px] border-2 border-dashed border-ink-muted/50 bg-white" />
        {/* Print registration — moves with offset */}
        <div
          className="absolute inset-[18%] rounded-[1px] border border-primary/70 bg-primary/15"
          style={{
            transform: `translate(${tx}%, ${ty}%)`
          }}
        />
        <span className="pointer-events-none absolute bottom-0 left-0 right-0 text-center text-[9px] tabular-nums text-ink-muted">
          {offsetXMm === 0 && offsetYMm === 0
            ? 'közép'
            : `${offsetXMm > 0 ? '+' : ''}${offsetXMm} / ${offsetYMm > 0 ? '+' : ''}${offsetYMm} mm`}
        </span>
      </div>
    </div>
  )
}
