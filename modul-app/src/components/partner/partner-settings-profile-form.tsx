'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  updatePartnerProfileAction,
  type PartnerSettingsState
} from '@/lib/auth/partner-settings-actions'
import {
  formatCompanyRegNumber,
  formatTaxNumber
} from '@/lib/partner/profile-fields'
import type { PartnerProfile } from '@/lib/supabase/database.types'

const initial: PartnerSettingsState = {}

type Props = {
  profile: PartnerProfile
  email: string
}

export function PartnerSettingsProfileForm({ profile, email }: Props) {
  const [tax, setTax] = useState(profile.billing_tax_number ?? '')
  const [reg, setReg] = useState(profile.billing_company_reg_number ?? '')

  const [state, formAction, pending] = useActionState(
    updatePartnerProfileAction,
    initial
  )

  useEffect(() => {
    if (!state.message) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])

  const fe = state.fieldErrors ?? {}

  return (
    <form
      action={formAction}
      className="rounded-md border border-border bg-surface p-3"
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-ink">Profil és számlázás</h2>
        <Button type="submit" size="sm" loading={pending}>
          Profil mentése
        </Button>
      </div>

      <input type="hidden" name="email" value={email} />
      <input
        type="hidden"
        name="selected_tenant_id"
        value={profile.selected_tenant_id ?? ''}
      />

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
          label="Mobil"
          htmlFor="settings-mobile"
          required
          error={fe.mobile}
        >
          <Input
            id="settings-mobile"
            name="mobile"
            type="tel"
            required
            defaultValue={profile.mobile ?? ''}
            placeholder="+36 30…"
          />
        </FormField>

        <FormField
          label="Számlázási név"
          htmlFor="settings-billing-name"
          error={fe.billing_name}
          className="sm:col-span-2 xl:col-span-1"
        >
          <Input
            id="settings-billing-name"
            name="billing_name"
            defaultValue={profile.billing_name ?? ''}
            placeholder="pl. Kovács Asztalos Bt."
            title="Üresen a Név másolódik"
          />
        </FormField>

        <FormField label="Ország" htmlFor="settings-country">
          <Input
            id="settings-country"
            name="billing_country"
            defaultValue={profile.billing_country || 'Magyarország'}
          />
        </FormField>

        <FormField
          label="Irányítószám"
          htmlFor="settings-postal"
          error={fe.billing_postal_code}
        >
          <Input
            id="settings-postal"
            name="billing_postal_code"
            defaultValue={profile.billing_postal_code ?? ''}
            placeholder="1044"
          />
        </FormField>

        <FormField label="Város" htmlFor="settings-city" error={fe.billing_city}>
          <Input
            id="settings-city"
            name="billing_city"
            defaultValue={profile.billing_city ?? ''}
            placeholder="Budapest"
          />
        </FormField>

        <FormField
          label="Utca"
          htmlFor="settings-street"
          error={fe.billing_street}
          className="sm:col-span-2 xl:col-span-1"
        >
          <Input
            id="settings-street"
            name="billing_street"
            defaultValue={profile.billing_street ?? ''}
            placeholder="István út"
          />
        </FormField>

        <FormField label="Házszám" htmlFor="settings-house">
          <Input
            id="settings-house"
            name="billing_house_number"
            defaultValue={profile.billing_house_number ?? ''}
            placeholder="12."
          />
        </FormField>

        <FormField
          label="Adószám"
          htmlFor="settings-tax"
          error={fe.billing_tax_number}
        >
          <Input
            id="settings-tax"
            name="billing_tax_number"
            value={tax}
            onChange={(e) => setTax(formatTaxNumber(e.target.value))}
            placeholder="12345678-1-42"
            title="Magánszemélynél üresen. Formátum: xxxxxxxx-x-xx"
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
