'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useState } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import {
  partnerRegisterAction,
  type PartnerAuthState
} from '@/lib/auth/partner-actions'
import { PARTNER_LOGIN_PATH } from '@/lib/auth/surface'
import { usePartnerHref } from '@/lib/auth/use-partner-href'
import type { PartnerCompanyOption } from '@/lib/partner/companies'
import { getPartnerLegalUrls } from '@/lib/partner/legal-urls'
import {
  formatCompanyRegNumber,
  formatPhoneNumber,
  formatTaxNumber,
  HU_PHONE_EXAMPLE,
  validatePartnerAccountStep,
  validatePartnerBillingStep,
  validatePartnerCompanyStep,
  type PartnerProfileFieldErrors
} from '@/lib/partner/profile-fields'
import { cn } from '@/lib/utils'

const initialState: PartnerAuthState = {}

type Step = 1 | 2 | 3

type Draft = {
  name: string
  email: string
  mobile: string
  password: string
  billing_name: string
  billing_country: string
  billing_city: string
  billing_postal_code: string
  billing_street: string
  billing_house_number: string
  billing_tax_number: string
  billing_company_reg_number: string
  selected_tenant_id: string
}

const emptyDraft: Draft = {
  name: '',
  email: '',
  mobile: '',
  password: '',
  billing_name: '',
  billing_country: 'Magyarország',
  billing_city: '',
  billing_postal_code: '',
  billing_street: '',
  billing_house_number: '',
  billing_tax_number: '',
  billing_company_reg_number: '',
  selected_tenant_id: ''
}

const STEP_META: Record<Step, { title: string; description: string }> = {
  1: {
    title: 'Fiók',
    description: 'Neved, emailed és jelszavad.'
  },
  2: {
    title: 'Számlázás',
    description: 'Számlázási adatok.'
  },
  3: {
    title: 'Cég választása',
    description: 'Melyik cégtől rendelsz?'
  }
}

