'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { OrderStatusPreview } from '@/components/order-status/order-status-preview'
import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import {
  saveCsoReadySmsTemplate,
  saveQuoteReadySmsTemplate,
  saveReviewThanksSmsTemplate
} from '@/lib/sms/actions'
import { sampleOrderStatusView } from '@/lib/order-status/sample'
import type {
  OrderStatusPreviewCompany,
  OrderStatusPreviewStage
} from '@/lib/order-status/sample'
import type { OrderShareKind } from '@/lib/order-status/types'
import { smsSegments, toAsciiSmsText } from '@/lib/sms/text'
import { cn } from '@/lib/utils'

export type SmsReviewState = {
  statusPageEnabled: boolean
  thankSmsEnabled: boolean
  hasLink: boolean
}

type Props = {
  quoteBody: string
  csoBody: string
  reviewThanksBody: string
  showQuote: boolean
  showCso: boolean
  canWrite: boolean
  company?: OrderStatusPreviewCompany | null
  review?: SmsReviewState | null
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="flex rounded-md border border-border p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={cn(
            'rounded px-2 py-1 text-hint',
            value === o.value ? 'bg-ink text-white' : 'text-ink-secondary hover:bg-subtle'
          )}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function TemplatePreview({
  body,
  sample
}: {
  body: string
  sample: Record<string, string>
}) {
  let preview = body
  for (const [key, value] of Object.entries(sample)) {
    preview = preview.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  preview = toAsciiSmsText(preview)
  const segments = smsSegments(preview)

  return (
    <div className="rounded-md border border-border bg-subtle px-2.5 py-2">
      <p className="text-hint font-medium text-ink-secondary">SMS szöveg</p>
      <p className="mt-1 whitespace-pre-wrap text-body text-ink">{preview}</p>
      <p className="mt-1.5 text-hint text-ink-secondary">
        {preview.length} karakter · ~{segments} SMS szegmens (ops)
      </p>
    </div>
  )
}

export function SmsSettingsForm({
  quoteBody: initialQuote,
  csoBody: initialCso,
  reviewThanksBody: initialReviewThanks,
  showQuote,
  showCso,
  canWrite,
  company = null,
  review = null
}: Props) {
  const [quoteBody, setQuoteBody] = useState(initialQuote)
  const [csoBody, setCsoBody] = useState(initialCso)
  const [reviewThanksBody, setReviewThanksBody] = useState(initialReviewThanks)
  const [pending, startTransition] = useTransition()
  const [previewKind, setPreviewKind] = useState<OrderShareKind>(() =>
    showCso ? 'cso' : 'quote'
  )

  const [previewStage, setPreviewStage] = useState<OrderStatusPreviewStage>('ready')
  const reviewEnabled = Boolean(review?.statusPageEnabled && review.hasLink)
  const statusPreviewView = useMemo(
    () =>
      sampleOrderStatusView(previewKind, company, {
        stage: previewStage,
        reviewEnabled
      }),
    [previewKind, company, previewStage, reviewEnabled]
  )

  function handleSaveQuote() {
    if (!canWrite) return
    startTransition(async () => {
      const result = await saveQuoteReadySmsTemplate(quoteBody)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Lapszabászat SMS sablon mentve.')
    })
  }

  function handleSaveCso() {
    if (!canWrite) return
    startTransition(async () => {
      const result = await saveCsoReadySmsTemplate(csoBody)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Ügyfélrendelés SMS sablon mentve.')
    })
  }

  function handleSaveReviewThanks() {
    if (!canWrite) return
    startTransition(async () => {
      const result = await saveReviewThanksSmsTemplate(reviewThanksBody)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Köszönő SMS sablon mentve.')
    })
  }

  const showPreviewToggle = showQuote && showCso

  return (
    <div className="pb-14">
      <PageHeader
        title="SMS sablonok"
        description="Készre / átvehető értesítők + ügyfél státuszoldal. Küldéskor az ékezetek ASCII-re foldolódnak."
      />

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {showQuote ? (
            <FormSection
              title="Lapszabászat — kész"
              description="Placeholderek: {customer_name}, {order_number}, {company_name}, {material_name}, {status_url}."
              columns={1}
            >
              <FormField
                label="Sablon szöveg"
                htmlFor="sms-quote-body"
                required
              >
                <textarea
                  id="sms-quote-body"
                  value={quoteBody}
                  disabled={!canWrite || pending}
                  onChange={(e) => setQuoteBody(e.target.value)}
                  rows={5}
                  maxLength={600}
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-body text-ink outline-none focus:border-ink"
                />
              </FormField>

              <TemplatePreview
                body={quoteBody}
                sample={{
                  customer_name: 'Kiss Janos',
                  order_number: 'M-1001',
                  company_name: company?.name || 'Pelda Kft',
                  material_name: 'Feher 18mm',
                  status_url: 'https://app.example/r/abc123'
                }}
              />

              {canWrite ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    loading={pending}
                    onClick={handleSaveQuote}
                  >
                    Lapszabászat sablon mentése
                  </Button>
                </div>
              ) : null}
            </FormSection>
          ) : null}

          {showCso ? (
            <FormSection
              title="Ügyfélrendelés — átvehető"
              description="Rövid SMS + {status_url}. Placeholderek: {customer_name}, {order_number}, {company_name}, {total_amount}, {ready_count}, {waiting_count}, {status_url}. A waiting_count opcionális (részlegesnél)."
              columns={1}
            >
              <FormField
                label="Sablon szöveg"
                htmlFor="sms-cso-body"
                required
              >
                <textarea
                  id="sms-cso-body"
                  value={csoBody}
                  disabled={!canWrite || pending}
                  onChange={(e) => setCsoBody(e.target.value)}
                  rows={5}
                  maxLength={600}
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-body text-ink outline-none focus:border-ink"
                />
              </FormField>

              <TemplatePreview
                body={csoBody}
                sample={{
                  customer_name: 'Kiss Janos',
                  order_number: 'UR-1001',
                  company_name: company?.name || 'Pelda Kft',
                  total_amount: '12 500',
                  ready_count: '2',
                  waiting_count: '0',
                  status_url: 'https://app.example/r/abc123'
                }}
              />

              {canWrite ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    loading={pending}
                    onClick={handleSaveCso}
                  >
                    Ügyfélrendelés sablon mentése
                  </Button>
                </div>
              ) : null}
            </FormSection>
          ) : null}

          <FormSection
            id="review-thanks"
            title="Köszönő SMS (Google értékelés)"
            description="Átadás után, egyszer, csak hozzájáruló vevőknek. Placeholderek: {customer_name}, {company_name}, {review_url}."
            headerAside={
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-hint font-medium',
                  review?.thankSmsEnabled && review.hasLink
                    ? 'bg-success-soft text-success-ink'
                    : 'bg-subtle text-ink-secondary'
                )}
              >
                {review?.thankSmsEnabled && review.hasLink ? 'Bekapcsolva' : 'Kikapcsolva'}
              </span>
            }
            columns={1}
          >
            <FormField label="Sablon szöveg" htmlFor="sms-review-body" required>
              <textarea
                id="sms-review-body"
                value={reviewThanksBody}
                disabled={!canWrite || pending}
                onChange={(e) => setReviewThanksBody(e.target.value)}
                rows={4}
                maxLength={600}
                className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-body text-ink outline-none focus:border-ink"
              />
            </FormField>

            <TemplatePreview
              body={reviewThanksBody}
              sample={{
                customer_name: 'Kiss Janos',
                company_name: company?.name || 'Pelda Kft',
                review_url: 'https://app.example/g/AbC123?s=sms'
              }}
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href="/beallitasok/google-ertekelesek"
                className="text-hint font-medium text-ink hover:underline"
              >
                Be- és kikapcsolás, időzítés: Google értékelések →
              </Link>
              {canWrite ? (
                <Button
                  type="button"
                  variant="primary"
                  loading={pending}
                  onClick={handleSaveReviewThanks}
                >
                  Köszönő SMS sablon mentése
                </Button>
              ) : null}
            </div>
          </FormSection>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-16 lg:self-start">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body font-medium text-ink">
              Státuszoldal előnézet
            </p>
            {showPreviewToggle ? (
              <div className="flex rounded-md border border-border p-0.5">
                <button
                  type="button"
                  className={cn(
                    'rounded px-2 py-1 text-hint',
                    previewKind === 'cso'
                      ? 'bg-ink text-white'
                      : 'text-ink-secondary hover:bg-subtle'
                  )}
                  onClick={() => setPreviewKind('cso')}
                >
                  Ügyfélrendelés
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded px-2 py-1 text-hint',
                    previewKind === 'quote'
                      ? 'bg-ink text-white'
                      : 'text-ink-secondary hover:bg-subtle'
                  )}
                  onClick={() => setPreviewKind('quote')}
                >
                  Lapszab
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-hint text-ink-muted">
              Így látja az ügyfél a SMS-ben kapott{' '}
              <span className="font-medium text-ink-secondary">/r/…</span>{' '}
              linket (mintaadat).
            </p>
            <Segmented
              label="Rendelés állapota"
              value={previewStage}
              onChange={setPreviewStage}
              options={[
                { value: 'ready', label: 'Átvehető' },
                { value: 'done', label: 'Átadva' }
              ]}
            />
          </div>
          <OrderStatusPreview view={statusPreviewView} />
          <p className="text-hint text-ink-secondary">
            {reviewEnabled
              ? 'Google értékelés kérése: bekapcsolva. Átvehetőnél az oldal alján, átadás után kiemelve.'
              : review?.hasLink
                ? 'Google értékelés kérése a státusz oldalon: kikapcsolva.'
                : 'Google értékelés kéréséhez add meg az értékelő linket a Cégadatokban.'}{' '}
            <Link
              href="/beallitasok/google-ertekelesek"
              className="font-medium text-ink hover:underline"
            >
              Beállítás →
            </Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
