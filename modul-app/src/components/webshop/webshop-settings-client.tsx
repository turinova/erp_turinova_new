'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { StorefrontSettings } from '@/lib/webshop/settings'
import { saveStorefrontSettings } from '@/lib/webshop/storefront-actions'

type Props = {
  initial: StorefrontSettings
  canWrite: boolean
}

function toRaw(v: number | null): string {
  return v == null ? '' : String(v)
}

function parseIntRaw(raw: string): number | null {
  const t = raw.replace(/\s/g, '').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

export function WebshopSettingsClient({ initial, canWrite }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [shippingFee, setShippingFee] = useState(toRaw(initial.shippingFeeGross))
  const [freeFrom, setFreeFrom] = useState(
    toRaw(initial.freeShippingThresholdGross)
  )
  const [daysMin, setDaysMin] = useState(toRaw(initial.deliveryDaysMin))
  const [daysMax, setDaysMax] = useState(toRaw(initial.deliveryDaysMax))
  const [pickupEnabled, setPickupEnabled] = useState(initial.pickupEnabled)
  const [pickupLabel, setPickupLabel] = useState(initial.pickupLabel ?? '')
  const [returnDays, setReturnDays] = useState(toRaw(initial.returnDays))
  const [warranty, setWarranty] = useState(toRaw(initial.warrantyMonths))
  const [returnText, setReturnText] = useState(initial.returnPolicyText ?? '')
  const [lowStock, setLowStock] = useState(String(initial.lowStockThreshold))
  const [showSold, setShowSold] = useState(initial.showSoldCount)
  const [reviewsEnabled, setReviewsEnabled] = useState(initial.reviewsEnabled)
  const [allowAiTraining, setAllowAiTraining] = useState(initial.allowAiTraining)
  const [hostName, setHostName] = useState(initial.hostingProviderName ?? '')
  const [hostAddress, setHostAddress] = useState(
    initial.hostingProviderAddress ?? ''
  )
  const [hostEmail, setHostEmail] = useState(initial.hostingProviderEmail ?? '')
  const [termsUrl, setTermsUrl] = useState(initial.termsUrl ?? '')
  const [privacyUrl, setPrivacyUrl] = useState(initial.privacyUrl ?? '')
  const [complaintInfo, setComplaintInfo] = useState(initial.complaintInfo ?? '')

  const disabled = !canWrite || pending

  function handleSave() {
    const numbers = {
      shippingFeeGross: parseIntRaw(shippingFee),
      freeShippingThresholdGross: parseIntRaw(freeFrom),
      deliveryDaysMin: parseIntRaw(daysMin),
      deliveryDaysMax: parseIntRaw(daysMax),
      returnDays: parseIntRaw(returnDays),
      warrantyMonths: parseIntRaw(warranty)
    }
    const local: Record<string, string> = {}
    for (const [k, v] of Object.entries(numbers)) {
      if (Number.isNaN(v)) local[k] = 'Számot adj meg.'
    }
    const low = parseIntRaw(lowStock)
    if (low == null || Number.isNaN(low)) local.lowStockThreshold = 'Számot adj meg.'
    if (Object.keys(local).length > 0) {
      setErrors(local)
      toast.error('Ellenőrizd a megadott adatokat.')
      return
    }

    startTransition(async () => {
      const result = await saveStorefrontSettings({
        ...numbers,
        pickupEnabled,
        pickupLabel,
        returnPolicyText: returnText,
        lowStockThreshold: low ?? 10,
        showSoldCount: showSold,
        reviewsEnabled,
        hostingProviderName: hostName,
        hostingProviderAddress: hostAddress,
        hostingProviderEmail: hostEmail,
        termsUrl,
        privacyUrl,
        complaintInfo,
        allowAiTraining
      })
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        toast.error(Object.values(result.fieldErrors ?? {})[0] || result.message)
        return
      }
      setErrors({})
      toast.success('Bolt beállítások mentve.')
      router.refresh()
    })
  }

  return (
    <div className="pb-14">
      <PageHeader
        title="Bolt beállítások"
        description="Ezek jelennek meg a termékoldalon a vásárlás gomb mellett."
        actions={
          canWrite ? (
            <Button type="button" loading={pending} onClick={handleSave}>
              Beállítások mentése
            </Button>
          ) : null
        }
      />

      <div className="space-y-3">
        <FormSection
          title="Szállítás és átvétel"
          description="A teljes költséget a vásárló már a termékoldalon látja."
          columns={4}
        >
          <FormField
            label="Szállítási díj (bruttó Ft)"
            htmlFor="sf-fee"
            optionalLabel
            error={errors.shippingFeeGross}
          >
            <Input
              id="sf-fee"
              value={shippingFee}
              onChange={(e) => setShippingFee(e.target.value)}
              inputMode="numeric"
              disabled={disabled}
              placeholder="1590"
            />
          </FormField>
          <FormField
            label="Ingyenes szállítás ettől (bruttó Ft)"
            htmlFor="sf-free"
            optionalLabel
            error={errors.freeShippingThresholdGross}
          >
            <Input
              id="sf-free"
              value={freeFrom}
              onChange={(e) => setFreeFrom(e.target.value)}
              inputMode="numeric"
              disabled={disabled}
              placeholder="25000"
            />
          </FormField>
          <FormField
            label="Szállítási idő – legalább (munkanap)"
            htmlFor="sf-dmin"
            optionalLabel
            error={errors.deliveryDaysMin}
          >
            <Input
              id="sf-dmin"
              value={daysMin}
              onChange={(e) => setDaysMin(e.target.value)}
              inputMode="numeric"
              disabled={disabled}
              placeholder="1"
            />
          </FormField>
          <FormField
            label="Szállítási idő – legfeljebb (munkanap)"
            htmlFor="sf-dmax"
            optionalLabel
            error={errors.deliveryDaysMax}
          >
            <Input
              id="sf-dmax"
              value={daysMax}
              onChange={(e) => setDaysMax(e.target.value)}
              inputMode="numeric"
              disabled={disabled}
              placeholder="3"
            />
          </FormField>
          <div className="col-span-full">
            <Switch
              id="sf-pickup"
              checked={pickupEnabled}
              disabled={disabled}
              onCheckedChange={setPickupEnabled}
              label="Személyes átvétel a boltban"
              description="Raktáron lévő terméknél „Átvehető a boltban” jelenik meg."
            />
          </div>
          {pickupEnabled ? (
            <FormField
              label="Átvételi hely"
              htmlFor="sf-pickup-label"
              optionalLabel
              hint="Pl. Budapest, Fő utca 1. · H–P 8–17"
              className="sm:col-span-2"
              error={errors.pickupLabel}
            >
              <Input
                id="sf-pickup-label"
                value={pickupLabel}
                onChange={(e) => setPickupLabel(e.target.value)}
                maxLength={160}
                disabled={disabled}
              />
            </FormField>
          ) : null}
        </FormSection>

        <FormSection
          title="Csere, visszaküldés, garancia"
          description="Konkrét ígéret a gomb alatt — ez csökkenti a vásárló kockázatérzetét."
          columns={4}
        >
          <FormField
            label="Visszaküldés (nap)"
            htmlFor="sf-return"
            optionalLabel
            hint={!errors.returnDays ? 'Legalább 14 (törvényes elállás)' : undefined}
            error={errors.returnDays}
          >
            <Input
              id="sf-return"
              value={returnDays}
              onChange={(e) => setReturnDays(e.target.value)}
              inputMode="numeric"
              disabled={disabled}
              placeholder="14"
            />
          </FormField>
          <FormField
            label="Garancia (hónap)"
            htmlFor="sf-warranty"
            optionalLabel
            error={errors.warrantyMonths}
          >
            <Input
              id="sf-warranty"
              value={warranty}
              onChange={(e) => setWarranty(e.target.value)}
              inputMode="numeric"
              disabled={disabled}
              placeholder="24"
            />
          </FormField>
          <FormField
            label="Visszaküldési feltételek"
            htmlFor="sf-return-text"
            optionalLabel
            hint="Rövid, érthető szöveg a „Szállítás és visszaküldés” fülbe"
            className="col-span-full"
            error={errors.returnPolicyText}
          >
            <Textarea
              id="sf-return-text"
              value={returnText}
              onChange={(e) => setReturnText(e.target.value)}
              rows={3}
              maxLength={1500}
              disabled={disabled}
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Készlet és vásárlói visszajelzés"
          description="Csak valós adat jelenik meg — nincs kitalált szűkösség."
          columns={4}
        >
          <FormField
            label="Pontos darabszám ennyi alatt"
            htmlFor="sf-low"
            hint="Felette csak „Raktáron” látszik"
            error={errors.lowStockThreshold}
          >
            <Input
              id="sf-low"
              value={lowStock}
              onChange={(e) => setLowStock(e.target.value)}
              inputMode="numeric"
              disabled={disabled}
            />
          </FormField>
          <div className="col-span-full space-y-2">
            <Switch
              id="sf-sold"
              checked={showSold}
              disabled={disabled}
              onCheckedChange={setShowSold}
              label="Eladott darabszám mutatása"
              description="Az elmúlt 30 nap valós eladásaiból (bolt + webshop), ha legalább 5 db."
            />
            <Switch
              id="sf-reviews"
              checked={reviewsEnabled}
              disabled={disabled}
              onCheckedChange={setReviewsEnabled}
              label="Vásárlói értékelések"
              description="Új értékelés csak jóváhagyás után jelenik meg (Webshop → Értékelések)."
            />
            <Switch
              id="sf-ai-training"
              checked={allowAiTraining}
              disabled={disabled}
              onCheckedChange={setAllowAiTraining}
              label="AI modellek taníthatnak a bolt tartalmából"
              description="Kikapcsolva is megtalálnak és ajánlanak a ChatGPT, Perplexity és Google AI keresők — csak a modelltanítást (GPTBot, Google-Extended, CCBot) tiltjuk."
            />
          </div>
        </FormSection>

        <FormSection
          title="Jogi adatok (lábléc)"
          description="A cégnév, székhely, adószám, cégjegyzékszám, e-mail és telefon a Beállítások → Cégadatok oldalról jön. Ezek nélkül a bolt nem felel meg az Ekertv. 4. §-nak."
          columns={4}
        >
          <FormField
            label="Tárhely-szolgáltató neve"
            htmlFor="sf-host-name"
            optionalLabel
            hint="Pl. Vercel Inc."
            className="sm:col-span-2"
            error={errors.hostingProviderName}
          >
            <Input
              id="sf-host-name"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              maxLength={200}
              disabled={disabled}
            />
          </FormField>
          <FormField
            label="Tárhely-szolgáltató e-mail címe"
            htmlFor="sf-host-email"
            optionalLabel
            className="sm:col-span-2"
            error={errors.hostingProviderEmail}
          >
            <Input
              id="sf-host-email"
              type="email"
              value={hostEmail}
              onChange={(e) => setHostEmail(e.target.value)}
              maxLength={200}
              disabled={disabled}
            />
          </FormField>
          <FormField
            label="Tárhely-szolgáltató postai címe"
            htmlFor="sf-host-address"
            optionalLabel
            className="col-span-full"
            error={errors.hostingProviderAddress}
          >
            <Input
              id="sf-host-address"
              value={hostAddress}
              onChange={(e) => setHostAddress(e.target.value)}
              maxLength={300}
              disabled={disabled}
            />
          </FormField>
          <FormField
            label="ÁSZF címe"
            htmlFor="sf-terms"
            optionalLabel
            hint="https://… vagy /aszf"
            className="sm:col-span-2"
            error={errors.termsUrl}
          >
            <Input
              id="sf-terms"
              value={termsUrl}
              onChange={(e) => setTermsUrl(e.target.value)}
              maxLength={500}
              disabled={disabled}
            />
          </FormField>
          <FormField
            label="Adatkezelési tájékoztató címe"
            htmlFor="sf-privacy"
            optionalLabel
            hint="Az értékelés űrlap is erre hivatkozik"
            className="sm:col-span-2"
            error={errors.privacyUrl}
          >
            <Input
              id="sf-privacy"
              value={privacyUrl}
              onChange={(e) => setPrivacyUrl(e.target.value)}
              maxLength={500}
              disabled={disabled}
            />
          </FormField>
          <FormField
            label="Panaszkezelés és békéltető testület"
            htmlFor="sf-complaint"
            optionalLabel
            hint="Hol és hogyan tehet panaszt a vásárló, melyik békéltető testülethez fordulhat (név, cím)"
            className="col-span-full"
            error={errors.complaintInfo}
          >
            <Textarea
              id="sf-complaint"
              value={complaintInfo}
              onChange={(e) => setComplaintInfo(e.target.value)}
              rows={3}
              maxLength={1500}
              disabled={disabled}
            />
          </FormField>
        </FormSection>
      </div>
    </div>
  )
}
