'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { addPosShiftCashMoveAction } from '@/lib/pos/shift-actions'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shiftId: string
  kind: 'in' | 'out'
  onDone: () => void
}

export function PosShiftCashMoveDialog({
  open,
  onOpenChange,
  shiftId,
  kind,
  onDone
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setAmount('')
    setNote(kind === 'out' ? 'Széf feladás' : 'KP betét')
    setError(null)
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, kind])

  function submit() {
    const n = Math.round(Number(amount))
    if (!Number.isFinite(n) || n <= 0) {
      setError('Adj meg pozitív összeget.')
      return
    }
    if (note.trim().length < 2) {
      setError('A megjegyzés kötelező.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await addPosShiftCashMoveAction({
        shiftId,
        kind,
        amount: n,
        note: note.trim()
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      onOpenChange(false)
      onDone()
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
      <DialogContent className="max-w-sm gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3 pr-10">
          <DialogTitle>
            {kind === 'out' ? 'KP feladás' : 'KP betét'}
          </DialogTitle>
          <p className="mt-1 text-hint text-ink-secondary">
            {kind === 'out'
              ? 'Készpénz kivétele a fiókból (pl. széf).'
              : 'Készpénz berakása a fiókba.'}
          </p>
        </DialogHeader>
        <div className="space-y-3 px-4 py-3">
          {error ? (
            <p
              className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger-ink"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div>
            <label
              className="mb-1 block text-[12px] font-medium text-ink-secondary"
              htmlFor="cash-move-amt"
            >
              Összeg (Ft) *
            </label>
            <Input
              id="cash-move-amt"
              type="number"
              min={1}
              className="h-10 tabular-nums"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setError(null)
              }}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-[12px] font-medium text-ink-secondary"
              htmlFor="cash-move-note"
            >
              Megjegyzés *
            </label>
            <Input
              id="cash-move-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setError(null)
              }}
              maxLength={200}
            />
          </div>
        </div>
        <DialogFooter className="border-t border-border px-4 py-3 sm:justify-end">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button type="button" loading={pending} onClick={submit}>
            Rögzítés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
