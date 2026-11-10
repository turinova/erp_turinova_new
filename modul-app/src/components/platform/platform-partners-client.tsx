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
import type {
  PlatformPartnerListItem,
  PlatformPartnersSummary,
  PlatformPartnerView
} from '@/lib/platform/partner-queries'
import { usePlatformHref } from '@/lib/platform/use-platform-href'
import { cn } from '@/lib/utils'

type StatusFilter = 'all' | 'active' | 'disabled'

type Props = {
  rows: PlatformPartnerListItem[]
  total: number
  page: number
  limit: number
  summary: PlatformPartnersSummary
  initialQ: string
  initialView: PlatformPartnerView
  initialStatus: StatusFilter
  tenantFilterId?: string | null
  tenantFilterName?: string | null
}

function formatRelative(iso: string | null) {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return '—'
  const diffMs = Date.now() - t
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'most'
  if (mins < 60) return `${mins} perce`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} órája`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} napja`
  try {
    return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'short' }).format(
      new Date(iso)
    )
  } catch {
    return iso
  }
}

function activityLabel(row: PlatformPartnerListItem) {
  const signIn = row.lastSignInAt ? new Date(row.lastSignInAt).getTime() : 0
  const submit = row.lastSubmittedAt
    ? new Date(row.lastSubmittedAt).getTime()
    : 0
  if (!signIn && !submit) return { primary: '—', secondary: null as string | null }
  if (submit >= signIn) {
    return {
      primary: `Beküldés ${formatRelative(row.lastSubmittedAt)}`,
      secondary: row.lastSignInAt
        ? `Belépés ${formatRelative(row.lastSignInAt)}`
        : null
    }
  }
  return {
    primary: `Belépés ${formatRelative(row.lastSignInAt)}`,
    secondary: row.lastSubmittedAt
      ? `Beküldés ${formatRelative(row.lastSubmittedAt)}`
      : null
  }
}

const VIEWS: {
  id: PlatformPartnerView
  label: string
  hint: string
}[] = [
  { id: 'live', label: 'Élő', hint: 'Belépett vagy beküldött (claimelt migrált is)' },
  { id: 'new', label: 'Új', hint: 'Friss organikus vagy aktivált migrált (7 nap)' },
  { id: 'legacy', label: 'Migrált', hint: 'Még nem lépett be / jelszó beállítás vár' },
  { id: 'all', label: 'Mind', hint: 'Teljes lista' }
]

export function PlatformPartnersClient({
  rows,
  total,
  page,
  limit,
  summary,
  initialQ,
  initialView,
  initialStatus,
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

  const viewCount = (id: PlatformPartnerView) => {
    if (id === 'live') return summary.live
    if (id === 'new') return summary.new7d
    if (id === 'legacy') return summary.legacy
    return summary.all
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-h1 text-ink">Partnerek</h1>
        <p className="mt-1 text-body text-ink-secondary">
          Élő: aktív partnerek. Migrált: még nem aktivált áthozott fiókok.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-hint text-ink-secondary">
        <span>
          Élő: <span className="font-medium tabular-nums text-ink">{summary.live}</span>
        </span>
        <span aria-hidden>·</span>
        <span>
          Új (7 nap):{' '}
          <span className="font-medium tabular-nums text-ink">{summary.new7d}</span>
        </span>
        <span aria-hidden>·</span>
        <span>
          Migrált:{' '}
          <span className="font-medium tabular-nums text-ink">{summary.legacy}</span>
        </span>
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

      <div
        role="tablist"
        aria-label="Partner nézet"
        className="mb-3 flex flex-wrap gap-0.5 rounded-md border border-border bg-subtle p-0.5"
      >
        {VIEWS.map((v) => {
          const active = initialView === v.id
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={active}
              title={v.hint}
              onClick={() =>
                pushParams({
                  view: v.id === 'live' ? null : v.id,
                  page: null
                })
              }
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-[5px] px-2.5 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-ink text-white'
                  : 'text-ink-secondary hover:bg-surface hover:text-ink'
              )}
            >
              {v.label}
              <span
                className={cn(
                  'tabular-nums',
                  active ? 'text-white/80' : 'text-ink-muted'
                )}
              >
                {viewCount(v.id)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
        <MenuSelect
          id="platform-partner-status-filter"
          value={initialStatus}
          allowEmpty={false}
          className="w-full sm:w-44"
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
      </div>

      {total === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          {initialView === 'live'
            ? 'Még nincs élő (belépett / beküldött) organikus partner.'
            : initialView === 'new'
              ? 'Nincs organikus regisztráció a szűrésre.'
              : initialView === 'legacy'
                ? 'Nincs migrált partner a szűrésre.'
                : 'Nincs partner a szűrésre.'}
        </p>
      ) : (
        <>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Név</DataTableHeaderCell>
                <DataTableHeaderCell>Státusz</DataTableHeaderCell>
                <DataTableHeaderCell>Cég</DataTableHeaderCell>
                <DataTableHeaderCell>Aktivitás</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Draft / Beküldés
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => {
                const activity = activityLabel(row)
                return (
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
                        {!row.selectedTenantId && row.status === 'active' ? (
                          <StatusBadge tone="neutral">Cég nélkül</StatusBadge>
                        ) : null}
                        {initialView === 'all' && row.isLegacy ? (
                          <StatusBadge tone="neutral" variant="outline">
                            Migrált
                          </StatusBadge>
                        ) : null}
                        {initialView === 'all' && !row.isLegacy ? (
                          <StatusBadge tone="info" variant="outline">
                            Új
                          </StatusBadge>
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
                    <DataTableCell>
                      <p className="text-[13px] text-ink">{activity.primary}</p>
                      {activity.secondary ? (
                        <p className="text-hint text-ink-secondary">
                          {activity.secondary}
                        </p>
                      ) : null}
                    </DataTableCell>
                    <DataTableCell className="text-right tabular-nums text-ink">
                      {row.draftCount} / {row.submittedCount}
                    </DataTableCell>
                  </DataTableRow>
                )
              })}
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
