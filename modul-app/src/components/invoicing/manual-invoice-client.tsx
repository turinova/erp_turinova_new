'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import {
  billingFromCustomer,
  DocumentBillingFields,
  EMPTY_DOCUMENT_BILLING,
  type DocumentBillingState
} from '@/components/sales/document-billing-fields'
import { CustomerMenuSelect } from '@/components/customers/customer-menu-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  createManualInvoiceAction,
  previewManualInvoiceAction
} from '@/lib/invoicing/actions'
import type { OptiCustomerOption } from '@/lib/customers/queries'
import type {
  InvoiceIssueKind,
  InvoicePaymentMethod
} from '@/lib/invoicing/types'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

type LineDraft = {
  key: string
  name: string
  quantity: string
  unit: string
  unitNet: string
  vatPercent: string
}

type Props = {
  customers: OptiCustomerOption[]
  hasAgentKey: boolean
  canWrite: boolean
  defaultSendEmail: boolean
}

const VAT_OPTIONS = [
  { value: '27', label: '27%' },
  { value: '18', label: '18%' },
  { value: '5', label: '5%' },
  { value: '0', label: '0%' }
]

const KIND_OPTIONS: { value: InvoiceIssueKind; label: string }[] = [
  { value: 'normal', label: 'Számla' },
  { value: 'proforma', label: 'Díjbekérő' },
  { value: 'advance', label: 'Előlegszámla' }
]

const PAY_OPTIONS: { value: InvoicePaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Átutalás' },
  { value: 'cash', label: 'Készpénz' },
  { value: 'card', label: 'Bankkártya' }
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function plusDaysIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function newLine(): LineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    quantity: '1',
    unit: 'db',
    unitNet: '',
    vatPercent: '27'
  }
}

function lineTotals(line: LineDraft) {
  const qty = Number(line.quantity.replace(/\s/g, '').replace(',', '.'))
  const unitNet = Number(line.unitNet.replace(/\s/g, '').replace(',', '.'))
  const vat = Number(line.vatPercent) || 0
  if (!(qty > 0) || !Number.isFinite(unitNet)) {
    return { net: 0, vat: 0, gross: 0 }
  }
  const net = Math.round(unitNet * qty)
  const vatAmt = Math.round((net * vat) / 100)
  return { net, vat: vatAmt, gross: net + vatAmt }
}

