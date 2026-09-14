'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
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
import {
  deletePartnerAccountAction,
  type PartnerSettingsState
} from '@/lib/auth/partner-settings-actions'

const initial: PartnerSettingsState = {}

export function PartnerDeleteAccount() {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [pending, startTransition] = useTransition()
  const [state, formAction] = useActionState(
    deletePartnerAccountAction,
    initial
  )

  useEffect(() => {
    if (state.message && !state.ok) {
      toast.error(state.message)
    }
  }, [state])

  function onConfirm() {
    const fd = new FormData()
    fd.set('confirm_text', confirmText)
    fd.set('password', password)
    startTransition(() => {
      formAction(fd)
    })
  }

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger/30 bg-surface px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold text-ink">Fiók törlése</h2>
          <p className="text-hint text-ink-secondary">
            Végleges. A kapcsolt cégnél már beküldött ajánlatok megmaradnak.
          </p>
        </div>
        <Button
          type="button"
          variant="danger"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setConfirmText('')
            setPassword('')
            setOpen(true)
          }}
        >
          Törlés…
        </Button>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Végleg törlöd a fiókodat?</DialogTitle>
            <DialogDescription>
              Írd be: TORLES, majd a jelszavad. A beküldött ajánlatok a cégnél
              megmaradnak.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-1 sm:grid-cols-2">
            <FormField
              label="Megerősítés"
              htmlFor="delete-confirm"
              required
              hint="Pontosan: TORLES"
            >
              <Input
                id="delete-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                placeholder="TORLES"
              />
            </FormField>
            <FormField label="Jelszó" htmlFor="delete-password" required>
              <Input
                id="delete-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setOpen(false)}
              autoFocus
            >
              Mégse
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={pending}
              disabled={confirmText !== 'TORLES' || !password}
              onClick={onConfirm}
            >
              Fiók törlése
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
