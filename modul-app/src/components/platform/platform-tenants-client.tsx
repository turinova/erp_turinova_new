'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Plus, Search } from 'lucide-react'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import {
  TENANT_STATUS_LABEL,
  tenantStatusTone
} from '@/lib/platform/onboarding'
import type { PlatformTenantListItem } from '@/lib/platform/queries'
import type { TenantStatus } from '@/lib/supabase/database.types'
import { cn } from '@/lib/utils'

type Props = {
  rows: PlatformTenantListItem[]
  total: number
  page: number
  limit: number
  initialQ: string
  initialStatus: TenantStatus | 'all'
}

const STATUS_OPTIONS: Array<TenantStatus | 'all'> = [
  'all',
  'active',
  'provisioning',
  'read_only',
  'suspended',
  'churned'
]

export function PlatformTenantsClient({
  rows,
  total,
  page,
  limit,
  initialQ,
  initialStatus
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
          <h1 className="text-h1 text-ink">Cégek</h1>
          <p className="mt-1 text-body text-ink-secondary">
            Tenant lifecycle és onboarding állapot.
          </p>
        </div>
        <Link
          href="/platform/tenants/uj"
          className={cn(buttonVariants({ variant: 'primary' }))}
        >
          <Plus className="size-3.5" aria-hidden />
          Új cég
        </Link>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <form onSubmit={handleSearch} className="relative max-w-sm flex-1">
          <label className="sr-only" htmlFor="platform-tenant-q">
            Keresés
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="platform-tenant-q"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Név vagy slug…"
            className="pl-8"
          />
        </form>
        <div className="min-w-[160px]">
          <label
            className="mb-1 block text-hint text-ink-secondary"
            htmlFor="platform-tenant-status"
          >
            Státusz
          </label>
          <MenuSelect
            id="platform-tenant-status"
            value={initialStatus}
            allowEmpty={false}
            options={STATUS_OPTIONS.map((s) => ({
              value: s,
              label: s === 'all' ? 'Összes' : TENANT_STATUS_LABEL[s]
            }))}
            onChange={(v) =>
              pushParams({
                status: v === 'all' ? null : v,
                page: null
              })
            }
          />
        </div>
      </div>

      {total === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center text-body text-ink-secondary">
          Nincs találat.
        </p>
      ) : (
        <>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Név</DataTableHeaderCell>
                <DataTableHeaderCell>Slug</DataTableHeaderCell>
                <DataTableHeaderCell>Státusz</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Tagok
                </DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Onboarding
                </DataTableHeaderCell>
                <DataTableHeaderCell>Létrehozva</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => (
                <DataTableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-subtle"
                  onClick={() =>
                    router.push(`/platform/tenants/${row.id}`)
                  }
                >
                  <DataTableCell>
                    <Link
                      href={`/platform/tenants/${row.id}`}
                      className="font-medium text-ink no-underline hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.name}
                    </Link>
                  </DataTableCell>
                  <DataTableCell className="font-mono text-hint text-ink">
                    {row.slug}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={tenantStatusTone(row.status)}>
                      {TENANT_STATUS_LABEL[row.status]}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell className="text-right tabular-nums">
                    {row.memberCount}
                  </DataTableCell>
                  <DataTableCell className="text-right tabular-nums">
                    {row.onboardingPercent}%
                  </DataTableCell>
                  <DataTableCell className="tabular-nums text-ink-secondary">
                    {formatDate(row.created_at)}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-hint text-ink-secondary">
              {from}–{to} / {total}
            </p>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => pushParams({ page: String(page - 1) })}
              >
                Előző
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
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

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'short' }).format(
      new Date(iso)
    )
  } catch {
    return iso
  }
}
