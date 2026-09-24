'use client'

import { useEffect } from 'react'
import { Check, Download, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { InvoicePaymentMethod } from '@/lib/invoicing/types'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

const AUTO_DISMISS_MS = {
  success: 5_000,
  warning: 8_000,
  error: 0
} as const

export type PosFlashError = {
  kind: 'error'
  message: string
}

export type PosFlashSale = {
  kind: 'success' | 'warning'
  saleId: string
  saleNumber: string
  dueHuf: number
  /** pl. Készpénz / Kártya / Vegyes */
  payLabel: string
  invoiceNumber?: string
  invoiceId?: string
  invoiceFailed?: boolean
  invoicePay?: InvoicePaymentMethod
  /** Számla hiba rövid szövege (warning) */
  invoiceError?: string
  needsAeeHint?: boolean
}

export type PosFlash = PosFlashError | PosFlashSale

type Props = {
  flash: PosFlash
  onDismiss: () => void
  onOpenSale: (saleId: string) => void
  invoiceRetryPending?: boolean
  onRetryInvoice?: () => void
}

export function PosFeedbackBar({
  flash,
  onDismiss,
  onOpenSale,
  invoiceRetryPending,
  onRetryInvoice
}: Props) {
  const dismissKey =
    flash.kind === 'error'
      ? `error:${flash.message}`
      : `${flash.kind}:${flash.saleId}:${flash.invoiceNumber ?? ''}:${flash.invoiceFailed ? 'fail' : 'ok'}`

  useEffect(() => {
    const ms = AUTO_DISMISS_MS[flash.kind]
    if (!ms) return
    const id = window.setTimeout(onDismiss, ms)
    return () => window.clearTimeout(id)
    // Only reset timer when the flash identity changes — not on parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismissKey
  }, [dismissKey])

  if (flash.kind === 'error') {
    return (
      <div
        className="flex shrink-0 items-start justify-between gap-2 border-b border-danger/30 bg-danger-soft px-3 py-2.5 text-body text-danger-ink"
        role="alert"
      >
        <p className="min-w-0 flex-1">{flash.message}</p>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 hover:bg-danger/10"
          aria-label="Üzenet bezárása"
          onClick={onDismiss}
        >
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  const isWarning = flash.kind === 'warning'

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-1 border-b px-3 py-2.5',
        isWarning
          ? 'border-warning/35 bg-warning-soft text-warning-ink'
          : 'border-success/30 bg-success-soft text-success-ink'
      )}
      role="status"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {!isWarning ? (
              <Check
                className="size-4 shrink-0 translate-y-0.5 text-success-ink"
                strokeWidth={2.5}
                aria-hidden
              />
            ) : null}
            <span className="text-[22px] font-semibold tabular-nums tracking-tight text-ink">
              {formatMoneyFt(flash.dueHuf)} Ft
            </span>
          </div>
          <p
            className={cn(
              'mt-0.5 text-[13px]',
              isWarning ? 'text-warning-ink' : 'text-success-ink'
            )}
          >
            <span className="font-medium tabular-nums">{flash.saleNumber}</span>
            <span className="text-ink-muted"> · </span>
            <span>{flash.payLabel}</span>
            {flash.invoiceFailed ? (
              <>
                <span className="text-ink-muted"> · </span>
                <span>Számla sikertelen</span>
                {flash.invoiceError ? (
                  <span className="text-ink-muted">
                    {' '}
                    ({flash.invoiceError})
                  </span>
                ) : null}
              </>
            ) : flash.invoiceNumber ? (
              <>
                <span className="text-ink-muted"> · </span>
                <span>Számla {flash.invoiceNumber}</span>
              </>
            ) : (
              <>
                <span className="text-ink-muted"> · </span>
                <span>Kész</span>
              </>
            )}
          </p>
          {flash.needsAeeHint ? (
            <p className="mt-1 text-hint text-ink-secondary">
              Online pénztárgép: írd be ezt az összeget. (Nem adóügyi nyugta.)
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(String(flash.dueHuf)).then(
                () => toast.message('Másolva'),
                () => toast.message(String(flash.dueHuf))
              )
            }}
          >
            Másol
          </Button>
          {flash.invoiceFailed && onRetryInvoice ? (
            <Button
              type="button"
              size="sm"
              disabled={invoiceRetryPending}
              onClick={onRetryInvoice}
            >
              Számla újra
            </Button>
          ) : null}
          {flash.invoiceId ? (
            <a
              href={`/api/invoices/${flash.invoiceId}/pdf`}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-hint font-medium text-ink no-underline hover:bg-subtle'
              )}
            >
              <Download className="size-3.5" aria-hidden />
              PDF
            </a>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onOpenSale(flash.saleId)}
          >
            Megnyitás
          </Button>
          <button
            type="button"
            className="shrink-0 rounded p-0.5 hover:bg-black/5"
            aria-label="Üzenet bezárása"
            onClick={onDismiss}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function posPayLabelFromTenders(
  kinds: Array<'cash' | 'card'>
): string {
  const hasCash = kinds.includes('cash')
  const hasCard = kinds.includes('card')
  if (hasCash && hasCard) return 'Vegyes'
  if (hasCard) return 'Kártya'
  if (hasCash) return 'Készpénz'
  return 'Fizetés'
}
