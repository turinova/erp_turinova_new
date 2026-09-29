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
import type { CsoReadySmsCandidate } from '@/lib/sms/types'
import { cn } from '@/lib/utils'

const SKIP_LABEL: Record<string, string> = {
  bad_phone: 'Érvénytelen telefon',
  already_sent: 'Már elküldve',
  empty_body: 'Üres sablon',
  not_ready: 'Nincs átvehető tétel',
  user_declined: 'Kihagyva'
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: CsoReadySmsCandidate[]
  loading?: boolean
  onConfirm: (orderIds: string[]) => void
}

export function CsoReadySmsDialog({
  open,
  onOpenChange,
  candidates,
  loading = false,
  onConfirm
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const eligible = candidates.filter((c) => c.eligible)
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    const next = candidates.filter((c) => c.eligible).map((c) => c.orderId)
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
  const title =
    candidates.length === 1
      ? isResend
        ? 'SMS újraküldése?'
        : 'SMS az ügyfélnek?'
      : `SMS küldése (${candidates.length})`

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
            Ellenőrizd a szöveget és a számot. Sikertelen SMS nem vonja vissza a
            státuszt.
          </DialogDescription>
        </DialogHeader>

        {single ? (
          <div className="space-y-2">
            <div className="rounded-md border border-border bg-subtle px-2.5 py-2">
              <p className="text-hint font-medium text-ink-secondary">
                Előnézet
              </p>
              <p className="mt-1 whitespace-pre-wrap text-body text-ink">
                {single.previewBody || '—'}
              </p>
            </div>
            <p className="text-body text-ink">
              <span className="text-ink-secondary">Telefon: </span>
              {single.mobile || '—'}
            </p>
            {single.waitingCount > 0 ? (
              <p className="text-body text-warning-ink">
                Még {single.waitingCount} tétel úton van — részleges értesítő.
              </p>
            ) : null}
            {!single.eligible ? (
              <p className="text-body text-warning-ink">
                {SKIP_LABEL[single.skipReason ?? ''] ?? 'Nem küldhető'}
              </p>
            ) : null}
          </div>
        ) : (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto py-1">
            {candidates.map((c) => {
              const canSelect = c.eligible
              const checked = selected.includes(c.orderId)
              return (
                <li
                  key={c.orderId}
                  className={cn(
                    'rounded-md border border-border px-2.5 py-2',
                    !canSelect && 'bg-subtle opacity-80'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-3.5 accent-ink"
                      checked={checked}
                      disabled={!canSelect || loading}
                      onChange={() => toggle(c.orderId)}
                      aria-label={`SMS: ${c.orderNumber}`}
                    />
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
                        {c.waitingCount > 0
                          ? ` · ${c.waitingCount} még úton`
                          : ''}
                      </p>
                      {canSelect && c.previewBody ? (
                        <p className="mt-1 line-clamp-2 text-hint text-ink">
                          {c.previewBody}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {eligible.length === 0 && !loading ? (
          <p className="text-hint text-ink-secondary">
            Nincs küldhető SMS — javítsd a telefont vagy a sablont.
          </p>
        ) : null}

        {loading && candidates.length === 0 ? (
          <p className="text-hint text-ink-secondary">Előnézet betöltése…</p>
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
              single
                ? !single.eligible
                : selected.length === 0 || eligible.length === 0
            }
            onClick={() =>
              onConfirm(single ? [single.orderId] : selected)
            }
          >
            {single
              ? isResend
                ? 'SMS újraküldése'
                : 'SMS küldése'
              : selected.length > 0
                ? `SMS küldése (${selected.length})`
                : 'SMS küldése'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
