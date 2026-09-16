'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
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

export function CustomerForm({ mode, initial, canWrite }: CustomerFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [name, setName] = useState(initial?.name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [mobile, setMobile] = useState(initial?.mobile ?? '')
  const [smsNotification, setSmsNotification] = useState(
    Boolean(initial?.sms_notification)
  )
  const [billingName, setBillingName] = useState(initial?.billing_name ?? '')
  const [billingCountry, setBillingCountry] = useState(
    initial?.billing_country ?? 'Magyarország'
  )
  const [billingCity, setBillingCity] = useState(initial?.billing_city ?? '')
  const [billingPostalCode, setBillingPostalCode] = useState(
    initial?.billing_postal_code ?? ''
  )
  const [billingStreet, setBillingStreet] = useState(
    initial?.billing_street ?? ''
  )
  const [billingHouseNumber, setBillingHouseNumber] = useState(
    initial?.billing_house_number ?? ''
  )
  const [billingTaxNumber, setBillingTaxNumber] = useState(
    initial?.billing_tax_number ?? ''
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
        billingName,
        billingCountry,
        billingCity,
        billingPostalCode,
        billingStreet,
        billingHouseNumber,
        billingTaxNumber,
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

      <div className="w-full max-w-6xl space-y-2.5">
        <FormSection
          title="Kapcsolat"
          description="Név és elérhetőségek."
          columns={4}
        >
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
            label="Telefonszám"
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
          description="Számlázási cím és adóazonosítók."
          columns={4}
        >
          <FormField
            label="Számlázási név"
            htmlFor="customer-billing-name"
            optionalLabel
            error={fieldErrors.billingName}
            className="sm:col-span-2"
          >
            <Input
              id="customer-billing-name"
              value={billingName}
              disabled={!canWrite}
              onChange={(e) => setBillingName(e.target.value)}
            />
          </FormField>

          <FormField
            label="Ország"
            htmlFor="customer-billing-country"
            required
            error={fieldErrors.billingCountry}
          >
            <Input
              id="customer-billing-country"
              value={billingCountry}
              disabled={!canWrite}
              onChange={(e) => setBillingCountry(e.target.value)}
            />
          </FormField>

          <FormField
            label="Város"
            htmlFor="customer-billing-city"
            optionalLabel
            error={fieldErrors.billingCity}
          >
            <Input
              id="customer-billing-city"
              value={billingCity}
              disabled={!canWrite}
              onChange={(e) => setBillingCity(e.target.value)}
            />
          </FormField>

          <FormField
            label="Irányítószám"
            htmlFor="customer-billing-zip"
            optionalLabel
            error={fieldErrors.billingPostalCode}
          >
            <Input
              id="customer-billing-zip"
              value={billingPostalCode}
              disabled={!canWrite}
              onChange={(e) => setBillingPostalCode(e.target.value)}
            />
          </FormField>

          <FormField
            label="Utca"
            htmlFor="customer-billing-street"
            optionalLabel
            error={fieldErrors.billingStreet}
            className="sm:col-span-2"
          >
            <Input
              id="customer-billing-street"
              value={billingStreet}
              disabled={!canWrite}
              onChange={(e) => setBillingStreet(e.target.value)}
            />
          </FormField>

          <FormField
            label="Házszám"
            htmlFor="customer-billing-house"
            optionalLabel
            error={fieldErrors.billingHouseNumber}
          >
            <Input
              id="customer-billing-house"
              value={billingHouseNumber}
              disabled={!canWrite}
              onChange={(e) => setBillingHouseNumber(e.target.value)}
            />
          </FormField>

          <FormField
            label="Adószám"
            htmlFor="customer-tax"
            optionalLabel
            error={fieldErrors.billingTaxNumber}
            hint={
              !fieldErrors.billingTaxNumber ? 'pl. 12345678-1-02' : undefined
            }
          >
            <Input
              id="customer-tax"
              value={billingTaxNumber}
              disabled={!canWrite}
              onChange={(e) =>
                setBillingTaxNumber(formatTaxNumber(e.target.value))
              }
              inputMode="numeric"
              placeholder="12345678-1-02"
            />
          </FormField>

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
            className="sm:col-span-2"
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
