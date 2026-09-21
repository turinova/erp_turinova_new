'use client'

import { useState, useTransition, type ReactNode } from 'react'

import { submitContactLeadAction } from '@/lib/marketing/contact-actions'
import {
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164
} from '@/lib/marketing/pricing'

/** Főoldali záró CTA — rövid visszahívás kérés. */
export function HomeCtaForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  if (done) {
    return (
      <div className="w-full rounded-2xl bg-white p-8 text-center">
        <p className="text-lg font-medium text-zinc-900">Megvan, felírtuk</p>
        <p className="mt-2 text-sm text-zinc-500">
          Visszahívunk a megadott számon. Ha addig kérdésed van:{' '}
          <a
            href={`tel:${SUPPORT_PHONE_E164}`}
            className="font-medium text-zinc-900 no-underline hover:underline"
          >
            {SUPPORT_PHONE_DISPLAY}
          </a>
        </p>
      </div>
    )
  }

  return (
    <form
      className="w-full rounded-2xl bg-white p-6 text-left sm:p-8"
      onSubmit={(e) => {
        e.preventDefault()
        setFormError(null)
        setFieldErrors({})
        startTransition(async () => {
          const res = await submitContactLeadAction({
            firstName: name,
            email,
            phone,
            company
          })
          if (!res.ok) {
            setFormError(res.message)
            setFieldErrors(res.fieldErrors ?? {})
            return
          }
          setDone(true)
        })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Név" htmlFor="cta-name" error={fieldErrors.firstName}>
          <input
            id="cta-name"
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="E-mail" htmlFor="cta-email" error={fieldErrors.email}>
          <input
            id="cta-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field
          label="Telefonszám"
          htmlFor="cta-phone"
          error={fieldErrors.phone}
        >
          <input
            id="cta-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field
          label="Cégnév"
          htmlFor="cta-company"
          error={fieldErrors.company}
        >
          <input
            id="cta-company"
            name="company"
            autoComplete="organization"
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      {formError ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-orange-500 px-5 text-base font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
      >
        {pending ? 'Küldés…' : 'Kérem a visszahívást'}
      </button>
      <p className="mt-3 text-center text-xs text-zinc-500">
        Hétköznap jellemzően még aznap visszahívunk.
      </p>
    </form>
  )
}

const inputClass =
  'h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors hover:border-zinc-300 focus:border-orange-500'

function Field({
  label,
  htmlFor,
  error,
  children
}: {
  label: string
  htmlFor: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[13px] font-medium text-zinc-700"
      >
        {label}
        <span className="ml-0.5 text-orange-500" aria-hidden>
          *
        </span>
      </label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
