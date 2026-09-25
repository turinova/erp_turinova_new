'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatMoneyFt } from '@/lib/accessories/parse'
import type { AccessoryListItem } from '@/lib/accessories/queries'
import {
  SHOP_READY_LABEL,
  shopReadyTone
} from '@/lib/accessories/web-shop'

const PRODUCT_PATH = '/torzsadatok/alapanyagok/termekek'

type Filter = 'web' | 'blocked' | 'ready'

type Props = {
  initialRows: AccessoryListItem[]
}

export function WebshopCatalogClient({ initialRows }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('web')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return initialRows.filter((row) => {
      if (filter === 'web' && !row.sellable_web) return false
      if (filter === 'blocked' && row.shop_ready_level !== 'blocked') {
        return false
      }
      if (
        filter === 'ready' &&
        row.shop_ready_level !== 'competitive' &&
        row.shop_ready_level !== 'agent_excellent'
      ) {
        return false
      }
      if (!term) return true
      return (
        row.name.toLowerCase().includes(term) ||
        row.sku.toLowerCase().includes(term) ||
        (row.web_slug ?? '').toLowerCase().includes(term)
      )
    })
  }, [initialRows, search, filter])

  return (
    <div>
      <PageHeader
        title="Bolt katalógus"
        description="Termékek, amiket az online boltban árulsz (vagy majdnem kész)."
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="relative max-w-sm flex-1"
        >
          <label className="sr-only" htmlFor="webshop-catalog-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="webshop-catalog-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés név, SKU, slug…"
            className="pl-8"
          />
        </form>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['web', 'Boltban'],
              ['blocked', 'Majdnem kész'],
              ['ready', 'Kész a boltra']
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={filter === value ? 'secondary' : 'ghost'}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center text-body text-ink-secondary">
          Nincs találat ebben a szűrésben.
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell>SKU</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                Bruttó
              </DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell className="w-24">Bolt</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.map((row) => (
              <DataTableRow key={row.id}>
                <DataTableCell className="font-medium text-ink">
                  <Link
                    href={`${PRODUCT_PATH}/${row.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                </DataTableCell>
                <DataTableCell className="tabular-nums text-ink-secondary">
                  {row.sku}
                </DataTableCell>
                <DataTableCell className="text-right tabular-nums">
                  {formatMoneyFt(row.price_gross)}
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge tone={shopReadyTone(row.shop_ready_level)}>
                    {SHOP_READY_LABEL[row.shop_ready_level]}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell>
                  {row.sellable_web && row.web_slug ? (
                    <Link
                      href={`/p/${encodeURIComponent(row.web_slug)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-hint text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
                    >
                      PDP
                      <ExternalLink className="size-3" aria-hidden />
                    </Link>
                  ) : (
                    <span className="text-hint text-ink-muted">—</span>
                  )}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </div>
  )
}
