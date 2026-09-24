'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  createSaleInvoiceAction,
  previewSaleInvoiceAction
} from '@/lib/invoicing/actions'
import {
  activeDocs,
  resolveInvoiceKindOptions
} from '@/lib/invoicing/invoice-rules'
import {
  defaultInvoicePaymentMethod,
  invoicePaymentMethodHint
} from '@/lib/invoicing/payment-method'
import type {
  InvoiceIssueKind,
  InvoiceListItem,
  InvoicePaymentMethod
} from '@/lib/invoicing/types'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { SaleDetail } from '@/lib/sales/queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: SaleDetail
  hasAgentKey: boolean
  invoices?: InvoiceListItem[]
  preferredKind?: InvoiceIssueKind | null
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function plusDaysIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function lastPaymentName(detail: SaleDetail): string | null {
  const list = detail.payments
  if (!list.length) return null
  return list[list.length - 1]?.payment_method_name ?? null
}

function defaultPay(
  kind: InvoiceIssueKind,
  detail: SaleDetail
): InvoicePaymentMethod {
  return defaultInvoicePaymentMethod(kind, {
    lastPaymentMethodName: lastPaymentName(detail),
    paymentStatus: detail.payment_status
  })
}

function kindTitle(kind: InvoiceIssueKind, hasProforma: boolean): string {
  if (kind === 'proforma') return 'Díjbekérő kiállítása'
  if (kind === 'advance') return 'Előlegszámla kiállítása'
  if (hasProforma) return 'Végszámla kiállítása'
  return 'Számla kiállítása'
}

