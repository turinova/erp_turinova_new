'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { submitContactLeadAction } from '@/lib/marketing/contact-actions'
import { formatPhoneInput } from '@/lib/marketing/phone'
import {
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164
} from '@/lib/marketing/pricing'
import { cn } from '@/lib/utils'

const PRIVACY_URL =
  process.env.NEXT_PUBLIC_LEGAL_PRIVACY_URL?.trim() || undefined

export function ContactForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [problem, setProblem] = useState('')
  const [website, setWebsite] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submittedPhone, setSubmittedPhone] = useState('')
  const [pending, startTransition] = useTransition()
  const openedAt = useRef(Date.now())

  useEffect(() => {
    openedAt.current = Date.now()
  }, [])

  if (done) {
    return (
      <div className="space-y-2 py-2">
        <div className="flex items-center gap-2">
          <CheckCircle2
            className="size-4 shrink-0 text-success-ink"
            aria-hidden
          />
          <p className="text-[15px] font-medium text-ink">Megvan, felírtuk</p>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-secondary">
          Visszahívunk
          {submittedPhone ? (
            <>
              {' '}
              a <span className="font-medium text-ink">{submittedPhone}</span>{' '}
              számon
            </>
          ) : (
            ' a megadott számon'
          )}
          . Ha addig kérdésed van:{' '}
          <a
            href={`tel:${SUPPORT_PHONE_E164}`}
            className="font-medium text-ink no-underline hover:underline"
          >
            {SUPPORT_PHONE_DISPLAY}
          </a>
        </p>
      </div>
    )
  }

  return (
    <form
      className="space-y-3.5"
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
            company,
            phone,
            problem: problem.trim() || undefined,
            website,
            formOpenedAt: openedAt.current,
            source: 'optinova-kapcsolat'
          })
          if (!res.ok) {
            setFormError(res.message)
            setFieldErrors(res.fieldErrors ?? {})
            return
          }
          setSubmittedPhone(phone.trim())
          setDone(true)
        })
      }}
    >
      {/* Honeypot — képernyőolvasóknak is elrejtve */}
      <div
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
        aria-hidden
      >
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <Field
        label="Telefonszám"
        htmlFor="phone"
        error={fieldErrors.phone}
        hint="Ezen a számon keresünk"
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="+36 30 123 4567"
          value={phone}
          onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
          aria-invalid={Boolean(fieldErrors.phone)}
          aria-describedby={
            fieldErrors.phone ? 'phone-error' : 'phone-hint'
          }
        />
      </Field>

      <Field label="Név" htmlFor="fullName" error={fieldErrors.fullName}>
        <Input
          id="fullName"
          name="name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          spellCheck={false}
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          aria-invalid={Boolean(fieldErrors.fullName)}
        />
      </Field>

      <Field label="E-mail" htmlFor="email" error={fieldErrors.email}>
        <Input
          id="email"
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
          aria-invalid={Boolean(fieldErrors.email)}
        />
      </Field>

      <Field
        label="Cégnév"
        htmlFor="company"
        error={fieldErrors.company}
        hint="Egyéni vállalkozó vagy magánszemély is megadható"
      >
        <Input
          id="company"
          name="organization"
          type="text"
          autoComplete="organization"
          autoCapitalize="words"
          required
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          aria-invalid={Boolean(fieldErrors.company)}
        />
      </Field>

      <Field
        label="Milyen problémára keresel megoldást?"
        htmlFor="problem"
        hint="Nem kötelező"
        error={fieldErrors.problem}
      >
        <textarea
          id="problem"
          name="problem"
          rows={3}
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          className={cn(
            'flex w-full rounded-md border border-border bg-surface px-2.5 py-2 text-body text-ink shadow-none transition-colors placeholder:text-ink-disabled hover:border-border-strong'
          )}
        />
      </Field>

      {formError ? (
        <p className="text-[13px] text-danger-ink" role="alert">
          {formError}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={pending}
        disabled={pending}
      >
        Kérem, hívjanak
      </Button>

      <p className="text-[12px] leading-snug text-ink-muted">
        A megadott adatokat a visszahívás érdekében kezeljük.
        {PRIVACY_URL ? (
          <>
            {' '}
            <a
              href={PRIVACY_URL}
              className="font-medium text-ink no-underline underline-offset-2 hover:underline"
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

function Field({
  label,
  htmlFor,
  hint,
  error,
  children
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  const hintId = `${htmlFor}-hint`
  const errorId = `${htmlFor}-error`
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={errorId} className="text-[12px] text-danger-ink" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[12px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
