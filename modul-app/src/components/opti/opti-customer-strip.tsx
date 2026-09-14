'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import type { OptiCustomerOption } from '@/lib/customers/queries'
import type { OptiPanelDraft } from '@/lib/opti/panel-draft'
import type { QuoteResult } from '@/lib/opti/quote-calculations'
import type { OptiSheetMaterialOption } from '@/lib/opti/queries'
import { saveOptiQuote } from '@/lib/quotes/actions'
import {
  PROJECT_NAME_MAX_LENGTH
} from '@/lib/quotes/project-name'
import { cn } from '@/lib/utils'

export type OptiCustomerDraft = {
  customerId: string | null
  name: string
  email: string
  mobile: string
  billingName: string
  billingCountry: string
  billingCity: string
  billingPostalCode: string
  billingStreet: string
  billingHouseNumber: string
  billingTaxNumber: string
}

const EMPTY_DRAFT: OptiCustomerDraft = {
  customerId: null,
  name: '',
  email: '',
  mobile: '',
  billingName: '',
  billingCountry: 'Magyarország',
  billingCity: '',
  billingPostalCode: '',
  billingStreet: '',
  billingHouseNumber: '',
  billingTaxNumber: ''
}

function draftFromCustomer(row: OptiCustomerOption): OptiCustomerDraft {
  return {
    customerId: row.id,
    name: row.name,
    email: row.email ?? '',
    mobile: row.mobile ?? '',
    billingName: row.billing_name ?? '',
    billingCountry: row.billing_country || 'Magyarország',
    billingCity: row.billing_city ?? '',
    billingPostalCode: row.billing_postal_code ?? '',
    billingStreet: row.billing_street ?? '',
    billingHouseNumber: row.billing_house_number ?? '',
    billingTaxNumber: row.billing_tax_number ?? ''
  }
}

