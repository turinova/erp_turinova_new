'use client'

import { CustomerOrderStatusShell } from '@/components/order-status/customer-order-status-shell'
import type { CustomerOrderStatusView } from '@/lib/order-status/types'
import { cn } from '@/lib/utils'

type Props = {
  view: CustomerOrderStatusView
  className?: string
}

/** Telefon-keret a státuszoldal beállítások előnézetéhez. */
export function OrderStatusPreview({ view, className }: Props) {
  return (
    <div
      className={cn(
        'mx-auto w-[320px] overflow-hidden rounded-[1.75rem] border-[6px] border-ink bg-app shadow-elev2',
        className
      )}
      aria-label="Rendelés státusz oldal előnézet"
    >
      <div className="flex justify-center bg-ink py-1.5">
        <div className="h-1 w-16 rounded-full bg-ink-secondary/40" aria-hidden />
      </div>
      <div className="max-h-[560px] overflow-y-auto overscroll-contain">
        <CustomerOrderStatusShell view={view} variant="preview" />
      </div>
      <div className="flex justify-center bg-app py-2">
        <div
          className="h-1 w-24 rounded-full border border-border bg-subtle"
          aria-hidden
        />
      </div>
    </div>
  )
}
