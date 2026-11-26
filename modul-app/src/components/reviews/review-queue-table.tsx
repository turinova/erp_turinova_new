'use client'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatReviewWhen, formatReviewDate } from '@/lib/reviews/format'
import {
  cancelReviewSmsAction,
  postponeReviewSmsAction,
  sendReviewSmsNowAction
} from '@/lib/reviews/queue-actions'
import type { ReviewQueueRow } from '@/lib/reviews/queue-queries'
import {
  CANCEL_NOTE_MAX,
  MAX_POSTPONES,
  POSTPONE_DAY_OPTIONS,
  REVIEW_CANCEL_REASONS,
  REVIEW_CANCEL_REASON_LABEL,
  type PostponeDays,
  type ReviewCancelReason
} from '@/lib/reviews/queue-rules'
import { cn } from '@/lib/utils'

const COMPLAINT_NOTE = 'Panasz rendezés alatt'

export function ReviewQueueTable({
  rows,
  canWrite,
  manageAvailable
}: {
  rows: ReviewQueueRow[]
  canWrite: boolean
  manageAvailable: boolean
}) {
  const [postponeRow, setPostponeRow] = useState<ReviewQueueRow | null>(null)
  const [cancelRow, setCancelRow] = useState<ReviewQueueRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function sendNow(row: ReviewQueueRow) {
    setBusyId(row.id)
    startTransition(async () => {
      const res = await sendReviewSmsNowAction(row.id)
      setBusyId(null)
      if (res.ok) toast.success(res.message ?? 'SMS elküldve.')
      else toast.error(res.message)
    })
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-border bg-surface px-3 py-6 text-center text-body text-ink-secondary">
        Nincs ütemezett köszönő SMS. Átadás után itt jelennek meg.
      </p>
    )
  }

  const actionsDisabled = !canWrite || pending

  return (
    <>
      {!manageAvailable ? (
        <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-ink">
          A halasztáshoz és törléshez futtasd a{' '}
          <code className="text-hint">20261026_review_queue_manage.sql</code> migrációt.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full text-body">
          <thead className="border-b border-border text-left text-hint text-ink-secondary">
            <tr>
              <th className="px-3 py-2 font-medium">Vevő</th>
              <th className="px-3 py-2 font-medium">Rendelés</th>
              <th className="px-3 py-2 font-medium">Átadva</th>
              <th className="px-3 py-2 font-medium">Küldés</th>
              <th className="px-3 py-2 text-right font-medium">Műveletek</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <Link href={`/ugyfelek/${r.customerId}`} className="text-ink hover:underline">
                    {r.customerName}
                  </Link>
                  {r.customerMobile ? (
                    <span className="block text-hint tabular-nums text-ink-muted">{r.customerMobile}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {r.orderHref && r.orderNumber ? (
                    <Link href={r.orderHref} className="text-ink hover:underline">
                      {r.orderNumber}
                    </Link>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums text-ink-secondary">{formatReviewDate(r.handedOverAt)}</td>
                <td className="px-3 py-2 tabular-nums">
                  {formatReviewWhen(r.sendAfter)}
                  {r.postponedCount > 0 ? (
                    <span className="block text-hint text-ink-muted">
                      {r.postponedCount}× halasztva{r.cancelNote ? ` · ${r.cancelNote}` : ''}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={actionsDisabled || !manageAvailable || r.postponedCount >= MAX_POSTPONES}
                      onClick={() => setPostponeRow(r)}
                    >
                      Elhalasztás
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={actionsDisabled}
                      loading={busyId === r.id}
                      onClick={() => sendNow(r)}
                    >
                      Küldés most
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-danger-ink"
                      disabled={actionsDisabled || !manageAvailable}
                      onClick={() => setCancelRow(r)}
                    >
                      Törlés
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PostponeDialog row={postponeRow} onClose={() => setPostponeRow(null)} />
      <CancelDialog row={cancelRow} onClose={() => setCancelRow(null)} />
    </>
  )
}

function ChoiceButton({
  selected,
  onClick,
  children
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'rounded-md border px-3 py-2 text-left text-body transition-colors duration-fast',
        selected ? 'border-primary bg-subtle ring-1 ring-primary' : 'border-border hover:bg-subtle'
      )}
    >
      {children}
    </button>
  )
}

function PostponeDialog({ row, onClose }: { row: ReviewQueueRow | null; onClose: () => void }) {
  const [days, setDays] = useState<PostponeDays>(14)
  const [complaint, setComplaint] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!row) return
    startTransition(async () => {
      const res = await postponeReviewSmsAction(row.id, days, complaint ? COMPLAINT_NOTE : undefined)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(`Elhalasztva ${days} nappal.`)
      setComplaint(false)
      onClose()
    })
  }

  return (
    <Dialog open={row != null} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Köszönő SMS elhalasztása</DialogTitle>
          <DialogDescription>
            {row?.customerName} · legfeljebb {MAX_POSTPONES}-szor halasztható.
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Halasztás" className="grid grid-cols-3 gap-2">
          {POSTPONE_DAY_OPTIONS.map((d) => (
            <ChoiceButton key={d} selected={days === d} onClick={() => setDays(d)}>
              +{d} nap
            </ChoiceButton>
          ))}
        </div>
        <label className="flex items-start gap-2 text-body text-ink">
          <input
            type="checkbox"
            className="mt-1"
            checked={complaint}
            onChange={(e) => setComplaint(e.target.checked)}
          />
          <span>
            Panasz rendezés alatt
            <span className="block text-hint text-ink-secondary">
              Ha megoldjátok a gondját, a vevő később szívesebben értékel.
            </span>
          </span>
        </label>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} autoFocus>
            Mégse
          </Button>
          <Button type="button" onClick={submit} loading={pending}>
            Elhalasztás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CancelDialog({ row, onClose }: { row: ReviewQueueRow | null; onClose: () => void }) {
  const [reason, setReason] = useState<ReviewCancelReason | null>(null)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const cancelRef = useRef<HTMLButtonElement>(null)

  function close() {
    setReason(null)
    setNote('')
    onClose()
  }

  function submit() {
    if (!row || !reason) return
    startTransition(async () => {
      const res = await cancelReviewSmsAction(row.id, reason, note)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success('Köszönő SMS törölve.')
      close()
    })
  }

  return (
    <Dialog open={row != null} onOpenChange={(o) => (!o ? close() : null)}>
      <DialogContent
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Köszönő SMS törlése</DialogTitle>
          <DialogDescription>{row?.customerName} nem kapja meg ezt az értékelés-kérő SMS-t.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Törlés oka" className="grid gap-2">
          {REVIEW_CANCEL_REASONS.map((r) => (
            <ChoiceButton key={r} selected={reason === r} onClick={() => setReason(r)}>
              {REVIEW_CANCEL_REASON_LABEL[r]}
              {r === 'customer_request' ? (
                <span className="block text-hint text-ink-secondary">
                  Az értékelés-kérő SMS hozzájárulását is kikapcsoljuk.
                </span>
              ) : null}
            </ChoiceButton>
          ))}
        </div>
        <Input
          aria-label="Megjegyzés (nem kötelező)"
          placeholder="Megjegyzés (nem kötelező)"
          value={note}
          maxLength={CANCEL_NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="text-hint text-ink-secondary">
          Elégedetlen vevőnél inkább halaszd el: a Google tiltja, hogy csak az elégedetteket kérjük meg.
        </p>
        <DialogFooter>
          <Button ref={cancelRef} type="button" variant="secondary" onClick={close}>
            Mégse
          </Button>
          <Button type="button" variant="danger" disabled={!reason} loading={pending} onClick={submit}>
            Törlés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
