'use client'

import {
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import {
  ChevronDown,
  FileText,
  Minus,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  User,
  UserPlus
} from 'lucide-react'

import { PosQuickTile } from '@/components/pos/pos-quick-tile'
import { StatusBadge } from '@/components/patterns/status-badge'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

/**
 * Statikus POS terminál — `PosClient` wide + desktop (nem touch) crop.
 * Belső canvas 1100×620, scale a marketing oszlophoz. Nincs scroll / DB / interakció.
 */

const CANVAS_W = 1100
const CANVAS_H = 620

type Tile = {
  id: string
  name: string
  fullName: string
  sku: string
  price: number
  onHand: number
  imageUrl: string
}

type CartLine = {
  id: string
  name: string
  sku: string
  qty: number
  unitPrice: number
  onHand: number
}

const TILES: Tile[] = [
  {
    id: '1',
    name: 'Blum soft-close',
    fullName: 'Blum soft-close 35 mm',
    sku: 'BL-SC-35',
    price: 4_890,
    onHand: 24,
    imageUrl: '/marketing/pos/01-softclose.svg'
  },
  {
    id: '2',
    name: 'Fogantyú króm',
    fullName: 'Fogantyú króm 128 mm',
    sku: 'FG-KR-128',
    price: 1_250,
    onHand: 86,
    imageUrl: '/marketing/pos/02-handle.svg'
  },
  {
    id: '3',
    name: 'Csavar 4×16',
    fullName: 'Csavar 4×16 (doboz)',
    sku: 'CS-4X16',
    price: 3_200,
    onHand: 40,
    imageUrl: '/marketing/pos/03-screw.svg'
  },
  {
    id: '4',
    name: 'Élfólia fehér',
    fullName: 'Élfólia 22 mm fehér',
    sku: 'EF-22-W',
    price: 890,
    onHand: 120,
    imageUrl: '/marketing/pos/04-edge.svg'
  },
  {
    id: '5',
    name: 'Polctartó',
    fullName: 'Polctartó 5×16 mm',
    sku: 'PT-5X16',
    price: 450,
    onHand: 200,
    imageUrl: '/marketing/pos/05-shelf.svg'
  },
  {
    id: '6',
    name: 'Zsanér 110°',
    fullName: 'Zsanér 110° clip-on',
    sku: 'ZS-110-C',
    price: 2_180,
    onHand: 64,
    imageUrl: '/marketing/pos/06-hinge.svg'
  }
]

const CART: CartLine[] = [
  {
    id: '1',
    name: 'Blum soft-close',
    sku: 'BL-SC-35',
    qty: 2,
    unitPrice: 4_890,
    onHand: 24
  },
  {
    id: '2',
    name: 'Fogantyú króm',
    sku: 'FG-KR-128',
    qty: 4,
    unitPrice: 1_250,
    onHand: 86
  },
  {
    id: '3',
    name: 'Csavar 4×16 (doboz)',
    sku: 'CS-4X16',
    qty: 1,
    unitPrice: 3_200,
    onHand: 40
  }
]

const DUE = CART.reduce((s, l) => s + l.qty * l.unitPrice, 0)
const NET = Math.round(DUE / 1.27)

const QTY_PRESETS = [1, 2, 5, 10, 100, 1000] as const

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
      {children}
    </div>
  )
}