export function InvoiceIssueDialog({
  open,
  onOpenChange,
  detail,
  hasAgentKey,
  invoices = [],
  preferredKind = null
}: Props) {
  const router = useRouter()
  const { options, defaultKind } = useMemo(
    () => resolveInvoiceKindOptions(detail, invoices),
    [detail, invoices]
  )
  const { hasProforma, hasFinal } = useMemo(
    () => activeDocs(invoices),
    [invoices]
  )

  const [kind, setKind] = useState<InvoiceIssueKind>(defaultKind)
  const [showKindPicker, setShowKindPicker] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod>(
    'bank_transfer'
  )
  const [dueDate, setDueDate] = useState(todayIso())
  const [fulfillmentDate, setFulfillmentDate] = useState(todayIso())
  const [comment, setComment] = useState('')
  const [email, setEmail] = useState(detail.customer.email ?? '')
  const [sendEmail, setSendEmail] = useState(Boolean(detail.customer.email))
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [proformaAmount, setProformaAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewOk, setPreviewOk] = useState(false)
  const previewGen = useRef(0)

  const dueGross = useMemo(
    () => detail.total_gross + detail.cash_rounding_amount,
    [detail]
  )

  const kindDisabled =
    options.length <= 1 || (hasProforma && detail.payment_status === 'paid')

  /** Certainty: ha a rendszer tudja a típust, elrejtjük (Módosítás linkkel). */
  const kindLocked =
    Boolean(preferredKind) || options.length <= 1 || kindDisabled
  const showKindSelect =
    options.length > 0 && (!kindLocked || showKindPicker)

  function revokePreview() {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev.split('#')[0]!)
      return null
    })
  }

  useEffect(() => {
    if (!open) return
    let next =
      preferredKind && options.some((o) => o.value === preferredKind)
        ? preferredKind
        : defaultKind
    if (options.length === 0) next = 'normal'
    setKind(next)
    setPaymentMethod(defaultPay(next, detail))
    setDueDate(next === 'proforma' ? plusDaysIso(8) : todayIso())
    setFulfillmentDate(todayIso())
    setComment('')
    setEmail(detail.customer.email ?? '')
    setSendEmail(Boolean(detail.customer.email))
    setAdvanceAmount('')
    setProformaAmount('')
    setError(null)
    setPreviewError(null)
    setPreviewOk(false)
    setShowKindPicker(false)
    revokePreview()
  }, [open, detail, preferredKind, defaultKind, options])

  const multiPaymentHint =
    detail.payments.length > 1
      ? 'Több befizetés van — ellenőrizd a fizetési módot.'
      : null

  useEffect(() => {
    if (!open) {
      revokePreview()
      setPreviewOk(false)
      setPreviewError(null)
      setPreviewLoading(false)
    }
  }, [open])

  // Debounced Agent PDF preview
  useEffect(() => {
    if (!open || !hasAgentKey || hasFinal || options.length === 0) return
    if (kind === 'advance') {
      const n = Number(advanceAmount.replace(/\s/g, ''))
      if (!(n > 0)) {
        setPreviewError('Add meg az előleg összegét az előnézethez.')
        setPreviewOk(false)
        revokePreview()
        return
      }
    }

    const gen = ++previewGen.current
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewOk(false)

    const handle = window.setTimeout(() => {
      void previewSaleInvoiceAction({
        saleId: detail.id,
        kind,
        paymentMethod,
        dueDate,
        fulfillmentDate,
        comment,
        customerEmail: email.trim() || undefined,
        advanceAmount:
          kind === 'advance'
            ? Number(advanceAmount.replace(/\s/g, ''))
            : undefined,
        proformaAmount:
          kind === 'proforma' && proformaAmount.trim()
            ? Number(proformaAmount.replace(/\s/g, ''))
            : undefined
      }).then((result) => {
        if (gen !== previewGen.current) return
        setPreviewLoading(false)
        if (!result.ok) {
          setPreviewError(result.message)
          setPreviewOk(false)
          revokePreview()
          return
        }
        try {
          const bin = atob(result.pdfBase64)
          const bytes = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
          const blob = new Blob([bytes], { type: 'application/pdf' })
          const url = URL.createObjectURL(blob)
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev.split('#')[0]!)
            return url + '#toolbar=0&navpanes=0'
          })
          setPreviewOk(true)
          setPreviewError(null)
        } catch {
          setPreviewError('PDF megjelenítési hiba.')
          setPreviewOk(false)
        }
      })
    }, 650)

    return () => window.clearTimeout(handle)
  }, [
    open,
    hasAgentKey,
    hasFinal,
    options.length,
    detail.id,
    kind,
    paymentMethod,
    dueDate,
    fulfillmentDate,
    comment,
    email,
    advanceAmount,
    proformaAmount
  ])

  const canIssue =
    hasAgentKey &&
    options.length > 0 &&
    !hasFinal &&
    previewOk &&
    !previewLoading

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3 pr-10">
          <DialogTitle>{kindTitle(kind, hasProforma)}</DialogTitle>
          <p className="mt-1 text-hint text-ink-secondary">
            {detail.sale_number} · {formatMoneyFt(dueGross)} Ft · előnézet a
            Számlázz.hu-tól
          </p>
        </DialogHeader>

        {hasFinal ? (
          <div className="px-4 py-4">
            <p className="rounded-md border border-warning/35 bg-warning-soft px-3 py-2 text-body text-warning-ink">
              Ehhez az eladáshoz már van aktív számla. Új bizonylathoz előbb
              sztornózd a meglévőt.
            </p>
            <DialogFooter className="mt-4 border-0 px-0 py-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                Bezárás
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="grid max-h-[min(80vh,40rem)] gap-0 overflow-hidden md:grid-cols-2">
              <div className="max-h-[min(40vh,20rem)] space-y-3 overflow-y-auto border-b border-border px-4 py-3 md:max-h-none md:border-b-0 md:border-r">
                {!hasAgentKey ? (
                  <p className="rounded-md border border-warning/35 bg-warning-soft px-3 py-2 text-body text-warning-ink">
                    Nincs Agent kulcs.{' '}
                    <a
                      href="/beallitasok/szamlazas"
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      Beállítások → Számlázás
                    </a>
                  </p>
                ) : null}

                {hasProforma && detail.payment_status === 'paid' ? (
                  <p className="rounded-md border border-border bg-subtle px-2.5 py-2 text-hint text-ink-secondary">
                    Van díjbekérő és az eladás fizetett — végszámla következik.
                    A díjbekérő ezután nem sztornózható.
                  </p>
                ) : null}

                {hasProforma && detail.payment_status !== 'paid' ? (
                  <p className="rounded-md border border-border bg-subtle px-2.5 py-2 text-hint text-ink-secondary">
                    Már van díjbekérő. Rögzítsd a fizetést, majd állíts ki
                    végszámlát — vagy előleget.
                  </p>
                ) : null}

                {kind === 'proforma' ? (
                  <p className="rounded-md border border-border bg-subtle px-2.5 py-2 text-hint text-ink-secondary">
                    Díjbekérő = fizetési felhívás (még nem számla). A fizetési
                    mód csak a papíron jelenik meg — nem rögzít ERP befizetést.
                  </p>
                ) : null}

                {kind === 'advance' ? (
                  <p className="rounded-md border border-border bg-subtle px-2.5 py-2 text-hint text-ink-secondary">
                    Előlegszámla az előlegről. Válaszd, hogyan érkezett / érkezik
                    az összeg.
                  </p>
                ) : null}

                {multiPaymentHint ? (
                  <p className="rounded-md border border-border bg-subtle px-2.5 py-2 text-hint text-ink-secondary">
                    {multiPaymentHint}
                  </p>
                ) : null}

                {options.length > 0 ? (
                  kindLocked && !showKindPicker ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-body text-ink">
                        <span className="text-ink-secondary">Típus · </span>
                        {options.find((o) => o.value === kind)?.label ??
                          kindTitle(kind, hasProforma)}
                      </p>
                      {options.length > 1 && !kindDisabled ? (
                        <button
                          type="button"
                          className="text-hint font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
                          onClick={() => setShowKindPicker(true)}
                        >
                          Módosítás
                        </button>
                      ) : null}
                    </div>
                  ) : showKindSelect ? (
                    <FormField label="Típus" htmlFor="inv-kind">
                      <select
                        id="inv-kind"
                        className="flex h-9 w-full rounded-md border border-border bg-surface px-2.5 text-body"
                        value={kind}
                        disabled={pending || kindDisabled}
                        onChange={(e) => {
                          const v = e.target.value as InvoiceIssueKind
                          setKind(v)
                          setPaymentMethod(defaultPay(v, detail))
                          if (v === 'proforma') setDueDate(plusDaysIso(8))
                          else setDueDate(todayIso())
                        }}
                      >
                        {options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  ) : null
                ) : null}

                <FormField
                  label="Fizetési mód"
                  htmlFor="inv-pay"
                  hint={invoicePaymentMethodHint(kind)}
                >
                  <select
                    id="inv-pay"
                    className="flex h-9 w-full rounded-md border border-border bg-surface px-2.5 text-body"
                    value={paymentMethod}
                    disabled={pending}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as InvoicePaymentMethod)
                    }
                  >
                    <option value="cash">Készpénz</option>
                    <option value="card">Bankkártya</option>
                    <option value="bank_transfer">Átutalás</option>
                  </select>
                </FormField>

                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Teljesítés" htmlFor="inv-fulfill">
                    <Input
                      id="inv-fulfill"
                      type="date"
                      value={fulfillmentDate}
                      disabled={pending}
                      onChange={(e) => setFulfillmentDate(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Fizetési határidő" htmlFor="inv-due">
                    <Input
                      id="inv-due"
                      type="date"
                      value={dueDate}
                      disabled={pending}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </FormField>
                </div>

                {kind === 'advance' ? (
                  <FormField
                    label="Előleg (bruttó Ft)"
                    htmlFor="inv-adv"
                    required
                  >
                    <Input
                      id="inv-adv"
                      inputMode="numeric"
                      value={advanceAmount}
                      disabled={pending}
                      onChange={(e) => setAdvanceAmount(e.target.value)}
                      placeholder={String(dueGross)}
                    />
                  </FormField>
                ) : null}

                {kind === 'proforma' ? (
                  <FormField
                    label="Díjbekérő összeg (bruttó Ft)"
                    htmlFor="inv-pro"
                    optionalLabel
                    hint="Üresen a teljes végösszeg."
                  >
                    <Input
                      id="inv-pro"
                      inputMode="numeric"
                      value={proformaAmount}
                      disabled={pending}
                      onChange={(e) => setProformaAmount(e.target.value)}
                      placeholder={String(dueGross)}
                    />
                  </FormField>
                ) : null}

                <FormField
                  label="E-mail"
                  htmlFor="inv-email"
                  required={sendEmail}
                  hint={
                    sendEmail
                      ? 'Ide megy a bizonylat.'
                      : 'Küldéshez kapcsold be az e-mailt.'
                  }
                >
                  <Input
                    id="inv-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    disabled={pending}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vevo@pelda.hu"
                  />
                </FormField>

                <label className="flex items-center gap-2 text-body text-ink">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    disabled={pending}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="size-4 rounded border-border"
                  />
                  Küldés e-mailben
                </label>

                <FormField label="Megjegyzés" htmlFor="inv-note" optionalLabel>
                  <Input
                    id="inv-note"
                    value={comment}
                    disabled={pending}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </FormField>

                {error ? (
                  <p className="text-hint text-danger-ink" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>

              <div className="flex min-h-[16rem] flex-col bg-subtle/40 px-3 py-3 md:min-h-0">
                <p className="mb-2 text-hint font-medium text-ink-secondary">
                  PDF előnézet
                </p>
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-surface">
                  {previewLoading ? (
                    <p className="absolute inset-0 flex items-center justify-center text-body text-ink-secondary">
                      Előnézet betöltése…
                    </p>
                  ) : null}
                  {previewError && !previewLoading ? (
                    <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-body text-danger-ink">
                      {previewError}
                    </p>
                  ) : null}
                  {previewUrl && !previewError ? (
                    <iframe
                      title="Számla előnézet"
                      src={previewUrl}
                      className="h-full min-h-[18rem] w-full md:min-h-[28rem]"
                    />
                  ) : null}
                  {!previewLoading && !previewError && !previewUrl ? (
                    <p className="absolute inset-0 flex items-center justify-center text-body text-ink-muted">
                      Az előnézet itt jelenik meg.
                    </p>
                  ) : null}
                </div>
                <p className="mt-2 text-hint text-ink-muted">
                  {sendEmail && email.trim()
                    ? `Küldés: ${email.trim()}`
                    : 'Nincs e-mail küldés — PDF a listán elérhető.'}
                </p>
              </div>
            </div>

            <DialogFooter className="border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                Mégse
              </Button>
              <Button
                type="button"
                disabled={pending || !canIssue}
                loading={pending}
                onClick={() => {
                  setError(null)
                  if (kind === 'normal' && detail.payment_status !== 'paid') {
                    setError(
                      'Végszámlát csak fizetett eladáshoz. Rögzítsd a fizetést.'
                    )
                    return
                  }
                  if (sendEmail && !email.trim()) {
                    setError('E-mail küldéshez add meg a címet.')
                    return
                  }
                  if (!previewOk) {
                    setError('Várj az előnézetre, vagy javítsd a hibát.')
                    return
                  }
                  startTransition(async () => {
                    const result = await createSaleInvoiceAction({
                      saleId: detail.id,
                      kind,
                      paymentMethod,
                      dueDate,
                      fulfillmentDate,
                      comment,
                      sendEmail,
                      customerEmail: email.trim() || undefined,
                      advanceAmount:
                        kind === 'advance'
                          ? Number(advanceAmount.replace(/\s/g, ''))
                          : undefined,
                      proformaAmount:
                        kind === 'proforma' && proformaAmount.trim()
                          ? Number(proformaAmount.replace(/\s/g, ''))
                          : undefined,
                      markAsPaid:
                        kind === 'normal' && detail.payment_status === 'paid'
                    })
                    if (!result.ok) {
                      setError(result.message)
                      return
                    }
                    toast.success(
                      result.providerNumber
                        ? `Kiállítva: ${result.providerNumber}`
                        : 'Bizonylat kiállítva.'
                    )
                    onOpenChange(false)
                    router.refresh()
                  })
                }}
              >
                Kiállítás
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
