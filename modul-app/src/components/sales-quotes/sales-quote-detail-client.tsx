'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, Pencil } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { FormField } from '@/components/patterns/form-field'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { SaleTotalsBreakdown } from '@/components/sales/sale-totals-breakdown'
import {
  QuoteBillingFields,
  type QuoteBillingState
} from '@/components/sales-quotes/quote-billing-fields'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { SaleTotalsResult } from '@/lib/sales/totals'
import {
  cloneSalesQuoteAction,
  convertSalesQuoteToSaleAction,
  setSalesQuoteStatusAction,
  syncQuoteBillingToCustomerAction,
  updateSalesQuoteDraftAction
} from '@/lib/sales-quotes/actions'
import {
  SALES_QUOTE_STATUS_LABEL,
  salesQuoteStatusTone
} from '@/lib/sales-quotes/parse'
import type {
  SalesQuoteDetail,
  SalesQuoteItemRow
} from '@/lib/sales-quotes/queries'
import { cn } from '@/lib/utils'

function formatQty(n: number) {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('hu-HU')
  } catch {
    return '—'
  }
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('hu-HU')
  } catch {
    return '—'
  }
}

function lineBeforeGross(it: SalesQuoteItemRow) {
  return Math.round(it.quantity * it.unit_price_gross)
}

function totalsFromDetail(detail: SalesQuoteDetail): SaleTotalsResult {
  const itemsGross = detail.items
    .filter((i) => i.item_kind === 'product')
    .reduce((s, i) => s + i.total_gross, 0)
  const feesGross = detail.items
    .filter((i) => i.item_kind === 'fee')
    .reduce((s, i) => s + i.total_gross, 0)
  const subtotalGross = itemsGross + feesGross

  return {
    itemsGross,
    feesGross,
    subtotalGross,
    globalDiscountAmount: detail.discount_amount,
    globalDiscountPercent: detail.discount_percentage,
    subtotalNet: detail.subtotal_net,
    subtotalVat: detail.total_vat,
    totalGross: detail.total_gross,
    totalNet: detail.subtotal_net,
    totalVat: detail.total_vat,
    cashRoundingAmount: 0,
    due: detail.total_gross
  }
}

function InfoCard({
  title,
  children,
  actions
}: {
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-body font-semibold text-ink">{title}</h3>
        {actions}
      </div>
      <div className="space-y-0.5 text-body leading-relaxed text-ink-secondary">
        {children}
      </div>
    </div>
  )
}

function hasBilling(d: SalesQuoteDetail) {
  return Boolean(
    d.billing_name ||
      d.billing_city ||
      d.billing_street ||
      d.billing_tax_number ||
      d.billing_postal_code
  )
}

function billingFromDetail(d: SalesQuoteDetail): QuoteBillingState {
  return {
    billingName: d.billing_name ?? '',
    billingCountry: d.billing_country || 'Magyarország',
    billingCity: d.billing_city ?? '',
    billingPostalCode: d.billing_postal_code ?? '',
    billingStreet: d.billing_street ?? '',
    billingHouseNumber: d.billing_house_number ?? '',
    billingTaxNumber: d.billing_tax_number ?? ''
  }
}

type Props = {
  detail: SalesQuoteDetail
  paymentMethods: PaymentMethodOption[]
  canWrite: boolean
}

