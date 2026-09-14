'use client'

import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  changePartnerPasswordAction,
  type PartnerSettingsState
} from '@/lib/auth/partner-settings-actions'

const initial: PartnerSettingsState = {}

export function PartnerPasswordForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    changePartnerPasswordAction,
    initial
  )

  useEffect(() => {
    if (!state.message) return
    if (state.ok) {
      toast.success(state.message)
      formRef.current?.reset()
    } else {
      toast.error(state.message)
    }
  }, [state])

  const fe = state.fieldErrors ?? {}

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-md border border-border bg-surface p-3"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-ink">Jelszó</h2>
        <Button type="submit" size="sm" loading={pending}>
          Módosítás
        </Button>
      </div>

      <div className="grid gap-2">
        <FormField
          label="Jelenlegi"
          htmlFor="current_password"
          required
          error={fe.current_password}
        >
          <Input
            id="current_password"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
          />
        </FormField>
        <FormField
          label="Új jelszó"
          htmlFor="new_password"
          required
          error={fe.new_password}
        >
          <Input
            id="new_password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="min. 8 karakter"
          />
        </FormField>
        <FormField
          label="Új jelszó újra"
          htmlFor="confirm_password"
          required
          error={fe.confirm_password}
        >
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </FormField>
      </div>
    </form>
  )
}