export function OptiCustomerStrip({
  customers,
  panels,
  quote,
  sheetMaterials,
  quoteId,
  initialCustomer,
  initialProjectName,
  initialDraft,
  initialSessionProjectName,
  onSessionCustomerChange,
  onSaveSuccess
}: {
  customers: OptiCustomerOption[]
  panels: OptiPanelDraft[]
  quote: QuoteResult
  sheetMaterials: OptiSheetMaterialOption[]
  quoteId?: string | null
  initialCustomer?: OptiCustomerOption | null
  initialProjectName?: string | null
  /** Sessionből visszatöltött draft (új Opti). */
  initialDraft?: OptiCustomerDraft | null
  initialSessionProjectName?: string | null
  onSessionCustomerChange?: (
    draft: OptiCustomerDraft,
    projectName: string
  ) => void
  onSaveSuccess?: () => void
}) {
  const router = useRouter()
  const isEdit = Boolean(quoteId)
  const [draft, setDraft] = useState<OptiCustomerDraft>(() => {
    if (initialCustomer) return draftFromCustomer(initialCustomer)
    if (initialDraft?.name?.trim()) return initialDraft
    return EMPTY_DRAFT
  })
  const [projectName, setProjectName] = useState(
    () => initialProjectName ?? initialSessionProjectName ?? ''
  )
  const [billingOpen, setBillingOpen] = useState(
    () => Boolean(initialCustomer || initialDraft?.name?.trim())
  )
  const [nameError, setNameError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()
  const sessionReady = useRef(false)

  useEffect(() => {
    sessionReady.current = true
  }, [])

  useEffect(() => {
    if (!sessionReady.current || !onSessionCustomerChange || isEdit) return
    onSessionCustomerChange(draft, projectName)
  }, [draft, projectName, onSessionCustomerChange, isEdit])

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: c.name,
        hint: [c.email, c.mobile].filter(Boolean).join(' · ') || undefined
      })),
    [customers]
  )

  const canSave = draft.name.trim().length > 0 && panels.length > 0

  function patch(partial: Partial<OptiCustomerDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  function selectExisting(customerId: string) {
    if (!customerId) {
      setDraft(EMPTY_DRAFT)
      return
    }
    const row = customers.find((c) => c.id === customerId)
    if (!row) return
    setNameError(undefined)
    setDraft(draftFromCustomer(row))
    setBillingOpen(true)
  }

  function handleSaveClick() {
    if (!draft.name.trim()) {
      setNameError('A megrendelő neve kötelező a mentéshez.')
      return
    }
    setNameError(undefined)

    startTransition(async () => {
      const result = await saveOptiQuote({
        quoteId: quoteId ?? null,
        customer: {
          customerId: draft.customerId,
          name: draft.name,
          email: draft.email,
          mobile: draft.mobile,
          billingName: draft.billingName,
          billingCountry: draft.billingCountry,
          billingCity: draft.billingCity,
          billingPostalCode: draft.billingPostalCode,
          billingStreet: draft.billingStreet,
          billingHouseNumber: draft.billingHouseNumber,
          billingTaxNumber: draft.billingTaxNumber
        },
        projectName,
        panels,
        quote,
        sheetMaterials
      })

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(
        isEdit
          ? `Árajánlat frissítve: ${result.quoteNumber}`
          : `Árajánlat mentve: ${result.quoteNumber}`
      )
      onSaveSuccess?.()
      router.push(`/ajanlatok/${result.id}`)
    })
  }

  return (
    <section className="overflow-visible rounded-lg border border-border border-l-[3px] border-l-ink bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-subtle px-3 py-3">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-h3 text-ink">3. Megrendelő és mentés</h2>
          <p className="text-hint text-ink-secondary">
            {isEdit
              ? 'Frissítéskor ugyanaz a Q-szám marad; a panelek és az árazás felülíródik.'
              : 'Mentéskor draft árajánlat jön létre (Q-év-nnn). A megrendeléssé alakítás később jön.'}
          </p>
        </div>
        <Button
          type="button"
          onClick={handleSaveClick}
          disabled={!canSave || isPending}
          loading={isPending}
          title={
            !canSave
              ? 'Add meg a megrendelő nevét.'
              : isEdit
                ? 'Árajánlat frissítése'
                : 'Árajánlat mentése'
          }
          className="shrink-0"
        >
          {isPending
            ? isEdit
              ? 'Frissítés…'
              : 'Mentés…'
            : isEdit
              ? 'Árajánlat frissítése'
              : 'Árajánlat mentése'}
        </Button>
      </header>

      <div className="space-y-3 p-3">
        <FormField
          label="Projekt neve"
          htmlFor="opti-project-name"
          optionalLabel
          hint="pl. Konyha – Kovács"
        >
          <Input
            id="opti-project-name"
            value={projectName}
            maxLength={PROJECT_NAME_MAX_LENGTH}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </FormField>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            label="Meglévő ügyfél"
            htmlFor="opti-customer-pick"
            optionalLabel
            hint="Válassz listából, vagy írd be új nevet jobbra."
          >
            <MenuSelect
              id="opti-customer-pick"
              value={draft.customerId ?? ''}
              options={customerOptions}
              allowEmpty
              emptyLabel="Új / nincs kiválasztva"
              placeholder="Válassz ügyfelet…"
              onChange={selectExisting}
            />
          </FormField>

          <FormField
            label="Megrendelő neve"
            htmlFor="opti-customer-name"
            required
            error={nameError}
          >
            <Input
              id="opti-customer-name"
              value={draft.name}
              autoComplete="organization"
              onChange={(e) => {
                const name = e.target.value
                patch({
                  name,
                  customerId:
                    draft.customerId &&
                    customers.find((c) => c.id === draft.customerId)?.name ===
                      name
                      ? draft.customerId
                      : null
                })
                if (nameError) setNameError(undefined)
              }}
            />
          </FormField>

          <FormField label="E-mail" htmlFor="opti-customer-email" optionalLabel>
            <Input
              id="opti-customer-email"
              type="email"
              value={draft.email}
              autoComplete="email"
              onChange={(e) => patch({ email: e.target.value })}
            />
          </FormField>

          <FormField
            label="Telefon"
            htmlFor="opti-customer-mobile"
            optionalLabel
          >
            <Input
              id="opti-customer-mobile"
              value={draft.mobile}
              autoComplete="tel"
              onChange={(e) => patch({ mobile: e.target.value })}
            />
          </FormField>
        </div>

        <div className="rounded-md border border-border">
          <button
            type="button"
            aria-expanded={billingOpen}
            onClick={() => setBillingOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-subtle/80"
          >
            <span className="text-body font-medium text-ink">
              Számlázási adatok
            </span>
            <ChevronDown
              className={cn(
                'size-4 shrink-0 text-ink-secondary transition-transform',
                billingOpen && 'rotate-180'
              )}
              aria-hidden
            />
          </button>

          {billingOpen ? (
            <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="Számlázási név"
                htmlFor="opti-bill-name"
                optionalLabel
              >
                <Input
                  id="opti-bill-name"
                  value={draft.billingName}
                  onChange={(e) => patch({ billingName: e.target.value })}
                />
              </FormField>
              <FormField label="Ország" htmlFor="opti-bill-country" optionalLabel>
                <Input
                  id="opti-bill-country"
                  value={draft.billingCountry}
                  onChange={(e) => patch({ billingCountry: e.target.value })}
                />
              </FormField>
              <FormField label="Város" htmlFor="opti-bill-city" optionalLabel>
                <Input
                  id="opti-bill-city"
                  value={draft.billingCity}
                  onChange={(e) => patch({ billingCity: e.target.value })}
                />
              </FormField>
              <FormField
                label="Irányítószám"
                htmlFor="opti-bill-zip"
                optionalLabel
              >
                <Input
                  id="opti-bill-zip"
                  value={draft.billingPostalCode}
                  onChange={(e) => patch({ billingPostalCode: e.target.value })}
                />
              </FormField>
              <FormField label="Utca" htmlFor="opti-bill-street" optionalLabel>
                <Input
                  id="opti-bill-street"
                  value={draft.billingStreet}
                  onChange={(e) => patch({ billingStreet: e.target.value })}
                />
              </FormField>
              <FormField
                label="Házszám"
                htmlFor="opti-bill-house"
                optionalLabel
              >
                <Input
                  id="opti-bill-house"
                  value={draft.billingHouseNumber}
                  onChange={(e) =>
                    patch({ billingHouseNumber: e.target.value })
                  }
                />
              </FormField>
              <FormField
                label="Adószám"
                htmlFor="opti-bill-tax"
                optionalLabel
              >
                <Input
                  id="opti-bill-tax"
                  value={draft.billingTaxNumber}
                  onChange={(e) => patch({ billingTaxNumber: e.target.value })}
                />
              </FormField>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
