import {
  Check,
  CircleAlert,
  CircleCheck,
  MessageCircle,
  Package,
  RotateCcw,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react'
import Link from 'next/link'

import {
  CategoryBackLink,
  CategoryBreadcrumb,
  type CrumbCategory
} from '@/components/storefront/category-breadcrumb'
import { ClampText } from '@/components/storefront/clamp-text'
import { StorefrontPdpBuyBox } from '@/components/storefront/pdp-buy-box'
import { StorefrontPdpGallery } from '@/components/storefront/pdp-gallery'
import { Stars, StorefrontPdpReviews } from '@/components/storefront/pdp-reviews'
import { PdpSection, SECTION_TITLE } from '@/components/storefront/pdp-section'
import { StorefrontPdpVariants } from '@/components/storefront/pdp-variants'
import { ProductRail, type RailCard } from '@/components/storefront/product-grid'
import { StorefrontFrame } from '@/components/storefront/storefront-chrome'
import { DetailsHashOpener } from '@/components/storefront/storefront-scroll'
import type { StorefrontCard } from '@/lib/storefront/catalog'
import { formatFt } from '@/lib/storefront/format'
import type { PublicPdpPayload, PublicPdpVariant } from '@/lib/storefront/pdp'
import type { StorefrontCategory } from '@/lib/storefront/shell'
import { productPath, STOREFRONT_HOME } from '@/lib/storefront/url'
import { STATUTORY_RETURN_DAYS } from '@/lib/webshop/settings'
import { cn } from '@/lib/utils'

type StorefrontPdpViewProps = {
  payload: PublicPdpPayload
  categories: StorefrontCategory[]
  chain: CrumbCategory[]
  siblings: CrumbCategory[]
  required: StorefrontCard[]
  similar: StorefrontCard[]
  similarMore: { href: string; count: number } | null
}

const FIT_ANCHOR = 'passzol'
const SHIPPING_ANCHOR = 'szallitas'
const REVIEWS_ANCHOR = 'ertekelesek'
const MAX_CHIPS = 3

function salePercent(price: number, compare: number): number | null {
  if (!(compare > price) || price <= 0) return null
  return Math.round(((compare - price) / compare) * 100)
}

function formatAverage(v: number): string {
  return v.toLocaleString('hu-HU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function variantName(
  v: PublicPdpVariant,
  axes: PublicPdpPayload['product']['variantAxes']
): string {
  return axes
    .map((a) => v.values[a.key]?.label)
    .filter((l): l is string => Boolean(l))
    .join(' / ')
}

const linkCls = 'cursor-pointer font-medium text-ink underline underline-offset-2'

export function StorefrontPdpView({
  payload,
  categories,
  chain,
  siblings,
  required,
  similar,
  similarMore
}: StorefrontPdpViewProps) {
  const { product, seller, settings, reviews, soldLast30Days, boughtTogether } =
    payload

  const images =
    product.gallery.length > 0
      ? product.gallery
      : product.imageUrl
        ? [product.imageUrl]
        : []

  const discount = product.referencePriceGross
    ? salePercent(product.priceGross, product.referencePriceGross)
    : null

  const returnDays = Math.max(
    settings.returnDays ?? STATUTORY_RETURN_DAYS,
    STATUTORY_RETURN_DAYS
  )

  const [primarySpec, ...otherKeySpecs] = product.keySpecs
  const hasFit =
    product.keySpecs.length > 0 ||
    product.compatibility.length > 0 ||
    Boolean(product.measureImageUrl)

  const colorIsAxis = product.variantAxes.some(
    (a) => a.key === '__color' || /sz[ií]n|colou?r/i.test(a.name)
  )
  const chips: string[] =
    product.keySpecs.length > 0
      ? product.keySpecs.slice(0, MAX_CHIPS).map((k) => `${k.name}: ${k.value}`)
      : [product.material, colorIsAxis ? null : product.color]
          .filter((v): v is string => Boolean(v && v.trim()))
          .slice(0, MAX_CHIPS)

  const lowStock = product.inStock && product.onHand <= settings.lowStockThreshold

  const deliveryRange =
    settings.deliveryDaysMin != null && settings.deliveryDaysMax != null
      ? settings.deliveryDaysMin === settings.deliveryDaysMax
        ? `${settings.deliveryDaysMin} munkanap`
        : `${settings.deliveryDaysMin}–${settings.deliveryDaysMax} munkanap`
      : settings.deliveryDaysMax != null
        ? `legfeljebb ${settings.deliveryDaysMax} munkanap`
        : settings.deliveryDaysMin != null
          ? `${settings.deliveryDaysMin} munkanaptól`
          : null

  const shippingCost =
    settings.shippingFeeGross == null
      ? null
      : settings.shippingFeeGross === 0 ||
          (settings.freeShippingThresholdGross != null &&
            product.priceGross >= settings.freeShippingThresholdGross)
        ? 'ingyenes szállítás'
        : `szállítás ${formatFt(settings.shippingFeeGross)}`

  const availabilityParts = [
    product.inStock && deliveryRange ? `kiszállítás ${deliveryRange}` : null,
    product.inStock ? shippingCost : null,
    product.inStock && settings.pickupEnabled ? 'boltban átvehető' : null
  ].filter((p): p is string => Boolean(p))

  const inStockSibling = product.inStock
    ? null
    : (product.variants.find((v) => !v.current && v.inStock) ?? null)

  const seriesCards: RailCard[] = product.variants
    .filter((v) => !v.current)
    .map((v) => ({
      id: v.id,
      slug: v.slug,
      title: v.title,
      imageUrl: v.imageUrl,
      priceGross: v.priceGross,
      inStock: v.inStock
    }))

  const description = product.descriptionLong || product.descriptionShort
  const benefits = product.useCases.slice(0, 4)
  const variantLabel = product.variantLabel
  const contactHref = seller.phone
    ? `tel:${seller.phone}`
    : seller.email
      ? `mailto:${seller.email}?subject=${encodeURIComponent(`Kérdés: ${product.title}`)}`
      : null
  const home = { label: seller.name, href: STOREFRONT_HOME }
  const hasManufacturerInfo = Boolean(product.manufacturer || product.safetyInfo)

  return (
    <StorefrontFrame
      seller={seller}
      settings={settings}
      categories={categories}
      bottomBarSpace
    >
      <DetailsHashOpener />
      <main className="mx-auto max-w-[1200px] pb-10 lg:px-8 lg:pb-20 lg:pt-6">
        <CategoryBackLink home={home} chain={chain} className="px-4 lg:hidden" />
        <div className="mb-5 hidden lg:block">
          <CategoryBreadcrumb
            home={home}
            chain={chain}
            siblings={siblings}
            current={product.title}
          />
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-12">
          <div className="lg:sticky lg:top-[76px]">
            <StorefrontPdpGallery images={images} alt={product.title} alts={product.imageAlts} />
          </div>

          <div className="px-4 pt-4 lg:px-0 lg:pt-0">
            {/* Mi ez? */}
            <div className="space-y-1.5">
              {product.brand ? (
                <p className="text-[13px] text-ink-secondary">{product.brand}</p>
              ) : null}
              <h1 className="line-clamp-4 text-[20px] font-semibold leading-[1.25] tracking-[-0.01em] text-ink lg:text-[26px]">
                {product.title}
              </h1>
              {(reviews.enabled && reviews.count > 0) || soldLast30Days != null ? (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-secondary">
                  {reviews.enabled && reviews.count > 0 ? (
                    <a
                      href={`#${REVIEWS_ANCHOR}`}
                      className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 hover:text-ink"
                    >
                      <Stars value={reviews.average} />
                      <span className="font-medium tabular-nums text-ink">
                        {formatAverage(reviews.average)}
                      </span>
                      <span className="underline underline-offset-2">
                        {reviews.count} értékelés
                      </span>
                    </a>
                  ) : null}
                  {soldLast30Days != null ? (
                    <span>
                      <span className="tabular-nums">{soldLast30Days} db</span> kelt el az
                      elmúlt 30 napban
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>

            {/* Mennyi? */}
            <div className="mt-3 space-y-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[24px] font-bold tabular-nums tracking-tight text-ink">
                  {formatFt(product.priceGross)}
                </span>
                <span className="text-[12px] text-ink-muted">
                  bruttó, {product.vatPercent}% ÁFA-val
                </span>
              </p>
              {discount != null && product.referencePriceGross != null ? (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-secondary">
                  <span>
                    Előző 30 nap legalacsonyabb ára:{' '}
                    <span className="tabular-nums line-through">
                      {formatFt(product.referencePriceGross)}
                    </span>
                  </span>
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-[12px] font-medium text-red-700">
                    −{discount}% · {formatFt(product.referencePriceGross - product.priceGross)}{' '}
                    megtakarítás
                  </span>
                </p>
              ) : null}
            </div>

            {/* Passzol-e? — gyors áttekintés */}
            {chips.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Fő adatok">
                {chips.map((c) => (
                  <li key={c}>
                    {hasFit ? (
                      <a
                        href={`#${FIT_ANCHOR}`}
                        className="inline-flex min-h-8 cursor-pointer items-center rounded-md border border-stone-200 px-2.5 text-[13px] text-ink hover:border-stone-400"
                      >
                        {c}
                      </a>
                    ) : (
                      <span className="inline-flex min-h-8 items-center rounded-md border border-stone-200 px-2.5 text-[13px] text-ink">
                        {c}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}

            {product.variantAxes.length > 0 ? (
              <div className="mt-5">
                <StorefrontPdpVariants
                  axes={product.variantAxes}
                  variants={product.variants}
                  fitAnchor={hasFit ? FIT_ANCHOR : null}
                />
              </div>
            ) : null}

            {/* Mikor és mennyiért kapom meg? — egy sor */}
            <div className="mt-5 space-y-1 text-[14px] leading-snug">
              <p className="flex gap-2">
                {product.inStock ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
                )}
                <span>
                  <span className={cn('font-medium', product.inStock ? 'text-green-700' : 'text-ink')}>
                    {product.inStock ? 'Raktáron' : 'Jelenleg nincs készleten'}
                  </span>
                  {lowStock ? (
                    <span className="text-ink-secondary"> — még {product.onHand} db</span>
                  ) : null}
                  {availabilityParts.length > 0 ? (
                    <span className="text-ink-secondary"> · {availabilityParts.join(' · ')}</span>
                  ) : null}
                </span>
              </p>
              {inStockSibling ? (
                <p className="pl-6 text-[13px] text-ink-secondary">
                  Raktáron:{' '}
                  <Link href={productPath(inStockSibling.slug)} scroll={false} className={linkCls}>
                    {variantName(inStockSibling, product.variantAxes) || inStockSibling.title}
                  </Link>
                </p>
              ) : null}
            </div>

            <div className="mt-4">
              <StorefrontPdpBuyBox
                accessoryId={product.id}
                imageUrl={images[0] ?? null}
                unitGross={product.priceGross}
                priceTiers={product.priceTiers}
                inStock={product.inStock}
                maxQty={product.inStock ? product.onHand : null}
                variantLabel={variantLabel}
                freeShippingThresholdGross={settings.freeShippingThresholdGross}
                shippingFeeGross={settings.shippingFeeGross}
                productTitle={product.title}
                sku={product.sku}
                sellerEmail={seller.email}
                sellerPhone={seller.phone}
                privacyUrl={settings.privacyUrl}
              />
            </div>

            {/* Kockázatcsökkentés a gomb alatt — egy sor */}
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-ink">
              <li>
                <a
                  href={`#${SHIPPING_ANCHOR}`}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 hover:underline"
                >
                  <RotateCcw className="size-4 shrink-0" aria-hidden />
                  {returnDays} nap elállás
                </a>
              </li>
              {settings.warrantyMonths != null && settings.warrantyMonths > 0 ? (
                <li className="inline-flex min-h-8 items-center gap-1.5">
                  <ShieldCheck className="size-4 shrink-0" aria-hidden />
                  {settings.warrantyMonths} hónap jótállás
                </li>
              ) : null}
              {contactHref ? (
                <li>
                  <a
                    href={contactHref}
                    className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 underline underline-offset-2"
                  >
                    <MessageCircle className="size-4 shrink-0" aria-hidden />
                    Kérdezz tőlünk
                  </a>
                </li>
              ) : null}
            </ul>

            {required.length > 0 ? (
              <div className="-mx-4 mt-8 lg:mx-0">
                <ProductRail title="Kell hozzá" items={required} />
              </div>
            ) : null}

            {hasFit ? (
              <section
                id={FIT_ANCHOR}
                aria-labelledby="passzol-title"
                className="mt-8 scroll-mt-4 space-y-3"
              >
                <h2 id="passzol-title" className={SECTION_TITLE}>
                  Passzol-e?
                </h2>
                {primarySpec ? (
                  <dl className="space-y-2">
                    <div className="rounded-md border border-ink px-4 py-3">
                      <dt className="text-[13px] text-ink-secondary">{primarySpec.name}</dt>
                      <dd className="text-[24px] font-semibold leading-tight tabular-nums text-ink">
                        {primarySpec.value}
                      </dd>
                      {primarySpec.hint ? (
                        <dd className="mt-1 text-[13px] leading-snug text-ink-secondary">
                          {primarySpec.hint}
                        </dd>
                      ) : null}
                    </div>
                    {otherKeySpecs.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {otherKeySpecs.map((k) => (
                          <div
                            key={k.attributeId}
                            className={cn(
                              'rounded-md border border-stone-200 px-3 py-2.5',
                              otherKeySpecs.length === 1 && 'col-span-2'
                            )}
                          >
                            <dt className="text-[12px] text-ink-secondary">{k.name}</dt>
                            <dd className="text-[16px] font-semibold leading-snug tabular-nums text-ink">
                              {k.value}
                            </dd>
                            {k.hint ? (
                              <dd className="mt-0.5 text-[12px] leading-snug text-ink-muted">
                                {k.hint}
                              </dd>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </dl>
                ) : null}
                {product.measureImageUrl ? (
                  <figure className="overflow-hidden rounded-md border border-stone-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.measureImageUrl}
                      alt={`${product.title} — hogyan mérd le`}
                      loading="lazy"
                      className="w-full object-contain p-3"
                    />
                    <figcaption className="border-t border-stone-100 px-3 py-2 text-[12px] text-ink-secondary">
                      Hogyan mérd le
                    </figcaption>
                  </figure>
                ) : null}
                {product.compatibility.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[14px] font-medium text-ink">Mihez illik</p>
                    <ul className="space-y-1.5">
                      {product.compatibility.map((c) => (
                        <li key={c} className="flex gap-2 text-[14px] text-ink">
                          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <p className="text-[13px] leading-snug text-ink-secondary">
                  Nem vagy biztos benne?{' '}
                  {seller.phone ? (
                    <a href={`tel:${seller.phone}`} className={linkCls}>
                      Hívj, és megnézzük együtt
                    </a>
                  ) : seller.email ? (
                    <a
                      href={`mailto:${seller.email}?subject=${encodeURIComponent(`Passzol-e: ${product.title}`)}`}
                      className={linkCls}
                    >
                      Küldj fotót a régiről
                    </a>
                  ) : (
                    'Mérd le a régit, és vesd össze a fenti adatokkal.'
                  )}
                </p>
              </section>
            ) : null}

            {/* Részletek — egységes, összecsukható szekciók */}
            <div className="mt-8 border-y border-stone-200">
              {description || benefits.length > 0 ? (
                <PdpSection title="Leírás" defaultOpen>
                  <div className="space-y-4">
                    {benefits.length > 0 ? (
                      <ul className="space-y-1.5">
                        {benefits.map((b) => (
                          <li key={b} className="flex gap-2 text-ink">
                            <Check className="mt-1 size-4 shrink-0" aria-hidden />
                            {b}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {description ? (
                      <ClampText>
                        <p className="whitespace-pre-wrap">{description}</p>
                      </ClampText>
                    ) : null}
                  </div>
                </PdpSection>
              ) : null}

              {product.specRows.length > 0 ? (
                <PdpSection title="Jellemzők" count={product.specRows.length}>
                  <dl className="divide-y divide-stone-100">
                    {product.specRows.map((r) => (
                      <div key={r.name} className="flex justify-between gap-4 py-2.5">
                        <dt>{r.name}</dt>
                        <dd className="text-right font-medium tabular-nums text-ink">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                </PdpSection>
              ) : null}

              {product.boxContents.length > 0 ? (
                <PdpSection title="Csomag tartalma és szerelés">
                  <ul className="space-y-1.5">
                    {product.boxContents.map((b) => (
                      <li key={b} className="flex gap-2 text-ink">
                        <Package className="mt-1 size-4 shrink-0" aria-hidden />
                        {b}
                      </li>
                    ))}
                  </ul>
                </PdpSection>
              ) : null}

              <PdpSection id={SHIPPING_ANCHOR} title="Szállítás és visszaküldés">
                <div className="space-y-3">
                  <p>
                    <strong className="font-medium text-ink">Szállítás. </strong>
                    {deliveryRange ? `Átfutás: ${deliveryRange}. ` : ''}
                    {settings.shippingFeeGross != null
                      ? settings.shippingFeeGross === 0
                        ? 'A szállítás ingyenes. '
                        : `Szállítási díj: ${formatFt(settings.shippingFeeGross)}. `
                      : 'A szállítási díjat a rendelés visszaigazolásában közöljük. '}
                    {settings.freeShippingThresholdGross != null
                      ? `${formatFt(settings.freeShippingThresholdGross)} feletti rendelésnél ingyenes.`
                      : ''}
                  </p>
                  {settings.pickupEnabled ? (
                    <p>
                      <strong className="font-medium text-ink">Személyes átvétel. </strong>
                      {settings.pickupLabel || 'A boltban, raktáron lévő terméknél.'}
                    </p>
                  ) : null}
                  <p>
                    <strong className="font-medium text-ink">Elállás. </strong>
                    Fogyasztóként a kézhezvételtől számított {returnDays} napon belül
                    indoklás nélkül elállhatsz a vásárlástól. Jelezd
                    {seller.email ? ` a ${seller.email} címen` : ' nekünk'}, és a vételárat
                    a kiszállítás díjával együtt 14 napon belül visszatérítjük.
                  </p>
                  {settings.returnPolicyText ? (
                    <p className="whitespace-pre-wrap">{settings.returnPolicyText}</p>
                  ) : null}
                  <p>
                    <strong className="font-medium text-ink">Szavatosság. </strong>
                    Hibás termék esetén kellékszavatossági és termékszavatossági jogaid
                    vannak (2 év).
                    {settings.warrantyMonths
                      ? ` Emellett ${settings.warrantyMonths} hónap jótállást vállalunk.`
                      : ''}
                  </p>
                  {settings.termsUrl ? (
                    <p>
                      Részletek az{' '}
                      <a href={settings.termsUrl} className={linkCls}>
                        Általános Szerződési Feltételekben
                      </a>
                      .
                    </p>
                  ) : null}
                </div>
              </PdpSection>

              {reviews.enabled ? (
                <PdpSection
                  id={REVIEWS_ANCHOR}
                  title="Értékelések"
                  count={reviews.count}
                  aside={
                    reviews.count > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Stars value={reviews.average} />
                        <span className="tabular-nums">{formatAverage(reviews.average)}</span>
                      </span>
                    ) : null
                  }
                >
                  <StorefrontPdpReviews
                    accessoryId={product.id}
                    variantLabel={variantLabel}
                    reviews={reviews}
                    privacyUrl={settings.privacyUrl}
                  />
                </PdpSection>
              ) : null}

              {product.faq.length > 0 ? (
                <PdpSection title="Gyakori kérdések" count={product.faq.length}>
                  <ul className="space-y-4">
                    {product.faq.map((f) => (
                      <li key={f.q}>
                        <p className="font-medium text-ink">{f.q}</p>
                        <p className="mt-1">{f.a}</p>
                      </li>
                    ))}
                  </ul>
                </PdpSection>
              ) : null}

              <PdpSection
                title={hasManufacturerInfo ? 'Gyártó és biztonság' : 'Termékazonosítók'}
              >
                <div className="space-y-3">
                  {product.manufacturer ? (
                    <div>
                      <p className="font-medium text-ink">Gyártó</p>
                      <p>{product.manufacturer.name}</p>
                      {product.manufacturer.address ? (
                        <p>{product.manufacturer.address}</p>
                      ) : null}
                      {product.manufacturer.email ? (
                        <p>
                          <a
                            href={`mailto:${product.manufacturer.email}`}
                            className="cursor-pointer underline underline-offset-2"
                          >
                            {product.manufacturer.email}
                          </a>
                        </p>
                      ) : null}
                      {product.manufacturer.website ? (
                        <p className="break-all">{product.manufacturer.website}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {product.manufacturer?.euRepName ? (
                    <div>
                      <p className="font-medium text-ink">Felelős személy az EU-ban</p>
                      <p>{product.manufacturer.euRepName}</p>
                      {product.manufacturer.euRepAddress ? (
                        <p>{product.manufacturer.euRepAddress}</p>
                      ) : null}
                      {product.manufacturer.euRepEmail ? (
                        <p>{product.manufacturer.euRepEmail}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                    <dt>Cikkszám</dt>
                    <dd className="tabular-nums text-ink">{product.sku}</dd>
                    {product.mpn ? (
                      <>
                        <dt>Gyártói cikkszám</dt>
                        <dd className="tabular-nums text-ink">{product.mpn}</dd>
                      </>
                    ) : null}
                    {product.gtin ? (
                      <>
                        <dt>EAN</dt>
                        <dd className="tabular-nums text-ink">{product.gtin}</dd>
                      </>
                    ) : null}
                  </dl>
                  {product.safetyInfo ? (
                    <div className="flex gap-2.5 rounded-md bg-amber-50 p-3 text-ink">
                      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <p className="whitespace-pre-wrap">
                        <strong className="font-medium">Figyelmeztetés. </strong>
                        {product.safetyInfo}
                      </p>
                    </div>
                  ) : null}
                </div>
              </PdpSection>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-10 lg:mt-16">
          <ProductRail title="Ugyanebből a sorozatból" items={seriesCards} />
          <ProductRail title="Gyakran együtt vásárolt" items={boughtTogether} />
          <ProductRail
            title="Hasonló termékek"
            items={similar}
            moreHref={similarMore?.href}
            moreLabel={similarMore ? `Összes (${similarMore.count})` : undefined}
          />
        </div>
      </main>
    </StorefrontFrame>
  )
}
