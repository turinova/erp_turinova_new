'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PARTNER_QUOTES_PATH } from '@/lib/auth/surface'
import { usePartnerHref } from '@/lib/auth/use-partner-href'
import type { OptiPanelDraft } from '@/lib/opti/panel-draft'
import type { QuoteResult } from '@/lib/opti/quote-calculations'
import type { OptiSheetMaterialOption } from '@/lib/opti/queries'
import { savePartnerOptiQuote } from '@/lib/quotes/partner-actions'
import { PROJECT_NAME_MAX_LENGTH } from '@/lib/quotes/project-name'

export type PartnerOptiCustomerSnapshot = {
  name: string
  email: string
  mobile: string
  billingName: string
  billingCity: string
  billingPostalCode: string
  billingStreet: string
  billingHouseNumber: string
  billingTaxNumber: string
}

export function PartnerOptiSaveStrip({
  customer,
  companyLabel,
  panels,
  quote,
  sheetMaterials,
  quoteId,
  initialProjectName,
  initialSessionProjectName,
  onSessionProjectNameChange,
  onSaveSuccess
}: {
  customer: PartnerOptiCustomerSnapshot
  companyLabel: string | null
  panels: OptiPanelDraft[]
  quote: QuoteResult
  sheetMaterials: OptiSheetMaterialOption[]
  quoteId?: string | null
  initialProjectName?: string | null
  initialSessionProjectName?: string | null
  onSessionProjectNameChange?: (projectName: string) => void
  onSaveSuccess?: () => void
}) {
  const router = useRouter()
  const href = usePartnerHref()
  const isEdit = Boolean(quoteId)
  const [projectName, setProjectName] = useState(
    () => initialProjectName ?? initialSessionProjectName ?? ''
  )
  const [isPending, startTransition] = useTransition()
  const canSave = panels.length > 0
  const sessionReady = useRef(false)

  useEffect(() => {
    sessionReady.current = true
  }, [])

  useEffect(() => {
    if (!sessionReady.current || !onSessionProjectNameChange || isEdit) return
    onSessionProjectNameChange(projectName)
  }, [projectName, onSessionProjectNameChange, isEdit])

  function handleSaveClick() {
    startTransition(async () => {
      const result = await savePartnerOptiQuote({
        quoteId: quoteId ?? null,
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
          ? `Ajánlat frissítve: ${result.quoteNumber}`
          : `Ajánlat mentve: ${result.quoteNumber} (még nem beküldve)`
      )
      onSaveSuccess?.()
      router.push(`${href(PARTNER_QUOTES_PATH)}/${result.id}`)
      router.refresh()
    })
  }

  const address = [
    customer.billingPostalCode,
    customer.billingCity,
    [customer.billingStreet, customer.billingHouseNumber]
      .filter(Boolean)
      .join(' ')
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <section className="overflow-hidden rounded-lg border border-border border-l-[3px] border-l-ink bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-subtle px-3 py-3">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-h3 text-ink">3. Mentés</h2>
          <p className="text-hint text-ink-secondary">
            {isEdit
              ? 'Frissítéskor ugyanaz a Q-szám marad; a panelek és az árazás felülíródik.'
              : 'Mentéskor draft ajánlat jön létre a kapcsolt cégnél. Beküldés később.'}
          </p>
        </div>
        <Button
          type="button"
          onClick={handleSaveClick}
          disabled={!canSave || isPending}
          loading={isPending}
          className="shrink-0"
        >
          {isPending
            ? isEdit
              ? 'Frissítés…'
              : 'Mentés…'
            : isEdit
              ? 'Ajánlat frissítése'
              : 'Ajánlat mentése'}
        </Button>
      </header>

      <div className="space-y-3 p-3">
        <FormField
          label="Projekt neve"
          htmlFor="partner-opti-project-name"
          optionalLabel
          hint="pl. Konyha – Kovács"
        >
          <Input
            id="partner-opti-project-name"
            value={projectName}
            maxLength={PROJECT_NAME_MAX_LENGTH}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </FormField>

        <div className="rounded-md border border-border bg-subtle/50 px-3 py-2.5">
          <p className="text-hint text-ink-muted">Megrendelő (a profilodból)</p>
          <p className="mt-0.5 text-body font-medium text-ink">{customer.name}</p>
          <p className="text-hint text-ink-secondary">
            {[customer.email, customer.mobile].filter(Boolean).join(' · ') ||
              '—'}
          </p>
          {customer.billingName ? (
            <p className="mt-1 text-hint text-ink-secondary">
              Számlázás: {customer.billingName}
              {customer.billingTaxNumber
                ? ` · ${customer.billingTaxNumber}`
                : ''}
            </p>
          ) : null}
          {address ? (
            <p className="text-hint text-ink-secondary">{address}</p>
          ) : null}
        </div>

        {companyLabel ? (
          <p className="text-hint text-ink-secondary">
            Kapcsolt cég: <span className="text-ink">{companyLabel}</span>
          </p>
        ) : null}
      </div>
    </section>
  )
}
