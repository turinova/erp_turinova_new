'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { retryAutoProforma } from '@/lib/partner/auto-proforma-actions'
import {
  AUTO_PROFORMA_BADGE,
  type AutoProformaStatus
} from '@/lib/partner/auto-proforma-rules'

const TONE: Record<AutoProformaStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  pending: 'neutral',
  processing: 'neutral',
  issued: 'success',
  failed: 'danger',
  skipped: 'warning'
}

/** Staff: partner átutalásos beküldés automatikus díjbekérője. */
export function AutoProformaStatusItem({
  quoteId,
  status,
  note,
  canWrite
}: {
  quoteId: string
  status: AutoProformaStatus
  note: string | null
  canWrite: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const canRetry = canWrite && (status === 'failed' || status === 'skipped')

  function handleRetry() {
    startTransition(async () => {
      const result = await retryAutoProforma(quoteId)
      if (!result.ok) {
        toast.error(result.message)
        router.refresh()
        return
      }
      toast.success(`Díjbekérő elküldve: ${result.providerNumber}`)
      router.refresh()
    })
  }

  return (
    <div>
      <dt className="text-hint text-ink-secondary">Díjbekérő</dt>
      <dd className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={TONE[status]}>{AUTO_PROFORMA_BADGE[status]}</StatusBadge>
        {note && status !== 'pending' && status !== 'processing' ? (
          <span className="text-hint text-ink-secondary">{note}</span>
        ) : null}
        {canRetry ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={pending}
            disabled={pending}
            onClick={handleRetry}
          >
            Díjbekérő küldése
          </Button>
        ) : null}
      </dd>
    </div>
  )
}
