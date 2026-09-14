'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { PlatformPartnerListItem } from '@/lib/platform/partner-queries'

type LinkFilter = 'all' | 'linked' | 'unlinked'

type Props = {
  rows: PlatformPartnerListItem[]
  total: number
  page: number
  limit: number
  initialQ: string
  initialLink: LinkFilter
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('hu-HU', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function PlatformPartnersClient({
  rows,
  total,
  page,
  limit,
  initialQ,
  initialLink
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [qDraft, setQDraft] = useState(initialQ)

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  function pushParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    pushParams({ q: qDraft.trim() || null, page: null })
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-ink">Partnerek</h1>
          <p className="mt-1 text-body text-ink-secondary">
            Online asztalosok — nem tenant seat. Disable / unlink / impersonate
            a partner részletezőn.
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="relative max-w-sm flex-1">
          <label className="sr-only" htmlFor="platform-partner-search">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="platform-partner-search"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Keresés név vagy email…"
            className="pl-8"
          />
        </form>
        <Select
          value={initialLink}
          onChange={(e) =>
            pushParams({
              link: e.target.value === 'all' ? null : e.target.value,
              page: null
            })
          }
          aria-label="Kapcsolat szűrő"
          className="w-full sm:w-44"
        >
          <option value="all">Összes</option>
          <option value="linked">Kapcsolt céggel</option>
          <option value="unlinked">Cég nélkül</option>
        </Select>
      </div>

      {total === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          Nincs partner a szűrésre.
        </p>
      ) : (
        <>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Név</DataTableHeaderCell>
                <DataTableHeaderCell>Státusz</DataTableHeaderCell>
                <DataTableHeaderCell>Cég</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Draft / Beküldés
                </DataTableHeaderCell>
                <DataTableHeaderCell>Utolsó belépés</DataTableHeaderCell>
                <DataTableHeaderCell className="w-[1%] text-right">
                  Műveletek
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => (
                <DataTableRow key={row.userId}>
                  <DataTableCell>
                    <Link
                      href={`/platform/partnerek/${row.userId}`}
                      className="font-medium text-ink no-underline hover:underline"
                    >
                      {row.name}
                    </Link>
                    <p className="text-hint text-ink-secondary">{row.email}</p>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      tone={row.status === 'disabled' ? 'danger' : 'success'}
                    >
                      {row.status === 'disabled' ? 'Kikapcsolva' : 'Aktív'}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell className="text-ink">
                    {row.companyName ?? (
                      <span className="text-ink-muted">—</span>
                    )}
                  </DataTableCell>
                  <DataTableCell className="text-right tabular-nums text-ink">
                    {row.draftCount} / {row.submittedCount}
                  </DataTableCell>
                  <DataTableCell className="text-hint text-ink-secondary">
                    {formatDate(row.lastSignInAt)}
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        router.push(`/platform/partnerek/${row.userId}`)
                      }
                    >
                      Megnyitás
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-hint text-ink-secondary">
            <p>
              {from}–{to} / {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => pushParams({ page: String(page - 1) })}
              >
                Előző
              </Button>
              <span className="px-2 tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => pushParams({ page: String(page + 1) })}
              >
                Következő
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