function ScaleCanvas({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    function measure() {
      const w = el!.clientWidth
      if (w <= 0) return
      setScale(w / CANVAS_W)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden"
      style={{ height: CANVAS_H * scale }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`
        }}
      >
        {children}
      </div>
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
        'rounded-md border px-2.5 py-1 text-hint',
        active
          ? 'border-ink bg-ink text-surface'
          : 'border-border bg-surface text-ink-secondary'
      )}
    >
      {children}
    </span>
  )
}

function PosDesktopChrome() {
  return (
    <div
      className="pointer-events-none flex h-full select-none flex-col bg-app"
      aria-hidden
      style={{ width: CANVAS_W, height: CANVAS_H }}
    >
      {/* Top bar — PosClient desktop */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="text-[13px] font-semibold text-ink">POS</span>
        <span className="rounded-md border border-border bg-subtle px-2.5 py-1 text-body text-ink">
          Fő raktár
        </span>
        <span className="rounded-md border border-border bg-subtle px-2.5 py-1 text-body text-ink">
          Pult 1
        </span>
        <StatusBadge tone="success" variant="outline">
          Műszak nyitva
        </StatusBadge>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-body">
          <User className="size-3.5 text-ink-muted" aria-hidden />
          Kovács Asztalos Kft.
        </span>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[13px] font-medium text-ink">
          <UserPlus className="size-3.5" aria-hidden />
          Új ügyfél
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[13px] font-medium text-ink">
            <FileText className="size-3.5" aria-hidden />
            Számlát kér
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[13px] font-medium text-ink">
            <MoreHorizontal className="size-4" aria-hidden />
            Több
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-0">
        {/* Catalog */}
        <section className="flex min-h-0 flex-col border-r border-border p-3">
          <div className="relative shrink-0">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <span className="flex h-8 w-full items-center rounded-md border border-border bg-surface pl-8 pr-3 text-[13px] text-ink-muted">
              Vonalkód / SKU / név…
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <FakeChip>Elöl a készletes</FakeChip>
            <FakeChip active>Mind</FakeChip>
            <span className="text-hint text-ink-secondary">
              Gépelés: lista · scanner: fókusz nélkül · Enter: exact ha nincs
              találat
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-hint text-ink-secondary">Mennyiség:</span>
            {QTY_PRESETS.map((n) => (
              <span
                key={n}
                className={cn(
                  'inline-flex min-h-8 min-w-8 items-center justify-center rounded-md border px-2.5 py-1 tabular-nums',
                  n === 1
                    ? 'border-ink bg-ink text-surface'
                    : 'border-border bg-surface text-ink'
                )}
              >
                {n}
              </span>
            ))}
          </div>

          <div className="mt-2 min-h-0 flex-1 overflow-hidden rounded-md border border-border">
            <div className="grid grid-cols-3 gap-2.5 p-3">
              {TILES.map((t) => (
                <PosQuickTile
                  key={t.id}
                  name={t.name}
                  fullName={t.fullName}
                  sku={t.sku}
                  priceLabel={`${formatMoneyFt(t.price)} Ft`}
                  imageUrl={t.imageUrl}
                  onHand={t.onHand}
                  unitShortform="db"
                />
              ))}
            </div>
          </div>
        </section>

        {/* Cart + pay */}
        <aside className="flex min-h-0 flex-col bg-subtle/30">
          <div className="min-h-0 flex-1 overflow-hidden p-3">
            <div className="overflow-hidden rounded-md border border-border bg-surface">
              <table className="w-full table-fixed border-collapse text-body">
                <thead>
                  <tr className="border-b border-border bg-subtle text-left text-label text-ink-secondary">
                    <th className="min-w-0 px-2 py-2 font-medium">Termék</th>
                    <th className="w-[9.5rem] px-1 py-2 text-center font-medium">
                      Qty
                    </th>
                    <th
                      className="w-[6.75rem] px-1.5 py-2 text-right font-medium leading-tight"
                      title="Bruttó összeg"
                    >
                      Összeg
                    </th>
                    <th className="w-10 px-0.5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {CART.map((line) => {
                    const total = line.qty * line.unitPrice
                    return (
                      <tr
                        key={line.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="min-w-0 px-2 py-2 align-middle">
                          <div className="flex min-w-0 items-start gap-1 font-semibold text-ink">
                            <ChevronDown
                              className="mt-0.5 size-3.5 shrink-0 text-ink-muted"
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1 line-clamp-2 leading-snug">
                              {line.name}
                            </span>
                          </div>
                          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1 pl-4">
                            <span className="truncate text-hint text-ink-secondary">
                              {line.sku}
                            </span>
                            <span className="text-hint text-ink-muted">
                              {line.onHand} db
                            </span>
                          </div>
                        </td>
                        <td className="px-1 py-2 align-middle">
                          <div className="flex items-center justify-center gap-0.5">
                            <span className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface">
                              <Minus className="size-4 text-ink" aria-hidden />
                            </span>
                            <span className="inline-flex h-9 w-12 items-center justify-center rounded-md border border-border bg-surface text-center tabular-nums">
                              {line.qty}
                            </span>
                            <span className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface">
                              <Plus className="size-4 text-ink" aria-hidden />
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-2 text-right align-middle tabular-nums text-ink">
                          <span className="text-[14px] font-semibold sm:text-[15px]">
                            {formatMoneyFt(total)} Ft
                          </span>
                        </td>
                        <td className="px-0.5 py-2 align-middle">
                          <span className="inline-flex size-9 items-center justify-center text-danger-ink">
                            <Trash2 className="size-4" aria-hidden />
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="shrink-0 space-y-2.5 border-t border-border bg-surface p-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-ink-secondary">
                  Nettó összesen
                </p>
                <p className="text-[17px] font-semibold tabular-nums text-ink">
                  {formatMoneyFt(NET)} Ft
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-medium text-ink-secondary">
                  Fizetendő (bruttó)
                </p>
                <p className="text-[28px] font-semibold leading-none tabular-nums tracking-tight text-ink">
                  {formatMoneyFt(DUE)} Ft
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <span className="flex h-14 flex-col items-center justify-center rounded-md bg-primary text-[15px] font-semibold text-white">
                <span className="leading-tight">
                  Készpénz
                  <span className="ml-1 text-[11px] font-normal opacity-70">
                    F4
                  </span>
                </span>
                <span className="mt-0.5 text-[13px] font-medium tabular-nums opacity-90">
                  {formatMoneyFt(DUE)} Ft
                </span>
              </span>
              <span className="flex h-14 flex-col items-center justify-center rounded-md border-2 border-border-strong bg-surface text-[15px] font-semibold text-ink">
                <span className="leading-tight">
                  Kártya
                  <span className="ml-1 text-[11px] font-normal opacity-70">
                    F5
                  </span>
                </span>
                <span className="mt-0.5 text-[13px] font-medium tabular-nums opacity-90">
                  {formatMoneyFt(DUE)} Ft
                </span>
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export function PosTerminalMockup({ className }: { className?: string }) {
  return (
    <AppFrame path="turinova.hu/pos" className={className}>
      <ScaleCanvas>
        <PosDesktopChrome />
      </ScaleCanvas>
    </AppFrame>
  )
}