export function ManualInvoiceClient({
  customers,
  hasAgentKey,
  canWrite,
  defaultSendEmail
}: Props) {
  const router = useRouter()
  const [kind, setKind] = useState<InvoiceIssueKind>('normal')
  const [paymentMethod, setPaymentMethod] =
    useState<InvoicePaymentMethod>('bank_transfer')
  const [dueDate, setDueDate] = useState(todayIso())
  const [fulfillmentDate, setFulfillmentDate] = useState(todayIso())
  const [comment, setComment] = useState('')
  const [reference, setReference] = useState('')
  const [email, setEmail] = useState('')
  const [sendEmail, setSendEmail] = useState(defaultSendEmail)
  const [markAsPaid, setMarkAsPaid] = useState(false)
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [proformaAmount, setProformaAmount] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [billing, setBilling] = useState<DocumentBillingState>(
    EMPTY_DOCUMENT_BILLING
  )
  const [lines, setLines] = useState<LineDraft[]>([newLine()])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewOk, setPreviewOk] = useState(false)
  const previewGen = useRef(0)

  const totals = useMemo(() => {
    if (kind === 'advance') {
      const brutto = Number(advanceAmount.replace(/\s/g, '').replace(',', '.'))
      if (!(brutto > 0)) return { net: 0, vat: 0, gross: 0 }
      const vat = Math.round((brutto / 127) * 27)
      return { net: brutto - vat, vat, gross: Math.round(brutto) }
    }
    if (kind === 'proforma') {
      const partial = Number(
        proformaAmount.replace(/\s/g, '').replace(',', '.')
      )
      if (partial > 0) {
        const vat = Math.round((partial / 127) * 27)
        return { net: partial - vat, vat, gross: Math.round(partial) }
      }
    }
    return lines.reduce(
      (acc, l) => {
        const t = lineTotals(l)
        acc.net += t.net
        acc.vat += t.vat
        acc.gross += t.gross
        return acc
      },
      { net: 0, vat: 0, gross: 0 }
    )
  }, [lines, kind, advanceAmount, proformaAmount])

  function applyCustomer(id: string, c: OptiCustomerOption | null) {
    setCustomerId(id)
    if (!id || !c) return
    setBilling(billingFromCustomer(c))
    if (c.email) {
      setEmail(c.email)
      setSendEmail(true)
    }
  }

  function patchLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    )
  }

  function revokePreview() {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev.split('#')[0]!)
      return null
    })
  }

  useEffect(() => {
    if (kind === 'proforma') setDueDate(plusDaysIso(8))
    else setDueDate(todayIso())
    if (kind === 'normal') {
      setMarkAsPaid(paymentMethod === 'cash' || paymentMethod === 'card')
    } else {
      setMarkAsPaid(false)
    }
  }, [kind])

  useEffect(() => {
    if (kind === 'normal') {
      setMarkAsPaid(paymentMethod === 'cash' || paymentMethod === 'card')
    }
  }, [paymentMethod, kind])

  function buildPayload() {
    const street = [billing.billingStreet, billing.billingHouseNumber]
      .filter(Boolean)
      .join(' ')
    return {
      kind,
      paymentMethod,
      dueDate,
      fulfillmentDate,
      comment: comment.trim() || undefined,
      reference: reference.trim() || undefined,
      sendEmail: sendEmail && Boolean(email.trim()),
      markAsPaid: kind === 'normal' ? markAsPaid : false,
      advanceAmount:
        kind === 'advance'
          ? Number(advanceAmount.replace(/\s/g, '').replace(',', '.'))
          : undefined,
      proformaAmount:
        kind === 'proforma' && proformaAmount.trim()
          ? Number(proformaAmount.replace(/\s/g, '').replace(',', '.'))
          : undefined,
      customerId: customerId || null,
      buyer: {
        name: billing.billingName.trim() || 'Vevő',
        postalCode: billing.billingPostalCode.trim(),
        city: billing.billingCity.trim(),
        address: street,
        email: email.trim(),
        taxNumber: billing.billingTaxNumber.trim()
      },
      lines: lines.map((l) => ({
        name: l.name.trim(),
        quantity: Number(l.quantity.replace(/\s/g, '').replace(',', '.')) || 0,
        unit: l.unit.trim() || 'db',
        unitNet: Number(l.unitNet.replace(/\s/g, '').replace(',', '.')) || 0,
        vatPercent: Number(l.vatPercent) || 0
      }))
    }
  }

  // Debounced Agent PDF preview
  useEffect(() => {
    if (!canWrite || !hasAgentKey) return

    if (kind === 'advance') {
      const n = Number(advanceAmount.replace(/\s/g, '').replace(',', '.'))
      if (!(n > 0)) {
        setPreviewError('Add meg az előleg összegét az előnézethez.')
        setPreviewOk(false)
        revokePreview()
        return
      }
    } else {
      const valid = lines.some((l) => {
        const t = lineTotals(l)
        return l.name.trim() && t.gross > 0
      })
      if (!valid && !(kind === 'proforma' && Number(proformaAmount) > 0)) {
        setPreviewError('Adj meg legalább egy tételt.')
        setPreviewOk(false)
        revokePreview()
        return
      }
    }

    if (!billing.billingName.trim()) {
      setPreviewError('A vevő neve kötelező az előnézethez.')
      setPreviewOk(false)
      revokePreview()
      return
    }

    const gen = ++previewGen.current
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewOk(false)

    const handle = window.setTimeout(() => {
      void previewManualInvoiceAction(buildPayload()).then((result) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preview on field changes
  }, [
    canWrite,
    hasAgentKey,
    kind,
    paymentMethod,
    dueDate,
    fulfillmentDate,
    comment,
    reference,
    email,
    sendEmail,
    markAsPaid,
    advanceAmount,
    proformaAmount,
    customerId,
    billing,
    lines
  ])

  const canIssue =
    canWrite && hasAgentKey && previewOk && !previewLoading && !pending

  function onIssue() {
    if (!canIssue) return
    setError(null)
    startTransition(async () => {
      const result = await createManualInvoiceAction(buildPayload())
      if (!result.ok) {
        setError(result.message)
        toast.error(result.message)
        return
      }
      toast.success(result.message || 'Számla kiállítva.')
      router.push('/szamlak?source=manual&view=all')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Új számla"
        description="Önálló bizonylat — nem kell értékesítés vagy lapszabászat."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/szamlak')}
            >
              Mégse
            </Button>
            <Button
              type="button"
              disabled={!canIssue}
              onClick={onIssue}
            >
              {pending ? 'Kiállítás…' : 'Kiállítás'}
            </Button>
          </div>
        }
      />

      {!canWrite ? (
        <p className="rounded-md border border-warning/35 bg-warning-soft px-3 py-2 text-body text-warning-ink">
          Nincs írási jogod a számlázáshoz.
        </p>
      ) : null}

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

      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger-ink">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <FormSection title="Típus és fizetés" columns={2}>
            <FormField label="Bizonylat típusa" htmlFor="mi-kind" required>
              <div className="flex flex-wrap gap-1.5" id="mi-kind">
                {KIND_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setKind(o.value)}
                    className={cn(
                      'h-8 rounded-md px-2.5 text-hint font-medium transition-colors',
                      kind === o.value
                        ? 'bg-primary text-white'
                        : 'border border-border bg-surface text-ink-secondary hover:bg-subtle hover:text-ink'
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Fizetési mód" htmlFor="mi-pay" required>
              <Select
                id="mi-pay"
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as InvoicePaymentMethod)
                }
              >
                {PAY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Teljesítés" htmlFor="mi-fulfill" required>
              <Input
                id="mi-fulfill"
                type="date"
                value={fulfillmentDate}
                onChange={(e) => setFulfillmentDate(e.target.value)}
              />
            </FormField>
            <FormField label="Fizetési határidő" htmlFor="mi-due" required>
              <Input
                id="mi-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </FormField>
            {kind === 'advance' ? (
              <FormField
                label="Előleg bruttó (Ft)"
                htmlFor="mi-adv"
                required
              >
                <Input
                  id="mi-adv"
                  inputMode="decimal"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="pl. 50000"
                />
              </FormField>
            ) : null}
            {kind === 'proforma' ? (
              <FormField
                label="Rész-díjbekérő bruttó (Ft)"
                htmlFor="mi-prof"
                optionalLabel
              >
                <Input
                  id="mi-prof"
                  inputMode="decimal"
                  value={proformaAmount}
                  onChange={(e) => setProformaAmount(e.target.value)}
                  placeholder="Üres = teljes tétellista"
                />
              </FormField>
            ) : null}
            <FormField label="Hivatkozás" htmlFor="mi-ref" optionalLabel>
              <Input
                id="mi-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Rendelésszám / megjegyzés a számlán"
              />
            </FormField>
            {kind === 'normal' ? (
              <label className="flex items-center gap-2 text-body text-ink col-span-full">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-border"
                  checked={markAsPaid}
                  onChange={(e) => setMarkAsPaid(e.target.checked)}
                />
                Már fizetve (készpénz / kártya)
              </label>
            ) : null}
          </FormSection>

          <FormSection title="Vevő" columns={1}>
            <FormField label="Ügyfél a törzsből" htmlFor="mi-customer" optionalLabel>
              <CustomerMenuSelect
                id="mi-customer"
                value={customerId}
                seed={customers}
                onChange={applyCustomer}
                allowEmpty
                emptyLabel="Egyszeri / nincs törzsben"
              />
            </FormField>
            <DocumentBillingFields
              value={billing}
              onChange={setBilling}
              idPrefix="mi-bill"
              enableTaxpayerLookup={hasAgentKey}
              hint="A számlán megjelenő vevőadatok. Az ügyféltörzset nem írja felül."
            />
            <FormField label="E-mail (számlaértesítő)" htmlFor="mi-email" optionalLabel>
              <Input
                id="mi-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
            <label className="flex items-center gap-2 text-body text-ink">
              <input
                type="checkbox"
                className="size-3.5 rounded border-border"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                disabled={!email.trim()}
              />
              Küldés e-mailben a vevőnek
            </label>
          </FormSection>

          {kind !== 'advance' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-h3 text-ink">Tételek</h2>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setLines((prev) => [...prev, newLine()])}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Sor
                </Button>
              </div>
              <div className="space-y-2">
                {lines.map((line, idx) => {
                  const t = lineTotals(line)
                  return (
                    <div
                      key={line.key}
                      className="rounded-md border border-border bg-surface p-2.5 space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <FormField
                          label={idx === 0 ? 'Megnevezés' : '\u00A0'}
                          htmlFor={`mi-ln-${line.key}`}
                          className="min-w-0 flex-1"
                        >
                          <Input
                            id={`mi-ln-${line.key}`}
                            value={line.name}
                            onChange={(e) =>
                              patchLine(line.key, { name: e.target.value })
                            }
                            placeholder="Tétel neve"
                          />
                        </FormField>
                        <Button
                          type="button"
                          variant="secondary"
                          className="mt-5 shrink-0"
                          aria-label="Sor törlése"
                          disabled={lines.length <= 1}
                          onClick={() =>
                            setLines((prev) =>
                              prev.filter((l) => l.key !== line.key)
                            )
                          }
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <FormField label="Menny." htmlFor={`mi-q-${line.key}`}>
                          <Input
                            id={`mi-q-${line.key}`}
                            inputMode="decimal"
                            value={line.quantity}
                            onChange={(e) =>
                              patchLine(line.key, { quantity: e.target.value })
                            }
                          />
                        </FormField>
                        <FormField label="Egység" htmlFor={`mi-u-${line.key}`}>
                          <Input
                            id={`mi-u-${line.key}`}
                            value={line.unit}
                            onChange={(e) =>
                              patchLine(line.key, { unit: e.target.value })
                            }
                          />
                        </FormField>
                        <FormField
                          label="Nettó eg.ár"
                          htmlFor={`mi-n-${line.key}`}
                        >
                          <Input
                            id={`mi-n-${line.key}`}
                            inputMode="decimal"
                            value={line.unitNet}
                            onChange={(e) =>
                              patchLine(line.key, { unitNet: e.target.value })
                            }
                          />
                        </FormField>
                        <FormField label="ÁFA" htmlFor={`mi-v-${line.key}`}>
                          <Select
                            id={`mi-v-${line.key}`}
                            value={line.vatPercent}
                            onChange={(e) =>
                              patchLine(line.key, {
                                vatPercent: e.target.value
                              })
                            }
                          >
                            {VAT_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                      </div>
                      <p className="text-hint text-ink-muted tabular-nums">
                        Nettó {formatMoneyFt(t.net)} · ÁFA{' '}
                        {formatMoneyFt(t.vat)} · Bruttó{' '}
                        <span className="font-medium text-ink">
                          {formatMoneyFt(t.gross)} Ft
                        </span>
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          <FormField label="Megjegyzés a számlán" htmlFor="mi-note" optionalLabel>
            <Textarea
              id="mi-note"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </FormField>

          <div className="sticky bottom-0 z-10 -mx-1 border-t border-border bg-canvas/95 px-1 py-2.5 backdrop-blur-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="text-body text-ink-secondary">
                <span className="text-hint text-ink-muted">Összesen · </span>
                Nettó {formatMoneyFt(totals.net)} · ÁFA{' '}
                {formatMoneyFt(totals.vat)} ·{' '}
                <span className="font-semibold tabular-nums text-ink">
                  Bruttó {formatMoneyFt(totals.gross)} Ft
                </span>
              </div>
              <Button type="button" disabled={!canIssue} onClick={onIssue}>
                {pending ? 'Kiállítás…' : 'Kiállítás'}
              </Button>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-14 lg:self-start">
          <div className="overflow-hidden rounded-md border border-border bg-subtle">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <p className="text-hint font-medium text-ink">Előnézet</p>
              {previewLoading ? (
                <span className="text-hint text-ink-muted">Frissítés…</span>
              ) : previewOk ? (
                <span className="text-hint text-success-ink">Kész</span>
              ) : null}
            </div>
            <div className="relative aspect-[3/4] min-h-[28rem] bg-canvas">
              {previewUrl ? (
                <iframe
                  title="Számla előnézet"
                  src={previewUrl}
                  className="absolute inset-0 size-full border-0"
                />
              ) : (
                <div className="flex h-full min-h-[28rem] items-center justify-center px-4 text-center">
                  <p className="text-body text-ink-secondary">
                    {previewError ||
                      (hasAgentKey
                        ? 'Töltsd ki a vevőt és a tételeket — az előnézet automatikusan megjelenik.'
                        : 'Állíts be Agent kulcsot az előnézethez.')}
                  </p>
                </div>
              )}
            </div>
            {previewError && previewUrl ? (
              <p className="border-t border-border px-3 py-2 text-hint text-danger-ink">
                {previewError}
              </p>
            ) : null}
            <p className="border-t border-border px-3 py-2 text-hint text-ink-muted">
              A Kiállítás gomb csak sikeres előnézet után aktív.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
