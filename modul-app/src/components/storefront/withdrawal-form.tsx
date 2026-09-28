'use client'

import { Check } from 'lucide-react'
import { useState, useTransition } from 'react'

import { buttonVariants } from '@/components/ui/button'
import {
  submitWithdrawal,
  type WithdrawalInput,
  type WithdrawalReceipt
} from '@/lib/storefront/withdrawal-actions'
import { cn } from '@/lib/utils'
import { WITHDRAWAL_CONFIRM_LABEL } from '@/lib/webshop/legal/constants'

type Field = 'customerName' | 'customerEmail' | 'orderReference' | 'items' | 'comment' | 'refundAccount'

const inputCls =
  'w-full rounded-md border border-stone-300 bg-white px-3 text-[16px] text-ink outline-none focus-visible:border-ink focus-visible:ring-1 focus-visible:ring-ink disabled:opacity-60 aria-[invalid=true]:border-danger-ink'

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    dateStyle: 'long',
    timeStyle: 'medium'
  }).format(new Date(iso))
}

export function WithdrawalForm({ privacyUrl, returnDays }: { privacyUrl: string; returnDays: number }) {
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState<Record<Field, string>>({
    customerName: '',
    customerEmail: '',
    orderReference: '',
    items: '',
    comment: '',
    refundAccount: ''
  })
  const [honeypot, setHoneypot] = useState('')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<WithdrawalReceipt | null>(null)

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setErrors({})
    startTransition(async () => {
      const input: WithdrawalInput = { ...values, website: honeypot }
      const result = await submitWithdrawal(input)
      if (!result.ok) {
        setErrors((result.fieldErrors ?? {}) as Partial<Record<Field, string>>)
        setMessage(result.message)
        return
      }
      setReceipt(result.receipt)
    })
  }

  if (receipt) {
    const rows: [string, string][] = [
      ['Azonosító', receipt.reference],
      ['Beérkezett', formatWhen(receipt.submittedAt)],
      ['Név', receipt.customerName],
      ['E-mail', receipt.customerEmail],
      ['Rendelésszám', receipt.orderReference],
      ['Érintett termékek', receipt.items ?? 'a teljes rendelés'],
      ['Megjegyzés', receipt.comment ?? '—'],
      ['Visszautalás bankszámlára', receipt.refundAccount ?? '—']
    ]
    return (
      <div className="space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-4" role="status">
        <p className="flex gap-2.5 text-[15px] font-medium text-ink">
          <Check className="mt-0.5 size-5 shrink-0 text-green-700" aria-hidden />
          Elállási nyilatkozatát megkaptuk.
        </p>
        <dl className="grid gap-x-4 gap-y-1.5 text-[14px] sm:grid-cols-[200px_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="whitespace-pre-wrap text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[14px] text-ink-secondary">
          {receipt.emailSent
            ? `A visszaigazolást elküldtük a ${receipt.customerEmail} címre.`
            : 'A visszaigazoló e-mailt most nem tudtuk elküldeni. Kérjük, mentse el vagy nyomtassa ki ezt az oldalt: nyilatkozatát rögzítettük.'}{' '}
          Küldje vissza a terméket 14 napon belül; a vételárat legkésőbb 14 napon belül visszatérítjük.
        </p>
      </div>
    )
  }

  const field = (
    k: Field,
    label: string,
    opts: { type?: string; autoComplete?: string; hint?: string; multiline?: boolean; required?: boolean } = {}
  ) => {
    const id = `wd-${k}`
    const err = errors[k]
    const describedBy = [opts.hint ? `${id}-hint` : null, err ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="text-[14px] font-medium text-ink">
          {label}
          {opts.required ? null : <span className="font-normal text-ink-muted"> (nem kötelező)</span>}
        </label>
        {opts.multiline ? (
          <textarea
            id={id}
            rows={3}
            value={values[k]}
            onChange={set(k)}
            disabled={pending}
            aria-invalid={err ? true : undefined}
            aria-describedby={describedBy}
            className={cn(inputCls, 'py-2.5')}
          />
        ) : (
          <input
            id={id}
            type={opts.type ?? 'text'}
            autoComplete={opts.autoComplete}
            value={values[k]}
            onChange={set(k)}
            disabled={pending}
            required={opts.required}
            aria-invalid={err ? true : undefined}
            aria-describedby={describedBy}
            className={cn(inputCls, 'h-12')}
          />
        )}
        {opts.hint ? (
          <p id={`${id}-hint`} className="text-[13px] text-ink-muted">
            {opts.hint}
          </p>
        ) : null}
        {err ? (
          <p id={`${id}-error`} className="text-[13px] text-danger-ink" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="max-w-[560px] space-y-4" noValidate>
      <p className="text-[14px] text-ink-secondary">
        Regisztráció nem kell. Az átvételtől számított {returnDays} napon belül küldheti be; a beérkezést azonnal visszaigazoljuk
        e-mailben.
      </p>
      {field('customerName', 'Név', { autoComplete: 'name', required: true })}
      {field('customerEmail', 'E-mail cím', {
        type: 'email',
        autoComplete: 'email',
        required: true,
        hint: 'Ide küldjük a visszaigazolást.'
      })}
      {field('orderReference', 'Rendelésszám', { required: true, hint: 'A rendelés-visszaigazoló e-mailben találja.' })}
      {field('items', 'Érintett termékek', { multiline: true, hint: 'Ha üresen hagyja, a teljes rendelésről eláll.' })}
      {field('refundAccount', 'Bankszámlaszám a visszautaláshoz', {
        hint: 'Csak utánvétes vagy készpénzes fizetésnél szükséges.'
      })}
      {field('comment', 'Megjegyzés', { multiline: true })}
      <div className="hidden" aria-hidden>
        <label htmlFor="wd-website">Weboldal</label>
        <input id="wd-website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>
      <p className="text-[12px] leading-snug text-ink-muted">
        Az adatokat az elállás intézéséhez kezeljük.{' '}
        <a href={privacyUrl} className="cursor-pointer underline underline-offset-2">
          Adatkezelési tájékoztató
        </a>
      </p>
      {message ? (
        <p className="text-[14px] text-danger-ink" role="alert">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={cn(buttonVariants({ size: 'lg' }), 'h-12 w-full text-[15px] font-semibold sm:w-auto sm:px-6')}
      >
        {pending ? 'Küldés…' : WITHDRAWAL_CONFIRM_LABEL}
      </button>
    </form>
  )
}
