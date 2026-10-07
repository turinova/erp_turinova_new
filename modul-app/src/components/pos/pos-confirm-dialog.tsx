'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { StatusBadge } from '@/components/patterns/status-badge'
import type { DocumentBillingState } from '@/components/sales/document-billing-fields'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PosCashNumpad } from '@/components/pos/pos-cash-numpad'
import {
  cancelCardTerminalCharge,
  confirmCardTerminalCharge,
  pollCardTerminalCharge,
  startCardTerminalCharge
} from '@/lib/pos/card-terminal/charge'
import {
  getPosCardTerminalKind,
  setPosCardTerminalKind,
  type PosCardTerminalKind
} from '@/lib/pos/card-terminal/types'
import { getPosTerminalPublicConfigAction } from '@/lib/pos/settings-actions'
import type { PosTerminalPublicConfig } from '@/lib/pos/settings-types'
import type { PosCartLine, PosFeeLine } from '@/lib/pos/session'
import {
  buildPosTenders,
  posChangeDue,
  posPayableDue,
  type PosPayMode,
  type PosTenderLine
} from '@/lib/pos/tender'
import {
  saleLineCartKey,
  saleUnitLabel
} from '@/lib/sales/material-qty'
import { formatMoneyFt } from '@/lib/sales/parse'
import {
  computeSaleTotals,
  hungarianCashRound
} from '@/lib/sales/totals'
import { usePosTouchMode } from '@/lib/pos/touch-mode'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export type PosConfirmResult = {
  payments: Array<{ paymentMethodId: string; amount: number }>
  tenders: PosTenderLine[]
  /** Üres payments (0 Ft) → create_sale p_fulfill_now */
  fulfillNow: boolean
  cardProviderRef: string | null
  cardAuthCode: string | null
  cardTerminalKind: PosCardTerminalKind | null
  noteSuffix: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: PosPayMode
  lines: PosCartLine[]
  fees: PosFeeLine[]
  globalDiscPct: number
  cashMethodId: string | null
  cardMethodId: string | null
  cashMethodName: string
  cardMethodName: string
  warehouseName: string
  customerName: string | null
  invoice: boolean
  billing: DocumentBillingState | null
  overstockCount: number
  registerId?: string | null
  loading?: boolean
  onConfirm: (result: PosConfirmResult) => void
}

function lineAmounts(line: PosCartLine) {
  const before = Math.round(line.quantity * line.unitPriceGross)
  const disc = Math.round((before * (line.discountPercentage || 0)) / 100)
  return { before, final: Math.max(0, before - disc) }
}

