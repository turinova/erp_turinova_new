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
    } else {
      setCashPart(mode === 'cash' ? due : 0)
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
    cashAmount: mode === 'split' ? cashPart : undefined
  })

  const tenders = tendersBuild.ok ? tendersBuild.tenders : []
  const cashTender = tenders.find((t) => t.kind === 'cash')?.amount ?? 0
  const cardTender = tenders.find((t) => t.kind === 'card')?.amount ?? 0
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
    if (Math.abs(sum - due) > 0) {
      return 'A fizetések összege nem egyezik a fizetendővel.'
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
          'flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0',
          touch
            ? 'w-[calc(100vw-1rem)] max-w-2xl sm:max-w-2xl'
            : 'max-w-xl'
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-10">
          <DialogTitle>
            {step === 'terminal' ? 'Kártyaterminál' : 'Eladás megerősítése'}
          </DialogTitle>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
          {!invoice ? (
            <p className="mt-2 text-hint text-ink-secondary">
              Ez nem adóügyi nyugta. A hivatalos nyugtát az online
              pénztárgépen állítsd ki.
            </p>
          ) : (
            <p className="mt-2 text-hint text-ink-secondary">
              A készlet azonnal csökken. Ellenőrizd a tételeket és az összeget.
            </p>
          )}
        </DialogHeader>

        {step === 'review' ? (
          <>
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
              ) : (
                <p className="mb-3 text-hint text-ink-muted">
                  Nincs számla — csak belső eladásrögzítés (készlet + műszak).
                </p>
              )}

              <table className="w-full border-collapse text-body">
                <thead>
                  <tr className="border-b border-border text-left text-label text-ink-secondary">
                    <th className="pb-2 pr-2 font-medium">Tétel</th>
                    <th className="w-14 pb-2 text-center font-medium">Qty</th>
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
                        key={line.accessoryId}
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
                          {line.quantity} {line.unitShortform}
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

              <div className="mt-4 space-y-2 rounded-md border border-border bg-subtle/40 p-3">
                <p className="text-[12px] font-medium text-ink-secondary">
                  Fizetés
                </p>
                {mode === 'split' ? (
                  <label className="block space-y-1">
                    <span className="text-hint text-ink-secondary">
                      Készpénz rész ({cashMethodName || 'KP'})
                    </span>
                    <Input
                      type="number"
                      min={1}
                      max={Math.max(0, due - 1)}
                      className="h-11 tabular-nums"
                      value={cashPart || ''}
                      onChange={(e) =>
                        setCashPart(Math.max(0, Math.round(Number(e.target.value) || 0)))
                      }
                    />
                    <p className="text-hint text-ink-muted">
                      Kártya rész:{' '}
                      <span className="font-medium tabular-nums text-ink">
                        {formatMoneyFt(Math.max(0, due - cashPart))} Ft
                      </span>
                    </p>
                  </label>
                ) : null}

                {cashTender > 0 ? (
                  <div className="space-y-2">
                    <label className="block space-y-1">
                      <span className="text-hint text-ink-secondary">
                        Kapott készpénz
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
                            Math.max(0, Math.round(Number(e.target.value) || 0))
                          )
                        }
                      />
                      <p
                        className={cn(
                          'font-semibold tabular-nums',
                          touch ? 'text-[18px]' : 'text-[15px]',
                          cashOk ? 'text-ink' : 'text-danger-ink'
                        )}
                      >
                        Visszajáró:{' '}
                        {cashOk ? `${formatMoneyFt(change)} Ft` : '—'}
                      </p>
                    </label>
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
                  <p className="text-hint text-ink-secondary">
                    Kártya ({cardMethodName || 'Kártya'}):{' '}
                    <span className="font-semibold tabular-nums text-ink">
                      {formatMoneyFt(cardTender)} Ft
                    </span>
                    {' · '}
                    a következő lépésben a terminálon
                  </p>
                ) : null}
              </div>

              {localError ? (
                <p className="mt-3 text-body text-danger-ink" role="alert">
                  {localError}
                </p>
              ) : null}
            </div>

            <div className="shrink-0 space-y-1.5 border-t border-border bg-subtle/50 px-4 py-3">
              <SummaryRow
                label="Nettó összesen"
                value={`${formatMoneyFt(baseTotals.totalNet)} Ft`}
              />
              <SummaryRow
                label="ÁFA összesen"
                value={`${formatMoneyFt(baseTotals.totalVat)} Ft`}
              />
              {mode === 'cash' && cashRoundingAmount !== 0 ? (
                <SummaryRow
                  label="Készpénz kerekítés"
                  value={`${cashRoundingAmount > 0 ? '+' : ''}${formatMoneyFt(cashRoundingAmount)} Ft`}
                />
              ) : null}
              <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
                <span className="text-[13px] font-medium text-ink-secondary">
                  Fizetendő (bruttó)
                </span>
                <span className="text-[26px] font-semibold tabular-nums tracking-tight text-ink">
                  {formatMoneyFt(due)} Ft
                </span>
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
                className={touch ? 'h-12 min-w-[12rem] text-[15px]' : 'h-11 min-w-[10rem]'}
                loading={loading}
                onClick={() => void goNext()}
              >
                {cardTender > 0
                  ? 'Tovább a terminálhoz'
                  : `Eladás rögzítése · ${formatMoneyFt(due)} Ft`}
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
