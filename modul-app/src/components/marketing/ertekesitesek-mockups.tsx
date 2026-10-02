import type { ReactNode } from 'react'
import { Plus, Search, ShoppingCart } from 'lucide-react'

import { StatusBadge } from '@/components/patterns/status-badge'
import { getNavAccentClasses } from '@/lib/nav-accent'
import {
  formatMoneyFt,
  SALE_STATUS_LABEL,
  saleStatusTone,
  type SaleStatus
} from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

/**
 * Statikus UI-másolat: `/ertekesitesek` lista (`sales-list-client`).
 * Címkék / badge = `lib/sales/parse`. Nincs scroll, nincs DB, nincs interaktivitás.
 */

type MockRow = {
  id: string
  saleNumber: string
  customer: string
  channel: string
  totalGross: number
  status: SaleStatus
}

const ROWS: MockRow[] = [
  {
    id: '1',
    saleNumber: 'EL-2026-0142',
    customer: 'Kovács Asztalos Kft.',
    channel: 'POS',
    totalGross: 48_620,
    status: 'fulfilled'
  },
  {
    id: '2',
    saleNumber: 'EL-2026-0141',
    customer: 'Vendég',
    channel: 'POS',
    totalGross: 12_850,
    status: 'fulfilled'
  },
  {
    id: '3',
    saleNumber: 'EL-2026-0138',
    customer: 'Bútorház Bt.',
    channel: 'Manuális',
    totalGross: 215_400,
    status: 'confirmed'
  },
  {
    id: '4',
    saleNumber: 'EL-2026-0135',
    customer: 'Nagy Péter',
    channel: 'Manuális',
    totalGross: 8_900,
    status: 'returned'
  },
  {
    id: '5',
    saleNumber: 'EL-2026-0132',
    customer: 'Design Studio',
    channel: 'POS',
    totalGross: 64_800,
    status: 'partially_returned'
  }
]

const STATUS_CHIPS: { label: string; active?: boolean }[] = [
  { label: 'Mind', active: true },
  { label: 'Átadásra vár' },
  { label: 'Teljesítve' },
  { label: 'Részben visszáru' },
  { label: 'Visszáru' }
]

function AppFrame({
  path,
  children,
  className
}: {
  path: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-app shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
        </span>
        <span className="rounded bg-subtle px-2 py-0.5 text-[11px] text-ink-muted">
          {path}
        </span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function FakeChip({
  children,
  active
}: {
  children: ReactNode
  active?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-md px-2.5 text-hint font-medium',
        active ? 'bg-ink text-surface' : 'bg-subtle text-ink-secondary'
      )}
    >
      {children}
    </span>
  )
}

export function ErtekesitesekListaMockup({
  className
}: {
  className?: string
}) {
  const tones = getNavAccentClasses('amber')

  return (
    <AppFrame path="turinova.hu/ertekesitesek" className={className}>
      <div className="pointer-events-none select-none space-y-3" aria-hidden>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-md',
                  tones.soft,
                  tones.icon
                )}
              >
                <ShoppingCart className="size-4" />
              </span>
              <h3 className="text-h1 text-ink">Értékesítések</h3>
            </div>
            <p className="max-w-xl pl-[42px] text-body text-ink-secondary">
              Termék eladás — pult vagy iroda.
            </p>
            <div
              className={cn(
                'ml-[42px] mt-2 h-0.5 w-12 rounded-full',
                tones.bar
              )}
            />
          </div>
          <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-white">
            <Plus className="size-3.5" aria-hidden />
            Új értékesítés
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[10rem] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <span className="flex h-8 w-full items-center rounded-md border border-border bg-surface pl-8 pr-3 text-[13px] text-ink-muted">
              Szám / ügyfél…
            </span>
          </div>
          <span className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink">
            Keresés
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_CHIPS.map((c) => (
            <FakeChip key={c.label} active={c.active}>
              {c.label}
            </FakeChip>
          ))}
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead className="border-b border-border bg-subtle">
              <tr className="text-hint text-ink-secondary">
                <th className="px-2.5 py-2 font-medium">Szám</th>
                <th className="px-2.5 py-2 font-medium">Ügyfél</th>
                <th className="hidden px-2.5 py-2 font-medium sm:table-cell">
                  Csatorna
                </th>
                <th className="px-2.5 py-2 text-right font-medium">
                  Bruttó (Ft)
                </th>
                <th className="px-2.5 py-2 font-medium">Állapot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ROWS.map((row) => (
                <tr key={row.id} className="bg-surface">
                  <td className="px-2.5 py-2 font-medium text-ink">
                    {row.saleNumber}
                  </td>
                  <td className="px-2.5 py-2 text-ink-secondary">
                    {row.customer}
                  </td>
                  <td className="hidden px-2.5 py-2 text-ink-secondary sm:table-cell">
                    {row.channel}
                  </td>
                  <td className="px-2.5 py-2 text-right font-semibold tabular-nums text-ink">
                    {formatMoneyFt(row.totalGross)} Ft
                  </td>
                  <td className="px-2.5 py-2">
                    <StatusBadge tone={saleStatusTone(row.status)}>
                      {SALE_STATUS_LABEL[row.status]}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppFrame>
  )
}
