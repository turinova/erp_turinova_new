'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'

import { submitContactLeadAction } from '@/lib/marketing/contact-actions'
import {
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164
} from '@/lib/marketing/pricing'

const PRIVACY_URL =
  process.env.NEXT_PUBLIC_LEGAL_PRIVACY_URL?.trim() || undefined

/** Főoldali várólista CTA — ugyanaz a lead pipeline, mint /kapcsolat. */
export function HomeCtaForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [website, setWebsite] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()
  const openedAt = useRef(Date.now())

  useEffect(() => {
    openedAt.current = Date.now()
  }, [])

  if (done) {
    return (
      <div className="w-full rounded-2xl bg-white p-8 text-center">
        <p className="text-lg font-medium text-zinc-900">
          Feliratkozás rögzítve
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Az induláskor (2027 Q2) e-mailben tájékoztatunk. Kérdés esetén:{' '}
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
      className="relative w-full rounded-2xl bg-white p-6 text-left sm:p-8"
      autoComplete="on"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (pending) return
        setFormError(null)
        setFieldErrors({})
        startTransition(async () => {
          const res = await submitContactLeadAction({
            fullName,
            email,
            phone,
            company,
            website,
            formOpenedAt: openedAt.current,
            source: 'optinova-varolista'
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
      <div
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
        aria-hidden
      >
        <label htmlFor="cta-website">Website</label>
        <input
          id="cta-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Telefonszám"
          htmlFor="cta-phone"
          error={fieldErrors.phone}
          hint="Kapcsolattartáshoz"
        >
          <input
            id="cta-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="+36 30 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.phone)}
          />
        </Field>
        <Field label="Név" htmlFor="cta-name" error={fieldErrors.fullName}>
          <input
            id="cta-name"
            name="name"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            spellCheck={false}
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.fullName)}
          />
        </Field>
        <Field label="E-mail" htmlFor="cta-email" error={fieldErrors.email}>
          <input
            id="cta-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            placeholder="nev@ceg.hu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.email)}
          />
        </Field>
        <Field
          label="Cégnév"
          htmlFor="cta-company"
          error={fieldErrors.company}
          hint="Egyéni vállalkozó vagy magánszemély is megadható"
        >
          <input
            id="cta-company"
            name="organization"
            type="text"
            autoComplete="organization"
            autoCapitalize="words"
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.company)}
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
        {pending ? 'Küldés…' : 'Feliratkozás a várólistára'}
      </button>
      <p className="mt-3 text-center text-xs leading-relaxed text-zinc-500">
        Indulás: 2027 Q2. A megadott adatokat a várólista kapcsán kezeljük.
        {PRIVACY_URL ? (
          <>
            {' '}
            <a
              href={PRIVACY_URL}
              className="font-medium text-zinc-800 no-underline underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Adatkezelés
            </a>
          </>
        ) : null}
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
  hint,
  children
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
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
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  )
}
