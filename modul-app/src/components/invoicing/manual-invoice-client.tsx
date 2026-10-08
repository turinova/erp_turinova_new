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
import { MenuSelect } from '@/components/ui/menu-select'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  createConsolidatedInvoiceAction,
  createManualInvoiceAction,
  listEligibleConsolidateSourcesAction,
  previewConsolidatedInvoiceAction,
  previewManualInvoiceAction,
  pullConsolidatedLinesAction
} from '@/lib/invoicing/actions'
import type { EligibleConsolidateSource } from '@/lib/invoicing/eligible-consolidate'
import {
  allowedInvoicePaymentMethods,
  INVOICE_PAYMENT_METHOD_LABEL,
  invoicePaymentMethodHint
} from '@/lib/invoicing/payment-method'
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

type Mode = 'manual' | 'consolidate'
type PriceMode = 'net' | 'gross'

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

const UNIT_OPTIONS = [
  { value: 'db', label: 'db' },
  { value: 'm²', label: 'm²' },
  { value: 'm', label: 'm' },
  { value: 'óra', label: 'óra' },
  { value: 'csomag', label: 'csomag' }
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function plusDaysIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

let lineKeySeq = 0

function newLineKey(): string {
  lineKeySeq += 1
  return `ln-${lineKeySeq}`
}

function newLine(key?: string): LineDraft {
  return {
    key: key ?? newLineKey(),
    name: '',
    quantity: '1',
    unit: 'db',
    unitNet: '',
    vatPercent: '27'
  }
}

function parseNum(raw: string): number {
  return Number(raw.replace(/\s/g, '').replace(',', '.'))
}

function lineTotals(line: LineDraft) {
  const qty = parseNum(line.quantity)
  const unitNet = parseNum(line.unitNet)
  const vat = Number(line.vatPercent) || 0
  if (!(qty > 0) || !Number.isFinite(unitNet)) {
    return { net: 0, vat: 0, gross: 0 }
  }
  const net = Math.round(unitNet * qty)
  const vatAmt = Math.round((net * vat) / 100)
  return { net, vat: vatAmt, gross: net + vatAmt }
}

function sourceKey(s: { sourceType: string; sourceId: string }) {
  return `${s.sourceType}:${s.sourceId}`
}

export function ManualInvoiceClient({
  customers,
  hasAgentKey,
  canWrite,
  defaultSendEmail
}: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('manual')
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
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine('ln-0')])
  const [priceMode, setPriceMode] = useState<PriceMode>('net')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [eligible, setEligible] = useState<EligibleConsolidateSource[]>([])
  const [eligibleLoading, setEligibleLoading] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [pullPending, setPullPending] = useState(false)
  const [consolidatedSources, setConsolidatedSources] = useState<
    { sourceType: 'sale' | 'opti_order'; sourceId: string }[]
  >([])

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewOk, setPreviewOk] = useState(false)
  const [previewDirty, setPreviewDirty] = useState(true)
  const previewGen = useRef(0)

  const payOptions = useMemo(
    () =>
      allowedInvoicePaymentMethods(mode === 'consolidate' ? 'normal' : kind).map(
        (value) => ({
          value,
          label: INVOICE_PAYMENT_METHOD_LABEL[value]
        })
      ),
    [kind, mode]
  )

  const totals = useMemo(() => {
    if (mode === 'manual' && kind === 'advance') {
      const brutto = parseNum(advanceAmount)
      if (!(brutto > 0)) return { net: 0, vat: 0, gross: 0 }
      const vat = Math.round((brutto / 127) * 27)
      return { net: brutto - vat, vat, gross: Math.round(brutto) }
    }
    if (mode === 'manual' && kind === 'proforma') {
      const partial = parseNum(proformaAmount)
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
  }, [lines, kind, advanceAmount, proformaAmount, mode])

  function markDirty() {
    setPreviewDirty(true)
    setPreviewOk(false)
  }

  function applyCustomer(id: string, c: OptiCustomerOption | null) {
    setCustomerId(id)
    markDirty()
    if (!id || !c) return
    setBilling(billingFromCustomer(c))
    if (c.email) {
      setEmail(c.email)
      setSendEmail(true)
    }
    if (mode === 'consolidate') {
      setSelectedKeys(new Set())
      setConsolidatedSources([])
      setLines([newLine()])
    }
  }

  function patchLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    )
    markDirty()
  }

  function setUnitPrice(line: LineDraft, raw: string) {
    if (priceMode === 'net') {
      patchLine(line.key, { unitNet: raw })
      return
    }
    const gross = parseNum(raw)
    const vat = Number(line.vatPercent) || 0
    if (!Number.isFinite(gross)) {
      patchLine(line.key, { unitNet: raw })
      return
    }
    const net = vat > 0 ? gross / (1 + vat / 100) : gross
    patchLine(line.key, {
      unitNet: Number.isFinite(net) ? String(Math.round(net * 100) / 100) : ''
    })
  }

  function displayUnitPrice(line: LineDraft): string {
    if (priceMode === 'net') return line.unitNet
    const net = parseNum(line.unitNet)
    const vat = Number(line.vatPercent) || 0
    if (!Number.isFinite(net) || line.unitNet.trim() === '') return line.unitNet
    const gross = net * (1 + vat / 100)
    return String(Math.round(gross * 100) / 100)
  }

  function revokePreview() {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev.split('#')[0]!)
      return null
    })
  }

  useEffect(() => {
    if (mode === 'consolidate') {
      setKind('normal')
      setPaymentMethod('bank_transfer')
      setMarkAsPaid(false)
      setAdvanceAmount('')
      setProformaAmount('')
    }
  }, [mode])

  useEffect(() => {
    if (kind === 'proforma') {
      setDueDate(plusDaysIso(8))
      setPaymentMethod('bank_transfer')
      setMarkAsPaid(false)
    } else {
      setDueDate(todayIso())
    }
    if (kind === 'normal') {
      setMarkAsPaid(paymentMethod === 'cash' || paymentMethod === 'card')
    } else {
      setMarkAsPaid(false)
    }
    markDirty()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kind change resets pay
  }, [kind])

  useEffect(() => {
    if (kind === 'normal') {
      setMarkAsPaid(paymentMethod === 'cash' || paymentMethod === 'card')
    }
    markDirty()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod])

  useEffect(() => {
    if (mode !== 'consolidate' || !customerId) {
      setEligible([])
      return
    }
    let cancelled = false
    setEligibleLoading(true)
    void listEligibleConsolidateSourcesAction(customerId).then((res) => {
      if (cancelled) return
      setEligibleLoading(false)
      if (!res.ok) {
        toast.error(res.message)
        setEligible([])
        return
      }
      setEligible(res.sources)
    })
    return () => {
      cancelled = true
    }
  }, [mode, customerId])

  function buyerValid(): string | null {
    if (!billing.billingName.trim()) return 'A vevő neve kötelező.'
    const street = [billing.billingStreet, billing.billingHouseNumber]
      .filter(Boolean)
      .join(' ')
    if (!billing.billingCity.trim() && !street.trim()) {
      return 'Add meg a vevő címét (település vagy utca).'
    }
    return null
  }

  function buildManualPayload() {
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
          ? parseNum(advanceAmount)
          : undefined,
      proformaAmount:
        kind === 'proforma' && proformaAmount.trim()
          ? parseNum(proformaAmount)
          : undefined,
      customerId: customerId || null,
      buyer: {
        name: billing.billingName.trim(),
        postalCode: billing.billingPostalCode.trim(),
        city: billing.billingCity.trim(),
        address: street,
        email: email.trim(),
        taxNumber: billing.billingTaxNumber.trim()
      },
      lines: lines.map((l) => ({
        name: l.name.trim(),
        quantity: parseNum(l.quantity) || 0,
        unit: l.unit.trim() || 'db',
        unitNet: parseNum(l.unitNet) || 0,
        vatPercent: Number(l.vatPercent) || 0
      }))
    }
  }

  function buildConsolidatePayload() {
    const street = [billing.billingStreet, billing.billingHouseNumber]
      .filter(Boolean)
      .join(' ')
    return {
      sources: consolidatedSources,
      paymentMethod,
      dueDate,
      fulfillmentDate,
      comment: comment.trim() || undefined,
      sendEmail: sendEmail && Boolean(email.trim()),
      markAsPaid,
      customerId,
      buyer: {
        name: billing.billingName.trim(),
        postalCode: billing.billingPostalCode.trim(),
        city: billing.billingCity.trim(),
        address: street,
        email: email.trim(),
        taxNumber: billing.billingTaxNumber.trim()
      },
      lines: lines.map((l) => ({
        name: l.name.trim(),
        quantity: parseNum(l.quantity) || 0,
        unit: l.unit.trim() || 'db',
        unitNet: parseNum(l.unitNet) || 0,
        vatPercent: Number(l.vatPercent) || 0
      }))
    }
  }

  function canRefreshPreview(): string | null {
    if (!canWrite || !hasAgentKey) return 'Nincs jogosultság vagy Agent kulcs.'
    const bErr = buyerValid()
    if (bErr) return bErr

    if (mode === 'consolidate') {
      if (!customerId) return 'Összevonáshoz válassz ügyfelet.'
      if (consolidatedSources.length < 1) {
        return 'Húzd be legalább egy megrendelés tételeit.'
      }
      const valid = lines.some((l) => {
        const t = lineTotals(l)
        return l.name.trim() && t.gross > 0
      })
      if (!valid) return 'Adj meg legalább egy tételt.'
      return null
    }

    if (kind === 'advance') {
      const n = parseNum(advanceAmount)
      if (!(n > 0)) return 'Add meg az előleg összegét.'
      return null
    }
    const valid = lines.some((l) => {
      const t = lineTotals(l)
      return l.name.trim() && t.gross > 0
    })
    if (!valid && !(kind === 'proforma' && parseNum(proformaAmount) > 0)) {
      return 'Adj meg legalább egy tételt.'
    }
    return null
  }

  function applyPdfBase64(pdfBase64: string) {
    const bin = atob(pdfBase64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev.split('#')[0]!)
      return url + '#toolbar=0&navpanes=0'
    })
    setPreviewOk(true)
    setPreviewDirty(false)
    setPreviewError(null)
  }

  function onRefreshPreview() {
    const gate = canRefreshPreview()
    if (gate) {
      setPreviewError(gate)
      setPreviewOk(false)
      revokePreview()
      return
    }

    const gen = ++previewGen.current
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewOk(false)

    const run =
      mode === 'consolidate'
        ? previewConsolidatedInvoiceAction(buildConsolidatePayload())
        : previewManualInvoiceAction(buildManualPayload())

    void run.then((result) => {
      if (gen !== previewGen.current) return
      setPreviewLoading(false)
      if (!result.ok) {
        setPreviewError(result.message)
        setPreviewOk(false)
        revokePreview()
        return
      }
      try {
        applyPdfBase64(result.pdfBase64)
      } catch {
        setPreviewError('PDF megjelenítési hiba.')
        setPreviewOk(false)
      }
    })
  }

  const canIssue =
    canWrite &&
    hasAgentKey &&
    previewOk &&
    !previewDirty &&
    !previewLoading &&
    !pending

  function onIssue() {
    if (!canIssue) return
    setError(null)
    startTransition(async () => {
      const result =
        mode === 'consolidate'
          ? await createConsolidatedInvoiceAction(buildConsolidatePayload())
          : await createManualInvoiceAction(buildManualPayload())
      if (!result.ok) {
        setError(result.message)
        toast.error(result.message)
        return
      }
      toast.success(result.message || 'Számla kiállítva.')
      router.push(
        mode === 'consolidate'
          ? '/szamlak?source=consolidated&view=all'
          : '/szamlak?source=manual&view=all'
      )
      router.refresh()
    })
  }

  function toggleSource(s: EligibleConsolidateSource) {
    const key = sourceKey(s)
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function onPullLines() {
    if (!customerId) {
      toast.error('Válassz ügyfelet.')
      return
    }
    const sources = eligible
      .filter((s) => selectedKeys.has(sourceKey(s)))
      .map((s) => ({ sourceType: s.sourceType, sourceId: s.sourceId }))
    if (sources.length === 0) {
      toast.error('Jelölj ki legalább egy megrendelést.')
      return
    }
    setPullPending(true)
    const res = await pullConsolidatedLinesAction({ customerId, sources })
    setPullPending(false)
    if (!res.ok) {
      toast.error(res.message)
      return
    }
    setConsolidatedSources(sources)
    setLines(
      res.lines.map((l) => ({
        key: newLineKey(),
        name: l.name,
        quantity: String(l.quantity),
        unit: l.unit || 'db',
        unitNet: String(Math.round(l.unitNet * 100) / 100),
        vatPercent: String(l.vatPercent || 27)
      }))
    )
    setBilling({
      billingName: res.buyer.name,
      billingPostalCode: res.buyer.postalCode,
      billingCity: res.buyer.city,
      billingStreet: res.buyer.address,
      billingHouseNumber: '',
      billingTaxNumber: res.buyer.taxNumber,
      billingCountry: 'Magyarország'
    })
    if (res.buyer.email) {
      setEmail(res.buyer.email)
      setSendEmail(true)
    }
    setReference(res.reference)
    markDirty()
    toast.success(`${res.lines.length} tétel behúzva (${res.sourceNumbers.length} forrás).`)
  }

  const showLines = mode === 'consolidate' || kind !== 'advance'
  const effectiveKind = mode === 'consolidate' ? 'normal' : kind

  return (
    <div className="space-y-4">
      <PageHeader
        title="Új számla"
        description="Szabad kézi bizonylat vagy több megrendelés egy számlára."
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/szamlak')}
          >
            Mégse
          </Button>
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

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { value: 'manual' as const, label: 'Szabad kézi' },
            { value: 'consolidate' as const, label: 'Megrendelésekből' }
          ] as const
        ).map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              setMode(o.value)
              markDirty()
              revokePreview()
            }}
            className={cn(
              'h-8 rounded-md px-2.5 text-hint font-medium transition-colors',
              mode === o.value
                ? 'bg-primary text-white'
                : 'border border-border bg-surface text-ink-secondary hover:bg-subtle hover:text-ink'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {mode === 'manual' ? (
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
              <FormField
                label="Fizetési mód"
                htmlFor="mi-pay"
                required
                hint={invoicePaymentMethodHint(kind)}
              >
                <Select
                  id="mi-pay"
                  value={paymentMethod}
                  disabled={kind === 'proforma'}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as InvoicePaymentMethod)
                  }
                >
                  {payOptions.map((o) => (
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
                  onChange={(e) => {
                    setFulfillmentDate(e.target.value)
                    markDirty()
                  }}
                />
              </FormField>
              <FormField label="Fizetési határidő" htmlFor="mi-due" required>
                <Input
                  id="mi-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value)
                    markDirty()
                  }}
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
                    onChange={(e) => {
                      setAdvanceAmount(e.target.value)
                      markDirty()
                    }}
                    placeholder="pl. 50000"
                  />
                </FormField>
              ) : null}
              {kind === 'proforma' ? (
                <FormField
                  label="Rész-díjbekérő bruttó (Ft)"
                  htmlFor="mi-prof"
                  optionalLabel
                  hint="Üres = teljes tétellista a számlán."
                >
                  <Input
                    id="mi-prof"
                    inputMode="decimal"
                    value={proformaAmount}
                    onChange={(e) => {
                      setProformaAmount(e.target.value)
                      markDirty()
                    }}
                    placeholder="Üres = teljes tétellista"
                  />
                </FormField>
              ) : null}
              <FormField label="Hivatkozás" htmlFor="mi-ref" optionalLabel>
                <Input
                  id="mi-ref"
                  value={reference}
                  onChange={(e) => {
                    setReference(e.target.value)
                    markDirty()
                  }}
                  placeholder="Rendelésszám / megjegyzés a számlán"
                />
              </FormField>
              {kind === 'normal' ? (
                <label className="flex items-center gap-2 text-body text-ink col-span-full">
                  <input
                    type="checkbox"
                    className="size-3.5 rounded border-border"
                    checked={markAsPaid}
                    onChange={(e) => {
                      setMarkAsPaid(e.target.checked)
                      markDirty()
                    }}
                  />
                  Már fizetve (készpénz / kártya)
                </label>
              ) : null}
            </FormSection>
          ) : (
            <FormSection title="Összevonás" columns={2}>
              <FormField label="Teljesítés" htmlFor="mi-fulfill-c" required>
                <Input
                  id="mi-fulfill-c"
                  type="date"
                  value={fulfillmentDate}
                  onChange={(e) => {
                    setFulfillmentDate(e.target.value)
                    markDirty()
                  }}
                />
              </FormField>
              <FormField label="Fizetési határidő" htmlFor="mi-due-c" required>
                <Input
                  id="mi-due-c"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value)
                    markDirty()
                  }}
                />
              </FormField>
              <FormField label="Fizetési mód" htmlFor="mi-pay-c" required>
                <Select
                  id="mi-pay-c"
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as InvoicePaymentMethod)
                  }
                >
                  {payOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <label className="flex items-center gap-2 text-body text-ink">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-border"
                  checked={markAsPaid}
                  onChange={(e) => {
                    setMarkAsPaid(e.target.checked)
                    markDirty()
                  }}
                />
                Már fizetve
              </label>
              <p className="col-span-full text-hint text-ink-muted">
                Végszámla több fizetett értékesítés / lapszabászat megrendelésből.
                A tételek forrásszámmal prefixelve jelennek meg.
              </p>
            </FormSection>
          )}

          <FormSection title="Vevő" columns={1}>
            <FormField
              label="Ügyfél a törzsből"
              htmlFor="mi-customer"
              required={mode === 'consolidate'}
              optionalLabel={mode === 'manual'}
            >
              <CustomerMenuSelect
                id="mi-customer"
                value={customerId}
                seed={customers}
                onChange={applyCustomer}
                allowEmpty={mode === 'manual'}
                emptyLabel="Egyszeri / nincs törzsben"
              />
            </FormField>
            <DocumentBillingFields
              value={billing}
              onChange={(next) => {
                setBilling(next)
                markDirty()
              }}
              idPrefix="mi-bill"
              enableTaxpayerLookup={hasAgentKey}
              requiredBilling
              hint="A számlán megjelenő vevőadatok. Az ügyféltörzset nem írja felül."
            />
            <FormField label="E-mail (számlaértesítő)" htmlFor="mi-email" optionalLabel>
              <Input
                id="mi-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  markDirty()
                }}
              />
            </FormField>
            <label className="flex items-center gap-2 text-body text-ink">
              <input
                type="checkbox"
                className="size-3.5 rounded border-border"
                checked={sendEmail}
                onChange={(e) => {
                  setSendEmail(e.target.checked)
                  markDirty()
                }}
                disabled={!email.trim()}
              />
              Küldés e-mailben a vevőnek
            </label>
          </FormSection>

          {mode === 'consolidate' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-h3 text-ink">Megrendelések</h2>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    !customerId ||
                    selectedKeys.size === 0 ||
                    pullPending ||
                    !canWrite
                  }
                  onClick={() => void onPullLines()}
                >
                  {pullPending ? 'Behúzás…' : 'Hozzáadás a számlához'}
                </Button>
              </div>
              {!customerId ? (
                <p className="text-body text-ink-secondary">
                  Válassz ügyfelet a számlázható megrendelésekhez.
                </p>
              ) : eligibleLoading ? (
                <p className="text-body text-ink-muted">Betöltés…</p>
              ) : eligible.length === 0 ? (
                <p className="rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink-secondary">
                  Nincs számlázható megrendelés ennél az ügyfélnél (fizetve + nincs
                  végszámla).{' '}
                  <button
                    type="button"
                    className="font-medium underline-offset-2 hover:underline"
                    onClick={() => setMode('manual')}
                  >
                    Váltás szabad kézi módra
                  </button>
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {eligible.map((s) => {
                    const key = sourceKey(s)
                    const checked = selectedKeys.has(key)
                    return (
                      <li key={key}>
                        <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-subtle">
                          <input
                            type="checkbox"
                            className="size-3.5 rounded border-border"
                            checked={checked}
                            onChange={() => toggleSource(s)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="text-hint text-ink-muted">
                              {s.kindLabel}
                            </span>{' '}
                            <span className="text-body font-medium text-ink">
                              {s.sourceNumber}
                            </span>
                          </span>
                          <span className="shrink-0 text-hint tabular-nums text-ink-secondary">
                            {formatMoneyFt(s.totalGross)} Ft
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
              {consolidatedSources.length > 0 ? (
                <p className="text-hint text-ink-muted">
                  Behúzva: {consolidatedSources.length} forrás · szerkeszthető
                  tételek alább.
                </p>
              ) : null}
            </div>
          ) : null}

          {showLines ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-h3 text-ink">Tételek</h2>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {(
                      [
                        { value: 'net' as const, label: 'Nettó' },
                        { value: 'gross' as const, label: 'Bruttó' }
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setPriceMode(o.value)}
                        className={cn(
                          'h-7 rounded-md px-2 text-hint font-medium',
                          priceMode === o.value
                            ? 'bg-subtle text-ink'
                            : 'text-ink-muted hover:text-ink'
                        )}
                      >
                        {o.label} eg.ár
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setLines((prev) => [...prev, newLine()])
                      markDirty()
                    }}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Sor
                  </Button>
                </div>
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
                          required={idx === 0}
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
                          onClick={() => {
                            setLines((prev) =>
                              prev.filter((l) => l.key !== line.key)
                            )
                            markDirty()
                          }}
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
                          <MenuSelect
                            id={`mi-u-${line.key}`}
                            value={line.unit}
                            options={UNIT_OPTIONS}
                            allowEmpty={false}
                            onChange={(v) => patchLine(line.key, { unit: v })}
                          />
                        </FormField>
                        <FormField
                          label={
                            priceMode === 'gross' ? 'Bruttó eg.ár' : 'Nettó eg.ár'
                          }
                          htmlFor={`mi-n-${line.key}`}
                        >
                          <Input
                            id={`mi-n-${line.key}`}
                            inputMode="decimal"
                            value={displayUnitPrice(line)}
                            onChange={(e) =>
                              setUnitPrice(line, e.target.value)
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
              onChange={(e) => {
                setComment(e.target.value)
                markDirty()
              }}
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
                {pending
                  ? 'Kiállítás…'
                  : effectiveKind === 'proforma'
                    ? 'Díjbekérő kiállítása'
                    : effectiveKind === 'advance'
                      ? 'Előleg kiállítása'
                      : 'Kiállítás'}
              </Button>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-14 lg:self-start">
          <div className="overflow-hidden rounded-md border border-border bg-subtle">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <p className="text-hint font-medium text-ink">Előnézet</p>
              <div className="flex items-center gap-2">
                {previewLoading ? (
                  <span className="text-hint text-ink-muted">Frissítés…</span>
                ) : previewOk && !previewDirty ? (
                  <span className="text-hint text-success-ink">Kész</span>
                ) : previewDirty && previewUrl ? (
                  <span className="text-hint text-warning-ink">Elavult</span>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canWrite || !hasAgentKey || previewLoading}
                  onClick={onRefreshPreview}
                >
                  Előnézet frissítése
                </Button>
              </div>
            </div>
            <div className="relative aspect-[3/4] min-h-[28rem] bg-canvas">
              {previewUrl ? (
                <iframe
                  title="Számla előnézet"
                  src={previewUrl}
                  className={cn(
                    'absolute inset-0 size-full border-0',
                    previewDirty ? 'opacity-60' : null
                  )}
                />
              ) : (
                <div className="flex h-full min-h-[28rem] items-center justify-center px-4 text-center">
                  <p className="text-body text-ink-secondary">
                    {previewError ||
                      (hasAgentKey
                        ? 'Töltsd ki a vevőt és a tételeket, majd nyomd meg: Előnézet frissítése.'
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
              A Kiállítás gomb csak friss, sikeres előnézet után aktív.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
