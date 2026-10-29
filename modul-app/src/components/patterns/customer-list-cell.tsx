import Link from 'next/link'

import { cn } from '@/lib/utils'

type CustomerListCellProps = {
  name: string | null | undefined
  customerId?: string | null
  mobile?: string | null
  /** Ha nincs név: pl. Vendég / — */
  emptyLabel?: string
  className?: string
}

/** Lista Ügyfél oszlop: név → /ugyfelek/:id, alá a telefon. */
export function CustomerListCell({
  name,
  customerId,
  mobile,
  emptyLabel = '—',
  className
}: CustomerListCellProps) {
  const label = (name ?? '').trim() || emptyLabel
  const phone = (mobile ?? '').trim()
  const href = customerId ? `/ugyfelek/${customerId}` : null

  return (
    <div className={cn('min-w-0', className)}>
      {href ? (
        <Link
          href={href}
          className="font-medium text-ink no-underline hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {label}
        </Link>
      ) : (
        <span className="text-ink">{label}</span>
      )}
      {phone ? (
        <p className="truncate text-hint text-ink-secondary" title={phone}>
          {phone}
        </p>
      ) : null}
    </div>
  )
}
