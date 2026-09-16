'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { saveQuoteReadySmsTemplate } from '@/lib/sms/actions'
import { smsSegments, toAsciiSmsText } from '@/lib/sms/text'

type Props = {
  initialBody: string
  canWrite: boolean
}

export function SmsSettingsForm({ initialBody, canWrite }: Props) {
  const [body, setBody] = useState(initialBody)
  const [pending, startTransition] = useTransition()

  const preview = toAsciiSmsText(
    body
      .replace(/\{customer_name\}/g, 'Kiss Janos')
      .replace(/\{order_number\}/g, 'M-1001')
      .replace(/\{company_name\}/g, 'Pelda Kft')
      .replace(/\{material_name\}/g, 'Feher 18mm')
  )
  const segments = smsSegments(preview)

  function handleSave() {
    if (!canWrite) return
    startTransition(async () => {
      const result = await saveQuoteReadySmsTemplate(body)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('SMS sablon mentve.')
    })
  }

  return (
    <div className="pb-14">
      <PageHeader
        title="SMS sablon"
        description="Készre jelentés szöveg. Küldéskor az ékezetek ASCII-re foldolódnak."
      />

      <FormSection
        title="Készre jelentés"
        description="Placeholderek: {customer_name}, {order_number}, {company_name}, {material_name}."
        columns={2}
      >
        <FormField label="Sablon szöveg" htmlFor="sms-body" required>
          <textarea
            id="sms-body"
            value={body}
            disabled={!canWrite || pending}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={600}
            className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-body text-ink outline-none focus:border-ink"
          />
        </FormField>

        <div className="rounded-md border border-border bg-subtle px-2.5 py-2">
          <p className="text-hint font-medium text-ink-secondary">Előnézet</p>
          <p className="mt-1 whitespace-pre-wrap text-body text-ink">{preview}</p>
          <p className="mt-1.5 text-hint text-ink-secondary">
            {preview.length} karakter · ~{segments} SMS szegmens (ops)
          </p>
        </div>
      </FormSection>

      {canWrite ? (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="primary"
            loading={pending}
            onClick={handleSave}
          >
            Sablon mentése
          </Button>
        </div>
      ) : null}
    </div>
  )
}
