'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/patterns/status-badge'
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
import { createSaleReturnAction } from '@/lib/sales/actions'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { SaleDetail } from '@/lib/sales/queries'
import {
  computeReturnPreview,
  isCashPaymentMethodName,
  type ReturnableLine
} from '@/lib/sales/totals'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'

type LineState = {
  selected: boolean
  quantity: number
  restock: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: SaleDetail
  paymentMethods: PaymentMethodOption[]
}

function formatQty(n: number) {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

export function SaleReturnDialog({
  open,
  onOpenChange,
  detail,
  paymentMethods
}: Props) {
  const router = useRouter()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [pending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')

  const returnableLines: ReturnableLine[] = useMemo(
    () =>
      detail.items.map((it) => ({
        id: it.id,
        itemKind: it.item_kind,
        name: it.name_snapshot,
        quantitySold: it.quantity,
        quantityReturned: detail.returnedQtyByItemId[it.id] ?? 0,
        totalGross: it.total_gross,
        taxPercent: it.tax_rate_percent
      })),
    [detail]
  )

  const [lines, setLines] = useState<Record<string, LineState>>({})

  useEffect(() => {
    if (!open) return
    const next: Record<string, LineState> = {}
    for (const it of returnableLines) {
      const rem = Math.max(0, it.quantitySold - it.quantityReturned)
      if (rem <= 0) continue
      next[it.id] = {
        selected: rem > 0,
        quantity: rem,
        restock: it.itemKind === 'product'
      }
    }
    setLines(next)
    setReason('')
    setConfirmOpen(false)
    const cash = paymentMethods.find((p) => isCashPaymentMethodName(p.name))
    const card = paymentMethods.find((p) => {
      const n = p.name.toLowerCase()
      return n.includes('kártya') || n.includes('kartya') || n.includes('card')
    })
    // Prefer original payment method if recognizable
    const orig = detail.payments.find((p) => p.kind === 'payment')
    const matchOrig = orig
      ? paymentMethods.find((p) => p.name === orig.payment_method_name)
      : null
    setPaymentMethodId(
      matchOrig?.id ?? cash?.id ?? card?.id ?? paymentMethods[0]?.id ?? ''
    )
  }, [open, returnableLines, paymentMethods, detail.payments])

  useEffect(() => {
    if (!open || confirmOpen) return
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, confirmOpen])

  const itemsSumGross = detail.items.reduce((s, i) => s + i.total_gross, 0)
  const paidSum = detail.payments
    .filter((p) => p.kind === 'payment' && p.status === 'completed')
    .reduce((s, p) => s + p.amount, 0)
  const alreadyRefunded = detail.payments
    .filter((p) => p.kind === 'refund' && p.status === 'completed')
    .reduce((s, p) => s + p.amount, 0)

  const selected = Object.entries(lines)
    .filter(([, s]) => s.selected && s.quantity > 0)
    .map(([id, s]) => ({ itemId: id, quantity: s.quantity }))

  const allReturnableLeft = returnableLines.reduce(
    (s, l) => s + Math.max(0, l.quantitySold - l.quantityReturned),
    0
  )
  const selectedQty = selected.reduce((s, x) => s + x.quantity, 0)
  const isFullFirstReturn =
    alreadyRefunded === 0 &&
    detail.returns.length === 0 &&
    Math.abs(selectedQty - allReturnableLeft) < 0.0001

  const payName =
    paymentMethods.find((p) => p.id === paymentMethodId)?.name ?? ''
  const applyCashRound = isCashPaymentMethodName(payName)

  const preview = computeReturnPreview({
    saleTotalGross: detail.total_gross,
    saleCashRounding: detail.cash_rounding_amount,
    itemsSumGross,
    returnable: returnableLines,
    selected,
    isFullFirstReturn,
    alreadyRefunded,
    paidSum,
    applyCashRound
  })

  const needsPayment = preview.refundDue > 0

  function patchLine(id: string, patch: Partial<LineState>) {
    setLines((prev) => {
      const cur = prev[id]
      if (!cur) return prev
      return { ...prev, [id]: { ...cur, ...patch } }
    })
  }

  function submit() {
    if (selected.length === 0) {
      toast.error('Válassz legalább egy tételt.')
      return
    }
    if (needsPayment && !paymentMethodId) {
      toast.error('Válaszd ki a visszatérítés módját.')
      return
    }

    startTransition(async () => {
      const result = await createSaleReturnAction({
        salesOrderId: detail.id,
        items: selected.map((s) => ({
          salesOrderItemId: s.itemId,
          quantity: s.quantity,
          restock: lines[s.itemId]?.restock ?? true
        })),
        paymentMethodId: needsPayment ? paymentMethodId : null,
        reason: reason.trim() || null,
        note: null
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(
        result.returnNumber
          ? `Visszáru kész: ${result.returnNumber}`
          : 'Visszáru rögzítve.'
      )
      setConfirmOpen(false)
      onOpenChange(false)
      router.refresh()
    })
  }

  const selectable = returnableLines.filter(
    (l) => l.quantitySold - l.quantityReturned > 0.0001
  )

  return (
    <>
      <Dialog
        open={open && !confirmOpen}
        onOpenChange={(next) => {
          if (pending) return
          onOpenChange(next)
        }}
      >
        <DialogContent
          className="flex max-h-[85vh] max-w-xl flex-col gap-0 overflow-hidden p-0"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            cancelRef.current?.focus()
          }}
        >
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-10">
            <DialogTitle>Visszáru indítása</DialogTitle>
            <p className="mt-1 text-hint text-ink-secondary">
              {detail.sale_number} — jelöld ki a visszahozott tételeket.
            </p>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {selectable.length === 0 ? (
              <p className="text-body text-ink-secondary">
                Ebből az eladásból minden tétel vissza van véve.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {selectable.map((it) => {
                  const rem = it.quantitySold - it.quantityReturned
                  const st = lines[it.id]
                  if (!st) return null
                  const isFee = it.itemKind === 'fee'
                  return (
                    <li key={it.id} className="space-y-2 px-3 py-2.5">
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 rounded border-border"
                          checked={st.selected}
                          onChange={(e) =>
                            patchLine(it.id, { selected: e.target.checked })
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-ink">{it.name}</span>
                          <span className="mt-0.5 block text-hint text-ink-secondary">
                            {isFee ? 'Díj' : null}
                            {!isFee && it.quantityReturned > 0
                              ? `Már vissza: ${formatQty(it.quantityReturned)} · `
                              : null}
                            Max {formatQty(rem)}
                          </span>
                        </span>
                      </label>
                      {st.selected ? (
                        <div className="ml-6 flex flex-wrap items-end gap-3">
                          <div>
                            <label
                              className="mb-1 block text-[12px] font-medium text-ink-secondary"
                              htmlFor={`ret-qty-${it.id}`}
                            >
                              Mennyiség
                            </label>
                            <Input
                              id={`ret-qty-${it.id}`}
                              type="number"
                              min={0.001}
                              max={rem}
                              step="any"
                              className="h-8 w-24"
                              value={st.quantity}
                              onChange={(e) => {
                                const n = Number(e.target.value)
                                if (!Number.isFinite(n)) return
                                patchLine(it.id, {
                                  quantity: Math.min(Math.max(n, 0), rem)
                                })
                              }}
                            />
                          </div>
                          {!isFee ? (
                            <label className="flex items-center gap-2 pb-1 text-body text-ink-secondary">
                              <input
                                type="checkbox"
                                className="size-4 rounded border-border"
                                checked={st.restock}
                                onChange={(e) =>
                                  patchLine(it.id, {
                                    restock: e.target.checked
                                  })
                                }
                              />
                              Visszavesz készletbe
                            </label>
                          ) : (
                            <span className="pb-1 text-hint text-ink-muted">
                              Díj — nincs készlet
                            </span>
                          )}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}

            <div>
              <label
                className="mb-1 block text-[12px] font-medium text-ink-secondary"
                htmlFor="ret-reason"
              >
                Ok (opcionális)
              </label>
              <Input
                id="ret-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Pl. meggondolta magát, hibás…"
                maxLength={200}
              />
            </div>

            {needsPayment ? (
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                  Visszatérítés módja
                </label>
                <MenuSelect
                  value={paymentMethodId}
                  onChange={setPaymentMethodId}
                  options={paymentMethods.map((p) => ({
                    value: p.id,
                    label: p.name
                  }))}
                  placeholder="Válassz módot"
                />
              </div>
            ) : (
              <p className="text-hint text-ink-secondary">
                Nincs visszatérítendő összeg (pl. fizetetlen eladás) — csak
                készlet.
              </p>
            )}

            <div className="space-y-1 rounded-md border border-border bg-subtle/50 px-3 py-2.5">
              <p className="text-hint text-ink-muted">
                Az árak bruttók (ÁFA-val), az eredeti kedvezménnyel arányosan.
              </p>
              <div className="flex justify-between text-body text-ink-secondary">
                <span>Nettó összesen</span>
                <span className="tabular-nums">
                  {formatMoneyFt(preview.totalNet)} Ft
                </span>
              </div>
              <div className="flex justify-between text-body text-ink-secondary">
                <span>ÁFA összesen</span>
                <span className="tabular-nums">
                  {formatMoneyFt(preview.totalVat)} Ft
                </span>
              </div>
              {preview.cashRoundingAmount !== 0 ? (
                <div className="flex justify-between text-body text-ink-secondary">
                  <span>Készpénz kerekítés</span>
                  <span className="tabular-nums">
                    {preview.cashRoundingAmount > 0 ? '+' : ''}
                    {formatMoneyFt(preview.cashRoundingAmount)} Ft
                  </span>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between border-t border-border pt-2">
                <span className="text-[12px] font-medium text-ink-secondary">
                  Visszatérítendő (bruttó)
                </span>
                <span className="text-[22px] font-semibold tabular-nums text-ink">
                  {formatMoneyFt(preview.refundDue)} Ft
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:justify-end">
            <Button
              ref={cancelRef}
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              disabled={pending || selected.length === 0}
              onClick={() => setConfirmOpen(true)}
            >
              Tovább a megerősítéshez
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (pending) return
          setConfirmOpen(next)
        }}
      >
        <DialogContent className="max-w-md gap-0 p-0">
          <DialogHeader className="border-b border-border px-4 py-3 pr-10">
            <DialogTitle>Visszáru megerősítése</DialogTitle>
            <p className="mt-1 text-hint text-ink-secondary">
              A készlet azonnal nő (ha visszaveszed). A pénz visszakerül a
              választott módon.
            </p>
          </DialogHeader>
          <div className="space-y-2 px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {needsPayment ? (
                <StatusBadge
                  tone={applyCashRound ? 'success' : 'info'}
                  variant="solid"
                >
                  {payName || 'Visszatérítés'}
                </StatusBadge>
              ) : (
                <StatusBadge tone="neutral" variant="outline">
                  Nincs pénzmozgás
                </StatusBadge>
              )}
              <StatusBadge tone="neutral" variant="outline">
                {selected.length} tétel
              </StatusBadge>
            </div>
            <ul className="text-body text-ink-secondary">
              {selected.map((s) => {
                const src = returnableLines.find((r) => r.id === s.itemId)
                const restock = lines[s.itemId]?.restock
                return (
                  <li key={s.itemId} className="flex justify-between gap-2 py-0.5">
                    <span>
                      {src?.name} × {formatQty(s.quantity)}
                      {src?.itemKind === 'product' ? (
                        <span className="text-hint text-ink-muted">
                          {restock ? ' · készletbe' : ' · nem restock'}
                        </span>
                      ) : null}
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className="flex items-baseline justify-between border-t border-border pt-2">
              <span className="text-[12px] font-medium text-ink-secondary">
                Visszatérítendő (bruttó)
              </span>
              <span className="text-[22px] font-semibold tabular-nums">
                {formatMoneyFt(preview.refundDue)} Ft
              </span>
            </div>
          </div>
          <DialogFooter className="border-t border-border px-4 py-3 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
              autoFocus
            >
              Mégse
            </Button>
            <Button type="button" loading={pending} onClick={submit}>
              Visszáru rögzítése
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
