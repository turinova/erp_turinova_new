import Link from 'next/link'
import { AlertTriangle, Store } from 'lucide-react'

import {
  KIOSK_CUSTOMER_MATCH_LABEL,
  type KioskCustomerMatch
} from '@/lib/kiosk/customer-match-rules'
import type { QuoteKioskInfo } from '@/lib/quotes/queries'
import { cn } from '@/lib/utils'

const NEEDS_CHECK: KioskCustomerMatch[] = ['phone_multiple', 'created_renamed']

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('hu-HU', {
      dateStyle: 'short',
      timeStyle: 'short'
    })
  } catch {
    return iso
  }
}

/** Staff detail: bolti kioskról leadott ajánlat adatai (amit a vevő beírt). */
export function QuoteKioskInfoCard({
  kiosk,
  customerId,
  customerName
}: {
  kiosk: QuoteKioskInfo
  customerId: string
  customerName: string
}) {
  const needsCheck =
    kiosk.customer_match != null && NEEDS_CHECK.includes(kiosk.customer_match)

  return (
    <div
      className={cn(
        'max-w-xl rounded-md border px-3 py-2 text-body',
        needsCheck
          ? 'border-warning/40 bg-warning-soft'
          : 'border-border bg-subtle'
      )}
      role="status"
    >
      <p className="flex items-center gap-1.5 font-medium text-ink">
        <Store className="size-3.5 shrink-0" aria-hidden />
        Bolti kioskról leadva · {formatDateTime(kiosk.submitted_at)}
      </p>
      <p className="mt-0.5 text-ink-secondary">
        {[kiosk.guest_name, kiosk.guest_phone, kiosk.guest_email]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {kiosk.customer_match ? (
        <p
          className={cn(
            'mt-1 flex items-start gap-1.5 text-hint',
            needsCheck ? 'text-warning-ink' : 'text-ink-secondary'
          )}
        >
          {needsCheck ? (
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          ) : null}
          <span>
            {KIOSK_CUSTOMER_MATCH_LABEL[kiosk.customer_match]} Ügyfél:{' '}
            <Link
              href={`/ugyfelek/${customerId}`}
              className="font-medium text-ink underline-offset-2 hover:underline"
            >
              {customerName}
            </Link>
          </span>
        </p>
      ) : null}
      {kiosk.consent_at ? (
        <p className="mt-0.5 text-hint text-ink-secondary">
          A vevő a kioskon jóváhagyta a tételeket.
        </p>
      ) : null}
    </div>
  )
}
