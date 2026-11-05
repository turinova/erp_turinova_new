import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  Building2,
  ClipboardList,
  FileText,
  Phone,
  ScanSearch,
  Search
} from 'lucide-react'

import { cn } from '@/lib/utils'

type Tone = 'quotes' | 'orders' | 'search'

const TONE_CLASS: Record<Tone, string> = {
  quotes: 'bg-tile-quotes hover:bg-tile-quotes-hover focus-visible:outline-tile-quotes',
  orders: 'bg-tile-orders hover:bg-tile-orders-hover focus-visible:outline-tile-orders',
  search: 'bg-tile-search hover:bg-tile-search-hover focus-visible:outline-tile-search'
}

const TILE_BASE =
  'group flex min-h-[148px] flex-col rounded-lg p-5 text-white no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'

function TileIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      className="flex size-10 items-center justify-center rounded-md bg-white/15"
      aria-hidden
    >
      <Icon className="size-5" />
    </span>
  )
}

function SmallTile({
  href,
  tone,
  icon,
  title,
  description,
  meta
}: {
  href: string
  tone: Tone
  icon: LucideIcon
  title: string
  description: string
  meta: string
}) {
  return (
    <Link href={href} className={cn(TILE_BASE, TONE_CLASS[tone])}>
      <TileIcon icon={icon} />
      <p className="mt-3 text-[18px] font-semibold leading-tight">{title}</p>
      <p className="mt-1 text-[15px] leading-snug text-white/90">
        {description}
      </p>
      <p className="mt-auto flex items-center justify-between gap-2 pt-3 text-[14px] font-medium text-white/90">
        <span>{meta}</span>
        <ArrowRight
          className="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </p>
    </Link>
  )
}

export function HomeTiles({
  hrefs,
  draftCount,
  openOrderCount,
  acceptsOrders,
  phone
}: {
  hrefs: { opti: string; quotes: string; orders: string; search: string }
  draftCount: number
  openOrderCount: number
  /** false = a cég most nem fogad online rendelést. */
  acceptsOrders: boolean | null
  phone: string | null
}) {
  const optiDisabled = acceptsOrders === false

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {optiDisabled ? (
        <div
          aria-disabled="true"
          className="flex min-h-[148px] flex-col rounded-lg border border-border-strong bg-subtle p-5 sm:col-span-2"
        >
          <span
            className="flex size-10 items-center justify-center rounded-md bg-border text-ink-secondary"
            aria-hidden
          >
            <ScanSearch className="size-5" />
          </span>
          <p className="mt-3 text-[20px] font-semibold leading-tight text-ink">
            A cég most nem fogad online rendelést
          </p>
          <p className="mt-1 text-[15px] text-ink-secondary">
            Rendelésért hívd őket telefonon.
          </p>
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className="mt-auto inline-flex items-center gap-2 pt-3 text-[16px] font-semibold text-ink no-underline hover:underline"
            >
              <Phone className="size-4" aria-hidden />
              {phone}
            </a>
          ) : null}
        </div>
      ) : (
        <Link
          href={hrefs.opti}
          className={cn(
            TILE_BASE,
            'bg-tile-opti hover:bg-tile-opti-hover focus-visible:outline-tile-opti sm:col-span-2'
          )}
        >
          <TileIcon icon={ScanSearch} />
          <p className="mt-3 text-[22px] font-semibold leading-tight">
            Új rendelés leadása
          </p>
          <p className="mt-1 text-[15px] leading-snug text-white/90">
            Add meg a lapokat, az árat azonnal látod.
          </p>
          <span className="mt-auto inline-flex h-11 w-fit items-center gap-2 rounded-md bg-white px-4 text-[15px] font-semibold text-tile-opti">
            Kezdés
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </Link>
      )}

      <SmallTile
        href={hrefs.quotes}
        tone="quotes"
        icon={FileText}
        title="Ajánlataim"
        description="Mentett, még be nem küldött ajánlatok."
        meta={
          draftCount === 0 ? 'Nincs mentett ajánlat' : `${draftCount} beküldetlen`
        }
      />
      <SmallTile
        href={hrefs.orders}
        tone="orders"
        icon={ClipboardList}
        title="Rendeléseim"
        description="Hol tart, mikor viheted el."
        meta={
          openOrderCount === 0
            ? 'Nincs folyamatban'
            : `${openOrderCount} folyamatban`
        }
      />
      <SmallTile
        href={hrefs.search}
        tone="search"
        icon={Search}
        title="Anyagkereső"
        description="Árak, színek, méretek."
        meta="Keresés indítása"
      />
    </div>
  )
}

/** Nincs kapcsolt cég — a csempék helyén. */
export function SelectCompanyCard({ settingsHref }: { settingsHref: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border-2 border-tile-archive/40 bg-warning-soft p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-tile-archive text-white"
          aria-hidden
        >
          <Building2 className="size-5" />
        </span>
        <div>
          <h2 className="text-[18px] font-semibold text-warning-ink">
            Válaszd ki, melyik lapszabászattól rendelsz
          </h2>
          <p className="mt-0.5 text-[15px] text-warning-ink">
            Rendelni, keresni és árat látni csak kiválasztott céggel lehet.
          </p>
        </div>
      </div>
      <Link
        href={settingsHref}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-tile-archive px-4 text-[15px] font-semibold text-white no-underline hover:bg-tile-archive-hover"
      >
        Cég kiválasztása
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  )
}