export function PosConfirmDialog({
  open,
  onOpenChange,
  mode,
  lines,
  fees,
  globalDiscPct,
  cashMethodId,
  cardMethodId,
  cashMethodName,
  cardMethodName,
  warehouseName,
  customerName,
  invoice,
  billing,
  overstockCount,
  registerId = null,
  loading = false,
  onConfirm
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const cashReceivedRef = useRef<HTMLInputElement>(null)
  const { touch } = usePosTouchMode()

  const baseTotals = useMemo(
    () =>
      computeSaleTotals({
        lines: lines.map((l) => ({
          quantity: l.quantity,
          unitPriceGross: l.unitPriceGross,
          discountPercentage: l.discountPercentage,
          taxPercent: l.taxPercent
        })),
        fees: fees.map((f) => ({
          unitPriceGross: f.unitPriceGross,
          taxPercent: f.taxRatePercent
        })),
        globalDiscountPercent: globalDiscPct,
        applyCashRound: false
      }),
    [lines, fees, globalDiscPct]
  )

  const { due, cashRoundingAmount } = posPayableDue(baseTotals, mode)

  const [cashPart, setCashPart] = useState(0)
  const [cashReceived, setCashReceived] = useState(0)
  /** KP / kártya: mennyit fizetett (0 = hitel). */
  const [paidAmount, setPaidAmount] = useState(0)
  const [step, setStep] = useState<'review' | 'terminal'>('review')
  const [terminalKind, setTerminalKind] =
    useState<PosCardTerminalKind>('manual')
  const [authCode, setAuthCode] = useState('')
  const [terminalBusy, setTerminalBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [teyaConfig, setTeyaConfig] = useState<PosTerminalPublicConfig | null>(
    null
  )
  const [teyaPaymentId, setTeyaPaymentId] = useState<string | null>(null)
  const [teyaStatus, setTeyaStatus] = useState<string | null>(null)
  const pollStopRef = useRef(false)

  useEffect(() => {
    if (!open) return
    setStep('review')
    setLocalError(null)
    setAuthCode('')
    setTerminalBusy(false)
    setTeyaPaymentId(null)
    setTeyaStatus(null)
    pollStopRef.current = false
    void getPosTerminalPublicConfigAction().then((cfg) => {
      setTeyaConfig(cfg)
      if (cfg.teyaReady) {
        setTerminalKind('teya')
      } else {
        const stored = getPosCardTerminalKind()
        setTerminalKind(stored === 'teya' ? 'manual' : stored)
      }
    })
    if (mode === 'split') {
      const half = Math.floor(due / 2)
      setCashPart(half > 0 ? hungarianCashRound(half) || half : 0)
      setPaidAmount(due)
    } else {
      setCashPart(mode === 'cash' ? due : 0)
      setPaidAmount(due)
    }
    setCashReceived(mode === 'cash' || mode === 'split' ? due : 0)
    const id = window.setTimeout(() => {
      if (mode === 'cash' || mode === 'split') {
        cashReceivedRef.current?.focus()
        cashReceivedRef.current?.select()
      } else {
        cancelRef.current?.focus()
      }
    }, 0)
    return () => {
      window.clearTimeout(id)
      pollStopRef.current = true
    }
  }, [open, mode, due])

  async function runTeyaPoll(paymentRequestId: string) {
    pollStopRef.current = false
    setTeyaPaymentId(paymentRequestId)
    for (let i = 0; i < 90; i++) {
      if (pollStopRef.current) return
      const polled = await pollCardTerminalCharge(paymentRequestId)
      if (!polled.ok) {
        setLocalError(polled.message)
        setTerminalBusy(false)
        return
      }
      setTeyaStatus(polled.status)
      if (polled.done) {
        setTerminalBusy(false)
        if (polled.status === 'SUCCESSFUL') {
          setPosCardTerminalKind('teya')
          submitSale({
            providerRef: polled.providerRef,
            authCode: polled.authCode,
            kind: 'teya'
          })
          return
        }
        if (polled.status === 'CANCELLED') {
          setLocalError('A terminálfizetés megszakadt.')
          return
        }
        setLocalError('A terminálfizetés sikertelen.')
        return
      }
      await new Promise((r) => window.setTimeout(r, 1500))
    }
    setTerminalBusy(false)
    setLocalError('Időtúllépés — ellenőrizd a terminált, majd próbáld újra.')
  }

  async function launchTerminal(kind: PosCardTerminalKind) {
    setLocalError(null)
    setTerminalBusy(true)
    setTeyaStatus(null)
    const outcome = await startCardTerminalCharge({
      amountHuf: cardTender,
      orderRef: `pos-${Date.now()}`,
      kind,
      registerId
    })
    if (outcome.mode === 'error') {
      setLocalError(outcome.message)
      setTerminalBusy(false)
      return
    }
    if (outcome.mode === 'teya') {
      await runTeyaPoll(outcome.paymentRequestId)
      return
    }
    setTerminalBusy(false)
  }

  const tendersBuild = buildPosTenders({
    mode,
    due,
    cashMethodId,
    cardMethodId,
    cashAmount: mode === 'split' ? cashPart : undefined,
    paidAmount: mode === 'split' ? undefined : paidAmount
  })

  const tenders = tendersBuild.ok ? tendersBuild.tenders : []
  const cashTender = tenders.find((t) => t.kind === 'cash')?.amount ?? 0
  const cardTender = tenders.find((t) => t.kind === 'card')?.amount ?? 0
  const paidSum = tenders.reduce((s, t) => s + t.amount, 0)
  const isCredit = paidSum === 0
  const isPartial = paidSum > 0 && paidSum < due
  const change = posChangeDue(cashTender, cashReceived)
  const cashOk =
    cashTender <= 0 || Math.round(cashReceived) >= Math.round(cashTender)

  const modeLabel =
    mode === 'cash' ? 'Készpénz' : mode === 'card' ? 'Kártya' : 'Vegyes'

  function validateReview(): string | null {
    if (!tendersBuild.ok) return tendersBuild.message
    if (!cashOk) {
      return `A kapott összeg legyen legalább ${formatMoneyFt(cashTender)} Ft.`
    }
    const sum = tenders.reduce((s, t) => s + t.amount, 0)
    if (mode === 'split' && Math.abs(sum - due) > 0) {
      return 'A fizetések összege nem egyezik a fizetendővel.'
    }
    if (sum > due + 1) {
      return 'A fizetett összeg meghaladja a fizetendőt.'
    }
    return null
  }

  async function goNext() {
    const err = validateReview()
    if (err) {
      setLocalError(err)
      return
    }
    setLocalError(null)
    if (cardTender > 0) {
      setStep('terminal')
      await launchTerminal(terminalKind)
      return
    }
    submitSale(null)
  }

  function submitSale(card: {
    providerRef: string | null
    authCode: string | null
    kind: PosCardTerminalKind
  } | null) {
    if (!tendersBuild.ok) {
      setLocalError(tendersBuild.message)
      return
    }
    const noteParts: string[] = []
    if (card?.kind === 'teya') {
      noteParts.push(
        card.authCode
          ? `Teya auth: ${card.authCode}`
          : 'Teya: sikeres terminálfizetés'
      )
    } else if (card?.kind === 'manual') {
      noteParts.push(
        card.authCode
          ? `Terminál auth: ${card.authCode}`
          : 'Külső terminál: kezelő által megerősítve'
      )
    }
    onConfirm({
      payments: tenders.map((t) => ({
        paymentMethodId: t.paymentMethodId,
        amount: t.amount
      })),
      tenders,
      fulfillNow: tenders.length === 0,
      cardProviderRef: card?.providerRef ?? null,
      cardAuthCode: card?.authCode ?? null,
      cardTerminalKind: card?.kind ?? null,
      noteSuffix: noteParts.length ? noteParts.join(' · ') : null
    })
  }

  function finishTerminal() {
    if (terminalKind === 'teya' && teyaPaymentId && teyaStatus === 'SUCCESSFUL') {
      // már auto-submit pollból
      return
    }
    const result = confirmCardTerminalCharge({
      kind: terminalKind,
      amountHuf: cardTender,
      authCode
    })
    if (!result.ok) {
      setLocalError(result.message)
      return
    }
    setPosCardTerminalKind(terminalKind)
    submitSale({
      providerRef: result.providerRef,
      authCode: result.authCode,
      kind: result.kind
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (loading || terminalBusy) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        className={cn(
          'flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0',
          touch
            ? 'w-[min(96vw,1100px)] max-w-6xl sm:max-w-6xl'
            : 'max-w-5xl'
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-2.5 pr-10">
          <DialogTitle>
            {step === 'terminal' ? 'Kártyaterminál' : 'Eladás megerősítése'}
          </DialogTitle>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge
              tone={invoice ? 'info' : 'neutral'}
              variant={invoice ? 'solid' : 'outline'}
            >
              {invoice ? 'Számla' : 'Eladás'}
            </StatusBadge>
            <StatusBadge
              tone={mode === 'cash' ? 'success' : 'info'}
              variant="solid"
            >
              {modeLabel}
            </StatusBadge>
            <StatusBadge
              tone={customerName ? 'info' : 'neutral'}
              variant={customerName ? 'soft' : 'outline'}
            >
              {customerName ?? 'Vendég'}
            </StatusBadge>
            <StatusBadge tone="neutral" variant="outline">
              {warehouseName}
            </StatusBadge>
            {overstockCount > 0 ? (
              <StatusBadge tone="warning" variant="solid">
                {overstockCount} készlethiányos
              </StatusBadge>
            ) : null}
          </div>
          <p className="mt-1 text-hint text-ink-muted">
            {invoice
              ? 'A készlet azonnal csökken.'
              : 'Nem adóügyi nyugta — a hivatalos nyugtát a pénztárgépen állítsd ki.'}
          </p>
        </DialogHeader>

        {step === 'review' ? (
          <>
            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_1.15fr]">
              {/* Bal: tételek + kompakt összesítő */}
              <div className="flex min-h-0 min-w-0 flex-col border-b border-border md:border-b-0 md:border-r">
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  {invoice && billing ? (
                    <div className="mb-3 rounded-md border border-border bg-subtle/40 px-3 py-2.5">
                      <p className="mb-1 text-[12px] font-medium text-ink-secondary">
                        Számlázási adatok
                      </p>
                      <div className="space-y-0.5 text-body leading-relaxed text-ink">
                        {billing.billingName ? (
                          <p className="font-semibold">{billing.billingName}</p>
                        ) : null}
                        <p className="text-ink-secondary">
                          {[billing.billingPostalCode, billing.billingCity]
                            .filter(Boolean)
                            .join(' ')}
                        </p>
                        {billing.billingTaxNumber ? (
                          <p className="tabular-nums text-ink-secondary">
                            Adószám: {billing.billingTaxNumber}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <table className="w-full border-collapse text-body">
                    <thead>
                      <tr className="border-b border-border text-left text-label text-ink-secondary">
                        <th className="pb-2 pr-2 font-medium">Tétel</th>
                        <th className="w-14 pb-2 text-center font-medium">
                          Qty
                        </th>
                        <th className="w-[6.5rem] pb-2 text-right font-medium">
                          Bruttó
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const { before, final } = lineAmounts(line)
                        const hasDisc = line.discountPercentage > 0
                        const over =
                          line.onHand != null &&
                          line.quantity > line.onHand + 0.0001
                        return (
                          <tr
                            key={saleLineCartKey(line)}
                            className={cn(
                              'border-b border-border last:border-0',
                              over && 'bg-warning-soft/60'
                            )}
                          >
                            <td className="py-2 pr-2 align-top">
                              <div className="font-semibold text-ink">
                                {line.name}
                              </div>
                              <div className="mt-0.5 text-hint text-ink-secondary">
                                {line.sku}
                              </div>
                            </td>
                            <td className="py-2 text-center tabular-nums text-ink">
                              {line.quantity}{' '}
                              {saleUnitLabel(line.kind, line.unitShortform)}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {hasDisc ? (
                                <div className="flex flex-col items-end leading-tight">
                                  <span className="text-[12px] text-ink-muted line-through">
                                    {formatMoneyFt(before)} Ft
                                  </span>
                                  <span className="font-semibold text-warning-ink">
                                    {formatMoneyFt(final)} Ft
                                  </span>
                                </div>
                              ) : (
                                <span className="font-semibold text-ink">
                                  {formatMoneyFt(final)} Ft
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {fees.map((fee) => (
                        <tr
                          key={fee.key}
                          className="border-b border-border bg-subtle/40 last:border-0"
                        >
                          <td className="py-2 pr-2 font-semibold text-ink">
                            {fee.name}
                          </td>
                          <td className="py-2 text-center text-ink-muted">—</td>
                          <td className="py-2 text-right font-semibold tabular-nums text-ink">
                            {formatMoneyFt(Math.round(fee.unitPriceGross))} Ft
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="shrink-0 space-y-1 border-t border-border bg-subtle/40 px-4 py-2.5">
                  <SummaryRow
                    label="Nettó"
                    value={`${formatMoneyFt(baseTotals.totalNet)} Ft`}
                  />
                  <SummaryRow
                    label="ÁFA"
                    value={`${formatMoneyFt(baseTotals.totalVat)} Ft`}
                  />
                  {mode === 'cash' && cashRoundingAmount !== 0 ? (
                    <SummaryRow
                      label="KP kerekítés"
                      value={`${cashRoundingAmount > 0 ? '+' : ''}${formatMoneyFt(cashRoundingAmount)} Ft`}
                    />
                  ) : null}
                </div>
              </div>

              {/* Jobb: fizetés — eladó-first */}
              <div className="flex min-h-0 min-w-0 flex-col bg-subtle/30">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                  {/* Hero: fizetendő */}
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
                      Fizetendő
                    </p>
                    <p className="mt-0.5 text-[36px] font-semibold tabular-nums leading-none tracking-tight text-ink md:text-[40px]">
                      {formatMoneyFt(due)}{' '}
                      <span className="text-[20px] font-medium text-ink-secondary">
                        Ft
                      </span>
                    </p>
                    <p className="mt-1.5 text-hint text-ink-secondary">
                      {modeLabel}
                      {' · '}
                      {customerName ?? 'Vendég'}
                    </p>
                  </div>

                  {mode === 'split' ? (
                    <label className="block space-y-1.5">
                      <span className="text-[13px] font-medium text-ink">
                        Mennyit fizet készpénzzel?
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={Math.max(0, due - 1)}
                        className={cn(
                          'tabular-nums',
                          touch ? 'h-12 text-[20px]' : 'h-11 text-[16px]'
                        )}
                        value={cashPart || ''}
                        onChange={(e) =>
                          setCashPart(
                            Math.max(0, Math.round(Number(e.target.value) || 0))
                          )
                        }
                      />
                      <p className="text-hint text-ink-muted">
                        Kártya rész:{' '}
                        <span className="font-medium tabular-nums text-ink">
                          {formatMoneyFt(Math.max(0, due - cashPart))} Ft
                        </span>
                      </p>
                    </label>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[13px] font-medium text-ink">
                        Mennyit fizet most?
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { label: 'Teljes', value: due },
                            { label: 'Fél', value: Math.round(due / 2) },
                            { label: '0 Ft', value: 0 }
                          ] as const
                        ).map((tile) => {
                          const active = paidAmount === tile.value
                          return (
                            <button
                              key={tile.label}
                              type="button"
                              onClick={() => {
                                setPaidAmount(tile.value)
                                if (mode === 'cash') setCashReceived(tile.value)
                              }}
                              className={cn(
                                'flex h-12 flex-col items-center justify-center rounded-md border text-[13px] font-medium transition-colors',
                                touch && 'h-14 text-[15px]',
                                active
                                  ? 'border-ink bg-ink text-surface'
                                  : 'border-border bg-surface text-ink hover:border-border-strong hover:bg-subtle'
                              )}
                            >
                              {tile.label}
                              {tile.value > 0 && tile.label !== 'Teljes' ? (
                                <span
                                  className={cn(
                                    'text-[11px] tabular-nums font-normal',
                                    active ? 'text-surface/80' : 'text-ink-muted'
                                  )}
                                >
                                  {formatMoneyFt(tile.value)}
                                </span>
                              ) : null}
                            </button>
                          )
                        })}
                      </div>
                      <label className="block space-y-1">
                        <span className="text-hint text-ink-secondary">
                          Pontos összeg (Ft)
                        </span>
                        <Input
                          type="number"
                          min={0}
                          max={due}
                          className={cn(
                            'tabular-nums',
                            touch ? 'h-12 text-[20px]' : 'h-11 text-[16px]'
                          )}
                          value={paidAmount}
                          onChange={(e) => {
                            const n = Math.round(Number(e.target.value) || 0)
                            setPaidAmount(Math.max(0, Math.min(due, n)))
                            if (mode === 'cash') {
                              setCashReceived(Math.max(0, Math.min(due, n)))
                            }
                          }}
                        />
                      </label>
                      {isCredit ? (
                        <p className="rounded-md border border-warning/40 bg-warning-soft px-2.5 py-2 text-hint text-warning-ink">
                          Hitelre átadás — fizetetlen eladás, áru kimegy.
                        </p>
                      ) : isPartial ? (
                        <p className="rounded-md border border-border bg-surface px-2.5 py-2 text-hint text-ink-secondary">
                          Részfizetés · hátralék{' '}
                          <span className="font-semibold tabular-nums text-ink">
                            {formatMoneyFt(due - paidSum)} Ft
                          </span>
                        </p>
                      ) : null}
                    </div>
                  )}

                  {cashTender > 0 ? (
                    <div className="space-y-2 rounded-md border border-border bg-surface p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block space-y-1">
                          <span className="text-hint text-ink-secondary">
                            Kapott KP
                          </span>
                          <Input
                            ref={cashReceivedRef}
                            type="number"
                            inputMode="numeric"
                            min={cashTender}
                            className={cn(
                              'tabular-nums',
                              touch ? 'h-12 text-[20px]' : 'h-11 text-[16px]'
                            )}
                            value={cashReceived || ''}
                            onChange={(e) =>
                              setCashReceived(
                                Math.max(
                                  0,
                                  Math.round(Number(e.target.value) || 0)
                                )
                              )
                            }
                          />
                        </label>
                        <div className="flex flex-col justify-end">
                          <span className="text-hint text-ink-secondary">
                            Visszajáró
                          </span>
                          <p
                            className={cn(
                              'font-semibold tabular-nums tracking-tight',
                              touch ? 'text-[28px]' : 'text-[24px]',
                              cashOk ? 'text-success-ink' : 'text-danger-ink'
                            )}
                          >
                            {cashOk ? `${formatMoneyFt(change)} Ft` : '—'}
                          </p>
                        </div>
                      </div>
                      {touch ? (
                        <PosCashNumpad
                          value={cashReceived}
                          onChange={setCashReceived}
                        />
                      ) : null}
                      {touch ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-11"
                            onClick={() => setCashReceived(cashTender)}
                          >
                            Pontos összeg
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-11"
                            onClick={() => setCashReceived(0)}
                          >
                            Törlés
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {cardTender > 0 ? (
                    <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-body text-ink-secondary">
                      Következő: terminál ·{' '}
                      <span className="font-semibold tabular-nums text-ink">
                        {formatMoneyFt(cardTender)} Ft
                      </span>
                      {cardMethodName ? (
                        <span className="text-hint text-ink-muted">
                          {' '}
                          ({cardMethodName})
                        </span>
                      ) : null}
                    </p>
                  ) : null}

                  {localError ? (
                    <p className="text-body text-danger-ink" role="alert">
                      {localError}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:justify-end">
              <Button
                ref={cancelRef}
                type="button"
                variant="secondary"
                className={touch ? 'h-12 min-w-[6rem]' : 'h-11'}
                disabled={loading}
                onClick={() => onOpenChange(false)}
              >
                Mégse
              </Button>
              <Button
                type="button"
                className={
                  touch
                    ? 'h-12 min-w-[14rem] text-[15px]'
                    : 'h-11 min-w-[12rem]'
                }
                loading={loading}
                onClick={() => void goNext()}
              >
                {cardTender > 0
                  ? `Tovább a terminálhoz · ${formatMoneyFt(cardTender)} Ft`
                  : isCredit
                    ? 'Hitelre átadás'
                    : `Eladás rögzítése · ${formatMoneyFt(paidSum || due)} Ft`}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <p className="text-[28px] font-semibold tabular-nums tracking-tight text-ink">
                {formatMoneyFt(cardTender)} Ft
              </p>
              <p className="text-body text-ink-secondary">
                {terminalKind === 'teya'
                  ? 'Az összeg a Teya terminálra megy. Sikeres fizetés után az eladás automatikusan rögzül.'
                  : 'Indítsd a kártyaterminálon ezt az összeget. Sikeres fizetés után erősítsd meg — csak ezután rögzül az eladás.'}
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={terminalKind === 'teya' ? 'primary' : 'secondary'}
                  disabled={!teyaConfig?.teyaReady || terminalBusy}
                  onClick={() => {
                    setTerminalKind('teya')
                    void launchTerminal('teya')
                  }}
                >
                  Teya
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={terminalKind === 'manual' ? 'primary' : 'secondary'}
                  disabled={terminalBusy}
                  onClick={() => setTerminalKind('manual')}
                >
                  Kézi terminál
                </Button>
              </div>

              {!teyaConfig?.teyaReady ? (
                <p className="text-hint text-ink-muted">
                  Teya nincs bekötve.{' '}
                  <Link
                    href="/pos?beallitasok=1"
                    className="underline underline-offset-2"
                  >
                    POS beállítások
                  </Link>
                </p>
              ) : (
                <p className="text-hint text-ink-muted">
                  {terminalKind === 'teya'
                    ? `Teya POSLink · státusz: ${teyaStatus ?? 'indítás…'}`
                    : 'Külső banki terminál: írd be az összeget a gépen, majd erősítsd meg itt.'}
                </p>
              )}

              {terminalKind === 'manual' ? (
                <label className="block space-y-1">
                  <span className="text-hint text-ink-secondary">
                    Auth / bizonylat kód (opcionális)
                  </span>
                  <Input
                    className="h-11"
                    value={authCode}
                    placeholder="pl. engedélykód"
                    onChange={(e) => setAuthCode(e.target.value)}
                  />
                </label>
              ) : null}

              {localError ? (
                <p className="text-body text-danger-ink" role="alert">
                  {localError}
                </p>
              ) : null}
            </div>

            <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-11"
                disabled={loading}
                onClick={() => {
                  pollStopRef.current = true
                  if (teyaPaymentId) {
                    void cancelCardTerminalCharge(teyaPaymentId)
                  }
                  setTerminalBusy(false)
                  setStep('review')
                  setLocalError(null)
                }}
              >
                Vissza
              </Button>
              {terminalKind === 'teya' ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11"
                  disabled={loading || terminalBusy}
                  onClick={() => void launchTerminal('teya')}
                >
                  Újra
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-11 min-w-[10rem]"
                  loading={loading || terminalBusy}
                  onClick={finishTerminal}
                >
                  Sikeres — eladás rögzítése
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SummaryRow({
  label,
  value,
  tone
}: {
  label: string
  value: string
  tone?: 'warning'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-body">
      <span
        className={cn(
          tone === 'warning' ? 'text-warning-ink' : 'text-ink-secondary'
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'tabular-nums font-medium',
          tone === 'warning' ? 'text-warning-ink' : 'text-ink'
        )}
      >
        {value}
      </span>
    </div>
  )
}
