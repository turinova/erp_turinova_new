'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { ImpersonationInfo } from '@/lib/auth/session'
import { stopImpersonation } from '@/lib/platform/impersonation'

export function ImpersonationBanner({ info }: { info: ImpersonationInfo }) {
  const [pending, startTransition] = useTransition()

  function handleStop() {
    startTransition(async () => {
      try {
        const result = await stopImpersonation()
        if (result && !result.ok) {
          toast.error(result.message)
        }
      } catch {
        // redirect throws
      }
    })
  }

  return (
    <div
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-warning/40 bg-warning-soft px-4 py-2 md:px-6"
      role="status"
    >
      <p className="text-body text-warning-ink">
        Support mód: <strong>{info.targetEmail}</strong> · {info.tenantName}
        {info.operatorEmail ? (
          <span className="text-hint"> · operátor: {info.operatorEmail}</span>
        ) : null}
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={handleStop}
      >
        {pending ? 'Kilépés…' : 'Kilépés a support módból'}
      </Button>
    </div>
  )
}
