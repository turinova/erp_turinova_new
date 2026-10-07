'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  claimPosCartHandoffAction,
  listOpenPosCartHandoffsAction
} from '@/lib/pos/handoff-actions'
import type { PosHandoffListItem } from '@/lib/pos/handoff-types'
import type { PosCartLine } from '@/lib/pos/session'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

export type HandoffClaimResult = {
  code: string
  warehouseId: string
  customerId: string | null
  lines: PosCartLine[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Current pult cart non-empty → ask replace/merge before claim. */
  hasExistingCart: boolean
  onClaimed: (
    result: HandoffClaimResult,
    mode: 'replace' | 'merge'
  ) => void
}

function relativeHu(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.max(0, Math.round(ms / 60_000))
  if (min < 1) return 'most'
  if (min < 60) return `${min} perce`
  const h = Math.round(min / 60)
  return `${h} órája`
}

export function PosHandoffInbox({
  open,
  onOpenChange,
  hasExistingCart,
  onClaimed
}: Props) {
  const [rows, setRows] = useState<PosHandoffListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pending, startTransition] = useTransition()
  /** Ask mode before server claim when pult cart is non-empty. */
  const [confirmRow, setConfirmRow] = useState<PosHandoffListItem | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await listOpenPosCartHandoffsAction()
    setLoading(false)
    if (!res.ok) {
      setError(res.message)
      setRows([])
      return
    }
    setRows(res.rows)
  }, [])

  useEffect(() => {
    if (!open) {
      setConfirmRow(null)
      return
    }
    void refresh()
  }, [open, refresh])

  function runClaim(id: string, mode: 'replace' | 'merge') {
    startTransition(async () => {
      setError(null)
      const res = await claimPosCartHandoffAction({ handoffId: id })
      if (!res.ok) {
        setError(res.message)
        setConfirmRow(null)
        void refresh()
        return
      }
      onClaimed(
        {
          code: res.code,
          warehouseId: res.warehouseId,
          customerId: res.customerId,
          lines: res.lines
        },
        mode
      )
      setConfirmRow(null)
      onOpenChange(false)
    })
  }

  function onAtvetel(row: PosHandoffListItem) {
    if (hasExistingCart) {
      setConfirmRow(row)
      return
    }
    runClaim(row.id, 'replace')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0',
          'w-[min(96vw,28rem)] max-w-md'
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-10">
          <DialogTitle>PDA kosarak</DialogTitle>
          <p className="mt-1 text-hint text-ink-muted">
            Válaszd ki, melyiket veszed át a pultra.
          </p>
        </DialogHeader>

        {confirmRow ? (
          <div className="space-y-3 px-4 py-4">
            <p className="text-body text-ink">
              A pulton már van kosár. Mit csináljunk a{' '}
              <span className="font-semibold tabular-nums">
                {confirmRow.code}
              </span>{' '}
              átvételével?
            </p>
            <DialogFooter className="!flex-col gap-2 sm:!flex-col">
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full"
                autoFocus
                disabled={pending}
                onClick={() => setConfirmRow(null)}
              >
                Mégse
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full"
                disabled={pending}
                loading={pending}
                onClick={() => runClaim(confirmRow.id, 'merge')}
              >
                Hozzáadás
              </Button>
              <Button
                type="button"
                className="h-11 w-full"
                disabled={pending}
                loading={pending}
                onClick={() => runClaim(confirmRow.id, 'replace')}
              >
                Felülírás
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {error ? (
                <p className="mb-2 text-body text-danger-ink" role="alert">
                  {error}
                </p>
              ) : null}
              {loading ? (
                <p className="text-body text-ink-muted">Betöltés…</p>
              ) : rows.length === 0 ? (
                <p className="text-body text-ink-muted">
                  Nincs várakozó PDA kosár.
                </p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[18px] font-semibold tabular-nums text-ink">
                          {r.code}
                        </p>
                        <p className="truncate text-hint text-ink-secondary">
                          {r.createdByName ?? 'Eladó'} ·{' '}
                          {relativeHu(r.createdAt)} · {r.lineCount} tétel
                        </p>
                        <p className="text-[14px] font-medium tabular-nums text-ink">
                          {formatMoneyFt(r.totalGross)} Ft
                        </p>
                      </div>
                      <Button
                        type="button"
                        className="h-11 shrink-0"
                        disabled={pending}
                        onClick={() => onAtvetel(r)}
                      >
                        Átvétel
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <DialogFooter className="shrink-0 border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="secondary"
                className="h-11"
                onClick={() => onOpenChange(false)}
              >
                Bezárás
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                disabled={loading || pending}
                onClick={() => void refresh()}
              >
                Frissítés
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
