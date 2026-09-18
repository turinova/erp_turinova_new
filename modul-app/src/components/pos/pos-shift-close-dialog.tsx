'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

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
import {
  closePosShiftAction,
  previewPosShiftExpectedAction
} from '@/lib/pos/shift-actions'
import type { PosShiftExpected } from '@/lib/pos/shifts'
import { formatMoneyFt } from '@/lib/sales/parse'

const HU_DENOMS = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shiftId: string
  onClosed: () => void
}

export function PosShiftCloseDialog({
  open,
  onOpenChange,
  shiftId,
  onClosed
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [pending, startTransition] = useTransition()
  const [exp, setExp] = useState<PosShiftExpected | null>(null)
  const [countedCash, setCountedCash] = useState('')
  const [countedCard, setCountedCard] = useState('')
  const [note, setNote] = useState('')
  const [showDenom, setShowDenom] = useState(false)
  const [denoms, setDenoms] = useState<Record<number, number>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNote('')
    setShowDenom(false)
    setDenoms({})
    setError(null)
    void previewPosShiftExpectedAction(shiftId).then((r) => {
      if (!r.ok) {
        setError(r.message)
        return
      }
      setExp(r.data)
      setCountedCash(String(Math.round(r.data.expected_cash)))
      setCountedCard(String(Math.round(r.data.expected_card)))
    })
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, shiftId])

  const countedN = Math.round(Number(countedCash) || 0)
  const expectedN = exp ? Math.round(exp.expected_cash) : 0
  const diff = countedN - expectedN
  const needsNote = Math.abs(diff) >= 1

  useEffect(() => {
    if (!showDenom) return
    let sum = 0
    for (const d of HU_DENOMS) {
      sum += (denoms[d] || 0) * d
    }
    setCountedCash(String(sum))
  }, [denoms, showDenom])

  function submit() {
    if (!exp) return
    if (needsNote && note.trim().length < 3) {
      setError('Eltérés esetén írd meg az okot.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await closePosShiftAction({
        shiftId,
        countedCash: countedN,
        countedCard: Math.round(Number(countedCard) || 0),
        note: needsNote ? note.trim() : null,
        denominationJson: showDenom
          ? Object.fromEntries(
              Object.entries(denoms)
                .filter(([, q]) => q > 0)
                .map(([k, q]) => [k, q])
            )
          : null
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      onOpenChange(false)
      onClosed()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-10">
          <DialogTitle>Műszakzárás</DialogTitle>
          <p className="mt-1 text-hint text-ink-secondary">
            Belsős elszámolás — számold meg a fiókban lévő készpénzt.
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {error ? (
            <p
              className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger-ink"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {exp ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge tone="neutral" variant="outline">
                  {exp.sales_count} eladás
                </StatusBadge>
                <StatusBadge tone="neutral" variant="outline">
                  {formatMoneyFt(exp.sales_gross_sum)} Ft forgalom
                </StatusBadge>
                {exp.returns_count > 0 ? (
                  <StatusBadge tone="warning" variant="soft">
                    {exp.returns_count} visszáru
                  </StatusBadge>
                ) : null}
              </div>

              <div className="rounded-md border border-border p-3">
                <p className="text-[12px] font-medium text-ink-secondary">
                  Készpénz
                </p>
                <div className="mt-1 flex justify-between text-body">
                  <span className="text-ink-secondary">Elvárt</span>
                  <span className="font-semibold tabular-nums">
                    {formatMoneyFt(exp.expected_cash)} Ft
                  </span>
                </div>
                <div className="mt-2">
                  <label
                    className="mb-1 block text-[12px] font-medium text-ink-secondary"
                    htmlFor="close-cash"
                  >
                    Számolt (Ft) *
                  </label>
                  <Input
                    id="close-cash"
                    type="number"
                    className="h-10 tabular-nums"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[12px] text-ink-secondary">Eltérés</span>
                  <StatusBadge
                    tone={
                      diff === 0 ? 'success' : diff < 0 ? 'danger' : 'warning'
                    }
                    variant="solid"
                  >
                    {diff === 0
                      ? 'OK'
                      : `${diff > 0 ? '+' : ''}${formatMoneyFt(diff)} Ft`}
                  </StatusBadge>
                </div>
                <button
                  type="button"
                  className="mt-2 text-hint font-medium text-ink-secondary underline-offset-2 hover:underline"
                  onClick={() => setShowDenom((v) => !v)}
                >
                  {showDenom ? 'Címletezés elrejtése' : 'Címletezés'}
                </button>
                {showDenom ? (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {HU_DENOMS.map((d) => (
                      <label key={d} className="text-hint text-ink-secondary">
                        {formatMoneyFt(d)}
                        <Input
                          type="number"
                          min={0}
                          className="mt-0.5 h-8"
                          value={denoms[d] ?? ''}
                          onChange={(e) => {
                            const n = Math.max(0, Math.floor(Number(e.target.value) || 0))
                            setDenoms((prev) => ({ ...prev, [d]: n }))
                          }}
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-md border border-border p-3">
                <p className="text-[12px] font-medium text-ink-secondary">
                  Kártya
                </p>
                <div className="mt-1 flex justify-between text-body">
                  <span className="text-ink-secondary">Elvárt</span>
                  <span className="tabular-nums">
                    {formatMoneyFt(exp.expected_card)} Ft
                  </span>
                </div>
                <div className="mt-2">
                  <label
                    className="mb-1 block text-[12px] font-medium text-ink-secondary"
                    htmlFor="close-card"
                  >
                    Számolt (Ft)
                  </label>
                  <Input
                    id="close-card"
                    type="number"
                    className="h-10 tabular-nums"
                    value={countedCard}
                    onChange={(e) => setCountedCard(e.target.value)}
                  />
                </div>
              </div>

              {needsNote ? (
                <div>
                  <label
                    className="mb-1 block text-[12px] font-medium text-ink-secondary"
                    htmlFor="close-note"
                  >
                    Eltérés oka *
                  </label>
                  <Input
                    id="close-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Pl. téves visszajáró, hiány…"
                    maxLength={500}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-body text-ink-secondary">Számolás…</p>
          )}
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
            loading={pending}
            disabled={!exp}
            onClick={submit}
          >
            Műszak lezárása
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
