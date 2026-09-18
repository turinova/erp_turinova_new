'use client'

import { useActionState } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { loginAction, type LoginState } from '@/lib/auth/actions'

const initialState: LoginState = {}

type LoginFormProps = {
  showDevHint?: boolean
}

export function LoginForm({ showDevHint = false }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, initialState)

  return (
    <form action={formAction} className="flex w-full flex-col gap-3.5">
      <FormField label="Email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nev@ceg.hu"
        />
      </FormField>

      <FormField label="Jelszó" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
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

      {showDevHint ? (
        <p className="border border-border bg-subtle px-2.5 py-1.5 text-hint text-ink-secondary">
          Fejlesztői mód: bármilyen email + jelszó beléptet.
        </p>
      ) : (
        <p className="text-hint text-ink-muted">
          Ha máshol is be vagy lépve, az ottani belépés megszűnik.
        </p>
      )}

      <Button type="submit" loading={pending} className="w-full" size="md">
        Belépés
      </Button>
    </form>
  )
}
