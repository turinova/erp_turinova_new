'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { CompanyLogoField } from '@/components/company/company-logo-field'
import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { upsertTenantCompany } from '@/lib/company/actions'
import {
  formatCompanyRegNumber,
  formatPhoneNumber,
  formatTaxNumber
} from '@/lib/company/parse'
import type { TenantCompanyRow } from '@/lib/company/queries'

type CompanySettingsFormProps = {
  initial: TenantCompanyRow
  tenantId: string
  canWrite: boolean
}

export function CompanySettingsForm({
  initial,
  tenantId,
  canWrite
}: CompanySettingsFormProps) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(initial.name)
  const [email, setEmail] = useState(initial.email ?? '')
  const [phoneNumber, setPhoneNumber] = useState(initial.phone_number ?? '')
  const [website, setWebsite] = useState(initial.website ?? '')
  const [country, setCountry] = useState(initial.country || 'Magyarország')
  const [city, setCity] = useState(initial.city ?? '')
  const [postalCode, setPostalCode] = useState(initial.postal_code ?? '')
  const [address, setAddress] = useState(initial.address ?? '')
  const [taxNumber, setTaxNumber] = useState(initial.tax_number ?? '')
  const [companyRegistrationNumber, setCompanyRegistrationNumber] = useState(
    initial.company_registration_number ?? ''
  )
  const [vatId, setVatId] = useState(initial.vat_id ?? '')
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logo_url)
  const [quoteValidityDays, setQuoteValidityDays] = useState(
    String(initial.quote_validity_days ?? 14)
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canWrite) return
    setFieldErrors({})

    startTransition(async () => {
      const result = await upsertTenantCompany({
        name,
        email,
        phoneNumber,
        website,
        country,
        city,
        postalCode,
        address,
        taxNumber,
        companyRegistrationNumber,
        vatId,
        logoUrl: logoUrl ?? '',
        quoteValidityDays: Number(quoteValidityDays)
      })

      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        toast.error(result.message)
        return
      }

      toast.success('Cégadatok mentve.')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PageHeader
        title="Cégadatok"
        description="A cég megjelenő és számlázási adatai. Az árajánlat PDF ezeket használja."
        actions={
          canWrite ? (
            <Button type="submit" disabled={pending} loading={pending}>
              {pending ? 'Mentés…' : 'Mentés'}
            </Button>
          ) : null
        }
      />

      {!canWrite ? (
        <p className="rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink-secondary">
          Csak megtekintési jogod van — nem módosíthatsz.
        </p>
      ) : null}

      <FormSection title="Alapadatok" columns={2}>
        <FormField
          label="Cég neve"
          htmlFor="company-name"
          required
          error={fieldErrors.name}
        >
          <Input
            id="company-name"
            value={name}
            disabled={!canWrite || pending}
            autoComplete="organization"
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <FormField
          label="E-mail"
          htmlFor="company-email"
          optionalLabel
          error={fieldErrors.email}
        >
          <Input
            id="company-email"
            type="email"
            value={email}
            disabled={!canWrite || pending}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <FormField
          label="Telefonszám"
          htmlFor="company-phone"
          optionalLabel
          error={fieldErrors.phoneNumber}
          hint={
            !fieldErrors.phoneNumber ? 'pl. +36 30 999 2800' : undefined
          }
        >
          <Input
            id="company-phone"
            value={phoneNumber}
            disabled={!canWrite || pending}
            placeholder="+36 30 999 2800"
            autoComplete="tel"
            inputMode="tel"
            onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
          />
        </FormField>
        <FormField
          label="Weboldal"
          htmlFor="company-website"
          optionalLabel
          error={fieldErrors.website}
        >
          <Input
            id="company-website"
            value={website}
            disabled={!canWrite || pending}
            placeholder="https://pelda.hu"
            onChange={(e) => setWebsite(e.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection title="Címadatok" columns={2}>
        <FormField
          label="Ország"
          htmlFor="company-country"
          required
          error={fieldErrors.country}
        >
          <Input
            id="company-country"
            value={country}
            disabled={!canWrite || pending}
            onChange={(e) => setCountry(e.target.value)}
          />
        </FormField>
        <FormField
          label="Város"
          htmlFor="company-city"
          optionalLabel
          error={fieldErrors.city}
        >
          <Input
            id="company-city"
            value={city}
            disabled={!canWrite || pending}
            onChange={(e) => setCity(e.target.value)}
          />
        </FormField>
        <FormField
          label="Irányítószám"
          htmlFor="company-zip"
          optionalLabel
          error={fieldErrors.postalCode}
        >
          <Input
            id="company-zip"
            value={postalCode}
            disabled={!canWrite || pending}
            onChange={(e) => setPostalCode(e.target.value)}
          />
        </FormField>
        <FormField
          label="Cím"
          htmlFor="company-address"
          optionalLabel
          error={fieldErrors.address}
          hint="Utca, házszám egy mezőben."
        >
          <Input
            id="company-address"
            value={address}
            disabled={!canWrite || pending}
            onChange={(e) => setAddress(e.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection title="Adó- és nyilvántartási adatok" columns={2}>
        <FormField
          label="Adószám"
          htmlFor="company-tax"
          optionalLabel
          error={fieldErrors.taxNumber}
        >
          <Input
            id="company-tax"
            value={taxNumber}
            disabled={!canWrite || pending}
            placeholder="12345678-1-02"
            onChange={(e) => setTaxNumber(formatTaxNumber(e.target.value))}
          />
        </FormField>
        <FormField
          label="Cégjegyzékszám"
          htmlFor="company-reg"
          optionalLabel
          error={fieldErrors.companyRegistrationNumber}
        >
          <Input
            id="company-reg"
            value={companyRegistrationNumber}
            disabled={!canWrite || pending}
            placeholder="01-09-123456"
            onChange={(e) =>
              setCompanyRegistrationNumber(
                formatCompanyRegNumber(e.target.value)
              )
            }
          />
        </FormField>
        <FormField
          label="EU ÁFA szám"
          htmlFor="company-vat"
          optionalLabel
          error={fieldErrors.vatId}
        >
          <Input
            id="company-vat"
            value={vatId}
            disabled={!canWrite || pending}
            placeholder="HU12345678"
            onChange={(e) => setVatId(e.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Árajánlat"
        description="PDF keltezéstől számított érvényesség."
        columns={2}
      >
        <FormField
          label="Érvényesség (nap)"
          htmlFor="company-quote-validity"
          required
          error={fieldErrors.quoteValidityDays}
          hint="Alapértelmezett: 14 nap (2 hét)."
        >
          <Input
            id="company-quote-validity"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            step={1}
            value={quoteValidityDays}
            disabled={!canWrite || pending}
            onChange={(e) => setQuoteValidityDays(e.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Cég logo"
        description="Árajánlat PDF fejlécben jelenik meg."
        columns={2}
      >
        <CompanyLogoField
          tenantId={tenantId}
          value={logoUrl}
          onChange={setLogoUrl}
          disabled={!canWrite || pending}
          error={fieldErrors.logoUrl}
        />
      </FormSection>
    </form>
  )
}
