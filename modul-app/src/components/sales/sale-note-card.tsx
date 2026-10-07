'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { updateSaleNoteAction } from '@/lib/sales/actions'

type Props = {
  salesOrderId: string
  note: string | null
  canWrite: boolean
}

export function SaleNoteCard({ salesOrderId, note, canWrite }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(note ?? '')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (open) setDraft(note ?? '')
  }, [open, note])

  function save() {
    startTransition(async () => {
      const trimmed = draft.trim()
      const res = await updateSaleNoteAction({
        salesOrderId,
        note: trimmed.length > 0 ? trimmed : null
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success('Megjegyzés mentve.')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="rounded-md border border-border bg-surface px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
              Megjegyzés
            </p>
            {note?.trim() ? (
              <p className="mt-1 whitespace-pre-wrap text-body text-ink-secondary">
                {note}
              </p>
            ) : (
              <p className="mt-1 text-body text-ink-muted">Nincs megjegyzés.</p>
            )}
          </div>
          {canWrite ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => setOpen(true)}
            >
              <Pencil className="size-3.5" aria-hidden />
              Szerkesztés
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-w-md gap-0 p-0">
          <DialogHeader className="border-b border-border px-4 py-3 pr-10">
            <DialogTitle>Megjegyzés szerkesztése</DialogTitle>
            <p className="mt-1 text-hint text-ink-muted">
              Belső megjegyzés — nem jelenik meg a számlán.
            </p>
          </DialogHeader>
          <div className="px-4 py-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 500))}
              rows={5}
              placeholder="Pl. ügyfél kérése, átvétel megjegyzés…"
              className="text-body"
              disabled={pending}
            />
            <p className="mt-1.5 text-right text-hint text-ink-muted">
              {draft.trim().length}/500
            </p>
          </div>
          <DialogFooter className="border-t border-border px-4 py-3 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              autoFocus
              onClick={() => setOpen(false)}
            >
              Mégse
            </Button>
            <Button type="button" loading={pending} onClick={save}>
              Megjegyzés mentése
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
