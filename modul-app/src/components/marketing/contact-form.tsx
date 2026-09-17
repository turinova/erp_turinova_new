'use client'

import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SUPPORT_EMAIL } from '@/lib/marketing/pricing'

export function ContactForm() {
  const params = useSearchParams()
  const quotesPrefill = params.get('quotes') ?? ''
  const netPrefill = params.get('net') ?? ''

  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [quotes, setQuotes] = useState(quotesPrefill)
  const [message, setMessage] = useState(
    netPrefill
      ? `Kalkulátor nettó nyereség / hó (becslés): ${netPrefill} Ft`
      : ''
  )

  const mailto = useMemo(() => {
    const subject = encodeURIComponent('Optinova — demo kérés')
    const body = encodeURIComponent(
      [
        `Név: ${name}`,
        `Cég: ${company}`,
        `Email: ${email}`,
        `Telefon: ${phone}`,
        `Ajánlatok / hó (kb.): ${quotes}`,
        '',
        message
      ].join('\n')
    )
    return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
  }, [name, company, email, phone, quotes, message])

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        window.location.href = mailto
      }}
    >
      <Field label="Név" htmlFor="name">
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Cég" htmlFor="company">
        <Input
          id="company"
          name="company"
          autoComplete="organization"
          required
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Telefon" htmlFor="phone">
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
      </div>
      <Field
        label="Ajánlatok száma / hónap (kb.)"
        htmlFor="quotes"
        hint="Opcionális — a kalkulátorból is jöhet"
      >
        <Input
          id="quotes"
          name="quotes"
          inputMode="numeric"
          value={quotes}
          onChange={(e) => setQuotes(e.target.value)}
        />
      </Field>
      <Field label="Üzenet" htmlFor="message">
        <textarea
          id="message"
          name="message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex w-full rounded-md border border-border bg-surface px-2.5 py-2 text-body text-ink shadow-none transition-colors placeholder:text-ink-disabled hover:border-border-strong"
        />
      </Field>
      <Button type="submit" size="lg" className="w-full sm:w-auto">
        Ingyenes konzultáció emailben
      </Button>
      <p className="text-[12px] text-ink-muted">
        Az űrlap a leveleződben nyílik meg ({SUPPORT_EMAIL}). Válasz jellemzően
        1–2 munkanapon belül.
      </p>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[12px] text-ink-muted">{hint}</p> : null}
    </div>
  )
}
