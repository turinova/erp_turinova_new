'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import {
  saveCsoReadySmsTemplate,
  saveQuoteReadySmsTemplate
} from '@/lib/sms/actions'
import { smsSegments, toAsciiSmsText } from '@/lib/sms/text'

type Props = {
  quoteBody: string
  csoBody: string
  showQuote: boolean
  showCso: boolean
  canWrite: boolean
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
      <p className="text-hint font-medium text-ink-secondary">Előnézet</p>
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
  showQuote,
  showCso,
  canWrite
}: Props) {
  const [quoteBody, setQuoteBody] = useState(initialQuote)
  const [csoBody, setCsoBody] = useState(initialCso)
  const [pending, startTransition] = useTransition()

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

  return (
    <div className="pb-14">
      <PageHeader
        title="SMS sablonok"
        description="Készre / átvehető értesítők. Küldéskor az ékezetek ASCII-re foldolódnak."
      />

      {showQuote ? (
        <FormSection
          title="Lapszabászat — kész"
          description="Placeholderek: {customer_name}, {order_number}, {company_name}, {material_name}."
          columns={2}
        >
          <FormField label="Sablon szöveg" htmlFor="sms-quote-body" required>
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
              company_name: 'Pelda Kft',
              material_name: 'Feher 18mm'
            }}
          />

          {canWrite ? (
            <div className="col-span-full flex justify-end">
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
          description="Placeholderek: {customer_name}, {order_number}, {company_name}, {total_amount}, {ready_count}, {waiting_count}."
          columns={2}
        >
          <FormField label="Sablon szöveg" htmlFor="sms-cso-body" required>
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
              company_name: 'Pelda Kft',
              total_amount: '12 500',
              ready_count: '2',
              waiting_count: '0'
            }}
          />

          {canWrite ? (
            <div className="col-span-full flex justify-end">
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
    </div>
  )
}
