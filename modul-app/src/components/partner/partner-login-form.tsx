'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  partnerLoginAction,
  type PartnerAuthState
} from '@/lib/auth/partner-actions'
import {
  PARTNER_FORGOT_PASSWORD_PATH,
  PARTNER_REGISTER_PATH
} from '@/lib/auth/surface'
import { usePartnerHref } from '@/lib/auth/use-partner-href'

const initialState: PartnerAuthState = {}

export function PartnerLoginForm() {
  const [state, formAction, pending] = useActionState(
    partnerLoginAction,
    initialState
  )
  const href = usePartnerHref()

  return (
    <form action={formAction} className="flex w-full flex-col gap-3.5">
      <FormField label="Email" htmlFor="partner-email" required>
        <Input
          id="partner-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nev@email.hu"
        />
      </FormField>

      <FormField label="Jelszó" htmlFor="partner-password" required>
        <Input
          id="partner-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </FormField>

      <p className="text-right text-hint">
        <Link
          href={href(PARTNER_FORGOT_PASSWORD_PATH)}
          className="font-medium text-ink no-underline hover:underline"
        >
          Elfelejtetted a jelszavad?
        </Link>
      </p>

      {state.error ? (
        <p
          className="border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-hint text-danger-ink"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" loading={pending} className="w-full" size="md">
        Belépés
      </Button>

      <p className="text-center text-hint text-ink-secondary">
        Nincs még fiókod?{' '}
        <Link
          href={href(PARTNER_REGISTER_PATH)}
          className="font-medium text-ink no-underline hover:underline"
        >
          Regisztráció
        </Link>
      </p>
    </form>
  )
}
