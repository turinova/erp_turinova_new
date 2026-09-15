'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { updatePartnerSearchKinds } from '@/lib/partner-settings/actions'
import type { PartnerSearchKinds } from '@/lib/partner-settings/queries'
import { cn } from '@/lib/utils'

type PartnerSettingsFormProps = {
  initial: PartnerSearchKinds
  canWrite: boolean
}

export function PartnerSettingsForm({
  initial,
  canWrite
}: PartnerSettingsFormProps) {
  const [sheet, setSheet] = useState(initial.sheet)
  const [linear, setLinear] = useState(initial.linear)
  const [accessory, setAccessory] = useState(initial.accessory)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    if (!sheet && !linear && !accessory) {
      setError('Legalább egy keresési típust válassz.')
      return
    }

    startTransition(async () => {
      const result = await updatePartnerSearchKinds({
        searchSheet: sheet,
        searchLinear: linear,
        searchAccessory: accessory
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      toast.success('Partner kereső beállítások mentve.')
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Online partner"
        description="Ezek a beállítások az optinova.hu-s asztalos partnereket érintik."
      />

      <FormSection
        title="Partner kereső"
        description="Mire kereshetnek a partnerek a kapcsolt cég katalógusában."
        columns={2}
      >
        <div className="col-span-full space-y-3 sm:col-span-2">
          <fieldset className="space-y-3" disabled={!canWrite || pending}>
            <legend className="text-label text-ink">
              Mire kereshetnek a partnerek?
            </legend>
            <p className="text-hint text-ink-secondary">
              Legalább egyet válassz. A partner keresőben csak ezek jelennek
              meg.
            </p>

            <label className="flex items-center gap-2 text-body text-ink">
              <input
                type="checkbox"
                className="size-3.5 accent-primary"
                checked={sheet}
                onChange={(e) => setSheet(e.target.checked)}
              />
              Táblás anyagok
            </label>
            <label className="flex items-center gap-2 text-body text-ink">
              <input
                type="checkbox"
                className="size-3.5 accent-primary"
                checked={linear}
                onChange={(e) => setLinear(e.target.checked)}
              />
              Szálas anyagok
            </label>
            <label className="flex items-center gap-2 text-body text-ink">
              <input
                type="checkbox"
                className="size-3.5 accent-primary"
                checked={accessory}
                onChange={(e) => setAccessory(e.target.checked)}
              />
              Termékek
            </label>
          </fieldset>

          {error ? (
            <p className="text-body text-danger-ink" role="alert">
              {error}
            </p>
          ) : null}

          {!canWrite ? (
            <p className="text-hint text-ink-secondary">
              Megtekintő módban nem módosíthatsz.
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              disabled={!canWrite || pending}
              loading={pending}
              onClick={handleSave}
              className={cn(!canWrite && 'opacity-50')}
            >
              Mentés
            </Button>
          </div>
        </div>
      </FormSection>
    </div>
  )
}
