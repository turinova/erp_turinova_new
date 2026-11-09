'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { PhoneInput } from '@/components/patterns/phone-input'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { WebshopChannelsClient } from '@/components/webshop/webshop-channels-client'
import {
  formatPhoneNumber,
  HU_PHONE_EXAMPLE
} from '@/lib/customers/parse'
import type { DomainView } from '@/lib/storefront/domains/types'
import { saveWebshopLegalSettings } from '@/lib/webshop/legal-actions'
import {
  COUNTIES,
  COUNTY_CODES,
  DEFAULT_TRANSFER_HOLD_DAYS,
  PAYMENT_METHODS
} from '@/lib/webshop/legal/constants'
import type { SellerDefaults } from '@/lib/webshop/legal/context'
import type {
  CarrierCode,
  CountyCode,
  PaymentCode,
  WebshopLegalSettings
} from '@/lib/webshop/legal/types'
import {
  STATUTORY_RETURN_DAYS,
  type StorefrontSettings
} from '@/lib/webshop/settings'
import { saveStorefrontSettings } from '@/lib/webshop/storefront-actions'
import { cn } from '@/lib/utils'

/** W1 buyer promise: kártya · átutalás · személyesen (COD / külön POS mód nincs). */
const W1_PAYMENT_CODES: PaymentCode[] = ['card', 'transfer', 'pickup_cash']

function paymentsFromInitial(methods: PaymentCode[]): PaymentCode[] {
  const out: PaymentCode[] = []
  if (methods.includes('card')) out.push('card')
  if (methods.includes('transfer')) out.push('transfer')
  if (methods.includes('pickup_cash') || methods.includes('pickup_card')) {
    out.push('pickup_cash')
  }
  return out
}

/** Mentés: személyesen csak ha az átvétel be van kapcsolva; COD / pickup_card nem megy ki. */
function paymentsForSave(
  selected: PaymentCode[],
  pickupFulfillment: boolean
): PaymentCode[] {
  return W1_PAYMENT_CODES.filter((c) => {
    if (!selected.includes(c)) return false
    if (c === 'pickup_cash' && !pickupFulfillment) return false
    return true
  })
}

type TabKey =
  | 'altalanos'
  | 'megjelenes'
  | 'kereskedelem'
  | 'szallitas'
  | 'fizetes'
  | 'domain'
  | 'jogi'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'altalanos', label: 'Általános' },
  { key: 'megjelenes', label: 'Megjelenés' },
  { key: 'kereskedelem', label: 'Kereskedelem' },
  { key: 'szallitas', label: 'Szállítás' },
  { key: 'fizetes', label: 'Fizetés' },
  { key: 'domain', label: 'Domain' },
  { key: 'jogi', label: 'Jogi' }
]

type SellerKey =
  | 'sellerName'
  | 'taxNumber'
  | 'registrationNumber'
  | 'vatId'
  | 'postalCode'
  | 'city'
  | 'address'
  | 'email'
  | 'phone'

const SELLER_FIELDS: {
  key: SellerKey
  label: string
  span?: 2
  type?: string
}[] = [
  { key: 'sellerName', label: 'Cégnév', span: 2 },
  { key: 'taxNumber', label: 'Adószám' },
  { key: 'registrationNumber', label: 'Cégjegyzékszám / nyilvántartási szám' },
  { key: 'postalCode', label: 'Irányítószám' },
  { key: 'city', label: 'Város' },
  { key: 'address', label: 'Utca, házszám', span: 2 },
  { key: 'email', label: 'E-mail (vásárlóknak)', type: 'email', span: 2 },
  { key: 'phone', label: 'Telefon (vásárlóknak)' },
  { key: 'vatId', label: 'Közösségi adószám' }
]

export type WebshopSettingsDomainProps = {
  primaryUrl: string
  primaryIsCustom: boolean
  subdomainUrl: string | null
  indexNowLive: boolean
  domains: DomainView[]
}

