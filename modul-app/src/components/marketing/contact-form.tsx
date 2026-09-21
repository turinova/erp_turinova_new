'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { submitContactLeadAction } from '@/lib/marketing/contact-actions'
import {
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164
} from '@/lib/marketing/pricing'

export function ContactForm() {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [problem, setProblem] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

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
          Visszahívunk a megadott számon. Ha addig kérdésed van:{' '}
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
      onSubmit={(e) => {
        e.preventDefault()
        setFormError(null)
        setFieldErrors({})
        startTransition(async () => {
          const res = await submitContactLeadAction({
            firstName,
            email,
            company,
            phone,
            problem: problem.trim() || undefined
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
      <Field label="Keresztnév" htmlFor="firstName" error={fieldErrors.firstName}>
        <Input
          id="firstName"
          name="firstName"
          autoComplete="given-name"
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          aria-invalid={Boolean(fieldErrors.firstName)}
        />
      </Field>
      <Field label="E-mail" htmlFor="email" error={fieldErrors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(fieldErrors.email)}
        />
      </Field>
      <Field label="Cégnév" htmlFor="company" error={fieldErrors.company}>
        <Input
          id="company"
          name="company"
          autoComplete="organization"
          required
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          aria-invalid={Boolean(fieldErrors.company)}
        />
      </Field>
      <Field label="Telefonszám" htmlFor="phone" error={fieldErrors.phone}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-invalid={Boolean(fieldErrors.phone)}
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
          className="flex w-full rounded-md border border-border bg-surface px-2.5 py-2 text-body text-ink shadow-none transition-colors placeholder:text-ink-disabled hover:border-border-strong"
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
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-danger-ink">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}