export function SalesQuoteDetailClient({
  detail,
  paymentMethods,
  canWrite
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [convertOpen, setConvertOpen] = useState(false)
  const [lostOpen, setLostOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [payId, setPayId] = useState(paymentMethods[0]?.id ?? '')
  const [lostReason, setLostReason] = useState('')
  const [editNote, setEditNote] = useState(detail.note ?? '')
  const [editValidUntil, setEditValidUntil] = useState(
    detail.valid_until?.slice(0, 10) ?? ''
  )
  const [editBilling, setEditBilling] = useState(billingFromDetail(detail))
  const cancelRef = useRef<HTMLButtonElement>(null)

  const canAct =
    canWrite &&
    (detail.status === 'draft' || detail.status === 'sent') &&
    !detail.converted_sale_id
  const canEditDraft = canWrite && detail.status === 'draft'

  useEffect(() => {
    if (!convertOpen && !lostOpen && !editOpen && !syncOpen) return
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [convertOpen, lostOpen, editOpen, syncOpen])

  useEffect(() => {
    setEditNote(detail.note ?? '')
    setEditValidUntil(detail.valid_until?.slice(0, 10) ?? '')
    setEditBilling(billingFromDetail(detail))
  }, [detail])

  const totals = totalsFromDetail(detail)
  const customerHref = `/ugyfelek/${detail.customer_id}`
  const displayName = detail.customer_name ?? 'Ismeretlen ügyfél'
  const mobile = detail.customer_mobile
  const email = detail.customer_email
  const secondary = mobile || email || null

  const metaParts = [
    detail.warehouse_name,
    detail.created_by_label ? `Készítette: ${detail.created_by_label}` : null,
    formatDateTime(detail.created_at),
    detail.valid_until ? `Érvényes: ${formatDate(detail.valid_until)}` : null
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <PageHeader
        title={detail.quote_number}
        description={metaParts.join(' · ')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              tone={salesQuoteStatusTone(detail.status)}
              variant="solid"
            >
              {SALES_QUOTE_STATUS_LABEL[detail.status]}
            </StatusBadge>
            {detail.converted_sale_id ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  router.push(`/ertekesitesek/${detail.converted_sale_id}`)
                }
              >
                Eladás megnyitása
              </Button>
            ) : null}
            {canEditDraft ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-3.5" aria-hidden />
                Szerkesztés
              </Button>
            ) : null}
            {canAct ? (
              <>
                {detail.status === 'draft' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    loading={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const r = await setSalesQuoteStatusAction(
                          detail.id,
                          'sent'
                        )
                        if (!r.ok) toast.error(r.message)
                        else {
                          toast.success('Kiküldve jelölve.')
                          router.refresh()
                        }
                      })
                    }}
                  >
                    Kiküldve
                  </Button>
                ) : null}
                <Button type="button" onClick={() => setConvertOpen(true)}>
                  Eladás létrehozása
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setLostOpen(true)}
                >
                  Elveszett
                </Button>
              </>
            ) : null}
            {canWrite ? (
              <Button
                type="button"
                variant="secondary"
                loading={pending}
                onClick={() => {
                  startTransition(async () => {
                    const r = await cloneSalesQuoteAction(detail.id)
                    if (!r.ok) toast.error(r.message)
                    else {
                      toast.success('Másolat kész.')
                      router.push(`/ertekesitesek/arajanlatok/${r.id}`)
                    }
                  })
                }}
              >
                Másolat
              </Button>
            ) : null}
          </div>
        }
      />

      {detail.cloned_from_id ? (
        <p className="text-hint text-ink-secondary">
          Másolat innen:{' '}
          <Link
            href={`/ertekesitesek/arajanlatok/${detail.cloned_from_id}`}
            className="underline-offset-2 hover:underline"
          >
            forrás ajánlat
          </Link>
        </p>
      ) : null}

      {detail.lost_reason ? (
        <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-body text-danger-ink">
          Elvesztés oka: {detail.lost_reason}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard title="Ügyfél">
          <Link
            href={customerHref}
            className="font-medium text-ink underline-offset-2 hover:underline"
          >
            {displayName}
          </Link>
          {secondary ? (
            <p>{secondary}</p>
          ) : (
            <p className="text-hint text-ink-muted">Nincs kontakt</p>
          )}
          {mobile && email ? <p className="text-hint">{email}</p> : null}
          <div className="pt-2">
            <Link
              href={customerHref}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-hint font-medium text-ink-secondary no-underline hover:bg-subtle hover:text-ink"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Ügyfél megnyitása
            </Link>
          </div>
        </InfoCard>

        <InfoCard
          title="Számlázási adatok"
          actions={
            canEditDraft ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-hint"
                onClick={() => setEditOpen(true)}
              >
                Szerkesztés
              </Button>
            ) : null
          }
        >
          {hasBilling(detail) ? (
            <>
              {detail.billing_name ? (
                <p className="font-medium text-ink">{detail.billing_name}</p>
              ) : null}
              <p>
                {[detail.billing_postal_code, detail.billing_city]
                  .filter(Boolean)
                  .join(' ')}
              </p>
              <p>
                {[detail.billing_street, detail.billing_house_number]
                  .filter(Boolean)
                  .join(' ')}
              </p>
              {detail.billing_country ? <p>{detail.billing_country}</p> : null}
              {detail.billing_tax_number ? (
                <p>Adószám: {detail.billing_tax_number}</p>
              ) : null}
              <p className="pt-1 text-hint text-ink-muted">
                Az ajánlaton rögzítve — nem az élő ügyféltörzs.
              </p>
              {canWrite ? (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setSyncOpen(true)}
                  >
                    Mentés az ügyfél törzsbe is
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-hint text-ink-muted">
              Nincs számlázási adat az ajánlaton.
              {canEditDraft ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => setEditOpen(true)}
                  >
                    Kitöltés
                  </button>
                </>
              ) : null}
            </p>
          )}
        </InfoCard>
      </div>

      {detail.note ? (
        <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-body text-ink-secondary">
          {detail.note}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Tétel</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Qty</DataTableHeaderCell>
                <DataTableHeaderCell align="right">
                  Bruttó egységár
                </DataTableHeaderCell>
                <DataTableHeaderCell align="right">Kedv.</DataTableHeaderCell>
                <DataTableHeaderCell align="right">
                  Bruttó összeg
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {detail.items.map((it) => {
                const isFee = it.item_kind === 'fee'
                const before = lineBeforeGross(it)
                const hasDisc =
                  it.discount_amount > 0 || it.discount_percentage > 0
                return (
                  <DataTableRow key={it.id}>
                    <DataTableCell>
                      {it.accessory_id ? (
                        <Link
                          href={`/torzsadatok/alapanyagok/termekek/${it.accessory_id}`}
                          className="font-medium text-ink underline-offset-2 hover:underline"
                        >
                          {it.name_snapshot}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink">
                          {it.name_snapshot}
                        </span>
                      )}
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        {isFee ? (
                          <span className="text-hint text-ink-muted">Díj</span>
                        ) : it.sku_snapshot ? (
                          <span className="text-hint text-ink-secondary">
                            {it.sku_snapshot}
                          </span>
                        ) : null}
                        {hasDisc ? (
                          <StatusBadge tone="warning" variant="soft">
                            {it.discount_percentage > 0
                              ? `−${it.discount_percentage}%`
                              : `−${formatMoneyFt(it.discount_amount)} Ft`}
                          </StatusBadge>
                        ) : null}
                      </div>
                    </DataTableCell>
                    <DataTableCell align="right" className="tabular-nums">
                      {formatQty(it.quantity)} {it.unit_shortform}
                    </DataTableCell>
                    <DataTableCell align="right" className="tabular-nums">
                      {formatMoneyFt(it.unit_price_gross)}
                    </DataTableCell>
                    <DataTableCell
                      align="right"
                      className={cn(
                        'tabular-nums',
                        hasDisc
                          ? 'font-medium text-warning-ink'
                          : 'text-ink-secondary'
                      )}
                    >
                      {hasDisc
                        ? it.discount_percentage > 0
                          ? `${it.discount_percentage}%`
                          : `−${formatMoneyFt(it.discount_amount)}`
                        : '—'}
                    </DataTableCell>
                    <DataTableCell align="right" className="tabular-nums">
                      {hasDisc ? (
                        <div className="flex flex-col items-end leading-tight">
                          <span className="text-[12px] text-ink-muted line-through">
                            {formatMoneyFt(before)}
                          </span>
                          <span className="font-semibold text-warning-ink">
                            {formatMoneyFt(it.total_gross)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-semibold text-ink">
                          {formatMoneyFt(it.total_gross)}
                        </span>
                      )}
                    </DataTableCell>
                  </DataTableRow>
                )
              })}
            </DataTableBody>
          </DataTable>
        </div>

        <aside className="space-y-3 rounded-md border border-border bg-surface p-3">
          <SaleTotalsBreakdown totals={totals} />
          {detail.converted_sale_id ? (
            <p className="text-hint text-ink-secondary">
              Átalakítva eladássá.{' '}
              <Link
                href={`/ertekesitesek/${detail.converted_sale_id}`}
                className="underline-offset-2 hover:underline"
              >
                Eladás megnyitása
              </Link>
            </p>
          ) : null}
        </aside>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o)
          if (o) {
            setEditNote(detail.note ?? '')
            setEditValidUntil(detail.valid_until?.slice(0, 10) ?? '')
            setEditBilling(billingFromDetail(detail))
          }
        }}
      >
        <DialogContent className="max-w-md gap-0 p-0">
          <DialogHeader className="border-b border-border px-4 py-3 pr-10">
            <DialogTitle>Ajánlat szerkesztése</DialogTitle>
            <p className="mt-1 text-hint text-ink-secondary">
              Csak piszkozat. Tételekhez: Másolat, majd új draft.
            </p>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto px-4 py-3">
            <FormField label="Érvényes eddig" htmlFor="sq-edit-valid">
              <Input
                id="sq-edit-valid"
                type="date"
                value={editValidUntil}
                onChange={(e) => setEditValidUntil(e.target.value)}
              />
            </FormField>
            <FormField label="Megjegyzés" htmlFor="sq-edit-note">
              <Input
                id="sq-edit-note"
                value={editNote}
                maxLength={500}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </FormField>
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-ink-secondary">
                Számlázási adatok
              </p>
              <QuoteBillingFields
                value={editBilling}
                onChange={setEditBilling}
                disabled={pending}
                idPrefix="sq-edit-bill"
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border px-4 py-3 sm:justify-end">
            <Button
              ref={cancelRef}
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setEditOpen(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              loading={pending}
              onClick={() => {
                startTransition(async () => {
                  const r = await updateSalesQuoteDraftAction({
                    quoteId: detail.id,
                    note: editNote || null,
                    validUntil: editValidUntil || null,
                    billing: {
                      billingName: editBilling.billingName || null,
                      billingCountry:
                        editBilling.billingCountry || 'Magyarország',
                      billingCity: editBilling.billingCity || null,
                      billingPostalCode: editBilling.billingPostalCode || null,
                      billingStreet: editBilling.billingStreet || null,
                      billingHouseNumber:
                        editBilling.billingHouseNumber || null,
                      billingTaxNumber: editBilling.billingTaxNumber || null
                    }
                  })
                  if (!r.ok) {
                    toast.error(r.message)
                    return
                  }
                  toast.success('Ajánlat mentve.')
                  setEditOpen(false)
                  router.refresh()
                })
              }}
            >
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="max-w-sm gap-0 p-0">
          <DialogHeader className="border-b border-border px-4 py-3 pr-10">
            <DialogTitle>Mentés az ügyfél törzsbe</DialogTitle>
            <p className="mt-1 text-hint text-ink-secondary">
              Az ajánlat számlázási adatai felülírják az ügyfél törzs
              számlázását. Minden jövőbeli doksinál ez lesz a default.
            </p>
          </DialogHeader>
          <DialogFooter className="border-t border-border px-4 py-3 sm:justify-end">
            <Button
              ref={cancelRef}
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setSyncOpen(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              loading={pending}
              onClick={() => {
                startTransition(async () => {
                  const r = await syncQuoteBillingToCustomerAction(detail.id)
                  if (!r.ok) {
                    toast.error(r.message)
                    return
                  }
                  toast.success('Ügyfél számlázás frissítve.')
                  setSyncOpen(false)
                })
              }}
            >
              Törzs frissítése
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-sm gap-0 p-0">
          <DialogHeader className="border-b border-border px-4 py-3 pr-10">
            <DialogTitle>Eladás létrehozása</DialogTitle>
            <p className="mt-1 text-hint text-ink-secondary">
              Készlet csökken. A számlázás az ajánlat snapshotjából jön (
              {formatMoneyFt(detail.total_gross)} Ft).
            </p>
          </DialogHeader>
          <div className="px-4 py-3">
            <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
              Fizetési mód *
            </label>
            <MenuSelect
              value={payId}
              onChange={setPayId}
              allowEmpty={false}
              options={paymentMethods.map((p) => ({
                value: p.id,
                label: p.name
              }))}
            />
          </div>
          <DialogFooter className="border-t border-border px-4 py-3 sm:justify-end">
            <Button
              ref={cancelRef}
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setConvertOpen(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              loading={pending}
              disabled={!payId}
              onClick={() => {
                startTransition(async () => {
                  const r = await convertSalesQuoteToSaleAction({
                    quoteId: detail.id,
                    paymentMethodId: payId
                  })
                  if (!r.ok) {
                    toast.error(r.message)
                    return
                  }
                  toast.success('Eladás rögzítve.')
                  setConvertOpen(false)
                  if (r.saleId) router.push(`/ertekesitesek/${r.saleId}`)
                  else router.refresh()
                })
              }}
            >
              Eladás rögzítése
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent className="max-w-sm gap-0 p-0">
          <DialogHeader className="border-b border-border px-4 py-3 pr-10">
            <DialogTitle>Elveszettnek jelölés</DialogTitle>
          </DialogHeader>
          <div className="px-4 py-3">
            <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
              Ok *
            </label>
            <Input
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="Pl. drágábbnak találta…"
              maxLength={200}
            />
          </div>
          <DialogFooter className="border-t border-border px-4 py-3 sm:justify-end">
            <Button
              ref={cancelRef}
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setLostOpen(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={pending}
              onClick={() => {
                startTransition(async () => {
                  const r = await setSalesQuoteStatusAction(
                    detail.id,
                    'lost',
                    lostReason
                  )
                  if (!r.ok) toast.error(r.message)
                  else {
                    toast.success('Elveszettnek jelölve.')
                    setLostOpen(false)
                    router.refresh()
                  }
                })
              }}
            >
              Elveszett
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
