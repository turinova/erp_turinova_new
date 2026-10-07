'use client'

import { UserRound, X } from 'lucide-react'

import { CustomerMenuSelect } from '@/components/customers/customer-menu-select'
import { Button } from '@/components/ui/button'
import type { OptiCustomerOption } from '@/lib/customers/queries'
import { cn } from '@/lib/utils'

type ChipProps = {
  customerId: string
  customerName: string | null
  onOpen: () => void
}

export function PdaCustomerChip({
  customerId,
  customerName,
  onOpen
}: ChipProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex h-11 w-full items-center gap-2 rounded-md border px-3 text-left active:bg-subtle',
        customerId
          ? 'border-info/40 bg-info-soft/40'
          : 'border-border bg-surface'
      )}
    >
      <UserRound className="size-4 shrink-0 text-ink-secondary" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
        {customerName ?? (customerId ? 'Vevő' : 'Vendég')}
      </span>
      <span className="text-hint text-ink-muted">Váltás</span>
    </button>
  )
}

type SheetProps = {
  open: boolean
  onClose: () => void
  customerId: string
  customerSeed: OptiCustomerOption[]
  onChange: (id: string, customer: OptiCustomerOption | null) => void
}

export function PdaCustomerSheet({
  open,
  onClose,
  customerId,
  customerSeed,
  onChange
}: SheetProps) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-app">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))]">
        <h2 className="min-w-0 flex-1 truncate px-2 text-[16px] font-semibold text-ink">
          Ügyfél
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 w-11 shrink-0 px-0"
          onClick={onClose}
          aria-label="Bezárás"
        >
          <X className="size-5" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        <CustomerMenuSelect
          id="pda-customer"
          value={customerId}
          seed={customerSeed}
          portal={false}
          allowEmpty
          emptyLabel="Vendég"
          placeholder="Név, telefon, email…"
          onChange={(id, customer) => {
            onChange(id, customer)
            onClose()
          }}
        />
        <Button
          type="button"
          variant="secondary"
          className="h-12"
          onClick={() => {
            onChange('', null)
            onClose()
          }}
        >
          Vendég (nincs ügyfél)
        </Button>
      </div>
    </div>
  )
}
