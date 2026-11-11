'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState, useTransition } from 'react'

import { PartnerResendConfirmation } from '@/components/partner/partner-resend-confirmation'
import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  checkPartnerMustSetPasswordAction,
  partnerClaimPasswordAction,
  partnerLoginAction,
  type PartnerAuthState
} from '@/lib/auth/partner-actions'
import {
  PARTNER_FORGOT_PASSWORD_PATH,
  PARTNER_REGISTER_PATH
} from '@/lib/auth/surface'
import { usePartnerHref } from '@/lib/auth/use-partner-href'

const initialState: PartnerAuthState = {}
const initialClaimState: PartnerAuthState = {}

export function PartnerLoginForm() {
  const [state, formAction, pending] = useActionState(
    partnerLoginAction,
    initialState
  )
  const [claimState, claimAction, claimPending] = useActionState(
    partnerClaimPasswordAction,
    initialClaimState
  )
  const href = usePartnerHref()
  const [email, setEmail] = useState('')
  const [setupMode, setSetupMode] = useState(false)
  const [requireMobileLast4, setRequireMobileLast4] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (state.needsPasswordSetup) {
      setSetupMode(true)
      if (state.requireMobileLast4) setRequireMobileLast4(true)
    }
  }, [state.needsPasswordSetup, state.requireMobileLast4])

  useEffect(() => {
    if (claimState.needsPasswordSetup) {
      setSetupMode(true)
      if (claimState.requireMobileLast4) setRequireMobileLast4(true)
    }
  }, [claimState.needsPasswordSetup, claimState.requireMobileLast4])

  function onEmailBlur() {
    const value = email.trim()
    if (!value) return
    startTransition(async () => {
      const result = await checkPartnerMustSetPasswordAction(value)
      if (result.needsPasswordSetup) {
        setSetupMode(true)
        setRequireMobileLast4(result.requireMobileLast4)
      }
    })
  }

  const inSetupMode =
    setupMode ||
    Boolean(state.needsPasswordSetup) ||
    Boolean(claimState.needsPasswordSetup)

  const showMobile =
    requireMobileLast4 ||
    Boolean(state.requireMobileLast4) ||
    Boolean(claimState.requireMobileLast4)

  if (inSetupMode) {
    return (
      <form action={claimAction} className="flex w-full flex-col gap-3.5">
        <p
          className="border border-border bg-subtle px-2.5 py-1.5 text-hint text-ink-secondary"
          role="status"
        >
          Egyszer be kell állítanod a jelszavad az új felülethez. Írd be az új
          jelszót, és utána rögtön belépsz. Ehhez nem kell email.
        </p>

        <FormField
          label="Email"
          htmlFor="partner-claim-email"
          required
          error={claimState.fieldErrors?.email}
        >
          <Input
            id="partner-claim-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nev@email.hu"
          />
        </FormField>

        {showMobile ? (
          <FormField
            label="Telefonszám utolsó 4 számjegye"
            htmlFor="partner-claim-mobile4"
            required
            hint="A regisztrációnál megadott mobil utolsó 4 számjegye."
            error={claimState.fieldErrors?.mobile_last4}
          >
            <Input
              id="partner-claim-mobile4"
              name="mobile_last4"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={4}
              pattern="[0-9]{4}"
              placeholder="1234"
            />
          </FormField>
        ) : null}

        <FormField
          label="Új jelszó"
          htmlFor="partner-claim-password"
          required
          hint="Legalább 8 karakter."
          error={claimState.fieldErrors?.password}
        >
          <Input
            id="partner-claim-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="••••••••"
          />
        </FormField>

        <FormField
          label="Új jelszó mégegyszer"
          htmlFor="partner-claim-confirm"
          required
          error={claimState.fieldErrors?.confirm_password}
        >
          <Input
            id="partner-claim-confirm"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="••••••••"
          />
        </FormField>

        {claimState.error ? (
          <p
            className="border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-hint text-danger-ink"
            role="alert"
          >
            {claimState.error}
          </p>
        ) : null}

        <Button
          type="submit"
          loading={claimPending}
          className="w-full"
          size="md"
        >
          Jelszó beállítása és belépés
        </Button>

        <p className="text-center text-hint text-ink-secondary">
          <button
            type="button"
            className="font-medium text-ink underline-offset-2 hover:underline"
            onClick={() => {
              setSetupMode(false)
              setRequireMobileLast4(false)
            }}
          >
            Van már jelszavam, belépek
          </button>
        </p>

        <p className="text-center text-hint text-ink-secondary">
          <Link
            href={href(PARTNER_FORGOT_PASSWORD_PATH)}
            className="font-medium text-ink no-underline hover:underline"
          >
            Elfelejtetted a jelszavad?
          </Link>
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

      {state.needsEmailConfirmation && state.confirmEmail ? (
        <PartnerResendConfirmation
          key={state.confirmEmail}
          email={state.confirmEmail}
        />
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
