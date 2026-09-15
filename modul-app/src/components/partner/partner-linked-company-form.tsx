'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { MenuSelect } from '@/components/ui/menu-select'
import {
  updatePartnerLinkedCompanyAction,
  type PartnerSettingsState
} from '@/lib/auth/partner-settings-actions'
import type { PartnerCompanyOption } from '@/lib/partner/companies'

const initial: PartnerSettingsState = {}

type Props = {
  selectedTenantId: string | null
}

export function PartnerLinkedCompanyForm({ selectedTenantId }: Props) {
  const [companies, setCompanies] = useState<PartnerCompanyOption[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [value, setValue] = useState(selectedTenantId ?? '')

  const [state, formAction, pending] = useActionState(
    updatePartnerLinkedCompanyAction,
    initial
  )

  useEffect(() => {
    setValue(selectedTenantId ?? '')
  }, [selectedTenantId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/partner/companies')
        const json = (await res.json()) as { companies?: PartnerCompanyOption[] }
        if (!cancelled) setCompanies(json.companies ?? [])
      } catch {
        if (!cancelled) setCompanies([])
      } finally {
        if (!cancelled) setLoadingCompanies(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state.message) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])

  const fe = state.fieldErrors ?? {}

  return (
    <form
      action={formAction}
      className="rounded-md border border-primary/25 bg-primary-soft/40 p-3"
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold text-ink">Kapcsolt cég</h2>
          <p className="text-hint text-ink-secondary">
            A Kereső és az Opti ettől a cégtől veszi az anyagokat és az árakat.
            Ha váltasz, az új ajánlatok az új céghez tartoznak; a régiek a régi
            cégnél maradnak.
          </p>
        </div>
        <Button type="submit" size="sm" loading={pending} className="shrink-0">
          Cég mentése
        </Button>
      </div>

      <input type="hidden" name="selected_tenant_id" value={value} />

      <FormField
        label="Kapcsolt cég"
        htmlFor="linked-tenant"
        required
        error={fe.selected_tenant_id}
      >
        <MenuSelect
          id="linked-tenant"
          value={value}
          disabled={loadingCompanies}
          allowEmpty={false}
          placeholder={loadingCompanies ? 'Betöltés…' : 'Válassz céget…'}
          className="max-w-xl"
          options={companies.map((c) => ({
            value: c.id,
            label: c.name,
            hint: c.city || undefined
          }))}
          onChange={setValue}
        />
      </FormField>

      {!loadingCompanies && companies.length === 0 ? (
        <p className="mt-2 text-hint text-ink-secondary">
          Most nincs választható cég. A platformon kapcsold be az „Online partner
          rendelés” add-ont.
        </p>
      ) : null}
    </form>
  )
}
