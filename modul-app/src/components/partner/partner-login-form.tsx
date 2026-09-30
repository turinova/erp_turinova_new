'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState, useTransition } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  checkPartnerMustSetPasswordAction,
  partnerForgotPasswordAction,
  partnerLoginAction,
  type PartnerAuthState
} from '@/lib/auth/partner-actions'
import {
  PARTNER_FORGOT_PASSWORD_PATH,
  PARTNER_REGISTER_PATH
} from '@/lib/auth/surface'
import { usePartnerHref } from '@/lib/auth/use-partner-href'

const initialState: PartnerAuthState = {}
const initialSetupState: PartnerAuthState = {}

export function PartnerLoginForm() {
  const [state, formAction, pending] = useActionState(
    partnerLoginAction,
    initialState
  )
  const [setupState, setupAction, setupPending] = useActionState(
    partnerForgotPasswordAction,
    initialSetupState
  )
  const href = usePartnerHref()
  const [email, setEmail] = useState('')
  const [setupMode, setSetupMode] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (state.needsPasswordSetup) setSetupMode(true)
  }, [state.needsPasswordSetup])

  function onEmailBlur() {
    const value = email.trim()
    if (!value) return
    startTransition(async () => {
      const result = await checkPartnerMustSetPasswordAction(value)
      if (result.needsPasswordSetup) setSetupMode(true)
    })
  }

  const inSetupMode = setupMode || Boolean(state.needsPasswordSetup)

  if (inSetupMode) {
    return (
      <form action={setupAction} className="flex w-full flex-col gap-3.5">
        <p
          className="border border-border bg-subtle px-2.5 py-1.5 text-hint text-ink-secondary"
          role="status"
        >
          Egyszer be kell állítanod a jelszavad az új felülethez. Küldünk egy
          linket az emailedre — utána beléphetsz.
        </p>

        <FormField label="Email" htmlFor="partner-setup-email" required>
          <Input
            id="partner-setup-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nev@email.hu"
          />
        </FormField>

        {setupState.error ? (
          <p
            className="border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-hint text-danger-ink"
            role="alert"
          >
            {setupState.error}
          </p>
        ) : null}

        {setupState.success ? (
          <p
            className="border border-border bg-subtle px-2.5 py-1.5 text-hint text-ink-secondary"
            role="status"
          >
            {setupState.success}
          </p>
        ) : null}

        <Button
          type="submit"
          loading={setupPending}
          className="w-full"
          size="md"
        >
          Jelszó beállítása
        </Button>

        <p className="text-center text-hint text-ink-secondary">
          <button
            type="button"
            className="font-medium text-ink underline-offset-2 hover:underline"
            onClick={() => setSetupMode(false)}
          >
            Van már jelszavam — belépés
          </button>
        </p>
      </form>
    )
  }

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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={onEmailBlur}
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
