'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  partnerResetPasswordAction,
  type PartnerAuthState
} from '@/lib/auth/partner-actions'
import {
  PARTNER_FORGOT_PASSWORD_PATH,
  PARTNER_LOGIN_PATH
} from '@/lib/auth/surface'
import { usePartnerHref } from '@/lib/auth/use-partner-href'

const initialState: PartnerAuthState = {}

export function PartnerResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    partnerResetPasswordAction,
    initialState
  )
  const href = usePartnerHref()

  return (
    <form action={formAction} className="flex w-full flex-col gap-3.5">
      <FormField
        label="Új jelszó"
        htmlFor="reset-password"
        required
        hint={state.fieldErrors?.password ? undefined : 'Legalább 8 karakter.'}
        error={state.fieldErrors?.password}
      >
        <Input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
        />
      </FormField>

      <FormField
        label="Új jelszó még egyszer"
        htmlFor="reset-password-confirm"
        required
        error={state.fieldErrors?.confirm_password}
      >
        <Input
          id="reset-password-confirm"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
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

      <Button type="submit" loading={pending} className="w-full" size="md">
        Új jelszó mentése
      </Button>

      <p className="text-center text-hint text-ink-secondary">
        <Link
          href={href(PARTNER_LOGIN_PATH)}
          className="font-medium text-ink no-underline hover:underline"
        >
          Belépés
        </Link>
        {' · '}
        <Link
          href={href(PARTNER_FORGOT_PASSWORD_PATH)}
          className="font-medium text-ink no-underline hover:underline"
        >
          Új link kérése
        </Link>
      </p>
    </form>
  )
}
