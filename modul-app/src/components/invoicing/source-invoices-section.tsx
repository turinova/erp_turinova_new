'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, FileText } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { stornoInvoiceAction } from '@/lib/invoicing/actions'
import {
  canStornoInvoice,
  isInvoiceConsumedByFinal,
  stornoTargetIds
} from '@/lib/invoicing/invoice-rules'
import {
  invoicePaymentStatusLabel,
  invoiceTypeLabel,
  type InvoiceListItem,
  type InvoiceType
} from '@/lib/invoicing/types'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('hu-HU')
  } catch {
    return '—'
  }
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('hu-HU')
  } catch {
    return '—'
  }
}

function invoiceTypeTone(
  t: InvoiceType | string
): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  switch (t) {
    case 'szamla':
      return 'success'
    case 'dijbekero':
      return 'warning'
    case 'elolegszamla':
      return 'info'
    case 'sztorno':
      return 'danger'
    default:
      return 'neutral'
  }
}

function invoicePayTone(
  s: string
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (s === 'fizetve') return 'success'
  if (s === 'pending') return 'warning'
  if (s === 'nem_lesz_fizetve') return 'danger'
  return 'neutral'
}

export type SourceInvoicesSectionProps = {
  invoices: InvoiceListItem[]
  canWrite: boolean
  hasAgentKey: boolean
  listHref: string
  listLinkLabel: string
  hint: string
  /** Üres lista CTA — ha null, nincs gomb */
  emptyCtaLabel?: string | null
  onEmptyCta?: () => void
  showEmptyCta?: boolean
}

export function SourceInvoicesSection({
  invoices,
  canWrite,
  hasAgentKey,
  listHref,
  listLinkLabel,
  hint,
  emptyCtaLabel,
  onEmptyCta,
  showEmptyCta = false
}: SourceInvoicesSectionProps) {
  const router = useRouter()
  const [stornoId, setStornoId] = useState<string | null>(null)
  const [stornoPending, startStorno] = useTransition()

  const stornoOfIds = useMemo(() => stornoTargetIds(invoices), [invoices])
  const stornoTarget = useMemo(
    () => invoices.find((i) => i.id === stornoId) ?? null,
    [invoices, stornoId]
  )

  return (
    <>
      <section className="rounded-md border border-border bg-surface p-3.5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-h3 text-ink">Bizonylatok</h2>
            <p className="text-hint text-ink-secondary">{hint}</p>
          </div>
          <Link
            href={listHref}
            className="text-hint font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
          >
            {listLinkLabel}
          </Link>
        </div>

        {invoices.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-subtle/50 px-3 py-4 text-center">
            <p className="text-body text-ink-secondary">
              Még nincs kiállított bizonylat.
            </p>
            {showEmptyCta && emptyCtaLabel && onEmptyCta ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={onEmptyCta}
              >
                <FileText className="size-3.5" aria-hidden />
                {emptyCtaLabel}
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-2">
            {invoices.map((inv) => {
              const number =
                inv.provider_invoice_number || inv.internal_number
              const gross = inv.gross_total
              const alreadyStornoed = stornoOfIds.has(inv.id)
              const consumed = isInvoiceConsumedByFinal(inv, invoices)
              const canStorno = canStornoInvoice(inv, invoices, {
                canWrite,
                hasAgentKey
              })
              return (
                <li
                  key={inv.id}
                  className={cn(
                    'rounded-md border border-border p-3',
                    inv.invoice_type === 'sztorno' ||
                      alreadyStornoed ||
                      consumed
                      ? 'bg-subtle/50 opacity-90'
                      : 'bg-subtle/30'
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge
                          tone={invoiceTypeTone(inv.invoice_type)}
                          variant="solid"
                        >
                          {invoiceTypeLabel(inv.invoice_type)}
                        </StatusBadge>
                        <StatusBadge
                          tone={invoicePayTone(inv.payment_status)}
                          variant="outline"
                        >
                          {invoicePaymentStatusLabel(inv.payment_status)}
                        </StatusBadge>
                        {alreadyStornoed ? (
                          <StatusBadge tone="danger" variant="soft">
                            Sztornózva
                          </StatusBadge>
                        ) : null}
                        {consumed ? (
                          <StatusBadge tone="info" variant="soft">
                            Lezárva a számlával
                          </StatusBadge>
                        ) : null}
                      </div>
                      <p className="text-body font-semibold tabular-nums text-ink">
                        {number}
                      </p>
                      {inv.customer_name ? (
                        <p className="text-hint text-ink-secondary">
                          Vevő: {inv.customer_name}
                        </p>
                      ) : null}
                      <p className="text-hint text-ink-muted">
                        Kiállítva: {formatDateTime(inv.created_at)}
                        {inv.payment_due_date
                          ? ` · Határidő: ${formatDate(inv.payment_due_date)}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <p
                        className={cn(
                          'text-h3 font-semibold tabular-nums',
                          inv.invoice_type === 'sztorno'
                            ? 'text-danger-ink'
                            : 'text-ink'
                        )}
                      >
                        {gross != null
                          ? `${inv.invoice_type === 'sztorno' && gross > 0 ? '−' : ''}${formatMoneyFt(Math.abs(gross))} Ft`
                          : '—'}
                      </p>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <a
                          href={`/api/invoices/${inv.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            buttonVariants({
                              variant: 'secondary',
                              size: 'sm'
                            })
                          )}
                        >
                          <Download className="size-3.5" aria-hidden />
                          PDF letöltés
                        </a>
                        {canStorno ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setStornoId(inv.id)}
                          >
                            Sztornó
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(stornoId)}
        onOpenChange={(open) => {
          if (!open && !stornoPending) setStornoId(null)
        }}
        title="Sztornó kiállítása"
        description={
          stornoTarget
            ? `${invoiceTypeLabel(stornoTarget.invoice_type)} ${stornoTarget.provider_invoice_number || stornoTarget.internal_number} — ez a Számlázz.hu-n nem vonható vissza.`
            : 'Sztornó bizonylat kiállítása.'
        }
        confirmLabel="Sztornó kiállítása"
        cancelLabel="Mégse"
        variant="danger"
        loading={stornoPending}
        onConfirm={() => {
          if (!stornoId) return
          startStorno(async () => {
            const result = await stornoInvoiceAction(stornoId)
            if (!result.ok) {
              toast.error(result.message)
              return
            }
            toast.success(result.message ?? 'Sztornózva.')
            setStornoId(null)
            router.refresh()
          })
        }}
      />
    </>
  )
}
