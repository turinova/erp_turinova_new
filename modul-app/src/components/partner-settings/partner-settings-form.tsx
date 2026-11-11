'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  updatePartnerAutoProforma,
  updatePartnerSearchKinds
} from '@/lib/partner-settings/actions'
import type {
  PartnerAutoProformaView,
  PartnerSearchKinds
} from '@/lib/partner-settings/queries'
import { cn } from '@/lib/utils'

type PartnerSettingsFormProps = {
  initial: PartnerSearchKinds
  autoProforma: PartnerAutoProformaView
  canWrite: boolean
}

export function PartnerSettingsForm({
  initial,
  autoProforma,
  canWrite
}: PartnerSettingsFormProps) {
  const [sheet, setSheet] = useState(initial.sheet)
  const [linear, setLinear] = useState(initial.linear)
  const [accessory, setAccessory] = useState(initial.accessory)
  const [autoEnabled, setAutoEnabled] = useState(autoProforma.enabled)
  const [dueDays, setDueDays] = useState(String(autoProforma.dueDays))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const autoReady = autoProforma.hasAgentKey && autoProforma.transferActive

  function handleSave() {
    setError(null)
    if (!sheet && !linear && !accessory) {
      setError('Legalább egy keresési típust válassz.')
      return
    }
    const days = Number(dueDays)
    if (!Number.isInteger(days) || days < 1 || days > 60) {
      setError('A fizetési határidő 1 és 60 nap között lehet.')
      return
    }

    startTransition(async () => {
      const kinds = await updatePartnerSearchKinds({
        searchSheet: sheet,
        searchLinear: linear,
        searchAccessory: accessory
      })
      if (!kinds.ok) {
        setError(kinds.message)
        return
      }
      const auto = await updatePartnerAutoProforma({
        enabled: autoEnabled,
        dueDays: days
      })
      if (!auto.ok) {
        setError(auto.message)
        return
      }
      toast.success('Partner beállítások mentve.')
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Online partner"
        description="Ezek a beállítások a turinova.hu-s asztalos partnereket érintik."
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
        </div>
      </FormSection>

      <FormSection
        title="Díjbekérő"
        description="Ha a partner átutalással küldi be a rendelést, a Számlázz.hu azonnal díjbekérőt küld neki e-mailben."
        columns={2}
      >
        <div className="col-span-full space-y-3 sm:col-span-2">
          <Switch
            id="partner-auto-proforma"
            checked={autoEnabled}
            disabled={!canWrite || pending || (!autoReady && !autoEnabled)}
            onCheckedChange={setAutoEnabled}
            label="Átutalásnál automatikus díjbekérő"
            description="A bankszámlaszámot a Számlázz.hu fiókodból vesszük, ott legyen kitöltve."
          />

          {!autoProforma.hasAgentKey ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-hint text-warning-ink">
              <span>Előbb kapcsold össze a Számlázz.hu fiókot.</span>
              <Link
                href="/beallitasok/szamlazas"
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Számlázás beállítása
              </Link>
            </div>
          ) : !autoProforma.transferActive ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-hint text-warning-ink">
              <span>
                Az Átutalás fizetési mód ki van kapcsolva, vagy a partnerek
                nem választhatják.
              </span>
              <Link
                href="/torzsadatok/rendszer/fizetesi-modok"
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Fizetési módok megnyitása
              </Link>
            </div>
          ) : null}

          <FormField
            label="Fizetési határidő (nap)"
            htmlFor="partner-auto-proforma-days"
            hint="A díjbekérőn ennyi nap múlva jár le a fizetés."
          >
            <Input
              id="partner-auto-proforma-days"
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              className="w-24 tabular-nums"
              value={dueDays}
              disabled={!canWrite || pending || !autoEnabled}
              onChange={(e) => setDueDays(e.target.value)}
            />
          </FormField>

          <p className="text-hint text-ink-secondary">
            Nem megy ki díjbekérő, ha hiányzik a partner számlázási címe vagy
            e-mail címe. Ilyenkor a rendelésnél látod az okát, és kézzel
            elküldheted.
          </p>
        </div>
      </FormSection>

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
  )
}
