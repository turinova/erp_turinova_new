'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  Pencil,
  ScanSearch,
  Search,
  Send
} from 'lucide-react'
import { toast } from 'sonner'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { PageHeader } from '@/components/patterns/page-header'
import { StatusBadge } from '@/components/patterns/status-badge'
import { PartnerSubmitDialog } from '@/components/quotes/partner-submit-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  PARTNER_OPTI_PATH,
  PARTNER_ORDERS_PATH,
  PARTNER_QUOTES_PATH,
  PARTNER_SETTINGS_PATH
} from '@/lib/auth/surface'
import { usePartnerHref } from '@/lib/auth/use-partner-href'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import type {
  PartnerDraftKpis,
  PartnerOrderFilter,
  PartnerOrderKpis,
  PartnerQuoteListItem
} from '@/lib/partner/quotes-queries'
import {
  contentLabel,
  daysAgo,
  formatRelative,
  formatShortDay,
  orderStatusHint
} from '@/lib/partner/order-status-copy'
import { submitPartnerQuote } from '@/lib/quotes/partner-actions'
import {
  partnerQuoteStatusLabel,
  partnerQuoteStatusTone
} from '@/lib/quotes/partner-status-labels'
import { cn } from '@/lib/utils'

function chipClass(active: boolean, muted: boolean) {
  return cn(
    'h-7 rounded-md px-2.5 text-hint font-medium tabular-nums transition-colors',
    active
      ? 'bg-ink text-surface'
      : muted
        ? 'cursor-not-allowed bg-subtle text-ink-muted'
        : 'bg-subtle text-ink-secondary hover:bg-border/60 hover:text-ink'
  )
}

const ORDER_CHIPS: Array<{ value: PartnerOrderFilter; label: string }> = [
  { value: 'open', label: 'Folyamatban' },
  { value: 'ready', label: 'Elvihető' },
  { value: 'in_production', label: 'Gyártásban' },
  { value: 'due', label: 'Fizetendő' },
  { value: 'closed', label: 'Lezárt' },
  { value: 'all', label: 'Mind' }
]

type KpiTile = {
  key: string
  label: string
  value: string
  hint: string
  href?: string
  active?: boolean
  emphasize?: 'danger' | 'warning' | null
}

