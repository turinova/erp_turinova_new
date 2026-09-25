'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Bell, Check, X } from 'lucide-react'
import { useState, useTransition } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { requestStockNotify } from '@/lib/storefront/stock-notify-actions'
import { cn } from '@/lib/utils'

export function StockNotifyDialog({
  open,
  onOpenChange,
  accessoryId,
  productTitle,
  variantLabel,
  privacyUrl,
  onDone
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accessoryId: string
  productTitle: string
  variantLabel: string | null
  privacyUrl: string | null
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await requestStockNotify({
        accessoryId,
        email,
        variantLabel: variantLabel ?? undefined,
        website: honeypot
      })
      if (!result.ok) {
        setError(result.fieldErrors?.email ?? result.message)
        return
      }
      setSentTo(email.trim())
      onDone()
    })
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-lg bg-white pb-[max(env(safe-area-inset-bottom),16px)] shadow-lg sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-24 sm:w-[420px] sm:-translate-x-1/2 sm:rounded-lg">
          <div className="flex h-14 items-center justify-between border-b border-stone-200 px-4">
            <DialogPrimitive.Title className="text-[16px] font-semibold text-ink">
              Szólunk, ha megérkezik
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-stone-100"
              aria-label="Bezárás"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>

          {sentTo ? (
            <div className="space-y-4 px-4 pt-4" role="status">
              <p className="flex gap-2.5 text-[15px] text-ink">
                <Check className="mt-0.5 size-5 shrink-0 text-green-700" aria-hidden />
                <span>
                  Rendben. Amint újra rendelhető, írunk a{' '}
                  <span className="font-medium">{sentTo}</span> címre.
                </span>
              </p>
              <DialogPrimitive.Close
                className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'h-11 w-full text-[14px]')}
              >
                Bezárás
              </DialogPrimitive.Close>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 px-4 pt-4" noValidate>
              <DialogPrimitive.Description className="text-[14px] leading-snug text-ink-secondary">
                {productTitle}
                {variantLabel ? ` · ${variantLabel}` : ''} — egyszer írunk, amikor
                újra van készleten.
              </DialogPrimitive.Description>
              <div className="space-y-1.5">
                <label htmlFor="notify-email" className="text-[14px] font-medium text-ink">
                  E-mail címed
                </label>
                <input
                  id="notify-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pending}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'notify-error' : undefined}
                  className="h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-[16px] text-ink outline-none focus-visible:border-ink focus-visible:ring-1 focus-visible:ring-ink disabled:opacity-60"
                />
                {error ? (
                  <p id="notify-error" className="text-[13px] text-danger-ink" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <div className="hidden" aria-hidden>
                <label htmlFor="notify-website">Weboldal</label>
                <input
                  id="notify-website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>
              <p className="text-[12px] leading-snug text-ink-muted">
                Az e-mail címet csak erre az értesítésre használjuk.
                {privacyUrl ? (
                  <>
                    {' '}
                    <a href={privacyUrl} className="cursor-pointer underline underline-offset-2">
                      Adatkezelési tájékoztató
                    </a>
                  </>
                ) : null}
              </p>
              <button
                type="submit"
                disabled={pending}
                className={cn(buttonVariants({ size: 'lg' }), 'h-12 w-full gap-2 text-[15px] font-semibold')}
              >
                <Bell className="size-4" aria-hidden />
                {pending ? 'Mentés…' : 'Értesítést kérek'}
              </button>
            </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
