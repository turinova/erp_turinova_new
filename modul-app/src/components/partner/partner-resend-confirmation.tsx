'use client'

import { useEffect, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { partnerResendConfirmationAction } from '@/lib/auth/partner-actions'
import { cn } from '@/lib/utils'

const COOLDOWN_SECONDS = 60

export function PartnerResendConfirmation({
  email,
  startWithCooldown = false,
  className
}: {
  email: string
  /** Közvetlenül küldés után: ne lehessen azonnal újra kérni. */
  startWithCooldown?: boolean
  className?: string
}) {
  const [secondsLeft, setSecondsLeft] = useState(
    startWithCooldown ? COOLDOWN_SECONDS : 0
  )
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null
  )
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [secondsLeft])

  function resend() {
    startTransition(async () => {
      const res = await partnerResendConfirmationAction(email)
      setResult(res)
      setSecondsLeft(COOLDOWN_SECONDS)
    })
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Button
        type="button"
        variant="secondary"
        size="md"
        className="w-full"
        loading={pending}
        disabled={secondsLeft > 0 || !email}
        onClick={resend}
      >
        {secondsLeft > 0
          ? `Új levelet kérek (${secondsLeft} mp)`
          : 'Új levelet kérek'}
      </Button>
      {result ? (
        <p
          className={cn(
            'text-hint',
            result.ok ? 'text-ink-secondary' : 'text-danger-ink'
          )}
          role={result.ok ? 'status' : 'alert'}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  )
}