export function PartnerRegisterWizard() {
  const href = usePartnerHref()
  const legal = getPartnerLegalUrls()
  const [step, setStep] = useState<Step>(1)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [termsError, setTermsError] = useState<string | null>(null)
  const [localErrors, setLocalErrors] = useState<PartnerProfileFieldErrors>({})
  const [companies, setCompanies] = useState<PartnerCompanyOption[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [companiesError, setCompaniesError] = useState<string | null>(null)

  const [state, formAction, pending] = useActionState(
    partnerRegisterAction,
    initialState
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setCompaniesLoading(true)
      setCompaniesError(null)
      try {
        const res = await fetch('/api/partner/companies')
        const json = (await res.json()) as {
          companies?: PartnerCompanyOption[]
          error?: string
        }
        if (!res.ok) {
          throw new Error(json.error || 'Céglista hiba')
        }
        if (!cancelled) {
          setCompanies(json.companies ?? [])
        }
      } catch {
        if (!cancelled) {
          setCompanies([])
          setCompaniesError('A céglista most nem elérhető. Próbáld újra később.')
        }
      } finally {
        if (!cancelled) setCompaniesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const meta = STEP_META[step]
  const mergedErrors = useMemo(
    () => ({ ...localErrors, ...(state.fieldErrors ?? {}) }),
    [localErrors, state.fieldErrors]
  )

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
    setLocalErrors((e) => {
      if (!e[key]) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  function goNext() {
    if (step === 1) {
      const errors = validatePartnerAccountStep(draft, {
        requirePassword: true
      })
      setLocalErrors(errors)
      if (Object.keys(errors).length) return
      setStep(2)
      return
    }
    if (step === 2) {
      const errors = validatePartnerBillingStep(draft)
      setLocalErrors(errors)
      if (Object.keys(errors).length) return
      setStep(3)
    }
  }

  function goBack() {
    setLocalErrors({})
    if (step === 2) setStep(1)
    if (step === 3) setStep(2)
  }

  function onSubmitStep3(e: React.FormEvent<HTMLFormElement>) {
    const errors = validatePartnerCompanyStep(draft)
    setLocalErrors(errors)
    if (!acceptedTerms) {
      setTermsError('Fogadd el az ÁSZF-et és az adatkezelési tájékoztatót.')
      e.preventDefault()
      return
    }
    setTermsError(null)
    if (Object.keys(errors).length) {
      e.preventDefault()
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-hint text-ink-secondary">
        Lépés {step} / 3 — {meta.title}
      </p>
      <div className="mb-1 space-y-0.5">
        <h2 className="sr-only">{meta.title}</h2>
        <p className="text-[13px] text-ink-secondary">{meta.description}</p>
      </div>

      {step < 3 ? (
        <div className="flex flex-col gap-3.5">
          {step === 1 ? (
            <>
              <FormField
                label="Név"
                htmlFor="partner-name"
                required
                error={mergedErrors.name}
              >
                <Input
                  id="partner-name"
                  name="name"
                  value={draft.name}
                  onChange={(e) => patch('name', e.target.value)}
                  autoComplete="name"
                  required
                  placeholder="pl. Kovács János"
                />
              </FormField>
              <FormField
                label="Email"
                htmlFor="partner-reg-email"
                required
                hint={
                  mergedErrors.email ? undefined : 'Ezzel lépsz be.'
                }
                error={mergedErrors.email}
              >
                <Input
                  id="partner-reg-email"
                  name="email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => patch('email', e.target.value)}
                  autoComplete="email"
                  required
                  placeholder="nev@email.hu"
                />
              </FormField>
              <FormField
                label="Telefon"
                htmlFor="partner-mobile"
                required
                hint={
                  mergedErrors.mobile
                    ? undefined
                    : `pl. ${HU_PHONE_EXAMPLE}`
                }
                error={mergedErrors.mobile}
              >
                <Input
                  id="partner-mobile"
                  name="mobile"
                  type="tel"
                  value={draft.mobile}
                  onChange={(e) =>
                    patch('mobile', formatPhoneNumber(e.target.value))
                  }
                  autoComplete="tel"
                  required
                  inputMode="tel"
                  placeholder={HU_PHONE_EXAMPLE}
                />
              </FormField>
              <FormField
                label="Jelszó"
                htmlFor="partner-reg-password"
                required
                hint={
                  mergedErrors.password ? undefined : 'Legalább 8 karakter.'
                }
                error={mergedErrors.password}
              >
                <Input
                  id="partner-reg-password"
                  name="password"
                  type="password"
                  value={draft.password}
                  onChange={(e) => patch('password', e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                />
              </FormField>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <FormField
                label="Számlázási név"
                htmlFor="billing_name"
                hint={
                  mergedErrors.billing_name
                    ? undefined
                    : 'Ha üres, a nevedet használjuk.'
                }
                error={mergedErrors.billing_name}
              >
                <Input
                  id="billing_name"
                  name="billing_name"
                  value={draft.billing_name}
                  onChange={(e) => patch('billing_name', e.target.value)}
                  autoComplete="organization"
                  placeholder="pl. Kovács János"
                />
              </FormField>
              <FormField label="Ország" htmlFor="billing_country">
                <Input
                  id="billing_country"
                  name="billing_country"
                  value={draft.billing_country}
                  onChange={(e) => patch('billing_country', e.target.value)}
                  autoComplete="country-name"
                  placeholder="Magyarország"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField
                  label="Irányítószám"
                  htmlFor="billing_postal_code"
                  error={mergedErrors.billing_postal_code}
                >
                  <Input
                    id="billing_postal_code"
                    name="billing_postal_code"
                    value={draft.billing_postal_code}
                    onChange={(e) =>
                      patch('billing_postal_code', e.target.value)
                    }
                    autoComplete="postal-code"
                    inputMode="numeric"
                    placeholder="pl. 1044"
                  />
                </FormField>
                <FormField
                  label="Város"
                  htmlFor="billing_city"
                  error={mergedErrors.billing_city}
                >
                  <Input
                    id="billing_city"
                    name="billing_city"
                    value={draft.billing_city}
                    onChange={(e) => patch('billing_city', e.target.value)}
                    autoComplete="address-level2"
                    placeholder="pl. Budapest"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField
                  label="Utca"
                  htmlFor="billing_street"
                  error={mergedErrors.billing_street}
                >
                  <Input
                    id="billing_street"
                    name="billing_street"
                    value={draft.billing_street}
                    onChange={(e) => patch('billing_street', e.target.value)}
                    autoComplete="street-address"
                    placeholder="pl. István út"
                  />
                </FormField>
                <FormField label="Házszám" htmlFor="billing_house_number">
                  <Input
                    id="billing_house_number"
                    name="billing_house_number"
                    value={draft.billing_house_number}
                    onChange={(e) =>
                      patch('billing_house_number', e.target.value)
                    }
                    placeholder="pl. 12."
                  />
                </FormField>
              </div>
              <FormField
                label="Adószám"
                htmlFor="billing_tax_number"
                hint={
                  mergedErrors.billing_tax_number
                    ? undefined
                    : 'Magánszemélynél hagyd üresen. Formátum: xxxxxxxx-x-xx.'
                }
                error={mergedErrors.billing_tax_number}
              >
                <Input
                  id="billing_tax_number"
                  name="billing_tax_number"
                  value={draft.billing_tax_number}
                  onChange={(e) =>
                    patch('billing_tax_number', formatTaxNumber(e.target.value))
                  }
                  inputMode="numeric"
                  placeholder="pl. 12345678-1-42"
                />
              </FormField>
              <FormField
                label="Cégjegyzékszám"
                htmlFor="billing_company_reg_number"
                hint={
                  mergedErrors.billing_company_reg_number
                    ? undefined
                    : 'Csak cégnél. Formátum: xx-xx-xxxxxx.'
                }
                error={mergedErrors.billing_company_reg_number}
              >
                <Input
                  id="billing_company_reg_number"
                  name="billing_company_reg_number"
                  value={draft.billing_company_reg_number}
                  onChange={(e) =>
                    patch(
                      'billing_company_reg_number',
                      formatCompanyRegNumber(e.target.value)
                    )
                  }
                  inputMode="numeric"
                  placeholder="pl. 01-09-123456"
                />
              </FormField>
            </>
          ) : null}

          <div
            className={cn(
              'flex gap-2',
              step === 1 ? 'justify-end' : 'justify-between'
            )}
          >
            {step > 1 ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={goBack}
              >
                Vissza
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" size="md" onClick={goNext}>
              Tovább
            </Button>
          </div>
        </div>
      ) : (
        <form
          action={formAction}
          onSubmit={onSubmitStep3}
          className="flex flex-col gap-3.5"
        >
          {/* Hidden account + billing fields for final submit */}
          <input type="hidden" name="name" value={draft.name} />
          <input type="hidden" name="email" value={draft.email} />
          <input type="hidden" name="mobile" value={draft.mobile} />
          <input type="hidden" name="password" value={draft.password} />
          <input type="hidden" name="billing_name" value={draft.billing_name} />
          <input
            type="hidden"
            name="billing_country"
            value={draft.billing_country}
          />
          <input type="hidden" name="billing_city" value={draft.billing_city} />
          <input
            type="hidden"
            name="billing_postal_code"
            value={draft.billing_postal_code}
          />
          <input
            type="hidden"
            name="billing_street"
            value={draft.billing_street}
          />
          <input
            type="hidden"
            name="billing_house_number"
            value={draft.billing_house_number}
          />
          <input
            type="hidden"
            name="billing_tax_number"
            value={draft.billing_tax_number}
          />
          <input
            type="hidden"
            name="billing_company_reg_number"
            value={draft.billing_company_reg_number}
          />

          <input
            type="hidden"
            name="selected_tenant_id"
            value={draft.selected_tenant_id}
          />

          <FormField
            label="Cég"
            htmlFor="selected_tenant_id"
            required
            hint={
              mergedErrors.selected_tenant_id
                ? undefined
                : 'Később a Beállításokban válthatsz.'
            }
            error={mergedErrors.selected_tenant_id}
          >
            <MenuSelect
              id="selected_tenant_id"
              value={draft.selected_tenant_id}
              disabled={companiesLoading || companies.length === 0}
              allowEmpty={false}
              placeholder={
                companiesLoading
                  ? 'Betöltés…'
                  : companies.length === 0
                    ? 'Nincs választható cég'
                    : 'Válassz céget…'
              }
              options={companies.map((c) => ({
                value: c.id,
                label: c.name,
                hint: c.city || undefined
              }))}
              onChange={(v) => patch('selected_tenant_id', v)}
            />
          </FormField>

          {companiesError ? (
            <p className="text-hint text-danger-ink" role="alert">
              {companiesError}
            </p>
          ) : null}

          {!companiesLoading && companies.length === 0 && !companiesError ? (
            <p className="text-hint text-ink-secondary">
              Most nincs választható cég. Próbáld később, vagy írj nekünk.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <label className="flex items-start gap-2 text-body text-ink">
              <input
                type="checkbox"
                name="accept_terms"
                value="on"
                className="mt-0.5 size-3.5 shrink-0 accent-primary"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked)
                  if (e.target.checked) setTermsError(null)
                }}
                required
              />
              <span>
                Elfogadom az{' '}
                <a
                  href={legal.aszf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink underline underline-offset-2"
                >
                  Általános Szerződési Feltételeket
                </a>{' '}
                és az{' '}
                <a
                  href={legal.privacy}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink underline underline-offset-2"
                >
                  adatkezelési tájékoztatót
                </a>
                .
              </span>
            </label>
            {termsError ? (
              <p className="text-hint text-danger-ink" role="alert">
                {termsError}
              </p>
            ) : null}
          </div>

          {state.error ? (
            <p
              className="border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-hint text-danger-ink"
              role="alert"
            >
              {state.error}
            </p>
          ) : null}

          {state.success ? (
            <p
              className="border border-success/30 bg-success-soft px-2.5 py-1.5 text-hint text-success-ink"
              role="status"
            >
              {state.success}{' '}
              <Link
                href={href(PARTNER_LOGIN_PATH)}
                className="font-medium text-ink underline"
              >
                Belépés
              </Link>
            </p>
          ) : null}

          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={goBack}
              disabled={pending}
            >
              Vissza
            </Button>
            <Button
              type="submit"
              size="md"
              loading={pending}
              disabled={
                companiesLoading || companies.length === 0 || !acceptedTerms
              }
            >
              Regisztráció
            </Button>
          </div>
        </form>
      )}

      <p className="text-center text-hint text-ink-secondary">
        Van már fiókod?{' '}
        <Link
          href={href(PARTNER_LOGIN_PATH)}
          className="font-medium text-ink no-underline hover:underline"
        >
          Belépés
        </Link>
      </p>
    </div>
  )
}