function KpiStrip({ tiles, label }: { tiles: KpiTile[]; label: string }) {
  return (
    <section
      aria-label={label}
      className="mb-3 overflow-hidden rounded-md border border-border bg-surface"
    >
      <div
        className={cn(
          'grid gap-px bg-border',
          tiles.length === 3
            ? 'grid-cols-1 sm:grid-cols-3'
            : 'grid-cols-2 lg:grid-cols-4'
        )}
      >
        {tiles.map((tile) => {
          const body = (
            <>
              <p className="text-hint text-ink-secondary">{tile.label}</p>
              <p
                className={cn(
                  'mt-0.5 text-[1.375rem] font-semibold tabular-nums leading-none tracking-tight',
                  tile.emphasize === 'danger' && 'text-danger-ink',
                  tile.emphasize === 'warning' && 'text-warning-ink',
                  !tile.emphasize && 'text-ink'
                )}
              >
                {tile.value}
              </p>
              <p className="mt-1 truncate text-hint text-ink-muted">
                {tile.hint}
              </p>
            </>
          )
          const className = cn(
            'block min-w-0 px-3 py-2.5',
            tile.active ? 'bg-subtle' : 'bg-surface'
          )
          return tile.href ? (
            <Link
              key={tile.key}
              href={tile.href}
              aria-current={tile.active ? 'true' : undefined}
              className={cn(
                className,
                'no-underline transition-colors hover:bg-subtle'
              )}
            >
              {body}
            </Link>
          ) : (
            <div key={tile.key} className={className}>
              {body}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Projektnév az elsődleges azonosító; a szám csak másodlagos. */
function ProjectIdentityCell({
  row,
  href,
  number
}: {
  row: PartnerQuoteListItem
  href: string
  number: string
}) {
  return (
    <div className="min-w-0">
      <Link
        href={href}
        className={cn(
          'block truncate font-semibold no-underline hover:underline',
          row.project_name ? 'text-ink' : 'text-ink-secondary'
        )}
      >
        {row.project_name ?? number}
      </Link>
      <p className="text-hint tabular-nums text-ink-muted">
        {row.project_name ? number : 'Nincs projektnév'}
      </p>
    </div>
  )
}

type Mode = 'drafts' | 'submitted'

export function PartnerQuotesListClient({
  mode,
  rows,
  total,
  page,
  limit,
  initialQ,
  initialFilter,
  selectedTenantId,
  orderKpis = null,
  draftKpis = null
}: {
  mode: Mode
  rows: PartnerQuoteListItem[]
  total: number
  page: number
  limit: number
  initialQ: string
  initialFilter: PartnerOrderFilter
  selectedTenantId: string
  orderKpis?: PartnerOrderKpis | null
  draftKpis?: PartnerDraftKpis | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const href = usePartnerHref()
  const [qDraft, setQDraft] = useState(initialQ)
  const [submitRow, setSubmitRow] = useState<PartnerQuoteListItem | null>(null)
  const [pending, startTransition] = useTransition()

  const isDrafts = mode === 'drafts'
  const searching = Boolean(initialQ)
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

  function filterHref(filter: PartnerOrderFilter) {
    const base = href(PARTNER_ORDERS_PATH)
    return filter === 'open' ? base : `${base}?status=${filter}`
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    pushParams({ q: qDraft.trim() || null, page: null })
  }

  function detailHref(row: PartnerQuoteListItem) {
    return isDrafts
      ? `${href(PARTNER_QUOTES_PATH)}/${row.id}`
      : `${href(PARTNER_ORDERS_PATH)}/${row.id}`
  }

  function optiEditHref(row: PartnerQuoteListItem) {
    return `${href(PARTNER_OPTI_PATH)}?quote_id=${row.id}`
  }

  function handleSubmitConfirm(paymentMethodId: string) {
    const row = submitRow
    if (!row) return
    startTransition(async () => {
      const result = await submitPartnerQuote({
        quoteId: row.id,
        paymentMethodId
      })
      if (!result?.ok) {
        if (result?.code === 'price_changed') {
          setSubmitRow(null)
          toast.error(result.message, {
            duration: 15000,
            action: {
              label: 'Ajánlat megnyitása',
              onClick: () => router.push(optiEditHref(row))
            }
          })
          return
        }
        if (result?.code === 'billing_incomplete') {
          setSubmitRow(null)
          toast.error(result.message, {
            duration: 15000,
            action: {
              label: 'Beállítások',
              onClick: () =>
                router.push(
                  `${href(PARTNER_SETTINGS_PATH)}?return=${encodeURIComponent(
                    `${href(PARTNER_QUOTES_PATH)}/${row.id}?submit=1`
                  )}#szamlazas`
                )
            }
          })
          return
        }
        toast.error(result?.message ?? 'Nem sikerült beküldeni.')
        return
      }
      toast.success(
        result.autoProforma
          ? `Beküldve: ${result.quoteNumber}. A díjbekérőt e-mailben küldjük.`
          : `Beküldve: ${result.quoteNumber}. A Beküldött rendeléseim között követheted.`
      )
      setSubmitRow(null)
      router.refresh()
    })
  }

  const kpiTiles: KpiTile[] = isDrafts
    ? draftKpis
      ? [
          {
            key: 'count',
            label: 'Beküldetlen ajánlat',
            value: String(draftKpis.count),
            hint:
              draftKpis.count === 0
                ? 'Minden ajánlat beküldve'
                : 'Beküldésig nem rendelés'
          },
          {
            key: 'value',
            label: 'Összérték',
            value: formatQuotePrice(draftKpis.totalGross, draftKpis.currency),
            hint: 'bruttó, mentett ajánlatok'
          },
          {
            key: 'oldest',
            label: 'Legrégebbi',
            value: draftKpis.oldestUpdatedAt
              ? daysAgo(draftKpis.oldestUpdatedAt) === 0
                ? 'ma'
                : `${daysAgo(draftKpis.oldestUpdatedAt)} napja`
              : '—',
            hint:
              draftKpis.oldestUpdatedAt &&
              daysAgo(draftKpis.oldestUpdatedAt) >= 14
                ? 'Az árak azóta változhattak'
                : 'utolsó módosítás óta',
            emphasize:
              draftKpis.oldestUpdatedAt &&
              daysAgo(draftKpis.oldestUpdatedAt) >= 14
                ? 'warning'
                : null
          }
        ]
      : []
    : orderKpis
      ? [
          {
            key: 'ready',
            label: 'Elvihető',
            value: String(orderKpis.counts.ready),
            hint:
              orderKpis.counts.ready === 0
                ? 'Nincs elvihető rendelés'
                : 'Gyártás kész, várja az átvételt',
            href: filterHref('ready'),
            active: !searching && initialFilter === 'ready',
            emphasize: orderKpis.counts.ready > 0 ? 'warning' : null
          },
          {
            key: 'in_production',
            label: 'Gyártásban',
            value: String(orderKpis.counts.in_production),
            hint: orderKpis.nextProductionDate
              ? `Következő gyártási nap: ${formatShortDay(orderKpis.nextProductionDate)}`
              : 'Nincs ütemezett gyártási nap',
            href: filterHref('in_production'),
            active: !searching && initialFilter === 'in_production'
          },
          {
            key: 'due',
            label: 'Fizetendő',
            value: formatQuotePrice(orderKpis.dueGross, orderKpis.currency),
            hint:
              orderKpis.counts.due === 0
                ? 'Minden rendelés kifizetve'
                : `${orderKpis.counts.due} rendelésnél van hátralék`,
            href: filterHref('due'),
            active: !searching && initialFilter === 'due',
            emphasize: orderKpis.dueGross > 0 ? 'danger' : null
          },
          {
            key: 'year',
            label: 'Idén beküldve',
            value: String(orderKpis.yearCount),
            hint: `${formatQuotePrice(orderKpis.yearGross, orderKpis.currency)} bruttó`
          }
        ]
      : []

  const neverHadAny = isDrafts
    ? total === 0 && !searching
    : orderKpis
      ? orderKpis.counts.all === 0
      : total === 0 && !searching && initialFilter === 'all'

  return (
    <div>
      <PageHeader
        title={isDrafts ? 'Ajánlataim' : 'Beküldött rendeléseim'}
        description={
          isDrafts
            ? 'Mentett, még be nem küldött ajánlataid. Beküldés után válnak rendeléssé.'
            : 'Hol tart a rendelésed, mikor viheted el, és mennyit kell még fizetned.'
        }
        icon={isDrafts ? FileText : ClipboardList}
        accent={isDrafts ? 'violet' : 'emerald'}
        actions={
          <Button
            type="button"
            onClick={() => router.push(href(PARTNER_OPTI_PATH))}
          >
            <ScanSearch className="size-3.5" aria-hidden />
            {isDrafts ? 'Új ajánlat Optiban' : 'Új rendelés Optiban'}
          </Button>
        }
      />

      {!neverHadAny && kpiTiles.length > 0 ? (
        <KpiStrip
          tiles={kpiTiles}
          label={isDrafts ? 'Ajánlatok összesítő' : 'Rendelések összesítő'}
        />
      ) : null}

      {!neverHadAny ? (
        <div className="mb-3 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form
              onSubmit={handleSearchSubmit}
              className="relative max-w-sm flex-1"
            >
              <label className="sr-only" htmlFor="partner-quote-search">
                Keresés
              </label>
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <Input
                id="partner-quote-search"
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder={
                  isDrafts
                    ? 'Keresés ajánlatszám, projekt…'
                    : 'Keresés rendelés-, ajánlatszám, projekt…'
                }
                className="pl-8"
              />
            </form>
            {searching ? (
              <button
                type="button"
                className="self-start text-hint text-ink-secondary underline-offset-2 hover:underline sm:self-center"
                onClick={() => {
                  setQDraft('')
                  pushParams({ q: null, page: null })
                }}
              >
                Keresés törlése
              </button>
            ) : null}
            <p className="text-hint tabular-nums text-ink-muted sm:ml-auto">
              {from}–{to} / {total}
            </p>
          </div>

          {!isDrafts ? (
            <div
              className="flex flex-wrap items-center gap-1.5"
              aria-label="Szűrés állapot szerint"
            >
              {ORDER_CHIPS.map((chip) => {
                const active = !searching && initialFilter === chip.value
                const count = orderKpis?.counts[chip.value]
                return (
                  <button
                    key={chip.value}
                    type="button"
                    aria-pressed={active}
                    disabled={searching}
                    onClick={() =>
                      pushParams({
                        status: chip.value === 'open' ? null : chip.value,
                        page: null
                      })
                    }
                    className={chipClass(active, searching)}
                  >
                    {chip.label}
                    {count != null ? ` (${count})` : null}
                  </button>
                )
              })}
              {searching ? (
                <span className="text-hint text-ink-muted">
                  Keresésnél minden állapot látszik.
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {neverHadAny ? (
        <div className="rounded-md border border-dashed border-border bg-subtle p-4">
          <p className="text-body font-medium text-ink">
            {isDrafts
              ? 'Még nincs mentett ajánlatod.'
              : 'Még nincs beküldött rendelésed.'}
          </p>
          <p className="mt-1 text-body text-ink-secondary">
            {isDrafts
              ? 'Készíts egyet az Optiban, majd itt küldd be a cégnek.'
              : 'Az Ajánlataim listán a Beküldés gombbal tudsz rendelni.'}
          </p>
          {!isDrafts ? (
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() => router.push(href(PARTNER_QUOTES_PATH))}
            >
              Ajánlataim megnyitása
            </Button>
          ) : null}
        </div>
      ) : total === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
          <p>
            {searching
              ? 'Nincs találat a megadott keresésre.'
              : 'Ebben a nézetben nincs rendelés.'}
          </p>
          {!searching && !isDrafts && initialFilter !== 'all' ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => pushParams({ status: 'all', page: null })}
            >
              Összes rendelés mutatása
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>
                  {isDrafts ? 'Projekt · ajánlat' : 'Projekt · rendelés'}
                </DataTableHeaderCell>
                {isDrafts ? (
                  <DataTableHeaderCell>Tartalom</DataTableHeaderCell>
                ) : (
                  <DataTableHeaderCell>Állapot</DataTableHeaderCell>
                )}
                {!isDrafts ? (
                  <DataTableHeaderCell align="right">
                    Fizetendő
                  </DataTableHeaderCell>
                ) : null}
                <DataTableHeaderCell align="right">Összeg</DataTableHeaderCell>
                {isDrafts ? (
                  <DataTableHeaderCell>Módosítva</DataTableHeaderCell>
                ) : null}
                <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                  Műveletek
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => {
                const rowHref = detailHref(row)
                const otherCompany = row.tenant_id !== selectedTenantId
                return (
                  <DataTableRow
                    key={row.id}
                    className="cursor-pointer align-top transition-colors hover:bg-subtle"
                    onClick={(e) => {
                      if (
                        (e.target as HTMLElement).closest('a,button')
                      ) {
                        return
                      }
                      router.push(rowHref)
                    }}
                  >
                    <DataTableCell className="py-2">
                      <ProjectIdentityCell
                        row={row}
                        href={rowHref}
                        number={
                          isDrafts
                            ? row.quote_number
                            : (row.order_number ?? row.quote_number)
                        }
                      />
                      {!isDrafts && row.order_number ? (
                        <p className="text-hint text-ink-muted">
                          Ajánlat: {row.quote_number}
                        </p>
                      ) : null}
                      {otherCompany && row.company_name ? (
                        <p className="text-hint text-ink-muted">
                          Cég: {row.company_name}
                        </p>
                      ) : null}
                    </DataTableCell>

                    {isDrafts ? (
                      <DataTableCell className="py-2 text-ink-secondary">
                        {contentLabel(row)}
                      </DataTableCell>
                    ) : (
                      <DataTableCell className="py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge
                            tone={partnerQuoteStatusTone(row.status)}
                            variant={row.status === 'ready' ? 'solid' : 'soft'}
                          >
                            {partnerQuoteStatusLabel(row.status)}
                          </StatusBadge>
                          {row.archived_at ? (
                            <StatusBadge tone="neutral">Archív</StatusBadge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-hint text-ink-secondary">
                          {orderStatusHint(row)}
                        </p>
                      </DataTableCell>
                    )}

                    {!isDrafts ? (
                      <DataTableCell align="right" className="py-2">
                        {row.remaining_gross == null ? (
                          <span className="text-hint text-ink-muted">
                            {row.status === 'draft' ? 'Elfogadás után' : '—'}
                          </span>
                        ) : row.remaining_gross === 0 ? (
                          <span className="inline-flex items-center gap-1 text-success-ink">
                            <Check className="size-3.5" aria-hidden />
                            Fizetve
                          </span>
                        ) : (
                          <>
                            <span
                              className={cn(
                                'font-semibold',
                                row.total_paid > 0
                                  ? 'text-warning-ink'
                                  : 'text-danger-ink'
                              )}
                            >
                              {formatQuotePrice(row.remaining_gross, row.currency)}
                            </span>
                            <p className="text-hint text-ink-muted">
                              {row.total_paid > 0 ? 'részben fizetve' : 'nincs fizetve'}
                            </p>
                          </>
                        )}
                      </DataTableCell>
                    ) : null}

                    <DataTableCell align="right" className="py-2">
                      <span className="text-ink">
                        {formatQuotePrice(row.total_gross, row.currency)}
                      </span>
                      {!isDrafts ? (
                        <p className="text-hint text-ink-muted">
                          {contentLabel(row)}
                        </p>
                      ) : null}
                    </DataTableCell>

                    {isDrafts ? (
                      <DataTableCell className="py-2 text-ink-secondary">
                        {formatRelative(row.updated_at)}
                      </DataTableCell>
                    ) : null}

                    <DataTableCell className="py-2 text-right">
                      {isDrafts ? (
                        otherCompany ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="whitespace-nowrap text-hint text-ink-secondary">
                              Másik céghez mentve
                            </span>
                            <Link
                              href={href(PARTNER_SETTINGS_PATH)}
                              className="whitespace-nowrap text-hint text-ink underline-offset-2 hover:underline"
                            >
                              Cég váltása
                            </Link>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => router.push(optiEditHref(row))}
                            >
                              <Pencil className="size-3" aria-hidden />
                              Szerkesztés
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={pending}
                              onClick={() => setSubmitRow(row)}
                            >
                              <Send className="size-3" aria-hidden />
                              Beküldés…
                            </Button>
                          </div>
                        )
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => router.push(rowHref)}
                        >
                          Részletek
                          <ChevronRight className="size-3.5" aria-hidden />
                        </Button>
                      )}
                    </DataTableCell>
                  </DataTableRow>
                )
              })}
            </DataTableBody>
          </DataTable>

          {totalPages > 1 ? (
            <div className="mt-3 flex flex-wrap items-center justify-end gap-1 text-hint text-ink-secondary">
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
          ) : null}
        </>
      )}

      {isDrafts ? (
        <PartnerSubmitDialog
          open={submitRow != null}
          onOpenChange={(open) => {
            if (!open && !pending) setSubmitRow(null)
          }}
          quoteNumber={submitRow?.quote_number ?? ''}
          returnPath={
            submitRow
              ? `${href(PARTNER_QUOTES_PATH)}/${submitRow.id}?submit=1`
              : href(PARTNER_QUOTES_PATH)
          }
          loading={pending}
          onConfirm={handleSubmitConfirm}
        />
      ) : null}
    </div>
  )
}
