'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  partnerForgotPasswordAction,
  type PartnerAuthState
} from '@/lib/auth/partner-actions'
import { PARTNER_LOGIN_PATH } from '@/lib/auth/surface'
import { usePartnerHref } from '@/lib/auth/use-partner-href'

const initialState: PartnerAuthState = {}

export function PartnerForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    partnerForgotPasswordAction,
    initialState
  )
  const href = usePartnerHref()

  return (
    <form action={formAction} className="flex w-full flex-col gap-3.5">
      <FormField
        label="Email"
        htmlFor="forgot-email"
        required
        hint="A regisztrációnál használt címed."
      >
        <Input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nev@email.hu"
        />
      </FormField>

      {state.error ? (
        <p
          className="border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-hint text-danger-ink"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p
          className="border border-border bg-subtle px-2.5 py-1.5 text-hint text-ink-secondary"
          role="status"
        >
          {state.success}
        </p>
      ) : null}

      <Button type="submit" loading={pending} className="w-full" size="md">
        Küldés
      </Button>

      <p className="text-center text-hint text-ink-secondary">
        <Link
          href={href(PARTNER_LOGIN_PATH)}
          className="font-medium text-ink no-underline hover:underline"
        >
          Vissza a belépéshez
        </Link>
      </p>
    </form>
  )
}
