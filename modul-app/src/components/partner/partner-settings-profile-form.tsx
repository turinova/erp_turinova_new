'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { PhoneInput } from '@/components/patterns/phone-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  queryPartnerTaxpayerAction,
  updatePartnerProfileAction,
  type PartnerSettingsState
} from '@/lib/auth/partner-settings-actions'
import { HU_TAX_NUMBER_RE } from '@/lib/invoicing/taxpayer'
import {
  formatCompanyRegNumber,
  formatPhoneNumber,
  formatTaxNumber,
  HU_PHONE_EXAMPLE
} from '@/lib/partner/profile-fields'
import type { PartnerProfile } from '@/lib/supabase/database.types'

const initial: PartnerSettingsState = {}

type Props = {
  profile: PartnerProfile
  email: string
}

export function PartnerSettingsProfileForm({ profile, email }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('return')?.trim() || ''
  const requireBilling = Boolean(returnTo)

  const [tax, setTax] = useState(profile.billing_tax_number ?? '')
  const [reg, setReg] = useState(profile.billing_company_reg_number ?? '')
  const [mobile, setMobile] = useState(
    formatPhoneNumber(profile.mobile ?? '')
  )
  const [billingName, setBillingName] = useState(profile.billing_name ?? '')
  const [billingCountry, setBillingCountry] = useState(
    profile.billing_country || 'Magyarország'
  )
  const [billingPostal, setBillingPostal] = useState(
    profile.billing_postal_code ?? ''
  )
  const [billingCity, setBillingCity] = useState(profile.billing_city ?? '')
  const [billingStreet, setBillingStreet] = useState(
    profile.billing_street ?? ''
  )
  const [billingHouse, setBillingHouse] = useState(
    profile.billing_house_number ?? ''
  )

  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupOk, setLookupOk] = useState(false)
  const lastQueried = useRef('')
  const billingRef = useRef({
    billingName,
    billingPostal,
    billingCity,
    billingStreet,
    billingHouse,
    billingCountry
  })
  billingRef.current = {
    billingName,
    billingPostal,
    billingCity,
    billingStreet,
    billingHouse,
    billingCountry
  }

  const [state, formAction, pending] = useActionState(
    updatePartnerProfileAction,
    initial
  )

  useEffect(() => {
    if (!state.message) return
    if (state.ok) {
      toast.success(state.message)
      if (state.redirectTo) {
        router.push(state.redirectTo)
        router.refresh()
      }
    } else toast.error(state.message)
  }, [state, router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash !== '#szamlazas') return
    document.getElementById('szamlazas')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  function applyTaxpayer(taxpayer: {
    name: string
    postalCode: string
    city: string
    street: string
    houseNumber: string
  }) {
    // Adószám-lekérdezés célja a cégnév + cím — mindig felülírjuk
    // (a profilban gyakran személynév van számlázási névként).
    if (taxpayer.name) setBillingName(taxpayer.name)
    if (taxpayer.postalCode) setBillingPostal(taxpayer.postalCode)
    if (taxpayer.city) setBillingCity(taxpayer.city)
    if (taxpayer.street) setBillingStreet(taxpayer.street)
    if (taxpayer.houseNumber) setBillingHouse(taxpayer.houseNumber)
    if (!billingRef.current.billingCountry.trim()) {
      setBillingCountry('Magyarország')
    }
    setLookupOk(true)
    setLookupError(null)
  }

  async function runTaxpayerLookup(opts?: { force?: boolean }) {
    const clean = tax.trim().replace(/\s+/g, '')
    if (!HU_TAX_NUMBER_RE.test(clean)) {
      setLookupError('Érvényes adószám kell (pl. 12345678-1-42).')
      setLookupOk(false)
      return
    }
    if (!opts?.force && clean === lastQueried.current) return

    lastQueried.current = clean
    setLookupLoading(true)
    setLookupError(null)
    setLookupOk(false)
    const result = await queryPartnerTaxpayerAction(clean)
    setLookupLoading(false)
    if (!result.ok) {
      setLookupError(result.message)
      return
    }
    applyTaxpayer(result.taxpayer)
    if (opts?.force) {
      toast.success('Cégadatok kitöltve az adószám alapján.')
    }
  }

  useEffect(() => {
    const clean = tax.trim().replace(/\s+/g, '')
    if (!HU_TAX_NUMBER_RE.test(clean)) {
      setLookupError(null)
      setLookupOk(false)
      return
    }
    if (clean === lastQueried.current) return

    const handle = window.setTimeout(() => {
      void runTaxpayerLookup()
    }, 700)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce only on tax
  }, [tax])

  const fe = state.fieldErrors ?? {}
  const taxLookupReady = HU_TAX_NUMBER_RE.test(tax.trim().replace(/\s+/g, ''))

  return (
    <form
      action={formAction}
      id="szamlazas"
      className="scroll-mt-16 rounded-md border border-border bg-surface p-3"
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-ink">Profil és számlázás</h2>
        <Button type="submit" size="sm" loading={pending}>
          Profil mentése
        </Button>
      </div>

      {requireBilling ? (
        <p
          className="mb-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-hint text-warning-ink"
          role="status"
        >
          A díjbekérőhöz töltsd ki a számlázási címet (név, irányítószám, város,
          utca), majd mentsd. Utána visszaviszünk a beküldéshez.
        </p>
      ) : null}

      <input type="hidden" name="email" value={email} />
      <input
        type="hidden"
        name="selected_tenant_id"
        value={profile.selected_tenant_id ?? ''}
      />
      {returnTo ? (
        <input type="hidden" name="return_to" value={returnTo} />
      ) : null}

      <div className="grid gap-x-2.5 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        <FormField label="Email" htmlFor="settings-email">
          <Input
            id="settings-email"
            value={email}
            readOnly
            disabled
            className="bg-subtle"
            title="Belépési email, nem változtatható"
          />
        </FormField>

        <FormField
          label="Név"
          htmlFor="settings-name"
          required
          error={fe.name}
        >
          <Input
            id="settings-name"
            name="name"
            required
            defaultValue={profile.name}
            placeholder="pl. Kovács János"
          />
        </FormField>

        <FormField
          label="Telefon"
          htmlFor="settings-mobile"
          required
          hint={!fe.mobile ? `pl. ${HU_PHONE_EXAMPLE}` : undefined}
          error={fe.mobile}
        >
          <PhoneInput
            id="settings-mobile"
            name="mobile"
            required
            value={mobile}
            onValueChange={setMobile}
          />
        </FormField>

        <FormField
          label="Adószám"
          htmlFor="settings-tax"
          error={lookupError ?? fe.billing_tax_number}
          hint={
            lookupLoading
              ? 'Cégadatok lekérdezése…'
              : lookupOk
                ? 'Cégadatok kitöltve a Számlázz / NAV alapján.'
                : 'Formátum: 12345678-1-42 — kitöltés után automatikus lekérdezés.'
          }
          className="sm:col-span-2 xl:col-span-2"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              id="settings-tax"
              name="billing_tax_number"
              value={tax}
              onChange={(e) => {
                lastQueried.current = ''
                setTax(formatTaxNumber(e.target.value))
                setLookupOk(false)
                setLookupError(null)
              }}
              disabled={lookupLoading}
              placeholder="12345678-1-42"
              title="Magánszemélynél üresen. Formátum: xxxxxxxx-x-xx"
              inputMode="numeric"
              autoComplete="off"
              className="w-full min-w-[16ch] max-w-[22ch] font-mono tabular-nums tracking-wide sm:w-[22ch]"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              loading={lookupLoading}
              disabled={!taxLookupReady || lookupLoading}
              onClick={() => void runTaxpayerLookup({ force: true })}
            >
              Adatok lekérése
            </Button>
          </div>
        </FormField>

        <FormField
          label="Számlázási név"
          htmlFor="settings-billing-name"
          error={fe.billing_name}
          required={requireBilling}
          className="sm:col-span-2 xl:col-span-2"
        >
          <Input
            id="settings-billing-name"
            name="billing_name"
            required={requireBilling}
            value={billingName}
            onChange={(e) => setBillingName(e.target.value)}
            placeholder="pl. Kovács Asztalos Bt."
            title="Üresen a Név másolódik"
          />
        </FormField>

        <FormField label="Ország" htmlFor="settings-country">
          <Input
            id="settings-country"
            name="billing_country"
            value={billingCountry}
            onChange={(e) => setBillingCountry(e.target.value)}
          />
        </FormField>

        <FormField
          label="Irányítószám"
          htmlFor="settings-postal"
          error={fe.billing_postal_code}
          required={requireBilling}
        >
          <Input
            id="settings-postal"
            name="billing_postal_code"
            required={requireBilling}
            value={billingPostal}
            onChange={(e) => setBillingPostal(e.target.value)}
            placeholder="1044"
          />
        </FormField>

        <FormField
          label="Város"
          htmlFor="settings-city"
          error={fe.billing_city}
          required={requireBilling}
        >
          <Input
            id="settings-city"
            name="billing_city"
            required={requireBilling}
            value={billingCity}
            onChange={(e) => setBillingCity(e.target.value)}
            placeholder="Budapest"
          />
        </FormField>

        <FormField
          label="Utca"
          htmlFor="settings-street"
          error={fe.billing_street}
          required={requireBilling}
          className="sm:col-span-2 xl:col-span-1"
        >
          <Input
            id="settings-street"
            name="billing_street"
            required={requireBilling}
            value={billingStreet}
            onChange={(e) => setBillingStreet(e.target.value)}
            placeholder="István út"
          />
        </FormField>

        <FormField label="Házszám" htmlFor="settings-house">
          <Input
            id="settings-house"
            name="billing_house_number"
            value={billingHouse}
            onChange={(e) => setBillingHouse(e.target.value)}
            placeholder="12."
          />
        </FormField>

        <FormField
          label="Cégjegyzékszám"
          htmlFor="settings-reg"
          error={fe.billing_company_reg_number}
        >
          <Input
            id="settings-reg"
            name="billing_company_reg_number"
            value={reg}
            onChange={(e) => setReg(formatCompanyRegNumber(e.target.value))}
            placeholder="01-09-123456"
            title="Csak cégnél. Formátum: xx-xx-xxxxxx"
          />
        </FormField>
      </div>
    </form>
  )
}
