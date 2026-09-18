'use client'

import { useEffect, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getLastClosedCashAction,
  openPosShiftAction
} from '@/lib/pos/shift-actions'
import { formatMoneyFt } from '@/lib/sales/parse'

type Props = {
  registerId: string
  registerName: string
  onOpened: (shiftId: string) => void
}

export function PosShiftGate({ registerId, registerName, onOpened }: Props) {
  const [opening, setOpening] = useState('0')
  const [lastCash, setLastCash] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    void getLastClosedCashAction(registerId).then((r) => {
      if (cancelled || !r.ok) return
      setLastCash(r.amount)
      if (r.amount != null) setOpening(String(Math.round(r.amount)))
    })
    return () => {
      cancelled = true
    }
  }, [registerId])

  function submit() {
    const n = Math.round(Number(opening))
    if (!Number.isFinite(n) || n < 0) {
      setError('Érvénytelen nyitó összeg.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await openPosShiftAction(registerId, n)
      if (!result.ok) {
        setError(result.message)
        return
      }
      if (result.id) onOpened(result.id)
    })
  }

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-md border border-border bg-surface p-4">
        <div>
          <h1 className="text-h1 text-ink">Műszak megnyitása</h1>
          <p className="mt-1 text-body text-ink-secondary">
            Belsős elszámolás · {registerName}
          </p>
          <p className="mt-2 text-hint text-ink-muted">
            Add meg a fiókban lévő nyitó készpénzt (váltópénz).
          </p>
        </div>
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
            htmlFor="pos-open-cash"
          >
            Nyitó készpénz (Ft) *
          </label>
          <Input
            id="pos-open-cash"
            type="number"
            min={0}
            step={1}
            className="h-11 text-[17px] tabular-nums"
            value={opening}
            onChange={(e) => {
              setOpening(e.target.value)
              setError(null)
            }}
          />
        </div>
        {lastCash != null ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={pending}
            onClick={() => setOpening(String(Math.round(lastCash)))}
          >
            Előző záró: {formatMoneyFt(lastCash)} Ft
          </Button>
        ) : null}
        <Button
          type="button"
          className="h-11 w-full"
          loading={pending}
          onClick={submit}
        >
          Műszak megnyitása
        </Button>
      </div>
    </div>
  )
}
