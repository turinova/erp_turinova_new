'use client'

import { ArrowRightLeft, Banknote, CreditCard } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

type Props = {
  totalGross: number
  pending?: boolean
  empty?: boolean
  allowCash?: boolean
  allowCard?: boolean
  /** PDA → pult: primary CTA when handoff enabled (addon). */
  showHandoff?: boolean
  handoffPending?: boolean
  onHandoff?: () => void
  onCash?: () => void
  onCard?: () => void
  children?: React.ReactNode
}

/** Fix alsó összesítő — Átadás primary + KP/kártya. */
export function PdaDock({
  totalGross,
  pending,
  empty,
  allowCash,
  allowCard,
  showHandoff,
  handoffPending,
  onHandoff,
  onCash,
  onCard,
  children
}: Props) {
  const busy = pending || handoffPending

  return (
    <div
      className={cn(
        'shrink-0 space-y-2 border-t border-border bg-surface px-3 pt-3',
        'pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]'
      )}
    >
      {children}
      <p className="text-center text-[28px] font-semibold tabular-nums tracking-tight text-ink">
        {formatMoneyFt(totalGross)} Ft
      </p>
      {showHandoff ? (
        <Button
          type="button"
          className="h-14 w-full text-[15px]"
          disabled={busy || empty}
          loading={handoffPending}
          onClick={onHandoff}
        >
          <ArrowRightLeft className="size-4" aria-hidden />
          Átadás a pultra
        </Button>
      ) : null}
      <div
        className={cn(
          'grid gap-2',
          allowCash && allowCard ? 'grid-cols-2' : 'grid-cols-1'
        )}
      >
        {allowCash ? (
          <Button
            type="button"
            variant={showHandoff ? 'secondary' : 'primary'}
            className="h-12 text-[14px]"
            disabled={busy || empty}
            onClick={onCash}
          >
            <Banknote className="size-4" aria-hidden />
            Készpénz
          </Button>
        ) : null}
        {allowCard ? (
          <Button
            type="button"
            variant="secondary"
            className={cn(
              'h-12 text-[14px]',
              showHandoff
                ? null
                : 'border-[#c9cc3a]/60 bg-[#e0e34e] text-ink hover:bg-[#e0e34e]'
            )}
            disabled={busy || empty}
            onClick={onCard}
          >
            <CreditCard className="size-4" aria-hidden />
            Kártya
          </Button>
        ) : null}
      </div>
    </div>
  )
}
