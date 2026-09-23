'use client'

import { useEffect, useRef, useState } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { Input } from '@/components/ui/input'
import { formatTaxNumber } from '@/lib/customers/parse'
import { queryTaxpayerAction } from '@/lib/invoicing/actions'
import { HU_TAX_NUMBER_RE } from '@/lib/invoicing/taxpayer'

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
  /** Adószám → Számlázz taxpayer autofill (POS / számla dialógus) */
  enableTaxpayerLookup?: boolean
  /** Adószám mező fókusz nyitáskor */
  autoFocusTax?: boolean
}

export function DocumentBillingFields({
  value,
  onChange,
  disabled,
  idPrefix = 'doc-bill',
  hint = 'Csak ezen a dokumentumon érvényes. Az ügyféltörzset nem írja felül.',
  enableTaxpayerLookup = false,
  autoFocusTax = false
}: Props) {
  const taxRef = useRef<HTMLInputElement>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupOk, setLookupOk] = useState(false)
  const lastQueried = useRef<string>('')
  const valueRef = useRef(value)
  valueRef.current = value

  function patch(partial: Partial<DocumentBillingState>) {
    onChange({ ...value, ...partial })
  }

  useEffect(() => {
    if (!autoFocusTax) return
    const id = window.setTimeout(() => taxRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [autoFocusTax])

  useEffect(() => {
    if (!enableTaxpayerLookup || disabled) return
    const tax = value.billingTaxNumber.trim()
    if (!HU_TAX_NUMBER_RE.test(tax)) {
      setLookupError(null)
      setLookupOk(false)
      return
    }
    if (tax === lastQueried.current) return

    const handle = window.setTimeout(() => {
      lastQueried.current = tax
      setLookupLoading(true)
      setLookupError(null)
      setLookupOk(false)
      void queryTaxpayerAction(tax).then((result) => {
        setLookupLoading(false)
        if (!result.ok) {
          setLookupError(result.message)
          return
        }
        const t = result.taxpayer
        const cur = valueRef.current
        // Csak üres mezőket tölt — kézzel írt adatot nem törli
        onChange({
          ...cur,
          billingTaxNumber: tax,
          billingName: cur.billingName.trim()
            ? cur.billingName
            : t.name || cur.billingName,
          billingPostalCode: cur.billingPostalCode.trim()
            ? cur.billingPostalCode
            : t.postalCode || cur.billingPostalCode,
          billingCity: cur.billingCity.trim()
            ? cur.billingCity
            : t.city || cur.billingCity,
          billingStreet: cur.billingStreet.trim()
            ? cur.billingStreet
            : t.street || cur.billingStreet,
          billingHouseNumber: cur.billingHouseNumber.trim()
            ? cur.billingHouseNumber
            : t.houseNumber || cur.billingHouseNumber,
          billingCountry: cur.billingCountry || 'Magyarország'
        })
        setLookupOk(true)
      })
    }, 700)

    return () => window.clearTimeout(handle)
  }, [
    value.billingTaxNumber,
    enableTaxpayerLookup,
    disabled,
    onChange
  ])

  return (
    <div className="space-y-2">
      {hint ? <p className="text-hint text-ink-muted">{hint}</p> : null}

      <FormField
        label="Adószám"
        htmlFor={`${idPrefix}-tax`}
        hint={
          enableTaxpayerLookup
            ? lookupLoading
              ? 'Cégadatok lekérdezése…'
              : lookupOk
                ? 'Cégadatok kitöltve a Számlázz / NAV alapján.'
                : 'Formátum: 12345678-1-02 — kitöltés után automatikus lekérdezés.'
            : 'Formátum: 12345678-1-02'
        }
        error={lookupError ?? undefined}
      >
        <Input
          ref={taxRef}
          id={`${idPrefix}-tax`}
          value={value.billingTaxNumber}
          disabled={disabled || lookupLoading}
          inputMode="numeric"
          autoComplete="off"
          placeholder="12345678-1-02"
          maxLength={13}
          onChange={(e) => {
            lastQueried.current = ''
            setLookupOk(false)
            setLookupError(null)
            patch({ billingTaxNumber: formatTaxNumber(e.target.value) })
          }}
        />
      </FormField>

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
      <FormField label="Ország" htmlFor={`${idPrefix}-country`}>
        <Input
          id={`${idPrefix}-country`}
          value={value.billingCountry}
          disabled={disabled}
          onChange={(e) => patch({ billingCountry: e.target.value })}
        />
      </FormField>
    </div>
  )
}
