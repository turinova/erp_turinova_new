"use client"

import type { HungarianAddress } from "@/types/organization"
import { sanitizePostalCodeInput } from "@/lib/organizations/address"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type AddressFieldsProps = {
  idPrefix: string
  label: string
  value: HungarianAddress
  onChange: (next: HungarianAddress) => void
}

export function AddressFields({ idPrefix, label, value, onChange }: AddressFieldsProps) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-[var(--border)] p-4">
      <legend className="px-1 text-sm font-medium text-[var(--foreground)]">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-[5.5rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-postal`}>Irányítószám</Label>
          <Input
            id={`${idPrefix}-postal`}
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            placeholder="1051"
            value={value.postalCode}
            onChange={(e) =>
              onChange({ ...value, postalCode: sanitizePostalCodeInput(e.target.value) })
            }
            className="font-code tabular-nums"
            autoComplete="postal-code"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-city`}>Település</Label>
          <Input
            id={`${idPrefix}-city`}
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            placeholder="Budapest"
            autoComplete="address-level2"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-street`}>Utca, házszám</Label>
        <Input
          id={`${idPrefix}-street`}
          value={value.street}
          onChange={(e) => onChange({ ...value, street: e.target.value })}
          placeholder="Példa utca 12."
          autoComplete="street-address"
        />
      </div>
    </fieldset>
  )
}
