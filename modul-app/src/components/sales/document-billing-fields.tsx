'use client'

import { FormField } from '@/components/patterns/form-field'
import { Input } from '@/components/ui/input'
import { formatTaxNumber } from '@/lib/customers/parse'

/** Dokumentum számlázás (eladás / árajánlat / POS) — nem ügyféltörzs. */
export type DocumentBillingState = {
  billingName: string
  billingCountry: string
  billingCity: string
  billingPostalCode: string
  billingStreet: string
  billingHouseNumber: string
  billingTaxNumber: string
}

export const EMPTY_DOCUMENT_BILLING: DocumentBillingState = {
  billingName: '',
  billingCountry: 'Magyarország',
  billingCity: '',
  billingPostalCode: '',
  billingStreet: '',
  billingHouseNumber: '',
  billingTaxNumber: ''
}

export function billingFromCustomer(c: {
  name?: string | null
  billing_name?: string | null
  billing_country?: string | null
  billing_city?: string | null
  billing_postal_code?: string | null
  billing_street?: string | null
  billing_house_number?: string | null
  billing_tax_number?: string | null
}): DocumentBillingState {
  return {
    billingName: c.billing_name || c.name || '',
    billingCountry: c.billing_country || 'Magyarország',
    billingCity: c.billing_city || '',
    billingPostalCode: c.billing_postal_code || '',
    billingStreet: c.billing_street || '',
    billingHouseNumber: c.billing_house_number || '',
    billingTaxNumber: c.billing_tax_number
      ? formatTaxNumber(c.billing_tax_number)
      : ''
  }
}

export function billingHasAny(b: DocumentBillingState): boolean {
  return Boolean(
    b.billingName.trim() ||
      b.billingCity.trim() ||
      b.billingStreet.trim() ||
      b.billingTaxNumber.trim() ||
      b.billingPostalCode.trim() ||
      b.billingHouseNumber.trim()
  )
}

export function billingToFormInput(b: DocumentBillingState) {
  return {
    billingName: b.billingName.trim() || null,
    billingCountry: b.billingCountry.trim() || 'Magyarország',
    billingCity: b.billingCity.trim() || null,
    billingPostalCode: b.billingPostalCode.trim() || null,
    billingStreet: b.billingStreet.trim() || null,
    billingHouseNumber: b.billingHouseNumber.trim() || null,
    billingTaxNumber: b.billingTaxNumber.trim() || null
  }
}

type Props = {
  value: DocumentBillingState
  onChange: (next: DocumentBillingState) => void
  disabled?: boolean
  idPrefix?: string
  /** Hint a mezők felett */
  hint?: string
}

export function DocumentBillingFields({
  value,
  onChange,
  disabled,
  idPrefix = 'doc-bill',
  hint = 'Csak ezen a dokumentumon érvényes. Az ügyféltörzset nem írja felül.'
}: Props) {
  function patch(partial: Partial<DocumentBillingState>) {
    onChange({ ...value, ...partial })
  }

  return (
    <div className="space-y-2">
      {hint ? <p className="text-hint text-ink-muted">{hint}</p> : null}
      <FormField label="Számlázási név" htmlFor={`${idPrefix}-name`}>
        <Input
          id={`${idPrefix}-name`}
          value={value.billingName}
          disabled={disabled}
          onChange={(e) => patch({ billingName: e.target.value })}
        />
      </FormField>
      <div className="grid gap-2 sm:grid-cols-2">
        <FormField label="Irányítószám" htmlFor={`${idPrefix}-zip`}>
          <Input
            id={`${idPrefix}-zip`}
            value={value.billingPostalCode}
            disabled={disabled}
            onChange={(e) => patch({ billingPostalCode: e.target.value })}
          />
        </FormField>
        <FormField label="Város" htmlFor={`${idPrefix}-city`}>
          <Input
            id={`${idPrefix}-city`}
            value={value.billingCity}
            disabled={disabled}
            onChange={(e) => patch({ billingCity: e.target.value })}
          />
        </FormField>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
        <FormField label="Utca" htmlFor={`${idPrefix}-street`}>
          <Input
            id={`${idPrefix}-street`}
            value={value.billingStreet}
            disabled={disabled}
            onChange={(e) => patch({ billingStreet: e.target.value })}
          />
        </FormField>
        <FormField label="Házszám" htmlFor={`${idPrefix}-hn`}>
          <Input
            id={`${idPrefix}-hn`}
            value={value.billingHouseNumber}
            disabled={disabled}
            onChange={(e) => patch({ billingHouseNumber: e.target.value })}
          />
        </FormField>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <FormField label="Ország" htmlFor={`${idPrefix}-country`}>
          <Input
            id={`${idPrefix}-country`}
            value={value.billingCountry}
            disabled={disabled}
            onChange={(e) => patch({ billingCountry: e.target.value })}
          />
        </FormField>
        <FormField
          label="Adószám"
          htmlFor={`${idPrefix}-tax`}
          hint="Formátum: 12345678-1-02"
        >
          <Input
            id={`${idPrefix}-tax`}
            value={value.billingTaxNumber}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="off"
            placeholder="12345678-1-02"
            maxLength={13}
            onChange={(e) =>
              patch({ billingTaxNumber: formatTaxNumber(e.target.value) })
            }
          />
        </FormField>
      </div>
    </div>
  )
}
