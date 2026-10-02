import type { ReactNode } from 'react'
import { History, Search } from 'lucide-react'

import { StatusBadge } from '@/components/patterns/status-badge'
import { getNavAccentClasses } from '@/lib/nav-accent'
import {
  MOVEMENT_SOURCE_LABEL,
  MOVEMENT_TYPE_LABEL,
  movementSourceTone,
  movementTypeTone
} from '@/lib/stock/parse'
import type {
  StockMovementSource,
  StockMovementType
} from '@/lib/supabase/database.types'
import { cn } from '@/lib/utils'

/**
 * Statikus UI-másolat: `/keszlet/mozgasok` lista.
 * Címkék / badge = `stock-movements-list-client` + `lib/stock/parse`.
 * Nincs scroll, nincs DB, nincs interaktivitás.
 */

type MockRow = {
  id: string
  number: string
  product: string
  sku: string
  warehouse: string
  quantity: number
  unit: string
  movementType: StockMovementType
  sourceType: StockMovementSource
  sourceLabel: string
  date: string
}

const ROWS: MockRow[] = [
  {
    id: '1',
    number: 'SM-2026-1042',
    product: 'Egger H1176 ST37',
    sku: 'EG-H1176',
    warehouse: 'Fő raktár',
    quantity: 48,
    unit: 'db',
    movementType: 'in',
    sourceType: 'purchase_receipt',
    sourceLabel: 'GR-2026-0312',
    date: '2026. 03. 31.'
  },
  {
    id: '2',
    number: 'SM-2026-1041',
    product: 'Blum soft-close',
    sku: 'BL-SC-35',
    warehouse: 'Bolt',
    quantity: 2,
    unit: 'db',
    movementType: 'out',
    sourceType: 'sale',
    sourceLabel: 'S-2026-0881',
    date: '2026. 03. 31.'
  },
  {
    id: '3',
    number: 'SM-2026-1040',
    product: 'Élfólia 22 mm',
    sku: 'EF-22-W',
    warehouse: 'Fő raktár',
    quantity: 12,
    unit: 'm',
    movementType: 'out',
    sourceType: 'transfer',
    sourceLabel: 'TR-2026-0044',
    date: '2026. 03. 30.'
  },
  {
    id: '4',
    number: 'SM-2026-1039',
    product: 'Fogantyú króm',
    sku: 'FG-KR-128',
    warehouse: 'Bolt',
    quantity: 1,
    unit: 'db',
    movementType: 'in',
    sourceType: 'sale_return',
    sourceLabel: 'S-2026-0870',
    date: '2026. 03. 30.'
  },
  {
    id: '5',
    number: 'SM-2026-1038',
    product: 'Csavar 4×16',
    sku: 'CS-4X16',
    warehouse: 'Fő raktár',
    quantity: 500,
    unit: 'db',
    movementType: 'in',
    sourceType: 'purchase_receipt',
    sourceLabel: 'GR-2026-0308',
    date: '2026. 03. 29.'
  }
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

function formatQty(n: number) {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

export function KeszletMozgasokMockup({ className }: { className?: string }) {
  const tones = getNavAccentClasses('cyan')

  return (
    <AppFrame
      path="turinova.hu/keszlet/mozgasok"
      className={className}
    >
      <div className="pointer-events-none select-none space-y-3" aria-hidden>
        {/* PageHeader — mint PageHeaderWithNav /keszlet/mozgasok */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-md',
                tones.soft,
                tones.icon
              )}
            >
              <History className="size-4" />
            </span>
            <h3 className="text-h1 text-ink">Készletmozgások</h3>
          </div>
          <p className="max-w-2xl pl-[42px] text-body text-ink-secondary">
            Ledger — minden be- és kimenő változás.
          </p>
          <div
            className={cn('ml-[42px] mt-2 h-0.5 w-12 rounded-full', tones.bar)}
          />
        </div>

        {/* Kereső sor */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[10rem] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <span className="flex h-8 w-full items-center rounded-md border border-border bg-surface pl-8 pr-3 text-[13px] text-ink-muted">
              Szám / megjegyzés…
            </span>
          </div>
          <span className="inline-flex h-8 min-w-[7.5rem] items-center rounded-md border border-border bg-surface px-2.5 text-[13px] text-ink-secondary">
            Minden raktár
          </span>
          <span className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink">
            Keresés
          </span>
        </div>

        {/* Típus chipek */}
        <div className="flex flex-wrap gap-1.5">
          <FakeChip active>Mind</FakeChip>
          <FakeChip>Be</FakeChip>
          <FakeChip>Ki</FakeChip>
        </div>

        {/* Forrás chipek — crop: fő források */}
        <div className="flex flex-wrap gap-1.5">
          <FakeChip active>Minden forrás</FakeChip>
          <FakeChip>Beérkezés</FakeChip>
          <FakeChip>Eladás</FakeChip>
          <FakeChip>Áttárolás</FakeChip>
        </div>

        {/* Tábla — 5 sor, nincs scroll */}
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead className="border-b border-border bg-subtle">
              <tr className="text-hint text-ink-secondary">
                <th className="px-2.5 py-2 font-medium">Szám</th>
                <th className="px-2.5 py-2 font-medium">Termék</th>
                <th className="hidden px-2.5 py-2 font-medium sm:table-cell">
                  Raktár
                </th>
                <th className="px-2.5 py-2 text-right font-medium">
                  Mennyiség
                </th>
                <th className="px-2.5 py-2 font-medium">Irány</th>
                <th className="hidden px-2.5 py-2 font-medium md:table-cell">
                  Forrás
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ROWS.map((row) => {
                const isIn = row.movementType === 'in'
                return (
                  <tr key={row.id} className="bg-surface">
                    <td className="px-2.5 py-2 font-medium text-ink">
                      {row.number}
                    </td>
                    <td className="px-2.5 py-2">
                      <span className="font-medium text-ink">{row.product}</span>
                      <div className="text-hint text-ink-secondary">
                        {row.sku}
                      </div>
                    </td>
                    <td className="hidden px-2.5 py-2 text-ink-secondary sm:table-cell">
                      {row.warehouse}
                    </td>
                    <td className="px-2.5 py-2 text-right">
                      <span
                        className={cn(
                          'font-semibold tabular-nums',
                          isIn ? 'text-success-ink' : 'text-danger-ink'
                        )}
                      >
                        {isIn ? '+' : '−'}
                        {formatQty(row.quantity)} {row.unit}
                      </span>
                    </td>
                    <td className="px-2.5 py-2">
                      <StatusBadge tone={movementTypeTone(row.movementType)}>
                        {MOVEMENT_TYPE_LABEL[row.movementType]}
                      </StatusBadge>
                    </td>
                    <td className="hidden px-2.5 py-2 md:table-cell">
                      <StatusBadge tone={movementSourceTone(row.sourceType)}>
                        {MOVEMENT_SOURCE_LABEL[row.sourceType]}
                      </StatusBadge>
                      <div className="mt-0.5 text-hint text-ink-secondary">
                        {row.sourceLabel}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppFrame>
  )
}