type Props = {
  initial: StorefrontSettings
  legal: WebshopLegalSettings
  defaults: SellerDefaults
  autoCounty: CountyCode | null
  logoUrl: string | null
  canWrite: boolean
  domain: WebshopSettingsDomainProps
  liveProductCount: number
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

function tabFromSearch(raw: string | null): TabKey {
  if (
    raw === 'altalanos' ||
    raw === 'megjelenes' ||
    raw === 'kereskedelem' ||
    raw === 'szallitas' ||
    raw === 'fizetes' ||
    raw === 'domain' ||
    raw === 'jogi'
  ) {
    return raw
  }
  return 'altalanos'
}

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export function WebshopSettingsClient({
  initial,
  legal,
  defaults,
  autoCounty,
  logoUrl,
  canWrite,
  domain,
  liveProductCount
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const active = tabFromSearch(searchParams.get('tab'))
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const erpValue = (k: SellerKey): string =>
    (k === 'sellerName' ? defaults.sellerName : defaults[k]) ?? ''

  const [seller, setSeller] = useState<Record<SellerKey, string>>(() => {
    const out = {} as Record<SellerKey, string>
    for (const f of SELLER_FIELDS) {
      const raw = legal[f.key] ?? erpValue(f.key)
      out[f.key] = f.key === 'phone' ? formatPhoneNumber(raw) : raw
    }
    return out
  })
  const [county, setCounty] = useState(legal.county ?? '')
  const [serviceAddress, setServiceAddress] = useState(legal.serviceAddress ?? '')
  const [supportHours, setSupportHours] = useState(legal.supportHours ?? '')

  const [homeDeliveryEnabled, setHomeDeliveryEnabled] = useState(
    initial.shippingCarriers.includes('gls') ||
      initial.shippingFeeGross != null ||
      initial.deliveryDaysMin != null
  )
  const [shippingFee, setShippingFee] = useState(toRaw(initial.shippingFeeGross))
  const [daysMin, setDaysMin] = useState(toRaw(initial.deliveryDaysMin))
  const [daysMax, setDaysMax] = useState(toRaw(initial.deliveryDaysMax))
  const [pickupEnabled, setPickupEnabled] = useState(initial.pickupEnabled)
  const [pickupLabel, setPickupLabel] = useState(initial.pickupLabel ?? '')
  const [payments, setPayments] = useState<PaymentCode[]>(() =>
    paymentsFromInitial(initial.paymentMethods)
  )
  const [bankAccount, setBankAccount] = useState(initial.bankAccount ?? '')
  const [holdDays, setHoldDays] = useState(toRaw(initial.transferHoldDays))

  const [imageAspect, setImageAspect] = useState<'square' | 'portrait'>(
    initial.imageAspect
  )
  const [showNetPrice, setShowNetPrice] = useState(initial.showNetPrice)
  const [showSoldCount, setShowSoldCount] = useState(initial.showSoldCount)
  const [reviewsEnabled, setReviewsEnabled] = useState(initial.reviewsEnabled)
  const [socialFacebook, setSocialFacebook] = useState(initial.socialFacebook ?? '')
  const [socialInstagram, setSocialInstagram] = useState(initial.socialInstagram ?? '')
  const [socialYoutube, setSocialYoutube] = useState(initial.socialYoutube ?? '')
  const [socialTiktok, setSocialTiktok] = useState(initial.socialTiktok ?? '')
  const [socialLinkedin, setSocialLinkedin] = useState(initial.socialLinkedin ?? '')

  const [lowStock, setLowStock] = useState(toRaw(initial.lowStockThreshold))
  const [returnDays, setReturnDays] = useState(toRaw(initial.returnDays))
  const [returnPaidBy, setReturnPaidBy] = useState<'customer' | 'seller'>(
    initial.returnShippingPaidBy
  )
  const [warrantyMonths, setWarrantyMonths] = useState(toRaw(initial.warrantyMonths))
  const [returnPolicyText, setReturnPolicyText] = useState(
    initial.returnPolicyText ?? ''
  )
  const [allowAiTraining, setAllowAiTraining] = useState(initial.allowAiTraining)
  const [audience, setAudience] = useState(legal.audience)
  const [madeToOrder, setMadeToOrder] = useState(legal.madeToOrder)
  const [mandatoryWarranty, setMandatoryWarranty] = useState(legal.mandatoryWarranty)
  const [newsletter, setNewsletter] = useState(legal.newsletter)
  const [microEnterprise, setMicroEnterprise] = useState(legal.microEnterprise)

  const disabled = !canWrite || pending
  const showSave =
    active === 'altalanos' ||
    active === 'megjelenes' ||
    active === 'kereskedelem' ||
    active === 'szallitas' ||
    active === 'fizetes'

  const setTab = useCallback(
    (key: TabKey) => {
      const sp = new URLSearchParams(searchParams.toString())
      if (key === 'altalanos') sp.delete('tab')
      else sp.set('tab', key)
      const q = sp.toString()
      router.replace(q ? `?${q}` : '?', { scroll: false })
    },
    [router, searchParams]
  )

  function storefrontPayload(overrides?: {
    fee: number | null
    dMin: number | null
    dMax: number | null
    hold: number | null
    low: number
    retDays: number | null
    warranty: number | null
  }) {
    const fee = overrides?.fee ?? (homeDeliveryEnabled ? parseIntRaw(shippingFee) : null)
    const dMin = overrides?.dMin ?? (homeDeliveryEnabled ? parseIntRaw(daysMin) : null)
    const dMax = overrides?.dMax ?? (homeDeliveryEnabled ? parseIntRaw(daysMax) : null)
    const hold =
      overrides?.hold ?? (payments.includes('transfer') ? parseIntRaw(holdDays) : null)
    const low = overrides?.low ?? parseIntRaw(lowStock)
    const retDays = overrides?.retDays ?? parseIntRaw(returnDays)
    const warranty = overrides?.warranty ?? parseIntRaw(warrantyMonths)

    return {
      shippingFeeGross: homeDeliveryEnabled ? fee : null,
      freeShippingThresholdGross: null as number | null,
      deliveryDaysMin: homeDeliveryEnabled ? dMin : null,
      deliveryDaysMax: homeDeliveryEnabled ? dMax : null,
      pickupEnabled,
      pickupLabel: pickupEnabled ? pickupLabel : null,
      shippingCarriers: (homeDeliveryEnabled ? ['gls'] : []) as CarrierCode[],
      paymentMethods: paymentsForSave(payments, pickupEnabled),
      bankAccount: payments.includes('transfer') ? bankAccount : null,
      transferHoldDays: payments.includes('transfer') ? hold : null,
      returnDays: retDays,
      warrantyMonths: warranty,
      returnPolicyText: returnPolicyText.trim() ? returnPolicyText : null,
      lowStockThreshold: typeof low === 'number' && !Number.isNaN(low) ? low : initial.lowStockThreshold,
      showSoldCount,
      reviewsEnabled,
      returnShippingPaidBy: returnPaidBy,
      allowAiTraining,
      imageAspect,
      showNetPrice,
      socialFacebook: socialFacebook.trim() || null,
      socialInstagram: socialInstagram.trim() || null,
      socialYoutube: socialYoutube.trim() || null,
      socialTiktok: socialTiktok.trim() || null,
      socialLinkedin: socialLinkedin.trim() || null
    }
  }

  function legalPayload() {
    return {
      ...seller,
      county: (county || null) as CountyCode | null,
      serviceAddress,
      supportHours,
      audience,
      madeToOrder,
      mandatoryWarranty,
      newsletter,
      microEnterprise,
      termsUrl: legal.termsUrl ?? '',
      privacyUrl: legal.privacyUrl ?? ''
    }
  }

  function validateShippingPayment(): Record<string, string> {
    const local: Record<string, string> = {}
    const fee = parseIntRaw(shippingFee)
    const dMin = parseIntRaw(daysMin)
    const dMax = parseIntRaw(daysMax)
    const hold = parseIntRaw(holdDays)

    if (!homeDeliveryEnabled && !pickupEnabled) {
      local._shipping =
        'Kapcsold be a házhozszállítást vagy a személyes átvételt.'
    }
    if (homeDeliveryEnabled) {
      if (fee == null || Number.isNaN(fee)) {
        local.shippingFeeGross = 'Add meg a szállítási díjat (Ft).'
      }
      if (dMin == null || Number.isNaN(dMin)) {
        local.deliveryDaysMin = 'Add meg a szállítási időt (nap).'
      }
      if (dMax == null || Number.isNaN(dMax)) {
        local.deliveryDaysMax = 'Add meg a szállítási időt (nap).'
      }
      if (
        dMin != null &&
        dMax != null &&
        !Number.isNaN(dMin) &&
        !Number.isNaN(dMax) &&
        dMax < dMin
      ) {
        local.deliveryDaysMax = 'A max nem lehet kisebb a minnél.'
      }
    }
    if (payments.includes('transfer') && !bankAccount.trim()) {
      local.bankAccount = 'Átutaláshoz add meg a bankszámlaszámot.'
    }
    if (hold != null && Number.isNaN(hold)) {
      local.transferHoldDays = 'Számot adj meg.'
    }
    return local
  }

  function validateCommerce(): Record<string, string> {
    const local: Record<string, string> = {}
    const low = parseIntRaw(lowStock)
    const ret = parseIntRaw(returnDays)
    const war = parseIntRaw(warrantyMonths)
    if (low == null || Number.isNaN(low) || low < 0) {
      local.lowStockThreshold = '0 vagy nagyobb egész szám.'
    }
    if (ret != null && !Number.isNaN(ret) && ret < STATUTORY_RETURN_DAYS) {
      local.returnDays = `Legalább ${STATUTORY_RETURN_DAYS} nap.`
    }
    if (ret != null && Number.isNaN(ret)) {
      local.returnDays = 'Számot adj meg.'
    }
    if (war != null && Number.isNaN(war)) {
      local.warrantyMonths = 'Számot adj meg.'
    }
    return local
  }

  function handleSave() {
    if (active === 'altalanos') {
      startTransition(async () => {
        const result = await saveWebshopLegalSettings(legalPayload())
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {})
          toast.error(Object.values(result.fieldErrors ?? {})[0] || result.message)
          return
        }
        setErrors({})
        toast.success('Általános beállítások mentve.')
        router.refresh()
      })
      return
    }

    if (
      active === 'megjelenes' ||
      active === 'kereskedelem' ||
      active === 'szallitas' ||
      active === 'fizetes'
    ) {
      const needShipPay = active === 'szallitas' || active === 'fizetes'
      const shipPay = needShipPay ? validateShippingPayment() : {}
      const commerce = active === 'kereskedelem' ? validateCommerce() : {}
      const local = { ...shipPay, ...commerce }

      if (Object.keys(local).length > 0) {
        setErrors(local)
        if (
          local._shipping ||
          local.shippingFeeGross ||
          local.deliveryDaysMin ||
          local.deliveryDaysMax
        ) {
          if (active !== 'szallitas') setTab('szallitas')
          toast.error(local._shipping || 'Ellenőrizd a szállítási adatokat.')
        } else if (local.bankAccount || local.transferHoldDays) {
          if (active !== 'fizetes') setTab('fizetes')
          toast.error('Ellenőrizd a fizetési adatokat.')
        } else {
          toast.error('Ellenőrizd a megadott adatokat.')
        }
        return
      }

      const fee = homeDeliveryEnabled ? parseIntRaw(shippingFee) : null
      const dMin = homeDeliveryEnabled ? parseIntRaw(daysMin) : null
      const dMax = homeDeliveryEnabled ? parseIntRaw(daysMax) : null
      const hold = payments.includes('transfer') ? parseIntRaw(holdDays) : null
      const low = parseIntRaw(lowStock)
      const retDays = parseIntRaw(returnDays)
      const warranty = parseIntRaw(warrantyMonths)

      startTransition(async () => {
        const sf = await saveStorefrontSettings(
          storefrontPayload({
            fee,
            dMin,
            dMax,
            hold,
            low: low ?? initial.lowStockThreshold,
            retDays,
            warranty
          })
        )
        if (!sf.ok) {
          setErrors(sf.fieldErrors ?? {})
          toast.error(Object.values(sf.fieldErrors ?? {})[0] || sf.message)
          return
        }

        if (active === 'kereskedelem') {
          const lg = await saveWebshopLegalSettings(legalPayload())
          if (!lg.ok) {
            setErrors(lg.fieldErrors ?? {})
            toast.error(Object.values(lg.fieldErrors ?? {})[0] || lg.message)
            return
          }
        }

        setErrors({})
        toast.success('Bolt beállítások mentve.')
        router.refresh()
      })
    }
  }

  return (
    <div className="pb-14">
      <PageHeader
        title="Bolt beállítások"
        description="Általános, megjelenés, kereskedelem, szállítás, fizetés, domain, jogi."
        actions={
          canWrite && showSave ? (
            <Button type="button" loading={pending} onClick={handleSave}>
              Mentés
            </Button>
          ) : null
        }
      />

      <div
        role="tablist"
        aria-label="Bolt beállítás szekciók"
        className="mb-3 flex flex-wrap gap-1 rounded-lg border border-border bg-subtle p-1"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            id={`webshop-settings-tab-${tab.key}`}
            aria-controls={`webshop-settings-panel-${tab.key}`}
            onClick={() => setTab(tab.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
              active === tab.key
                ? 'bg-ink text-white'
                : 'text-ink-secondary hover:bg-surface hover:text-ink'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'altalanos' ? (
        <div
          role="tabpanel"
          id="webshop-settings-panel-altalanos"
          aria-labelledby="webshop-settings-tab-altalanos"
          className="space-y-4"
        >
          <FormSection title="Áttekintés" columns={2}>
            <div className="rounded-md border border-border bg-surface px-3 py-2.5">
              <p className="text-hint text-ink-secondary">Bolt címe</p>
              <p className="mt-0.5 truncate text-body font-medium text-ink">
                {displayUrl(domain.primaryUrl)}
              </p>
              <a
                href={domain.primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-2')}
              >
                Bolt megnyitása
              </a>
            </div>
            <div className="rounded-md border border-border bg-surface px-3 py-2.5">
              <p className="text-hint text-ink-secondary">Live termékek</p>
              <p className="mt-0.5 text-h2 tabular-nums text-ink">{liveProductCount}</p>
              <Link
                href="/webshop/katalogus?filter=live"
                className="mt-2 inline-block text-hint font-medium text-ink underline underline-offset-2"
              >
                Katalógus megnyitása
              </Link>
            </div>
          </FormSection>

          <FormSection
            title="Eladó a boltban"
            description="Alap: Cégadatok. Ha a webáruházban mást mutatsz, itt felülírod — az ERP nem változik."
            columns={4}
          >
            {SELLER_FIELDS.map((f) => {
              const erp = erpValue(f.key)
              const erpCompare = f.key === 'phone' ? formatPhoneNumber(erp) : erp
              const fromErp =
                Boolean(erpCompare) && seller[f.key].trim() === erpCompare.trim()
              return (
                <FormField
                  key={f.key}
                  label={f.label}
                  htmlFor={`ws-${f.key}`}
                  optionalLabel={f.key === 'vatId'}
                  hint={
                    f.key === 'phone' && !fromErp
                      ? `pl. ${HU_PHONE_EXAMPLE}`
                      : fromErp
                        ? 'A Cégadatokból'
                        : erp
                          ? `Cégadatokban: ${erp}`
                          : undefined
                  }
                  className={f.span === 2 ? 'sm:col-span-2' : undefined}
                  error={errors[f.key]}
                >
                  {f.key === 'phone' ? (
                    <PhoneInput
                      id={`ws-${f.key}`}
                      value={seller.phone}
                      disabled={disabled}
                      onValueChange={(phone) =>
                        setSeller((s) => ({ ...s, phone }))
                      }
                    />
                  ) : (
                    <Input
                      id={`ws-${f.key}`}
                      type={f.type ?? 'text'}
                      value={seller[f.key]}
                      onChange={(e) =>
                        setSeller((s) => ({ ...s, [f.key]: e.target.value }))
                      }
                      disabled={disabled}
                    />
                  )}
                </FormField>
              )
            })}
            <FormField
              label="Székhely vármegyéje"
              htmlFor="ws-county"
              hint="Békéltető testület / cégbíróság"
              className="sm:col-span-2"
              error={errors.county}
            >
              <Select
                id="ws-county"
                value={county}
                onChange={(e) => setCounty(e.target.value)}
                disabled={disabled}
              >
                <option value="">
                  {autoCounty
                    ? `Automatikus: ${COUNTIES[autoCounty].label}`
                    : 'Válassz vármegyét'}
                </option>
                {COUNTY_CODES.map((c) => (
                  <option key={c} value={c}>
                    {COUNTIES[c].label}
                  </option>
                ))}
              </Select>
            </FormField>
            <p className="col-span-full text-hint text-ink-secondary">
              Logo és ERP cégadat:{' '}
              <Link
                href="/beallitasok/cegadatok"
                className="font-medium text-ink underline underline-offset-2"
              >
                Cégadatok
              </Link>
              .
            </p>
          </FormSection>

          <FormSection
            title="Ügyfélszolgálat"
            description="Panasz / elállás tájékoztatóban jelenik meg."
            columns={4}
          >
            <FormField
              label="Levelezési, visszaküldési cím"
              htmlFor="ws-service"
              optionalLabel
              hint="Ha eltér a székhelytől"
              className="sm:col-span-2"
              error={errors.serviceAddress}
            >
              <Input
                id="ws-service"
                value={serviceAddress}
                onChange={(e) => setServiceAddress(e.target.value)}
                maxLength={300}
                disabled={disabled}
              />
            </FormField>
            <FormField
              label="Elérhetőség ideje"
              htmlFor="ws-hours"
              optionalLabel
              hint="Pl. H–P 8–16"
              className="sm:col-span-2"
              error={errors.supportHours}
            >
              <Input
                id="ws-hours"
                value={supportHours}
                onChange={(e) => setSupportHours(e.target.value)}
                maxLength={160}
                disabled={disabled}
              />
            </FormField>
          </FormSection>
        </div>
      ) : null}

      {active === 'megjelenes' ? (
        <div
          role="tabpanel"
          id="webshop-settings-panel-megjelenes"
          aria-labelledby="webshop-settings-tab-megjelenes"
          className="space-y-4"
        >
          <FormSection
            title="Arculat"
            description="A bolt fejlécében megjelenő logo a Cégadatokból jön."
            columns={2}
          >
            <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="size-12 rounded-md border border-border object-contain bg-white"
                />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-md border border-dashed border-border text-hint text-ink-muted">
                  —
                </div>
              )}
              <div className="min-w-0">
                <p className="text-body font-medium text-ink">
                  {logoUrl ? 'Logo beállítva' : 'Nincs logo'}
                </p>
                <Link
                  href="/beallitasok/cegadatok"
                  className="text-hint font-medium text-ink underline underline-offset-2"
                >
                  Cégadatok megnyitása
                </Link>
              </div>
            </div>
          </FormSection>

          <FormSection title="Termékképek és ár" columns={2}>
            <FormField label="Képarány" htmlFor="ws-aspect">
              <Select
                id="ws-aspect"
                value={imageAspect}
                onChange={(e) =>
                  setImageAspect(e.target.value === 'portrait' ? 'portrait' : 'square')
                }
                disabled={disabled}
              >
                <option value="square">1:1 (négyzet)</option>
                <option value="portrait">4:5 (álló)</option>
              </Select>
            </FormField>
            <div className="space-y-2 sm:col-span-2">
              <Switch
                id="ws-net"
                checked={showNetPrice}
                disabled={disabled}
                onCheckedChange={setShowNetPrice}
                label="Nettó ár mutatása"
                description="B2B: a bruttó alatt a nettó is látszik."
              />
              <Switch
                id="ws-sold"
                checked={showSoldCount}
                disabled={disabled}
                onCheckedChange={setShowSoldCount}
                label="Eladott darabszám a termékoldalon"
              />
              <Switch
                id="ws-reviews"
                checked={reviewsEnabled}
                disabled={disabled}
                onCheckedChange={setReviewsEnabled}
                label="Értékelések engedélyezve"
              />
            </div>
          </FormSection>

          <FormSection
            title="Közösségi oldalak"
            description="A bolt láblécében jelennek meg. Üresen hagyva a link nem látszik. Csak https:// címet írj."
            columns={2}
          >
            <FormField
              label="Facebook"
              htmlFor="ws-social-fb"
              error={errors.socialFacebook}
            >
              <Input
                id="ws-social-fb"
                type="url"
                inputMode="url"
                placeholder="https://facebook.com/…"
                value={socialFacebook}
                disabled={disabled}
                onChange={(e) => setSocialFacebook(e.target.value)}
              />
            </FormField>
            <FormField
              label="Instagram"
              htmlFor="ws-social-ig"
              error={errors.socialInstagram}
            >
              <Input
                id="ws-social-ig"
                type="url"
                inputMode="url"
                placeholder="https://instagram.com/…"
                value={socialInstagram}
                disabled={disabled}
                onChange={(e) => setSocialInstagram(e.target.value)}
              />
            </FormField>
            <FormField
              label="YouTube"
              htmlFor="ws-social-yt"
              error={errors.socialYoutube}
            >
              <Input
                id="ws-social-yt"
                type="url"
                inputMode="url"
                placeholder="https://youtube.com/…"
                value={socialYoutube}
                disabled={disabled}
                onChange={(e) => setSocialYoutube(e.target.value)}
              />
            </FormField>
            <FormField
              label="TikTok"
              htmlFor="ws-social-tt"
              error={errors.socialTiktok}
            >
              <Input
                id="ws-social-tt"
                type="url"
                inputMode="url"
                placeholder="https://tiktok.com/@…"
                value={socialTiktok}
                disabled={disabled}
                onChange={(e) => setSocialTiktok(e.target.value)}
              />
            </FormField>
            <FormField
              label="LinkedIn"
              htmlFor="ws-social-li"
              error={errors.socialLinkedin}
            >
              <Input
                id="ws-social-li"
                type="url"
                inputMode="url"
                placeholder="https://linkedin.com/company/…"
                value={socialLinkedin}
                disabled={disabled}
                onChange={(e) => setSocialLinkedin(e.target.value)}
              />
            </FormField>
          </FormSection>
        </div>
      ) : null}

      {active === 'kereskedelem' ? (
        <div
          role="tabpanel"
          id="webshop-settings-panel-kereskedelem"
          aria-labelledby="webshop-settings-tab-kereskedelem"
          className="space-y-4"
        >
          <FormSection title="Készlet és visszaküldés" columns={4}>
            <FormField
              label="Alacsony készlet küszöb (db)"
              htmlFor="ws-low"
              error={errors.lowStockThreshold}
            >
              <Input
                id="ws-low"
                value={lowStock}
                onChange={(e) => setLowStock(e.target.value)}
                inputMode="numeric"
                disabled={disabled}
              />
            </FormField>
            <FormField
              label="Elállás / visszaküldés (nap)"
              htmlFor="ws-return"
              optionalLabel
              hint={`Törvényes minimum: ${STATUTORY_RETURN_DAYS}`}
              error={errors.returnDays}
            >
              <Input
                id="ws-return"
                value={returnDays}
                onChange={(e) => setReturnDays(e.target.value)}
                inputMode="numeric"
                disabled={disabled}
                placeholder={String(STATUTORY_RETURN_DAYS)}
              />
            </FormField>
            <FormField label="Visszaküldés költségét viseli" htmlFor="ws-paidby">
              <Select
                id="ws-paidby"
                value={returnPaidBy}
                onChange={(e) =>
                  setReturnPaidBy(e.target.value === 'seller' ? 'seller' : 'customer')
                }
                disabled={disabled}
              >
                <option value="customer">Vásárló</option>
                <option value="seller">Eladó</option>
              </Select>
            </FormField>
            <FormField
              label="Önkéntes jótállás (hó)"
              htmlFor="ws-warranty"
              optionalLabel
              error={errors.warrantyMonths}
            >
              <Input
                id="ws-warranty"
                value={warrantyMonths}
                onChange={(e) => setWarrantyMonths(e.target.value)}
                inputMode="numeric"
                disabled={disabled}
              />
            </FormField>
            <FormField
              label="Visszaküldési tájékoztató (rövid)"
              htmlFor="ws-policy"
              optionalLabel
              className="sm:col-span-2"
              error={errors.returnPolicyText}
            >
              <Input
                id="ws-policy"
                value={returnPolicyText}
                onChange={(e) => setReturnPolicyText(e.target.value)}
                maxLength={1500}
                disabled={disabled}
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Értékesítés típusa"
            description="A tájékoztatók és a bolt szövegei ehhez igazodnak."
            columns={2}
          >
            <FormField label="Kiknek értékesítesz?" htmlFor="ws-audience">
              <Select
                id="ws-audience"
                value={audience}
                onChange={(e) =>
                  setAudience(e.target.value === 'business' ? 'business' : 'consumer')
                }
                disabled={disabled}
              >
                <option value="consumer">Magánszemélyeknek is (B2C)</option>
                <option value="business">Csak cégeknek (B2B)</option>
              </Select>
            </FormField>
            <div className="col-span-full space-y-2">
              <Switch
                id="ws-made"
                checked={madeToOrder}
                disabled={disabled}
                onCheckedChange={setMadeToOrder}
                label="Egyedi méretre gyártott / vágott termékek"
                description="Ezekre nem vonatkozik a fogyasztói elállás."
              />
              <Switch
                id="ws-mandatory"
                checked={mandatoryWarranty}
                disabled={disabled}
                onCheckedChange={setMandatoryWarranty}
                label="Kötelező jótállás alá tartozó termékek"
              />
              <Switch
                id="ws-newsletter"
                checked={newsletter}
                disabled={disabled}
                onCheckedChange={setNewsletter}
                label="Hírlevelet küldök"
              />
              <Switch
                id="ws-micro"
                checked={microEnterprise}
                disabled={disabled}
                onCheckedChange={setMicroEnterprise}
                label="Mikrovállalkozás vagyunk"
              />
              <Switch
                id="ws-ai"
                checked={allowAiTraining}
                disabled={disabled}
                onCheckedChange={setAllowAiTraining}
                label="AI botok taníthatnak a tartalomból"
                description="GPTBot / Google-Extended — a keresés ettől független."
              />
            </div>
          </FormSection>
        </div>
      ) : null}

      {active === 'szallitas' ? (
        <div
          role="tabpanel"
          id="webshop-settings-panel-szallitas"
          aria-labelledby="webshop-settings-tab-szallitas"
        >
          <FormSection
            title="Házhoz és átvétel"
            description="A vásárló fulfillment opciót lát (díj + idő / átvétel) — nem futárválasztót."
            columns={4}
          >
            <div className="col-span-full">
              <Switch
                id="sf-home"
                checked={homeDeliveryEnabled}
                disabled={disabled}
                onCheckedChange={setHomeDeliveryEnabled}
                label="Házhozszállítás"
                description="A termékoldalon és a kosárban megjelenik a díj és az átfutás."
              />
            </div>
            {homeDeliveryEnabled ? (
              <>
                <FormField
                  label="Házhoz díj (bruttó Ft)"
                  htmlFor="sf-fee"
                  required
                  error={errors.shippingFeeGross}
                >
                  <Input
                    id="sf-fee"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(e.target.value)}
                    inputMode="numeric"
                    disabled={disabled}
                    placeholder="1990"
                  />
                </FormField>
                <FormField
                  label="Átfutás – min. (munkanap)"
                  htmlFor="sf-dmin"
                  required
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
                  label="Átfutás – max. (munkanap)"
                  htmlFor="sf-dmax"
                  required
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
                <p className="col-span-full text-hint text-ink-secondary">
                  A feladást jelenleg GLS-sel intézzük.
                </p>
              </>
            ) : null}

            <div className="col-span-full border-t border-border pt-3">
              <Switch
                id="sf-pickup"
                checked={pickupEnabled}
                disabled={disabled}
                onCheckedChange={setPickupEnabled}
                label="Személyes átvétel"
                description="Raktáron lévő terméknél „Átvehető a boltban” jelenik meg."
              />
            </div>
            {pickupEnabled ? (
              <FormField
                label="Átvételi hely"
                htmlFor="sf-pickup-label"
                optionalLabel
                hint="Pl. Kecskemét, Mindszenti krt. 10. · H–P 8–16"
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
        </div>
      ) : null}

      {active === 'fizetes' ? (
        <div
          role="tabpanel"
          id="webshop-settings-panel-fizetes"
          aria-labelledby="webshop-settings-tab-fizetes"
        >
          <FormSection
            title="Fizetési módok"
            description="Három buyer opció — nem futár-utánvét, nem külön készpénz/terminál a weben."
            columns={4}
          >
            <fieldset className="col-span-full" disabled={disabled}>
              <legend className="sr-only">Fizetési módok</legend>
              <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-1">
                {W1_PAYMENT_CODES.map((code) => {
                  const pickupOnly = code === 'pickup_cash'
                  const blocked = pickupOnly && !pickupEnabled
                  return (
                    <CheckItem
                      key={code}
                      id={`sf-pay-${code}`}
                      label={PAYMENT_METHODS[code].label}
                      description={
                        blocked
                          ? 'Kapcsold be a személyes átvételt a Szállítás fülön.'
                          : PAYMENT_METHODS[code].hint
                      }
                      checked={payments.includes(code) && !blocked}
                      disabled={blocked}
                      onChange={(on) =>
                        setPayments((list) =>
                          toggle(list, code, on, W1_PAYMENT_CODES)
                        )
                      }
                    />
                  )
                })}
              </div>
            </fieldset>
            {payments.includes('transfer') ? (
              <>
                <FormField
                  label="Bankszámlaszám"
                  htmlFor="sf-bank"
                  required
                  hint="A díjbekérőn jelenik meg"
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
                  hint={`Alapérték: ${DEFAULT_TRANSFER_HOLD_DAYS}`}
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
        </div>
      ) : null}

      {active === 'domain' ? (
        <div
          role="tabpanel"
          id="webshop-settings-panel-domain"
          aria-labelledby="webshop-settings-tab-domain"
        >
          <WebshopChannelsClient
            embedded
            canWrite={canWrite}
            primaryUrl={domain.primaryUrl}
            primaryIsCustom={domain.primaryIsCustom}
            subdomainUrl={domain.subdomainUrl}
            indexNowLive={domain.indexNowLive}
            domains={domain.domains}
          />
        </div>
      ) : null}

      {active === 'jogi' ? (
        <div
          role="tabpanel"
          id="webshop-settings-panel-jogi"
          aria-labelledby="webshop-settings-tab-jogi"
        >
          <FormSection
            title="Fogyasztó Barát"
            description="ÁSZF és adatkezelés külső szolgáltatással — nem saját szövegszerkesztő."
            columns={1}
          >
            <div className="col-span-full rounded-md border border-border bg-subtle/40 px-3 py-2.5">
              <p className="text-body text-ink">
                A kötelező fogyasztóvédelmi dokumentumokat a{' '}
                <a
                  href="https://fogyasztobarat.hu/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-2"
                >
                  Fogyasztó Barát
                </a>{' '}
                szolgáltatással kötjük be (PDF + beágyazás). Nincs saját ÁSZF-szerkesztő — a
                bekötő mezők hamarosan ezen a fülön lesznek.
              </p>
            </div>
          </FormSection>
        </div>
      ) : null}
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
  onChange,
  disabled
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className={cn('flex items-start gap-2', disabled && 'opacity-60')}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#18181B] disabled:cursor-not-allowed"
      />
      <label
        htmlFor={id}
        className={cn(
          'min-w-0 text-body text-ink',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        )}
      >
        {label}
        {description ? (
          <span className="block text-hint text-ink-secondary">{description}</span>
        ) : null}
      </label>
    </div>
  )
}
