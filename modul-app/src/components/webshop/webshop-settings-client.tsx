'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  CARRIER_CODES,
  CARRIERS,
  DEFAULT_TRANSFER_HOLD_DAYS,
  PAYMENT_CODES,
  PAYMENT_METHODS
} from '@/lib/webshop/legal/constants'
import type { CarrierCode, PaymentCode } from '@/lib/webshop/legal/types'
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
  const [portraitImages, setPortraitImages] = useState(initial.imageAspect === 'portrait')
  const [showNetPrice, setShowNetPrice] = useState(initial.showNetPrice)
  const [carriers, setCarriers] = useState<CarrierCode[]>(initial.shippingCarriers)
  const [payments, setPayments] = useState<PaymentCode[]>(initial.paymentMethods)
  const [bankAccount, setBankAccount] = useState(initial.bankAccount ?? '')
  const [holdDays, setHoldDays] = useState(toRaw(initial.transferHoldDays))
  const [returnPaidBy, setReturnPaidBy] = useState(initial.returnShippingPaidBy)

  const disabled = !canWrite || pending

  function handleSave() {
    const numbers = {
      shippingFeeGross: parseIntRaw(shippingFee),
      freeShippingThresholdGross: parseIntRaw(freeFrom),
      deliveryDaysMin: parseIntRaw(daysMin),
      deliveryDaysMax: parseIntRaw(daysMax),
      returnDays: parseIntRaw(returnDays),
      warrantyMonths: parseIntRaw(warranty),
      transferHoldDays: parseIntRaw(holdDays)
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
        shippingCarriers: carriers,
        paymentMethods: payments,
        bankAccount,
        returnShippingPaidBy: returnPaidBy,
        allowAiTraining,
        imageAspect: portraitImages ? 'portrait' : 'square',
        showNetPrice
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
          id="szallitas"
          title="Szállítás és átvétel"
          description="A teljes költséget a vásárló már a termékoldalon látja. A választott futárszolgálatok a jogi oldalakon (ÁSZF, adatkezelés) is megjelennek."
          columns={4}
        >
          <fieldset className="col-span-full" disabled={disabled}>
            <legend className="mb-1.5 text-label text-ink">Szállítási módok</legend>
            <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {CARRIER_CODES.map((code) => (
                <CheckItem
                  key={code}
                  id={`sf-carrier-${code}`}
                  label={CARRIERS[code].label}
                  checked={carriers.includes(code)}
                  onChange={(on) => setCarriers((list) => toggle(list, code, on, CARRIER_CODES))}
                />
              ))}
            </div>
          </fieldset>
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
          id="fizetes"
          title="Fizetés"
          description="A pénztárban választható módok. Az ÁSZF és a Szállítás és fizetés oldal ebből készül."
          columns={4}
        >
          <fieldset className="col-span-full" disabled={disabled}>
            <legend className="mb-1.5 text-label text-ink">Fizetési módok</legend>
            <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
              {PAYMENT_CODES.map((code) => (
                <CheckItem
                  key={code}
                  id={`sf-pay-${code}`}
                  label={PAYMENT_METHODS[code].label}
                  description={PAYMENT_METHODS[code].hint}
                  checked={payments.includes(code)}
                  onChange={(on) => setPayments((list) => toggle(list, code, on, PAYMENT_CODES))}
                />
              ))}
            </div>
          </fieldset>
          {payments.includes('transfer') ? (
            <>
              <FormField
                label="Bankszámlaszám"
                htmlFor="sf-bank"
                required
                hint="A díjbekérőn és az ÁSZF-ben jelenik meg"
                className="sm:col-span-2"
                error={errors.bankAccount}
              >
                <Input
                  id="sf-bank"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  maxLength={80}
                  disabled={disabled}
                  placeholder="12345678-12345678-12345678"
                />
              </FormField>
              <FormField
                label="Foglalás a jóváírásig (munkanap)"
                htmlFor="sf-hold"
                optionalLabel
                hint={`Utána a rendelést töröljük. Alapérték: ${DEFAULT_TRANSFER_HOLD_DAYS}`}
                error={errors.transferHoldDays}
              >
                <Input
                  id="sf-hold"
                  value={holdDays}
                  onChange={(e) => setHoldDays(e.target.value)}
                  inputMode="numeric"
                  disabled={disabled}
                  placeholder={String(DEFAULT_TRANSFER_HOLD_DAYS)}
                />
              </FormField>
            </>
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
            label="Visszaküldés költsége"
            htmlFor="sf-return-paid"
            className="sm:col-span-2"
          >
            <Select
              id="sf-return-paid"
              value={returnPaidBy}
              onChange={(e) => setReturnPaidBy(e.target.value === 'seller' ? 'seller' : 'customer')}
              disabled={disabled}
            >
              <option value="customer">A vásárlót terheli</option>
              <option value="seller">Mi álljuk</option>
            </Select>
          </FormField>
          <FormField
            label="Önkéntes jótállás (hónap)"
            htmlFor="sf-warranty"
            optionalLabel
            hint={!errors.warrantyMonths ? 'A törvényes 2 év kellékszavatosságon felül' : undefined}
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
            <Switch
              id="sf-portrait"
              checked={portraitImages}
              disabled={disabled}
              onCheckedChange={setPortraitImages}
              label="Álló termékképek (4:5)"
              description="Divat, kozmetikum, italok: a képek nem kerülnek négyzetbe. Kikapcsolva 1:1."
            />
            <Switch
              id="sf-net-price"
              checked={showNetPrice}
              disabled={disabled}
              onCheckedChange={setShowNetPrice}
              label="Nettó ár mutatása"
              description="Céges vevőknek: a bruttó ár alatt kisebb betűvel a nettó ár is látszik."
            />
          </div>
        </FormSection>

        <p className="text-hint text-ink-secondary">
          Az eladó adatai, az ÁSZF, az adatkezelési tájékoztató és a többi kötelező oldal:{' '}
          <Link href="/webshop/jogi" className="text-ink underline underline-offset-2">
            Webshop → Jogi oldalak
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

function toggle<T extends string>(list: T[], code: T, on: boolean, order: readonly T[]): T[] {
  const next = on ? [...new Set([...list, code])] : list.filter((c) => c !== code)
  return order.filter((c) => next.includes(c))
}

function CheckItem({
  id,
  label,
  description,
  checked,
  onChange
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#18181B] disabled:cursor-not-allowed"
      />
      <label htmlFor={id} className="min-w-0 cursor-pointer text-body text-ink">
        {label}
        {description ? <span className="block text-hint text-ink-secondary">{description}</span> : null}
      </label>
    </div>
  )
}
