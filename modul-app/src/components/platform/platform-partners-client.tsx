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
import { MenuSelect } from '@/components/ui/menu-select'
import { formatPlatformHuf } from '@/lib/platform/partner-overview'
import type {
  PlatformPartnerListItem,
  PlatformPartnersSummary
} from '@/lib/platform/partner-queries'
import { usePlatformHref } from '@/lib/platform/use-platform-href'

type LinkFilter = 'all' | 'linked' | 'unlinked'
type StatusFilter = 'all' | 'active' | 'disabled'
type PasswordFilter = 'all' | 'must_set'

type Props = {
  rows: PlatformPartnerListItem[]
  total: number
  page: number
  limit: number
  summary: PlatformPartnersSummary
  initialQ: string
  initialLink: LinkFilter
  initialStatus: StatusFilter
  initialPassword: PasswordFilter
  tenantFilterId?: string | null
  tenantFilterName?: string | null
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

function formatDay(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'short' }).format(
      new Date(iso)
    )
  } catch {
    return iso
  }
}

export function PlatformPartnersClient({
  rows,
  total,
  page,
  limit,
  summary,
  initialQ,
  initialLink,
  initialStatus,
  initialPassword,
  tenantFilterId = null,
  tenantFilterName = null
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const href = usePlatformHref()
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
            Online asztalosok — aktivitás, onboarding és support műveletek.
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi
          label="Aktív"
          value={String(summary.active)}
          hint={
            summary.disabled > 0 ? `${summary.disabled} kikapcsolva` : undefined
          }
        />
        <Kpi
          label="Cég nélkül"
          value={String(summary.unlinked)}
          hint="Aktív, nincs selected cég"
        />
        <Kpi
          label="Jelszó vár"
          value={String(summary.mustSetPassword)}
          hint="must_set_password"
        />
        <Kpi
          label="Migrált"
          value={String(summary.legacy)}
          hint="legacy portal id"
        />
        <Kpi label="Élő draft" value={String(summary.draftsAlive)} />
        <Kpi label="Beküldés 7 nap" value={String(summary.submits7d)} />
        <Kpi label="GMV 7 nap" value={formatPlatformHuf(summary.gmv7d)} />
      </div>

      {tenantFilterId ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-subtle px-3 py-2">
          <p className="text-body text-ink">
            Szűrve cégre:{' '}
            <span className="font-medium">
              {tenantFilterName ?? tenantFilterId.slice(0, 8)}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={href(`/tenants/${tenantFilterId}`)}
              className="text-[13px] text-ink underline-offset-2 hover:underline"
            >
              ← Cég
            </Link>
            <button
              type="button"
              className="text-[13px] text-ink-secondary underline-offset-2 hover:underline"
              onClick={() => pushParams({ tenant: null, page: null })}
            >
              Szűrő törlése
            </button>
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
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
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[28rem]">
          <MenuSelect
            id="platform-partner-link-filter"
            value={initialLink}
            allowEmpty={false}
            options={[
              { value: 'all', label: 'Kapcsolat: összes' },
              { value: 'linked', label: 'Kapcsolt céggel' },
              { value: 'unlinked', label: 'Cég nélkül' }
            ]}
            onChange={(v) =>
              pushParams({
                link: v === 'all' ? null : v,
                page: null
              })
            }
          />
          <MenuSelect
            id="platform-partner-status-filter"
            value={initialStatus}
            allowEmpty={false}
            options={[
              { value: 'all', label: 'Státusz: összes' },
              { value: 'active', label: 'Aktív' },
              { value: 'disabled', label: 'Kikapcsolva' }
            ]}
            onChange={(v) =>
              pushParams({
                status: v === 'all' ? null : v,
                page: null
              })
            }
          />
          <MenuSelect
            id="platform-partner-password-filter"
            value={initialPassword}
            allowEmpty={false}
            options={[
              { value: 'all', label: 'Jelszó: összes' },
              { value: 'must_set', label: 'Jelszó beállítás kell' }
            ]}
            onChange={(v) =>
              pushParams({
                password: v === 'all' ? null : v,
                page: null
              })
            }
          />
        </div>
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
                <DataTableHeaderCell className="text-right">
                  7 nap
                </DataTableHeaderCell>
                <DataTableHeaderCell>Utolsó beküldés</DataTableHeaderCell>
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
                      href={href(`/partnerek/${row.userId}`)}
                      className="font-medium text-ink no-underline hover:underline"
                    >
                      {row.name}
                    </Link>
                    <p className="text-hint text-ink-secondary">{row.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.mustSetPassword ? (
                        <StatusBadge tone="warning">Jelszó kell</StatusBadge>
                      ) : null}
                      {row.isLegacy ? (
                        <StatusBadge tone="neutral">Migrált</StatusBadge>
                      ) : null}
                    </div>
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
                  <DataTableCell className="text-right text-ink">
                    <p className="tabular-nums">{row.submitted7d} db</p>
                    {row.gmv7d > 0 ? (
                      <p className="text-hint text-ink-secondary tabular-nums">
                        {formatPlatformHuf(row.gmv7d)}
                      </p>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell className="text-hint text-ink-secondary">
                    {formatDay(row.lastSubmittedAt)}
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
                        router.push(href(`/partnerek/${row.userId}`))
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

function Kpi({
  label,
  value,
  hint
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <p className="text-hint text-ink-secondary">{label}</p>
      <p className="mt-0.5 text-body font-semibold tabular-nums text-ink">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[11px] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}
