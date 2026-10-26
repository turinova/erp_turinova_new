'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { QuoteReadySmsCandidate } from '@/lib/sms/types'
import { cn } from '@/lib/utils'

const SKIP_LABEL: Record<string, string> = {
  no_entitlement: 'Nincs add-on',
  no_opt_in: 'Nincs SMS opt-in',
  bad_phone: 'Érvénytelen telefon',
  already_sent: 'Már elküldve',
  no_customer: 'Nincs ügyfél',
  empty_body: 'Üres sablon',
  user_declined: 'Kihagyva'
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: QuoteReadySmsCandidate[]
  loading?: boolean
  /**
   * `mark-ready` — készre állítás + opcionális SMS (default).
   * `sms-only` — csak SMS (első / újraküldés a detailről).
   */
  mode?: 'mark-ready' | 'sms-only'
  onConfirm: (smsQuoteIds: string[]) => void
}

export function QuoteReadySmsDialog({
  open,
  onOpenChange,
  candidates,
  loading = false,
  mode = 'mark-ready',
  onConfirm
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const eligible = candidates.filter((c) => c.eligible)
  const [selected, setSelected] = useState<string[]>([])
  const smsOnly = mode === 'sms-only'

  useEffect(() => {
    if (!open) return
    const next = candidates.filter((c) => c.eligible).map((c) => c.quoteId)
    setSelected(next)
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, candidates])

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const single = candidates.length === 1 ? candidates[0] : null
  const isResend = Boolean(single?.alreadySentAt)
  const title = smsOnly
    ? candidates.length === 1
      ? isResend
        ? 'SMS újraküldése?'
        : 'SMS az ügyfélnek?'
      : `SMS küldése (${candidates.length})`
    : candidates.length === 1
      ? 'Készre állítás + SMS'
      : `Készre állítás (${candidates.length})`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[560px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {smsOnly
              ? 'Ellenőrizd a számot. Sikertelen SMS nem változtatja a státuszt.'
              : 'A megrendelés(ek) készre állnak. Pipáld azokat, amelyekhez SMS-t küldesz. Sikertelen SMS nem vonja vissza a kész státuszt.'}
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-64 space-y-1.5 overflow-y-auto py-1">
          {candidates.map((c) => {
            const canSelect = c.eligible
            const checked = selected.includes(c.quoteId)
            return (
              <li
                key={c.quoteId}
                className={cn(
                  'flex items-start gap-2 rounded-md border border-border px-2.5 py-2',
                  !canSelect && 'bg-subtle opacity-80'
                )}
              >
                {smsOnly && single ? null : (
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3.5 accent-ink"
                    checked={checked}
                    disabled={!canSelect || loading}
                    onChange={() => toggle(c.quoteId)}
                    aria-label={`SMS: ${c.orderNumber}`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-label font-semibold text-ink">
                    {c.orderNumber}{' '}
                    <span className="font-normal text-ink-secondary">
                      · {c.customerName}
                    </span>
                  </p>
                  <p className="text-hint text-ink-secondary">
                    {canSelect
                      ? c.mobile || '—'
                      : SKIP_LABEL[c.skipReason ?? ''] ?? 'Nem küldhető'}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>

        {eligible.length === 0 ? (
          <p className="text-hint text-ink-secondary">
            {smsOnly
              ? 'Nincs küldhető SMS — javítsd a telefont, opt-int vagy a sablont.'
              : 'Nincs SMS-re jogosult ügyfél — a készre állítás SMS nélkül megy.'}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={loading}
            disabled={
              smsOnly
                ? single
                  ? !single.eligible
                  : selected.length === 0 || eligible.length === 0
                : false
            }
            onClick={() =>
              onConfirm(
                smsOnly && single ? [single.quoteId] : selected
              )
            }
          >
            {smsOnly
              ? single
                ? isResend
                  ? 'SMS újraküldése'
                  : 'SMS küldése'
                : selected.length > 0
                  ? `SMS küldése (${selected.length})`
                  : 'SMS küldése'
              : selected.length > 0
                ? `Készre állítás + ${selected.length} SMS`
                : 'Készre állítás SMS nélkül'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
