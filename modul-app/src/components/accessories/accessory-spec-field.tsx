'use client'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import {
  formatSpecNumber,
  specNumberToRaw,
  suggestNumberFromName
} from '@/lib/webshop/key-specs'
import type { ProductAttributeRow } from '@/lib/webshop/types'
import { cn } from '@/lib/utils'

export type SpecInputDraft = {
  numRaw: string
  maxRaw: string
  bool: '' | 'yes' | 'no'
}

export const EMPTY_SPEC_DRAFT: SpecInputDraft = { numRaw: '', maxRaw: '', bool: '' }

type Props = {
  attr: ProductAttributeRow
  draft: SpecInputDraft
  selectedValueIds: string[]
  onDraftChange: (next: SpecInputDraft) => void
  onValuesChange: (valueIds: string[]) => void
  disabled: boolean
  error?: string
  /** Fő kulcsadat: névből javaslat, ha egyértelmű. */
  productName?: string
  emphasis?: boolean
  className?: string
}

function UnitInput({
  id,
  value,
  onChange,
  unit,
  disabled,
  placeholder,
  ariaLabel
}: {
  id: string
  value: string
  onChange: (v: string) => void
  unit: string | null
  disabled: boolean
  placeholder?: string
  ariaLabel?: string
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={unit ? 'pr-10' : undefined}
      />
      {unit ? (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
          {unit}
        </span>
      ) : null}
    </div>
  )
}

export function AccessorySpecField({
  attr,
  draft,
  selectedValueIds,
  onDraftChange,
  onValuesChange,
  disabled,
  error,
  productName,
  emphasis,
  className
}: Props) {
  const fieldId = `accessory-spec-${attr.id}`
  const label = attr.unit && attr.valueType !== 'list' ? `${attr.name} (${attr.unit})` : attr.name
  const activeValues = attr.values.filter((v) => v.active)

  const suggestion =
    productName && attr.valueType === 'number' && !draft.numRaw.trim()
      ? suggestNumberFromName(productName, attr.unit)
      : null

  return (
    <FormField
      label={label}
      htmlFor={fieldId}
      optionalLabel
      error={error}
      hint={attr.measureHint || undefined}
      className={cn(emphasis && 'sm:col-span-2', className)}
    >
      {attr.valueType === 'number' ? (
        <div className="space-y-1">
          <UnitInput
            id={fieldId}
            value={draft.numRaw}
            onChange={(v) => onDraftChange({ ...draft, numRaw: v })}
            unit={attr.unit}
            disabled={disabled}
          />
          {suggestion != null ? (
            <div className="flex flex-wrap items-center gap-1.5 text-hint text-ink-secondary">
              <span>A névből: {formatSpecNumber(suggestion, attr.unit)}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  onDraftChange({ ...draft, numRaw: specNumberToRaw(suggestion) })
                }
              >
                Átveszem
              </Button>
            </div>
          ) : null}
        </div>
      ) : attr.valueType === 'range' ? (
        <div className="grid grid-cols-2 gap-1.5">
          <UnitInput
            id={fieldId}
            value={draft.numRaw}
            onChange={(v) => onDraftChange({ ...draft, numRaw: v })}
            unit={attr.unit}
            disabled={disabled}
            placeholder="tól"
            ariaLabel={`${attr.name} — tól`}
          />
          <UnitInput
            id={`${fieldId}-max`}
            value={draft.maxRaw}
            onChange={(v) => onDraftChange({ ...draft, maxRaw: v })}
            unit={attr.unit}
            disabled={disabled}
            placeholder="ig"
            ariaLabel={`${attr.name} — ig`}
          />
        </div>
      ) : attr.valueType === 'boolean' ? (
        <MenuSelect
          id={fieldId}
          value={draft.bool}
          allowEmpty
          placeholder="Nincs megadva"
          options={[
            { value: 'yes', label: 'Igen' },
            { value: 'no', label: 'Nem' }
          ]}
          onChange={(v) =>
            onDraftChange({ ...draft, bool: v === 'yes' ? 'yes' : v === 'no' ? 'no' : '' })
          }
          disabled={disabled}
        />
      ) : attr.allowMultiple ? (
        <div id={fieldId} role="group" aria-label={attr.name} className="flex flex-wrap gap-1.5">
          {activeValues.length === 0 ? (
            <span className="text-hint text-ink-secondary">
              Nincs érték — a Jellemzők oldalon adhatsz hozzá.
            </span>
          ) : null}
          {activeValues.map((v) => {
            const on = selectedValueIds.includes(v.id)
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() =>
                  onValuesChange(
                    on
                      ? selectedValueIds.filter((id) => id !== v.id)
                      : [...selectedValueIds, v.id]
                  )
                }
                className={cn(
                  'inline-flex h-8 items-center rounded-md border px-2.5 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60',
                  on
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-ink hover:bg-subtle'
                )}
              >
                {v.label}
              </button>
            )
          })}
        </div>
      ) : (
        <MenuSelect
          id={fieldId}
          value={selectedValueIds[0] ?? ''}
          allowEmpty
          placeholder={`Válassz: ${attr.name}…`}
          options={activeValues.map((v) => ({ value: v.id, label: v.label }))}
          onChange={(v) => onValuesChange(v ? [v] : [])}
          disabled={disabled}
        />
      )}
    </FormField>
  )
}
