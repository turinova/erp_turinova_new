'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import {
  DocumentBillingFields,
  type DocumentBillingState
} from '@/components/sales/document-billing-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  createCustomer,
  updateCustomer
} from '@/lib/customers/actions'
import {
  formatCompanyRegNumber,
  formatPhoneNumber,
  formatTaxNumber,
  HU_PHONE_EXAMPLE
} from '@/lib/customers/parse'
import type { CustomerDetail } from '@/lib/customers/queries'

type CustomerFormProps = {
  mode: 'create' | 'edit'
  initial?: CustomerDetail | null
  canWrite: boolean
}

function billingFromInitial(
  initial?: CustomerDetail | null
): DocumentBillingState {
  return {
    billingName: initial?.billing_name ?? '',
    billingCountry: initial?.billing_country ?? 'Magyarország',
    billingCity: initial?.billing_city ?? '',
    billingPostalCode: initial?.billing_postal_code ?? '',
    billingStreet: initial?.billing_street ?? '',
    billingHouseNumber: initial?.billing_house_number ?? '',
    billingTaxNumber: initial?.billing_tax_number
      ? formatTaxNumber(initial.billing_tax_number)
      : ''
  }
}

export function CustomerForm({ mode, initial, canWrite }: CustomerFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [name, setName] = useState(initial?.name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [mobile, setMobile] = useState(initial?.mobile ?? '')
  const [smsNotification, setSmsNotification] = useState(
    Boolean(initial?.sms_notification)
  )
  const [billing, setBilling] = useState<DocumentBillingState>(() =>
    billingFromInitial(initial)
  )
  const [billingCompanyRegNumber, setBillingCompanyRegNumber] = useState(
    initial?.billing_company_reg_number ?? ''
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function handleSave() {
    if (!canWrite) return
    startTransition(async () => {
      const payload = {
        name,
        email,
        mobile,
        smsNotification,
        billingName: billing.billingName,
        billingCountry: billing.billingCountry,
        billingCity: billing.billingCity,
        billingPostalCode: billing.billingPostalCode,
        billingStreet: billing.billingStreet,
        billingHouseNumber: billing.billingHouseNumber,
        billingTaxNumber: billing.billingTaxNumber,
        billingCompanyRegNumber
      }

      const result =
        mode === 'edit' && initial
          ? await updateCustomer({ id: initial.id, ...payload })
          : await createCustomer(payload)

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(
        mode === 'edit' ? 'Ügyfél mentve.' : 'Ügyfél létrehozva.'
      )
      setFieldErrors({})
      router.push(`/ugyfelek/${result.id}`)
      router.refresh()
    })
  }

  const title =
    mode === 'edit' ? (initial?.name ?? 'Ügyfél') : 'Új ügyfél'

  return (
    <div className="pb-14">
      <PageHeader
        title={title}
        description="Ügyfelek"
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/ugyfelek')}
            >
              Vissza a listához
            </Button>
            {canWrite ? (
              <Button type="button" loading={pending} onClick={handleSave}>
                Ügyfél mentése
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mt-4 space-y-3">
        <FormSection title="Alapadatok" columns={2}>
          <FormField
            label="Név"
            htmlFor="customer-name"
            required
            error={fieldErrors.name}
            className="sm:col-span-2"
          >
            <Input
              id="customer-name"
              value={name}
              disabled={!canWrite}
              onChange={(e) => setName(e.target.value)}
              autoComplete="organization"
            />
          </FormField>

          <FormField
            label="E-mail"
            htmlFor="customer-email"
            optionalLabel
            error={fieldErrors.email}
          >
            <Input
              id="customer-email"
              type="email"
              value={email}
              disabled={!canWrite}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </FormField>

          <FormField
            label="Mobil"
            htmlFor="customer-mobile"
            optionalLabel
            error={fieldErrors.mobile}
            hint={!fieldErrors.mobile ? `pl. ${HU_PHONE_EXAMPLE}` : undefined}
          >
            <Input
              id="customer-mobile"
              value={mobile}
              disabled={!canWrite}
              onChange={(e) => setMobile(formatPhoneNumber(e.target.value))}
              inputMode="tel"
              autoComplete="tel"
              placeholder={HU_PHONE_EXAMPLE}
            />
          </FormField>

          <div className="sm:col-span-2">
            <Switch
              id="customer-sms"
              checked={smsNotification}
              disabled={!canWrite}
              onCheckedChange={setSmsNotification}
              label="SMS értesítés"
              description="Készre állításkor SMS küldhető, ha a cégnek van SMS add-onja."
            />
          </div>
        </FormSection>

        <FormSection
          title="Számlázás"
          description="Adószám kitöltése után automatikus cégadat (Számlázz / NAV)."
          columns={1}
        >
          <DocumentBillingFields
            value={billing}
            onChange={setBilling}
            disabled={!canWrite || pending}
            idPrefix="customer-bill"
            enableTaxpayerLookup={canWrite}
            hint="Az ügyféltörzsben tárolódik. Adószám → automatikus név és cím."
          />
          {fieldErrors.billingName ||
          fieldErrors.billingTaxNumber ||
          fieldErrors.billingCountry ? (
            <p className="text-hint text-danger-ink" role="alert">
              {fieldErrors.billingName ||
                fieldErrors.billingTaxNumber ||
                fieldErrors.billingCountry}
            </p>
          ) : null}
          <FormField
            label="Cégjegyzékszám"
            htmlFor="customer-reg"
            optionalLabel
            error={fieldErrors.billingCompanyRegNumber}
            hint={
              !fieldErrors.billingCompanyRegNumber
                ? 'pl. 01-09-123456'
                : undefined
            }
          >
            <Input
              id="customer-reg"
              value={billingCompanyRegNumber}
              disabled={!canWrite}
              onChange={(e) =>
                setBillingCompanyRegNumber(
                  formatCompanyRegNumber(e.target.value)
                )
              }
              inputMode="numeric"
              placeholder="01-09-123456"
            />
          </FormField>
        </FormSection>

        {canWrite ? (
          <div className="sticky bottom-0 z-10 flex justify-end gap-1.5 border-t border-border bg-app/95 py-3 backdrop-blur-sm">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => router.push('/ugyfelek')}
            >
              Mégse
            </Button>
            <Button type="button" loading={pending} onClick={handleSave}>
              Ügyfél mentése
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
