'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Switch } from '@/components/ui/switch'
import {
  updatePartnerAutoProforma,
  updatePartnerSearchKinds
} from '@/lib/partner-settings/actions'
import type {
  PartnerAutoProformaView,
  PartnerSearchKinds
} from '@/lib/partner-settings/queries'
import {
  saveTeyaOnlineSettingsAction,
  testTeyaOnlineConnectionAction
} from '@/lib/teya-online/actions'
import type {
  TeyaOnlineEnv,
  TeyaOnlineSettingsPublic
} from '@/lib/teya-online/types'
import { cn } from '@/lib/utils'

const TEYA_ENV_OPTIONS = [
  { value: 'staging', label: 'Teszt' },
  { value: 'production', label: 'Éles' }
]

type PartnerSettingsFormProps = {
  initial: PartnerSearchKinds
  autoProforma: PartnerAutoProformaView
  teyaOnline: TeyaOnlineSettingsPublic
  canWrite: boolean
}

export function PartnerSettingsForm({
  initial,
  autoProforma,
  teyaOnline,
  canWrite
}: PartnerSettingsFormProps) {
  const [sheet, setSheet] = useState(initial.sheet)
  const [linear, setLinear] = useState(initial.linear)
  const [accessory, setAccessory] = useState(initial.accessory)
  const [autoEnabled, setAutoEnabled] = useState(autoProforma.enabled)
  const [dueDays, setDueDays] = useState(String(autoProforma.dueDays))
  const [teyaEnabled, setTeyaEnabled] = useState(teyaOnline.enabled)
  const [teyaEnv, setTeyaEnv] = useState<TeyaOnlineEnv>(teyaOnline.env)
  const [teyaStoreId, setTeyaStoreId] = useState(teyaOnline.storeId)
  const [teyaClientId, setTeyaClientId] = useState(teyaOnline.clientId)
  const [teyaSecret, setTeyaSecret] = useState('')
  const [hasStoredSecret, setHasStoredSecret] = useState(
    teyaOnline.hasClientSecret
  )
  const [testStatus, setTestStatus] = useState<
    'idle' | 'ok' | 'error'
  >('idle')
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [testing, startTest] = useTransition()

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
    if (teyaEnabled && !teyaStoreId.trim()) {
      setError('A Teya online bekapcsolásához kell az üzlet azonosító.')
      return
    }
    if (teyaEnabled && !teyaClientId.trim()) {
      setError('A Teya online bekapcsolásához kell a kliens azonosító.')
      return
    }
    if (teyaEnabled && !hasStoredSecret && !teyaSecret.trim()) {
      setError('A Teya online bekapcsolásához kell a titkos kulcs.')
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
      const teya = await saveTeyaOnlineSettingsAction({
        enabled: teyaEnabled,
        env: teyaEnv,
        storeId: teyaStoreId,
        clientId: teyaClientId,
        clientSecret: teyaSecret
      })
      if (!teya.ok) {
        setError(teya.message)
        return
      }
      if (teyaSecret.trim()) {
        setHasStoredSecret(true)
        setTeyaSecret('')
      }
      setTestStatus('idle')
      setTestMessage(null)
      toast.success('Partner beállítások mentve.')
    })
  }

  function handleTestConnection() {
    setTestStatus('idle')
    setTestMessage(null)
    startTest(async () => {
      const r = await testTeyaOnlineConnectionAction({
        env: teyaEnv,
        storeId: teyaStoreId,
        clientId: teyaClientId,
        clientSecret: teyaSecret
      })
      if (!r.ok) {
        setTestStatus('error')
        setTestMessage(r.message)
        toast.error(r.message)
        return
      }
      setTestStatus('ok')
      setTestMessage(r.message ?? 'Kapcsolat rendben.')
      toast.success(r.message ?? 'Kapcsolat rendben.')
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

      <FormSection
        title="Teya online kártya"
        description="Partner bankkártyás fizetés (webes checkout). Ez nem a pulti kártyagép — a POS Teya beállítás külön van."
        columns={2}
        headerAside={
          teyaOnline.ready || testStatus === 'ok' ? (
            <StatusBadge tone="success">Kész</StatusBadge>
          ) : teyaEnabled ? (
            <StatusBadge tone="warning">Hiányos</StatusBadge>
          ) : null
        }
      >
        <div className="col-span-full space-y-3 sm:col-span-2">
          <Switch
            id="partner-teya-online"
            checked={teyaEnabled}
            disabled={!canWrite || pending}
            onCheckedChange={setTeyaEnabled}
            label="Online kártyás fizetés engedélyezése"
            description="A partner a rendelésnél bankkártyával is fizethet (a checkout később kapcsolódik be)."
          />

          <FormField label="Környezet" htmlFor="partner-teya-env">
            <MenuSelect
              id="partner-teya-env"
              value={teyaEnv}
              options={TEYA_ENV_OPTIONS}
              allowEmpty={false}
              disabled={!canWrite || pending}
              onChange={(v) => setTeyaEnv(v as TeyaOnlineEnv)}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="Üzlet azonosító"
              htmlFor="partner-teya-store"
              required={teyaEnabled}
            >
              <Input
                id="partner-teya-store"
                autoComplete="off"
                spellCheck={false}
                value={teyaStoreId}
                disabled={!canWrite || pending}
                onChange={(e) => setTeyaStoreId(e.target.value)}
              />
            </FormField>
            <FormField
              label="Kliens azonosító"
              htmlFor="partner-teya-client"
              required={teyaEnabled}
            >
              <Input
                id="partner-teya-client"
                autoComplete="off"
                spellCheck={false}
                value={teyaClientId}
                disabled={!canWrite || pending}
                onChange={(e) => setTeyaClientId(e.target.value)}
              />
            </FormField>
            <FormField
              label="Titkos kulcs"
              htmlFor="partner-teya-secret"
              required={teyaEnabled && !hasStoredSecret}
              optionalLabel={hasStoredSecret}
              hint={
                hasStoredSecret
                  ? 'Már van mentett kulcs — hagyd üresen, ha nem cseréled.'
                  : 'Ecommerce client secret a Teya fiókból (nem a pulti POS kulcs).'
              }
            >
              <Input
                id="partner-teya-secret"
                type="password"
                autoComplete="new-password"
                value={teyaSecret}
                disabled={!canWrite || pending}
                onChange={(e) => setTeyaSecret(e.target.value)}
                placeholder={hasStoredSecret ? '••••••••' : undefined}
              />
            </FormField>
          </div>

          <p className="text-hint text-ink-secondary">
            Ezeket a Teya ecommerce / online payments regisztrációból kapod.
            A pulti kártyagép (POS) kulcsai általában nem működnek itt.
          </p>

          {testMessage ? (
            <p
              className={cn(
                'text-hint',
                testStatus === 'ok' ? 'text-success-ink' : 'text-danger-ink'
              )}
              role="status"
            >
              {testMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!canWrite || pending || testing}
              loading={testing}
              onClick={handleTestConnection}
            >
              Kapcsolat ellenőrzése
            </Button>
          </div>
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
          disabled={!canWrite || pending || testing}
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
