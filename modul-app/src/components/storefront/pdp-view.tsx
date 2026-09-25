import {
  CalendarClock,
  Check,
  ChevronLeft,
  CircleAlert,
  CircleCheck,
  FileText,
  MessageCircle,
  Package,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Store
} from 'lucide-react'
import Link from 'next/link'

import {
  CategoryBreadcrumb,
  type CrumbCategory
} from '@/components/storefront/category-breadcrumb'
import { ClampText } from '@/components/storefront/clamp-text'
import { StorefrontPdpBuyBox } from '@/components/storefront/pdp-buy-box'
import { StorefrontPdpGallery } from '@/components/storefront/pdp-gallery'
import { Stars, StorefrontPdpReviews } from '@/components/storefront/pdp-reviews'
import { PdpSection, SECTION_TITLE } from '@/components/storefront/pdp-section'
import { StorefrontPdpVariants } from '@/components/storefront/pdp-variants'
import { PdpVideo } from '@/components/storefront/pdp-video'
import { ProductRail, type RailCard } from '@/components/storefront/product-grid'
import { RecentlyViewedRail, RecordProductView } from '@/components/storefront/recently-viewed'
import { StorefrontFrame } from '@/components/storefront/storefront-chrome'
import { DetailsHashOpener } from '@/components/storefront/storefront-scroll'
import { DOCUMENT_KIND_LABEL, documentLanguageLabel } from '@/lib/accessories/document-kinds'
import { countryName } from '@/lib/geo/countries'
import type { RelatedCards, StorefrontCard } from '@/lib/storefront/catalog'
import { formatFt } from '@/lib/storefront/format'
import type { PublicPdpPayload, PublicPdpVariant } from '@/lib/storefront/pdp'
import type { StorefrontCategory, StorefrontSeller } from '@/lib/storefront/shell'
import { netContentLabel, unitPriceLabel } from '@/lib/storefront/unit-price'
import { categoryPath, productPath, STOREFRONT_HOME } from '@/lib/storefront/url'
import { STATUTORY_RETURN_DAYS } from '@/lib/webshop/settings'
import { cn } from '@/lib/utils'

type StorefrontPdpViewProps = {
  payload: PublicPdpPayload
  categories: StorefrontCategory[]
  chain: CrumbCategory[]
  siblings: CrumbCategory[]
  related: RelatedCards
  similar: StorefrontCard[]
  similarMore: { href: string; count: number } | null
}

const FIT_ANCHOR = 'kulcsadatok'
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

/** „1051 Budapest, Fő u. 1.” → „Budapest”. */
function cityOf(address: string | null): string | null {
  if (!address) return null
  const m = address.match(/\b\d{4}\s+([^,\d]+?)(?:,|$)/)
  return m?.[1]?.trim() || null
}

const arrivalFmt = new Intl.DateTimeFormat('hu-HU', { month: 'long', day: 'numeric' })

function arrivalLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime()) ? iso : arrivalFmt.format(d)
}

const linkCls = 'cursor-pointer font-medium text-ink underline underline-offset-2'

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('hu-HU')} KB`
}

type Alternative = {
  href: string
  title: string
  imageUrl: string | null
  priceGross: number
  note: string
}

export function StorefrontPdpView({
  payload,
  categories,
  chain,
  siblings,
  related,
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
  const packIsAxis = product.variantAxes.some((a) => a.key === '__pack')
  const chips: string[] =
    product.keySpecs.length > 0
      ? product.keySpecs.slice(0, MAX_CHIPS).map((k) => `${k.name}: ${k.value}`)
      : [product.material, colorIsAxis ? null : product.color]
          .filter((v): v is string => Boolean(v && v.trim()))
          .slice(0, MAX_CHIPS)

  const unitPrice = unitPriceLabel(product.priceGross, product.netContent)
  const netIsMultipack =
    product.multipack != null &&
    product.netContent?.unit === 'db' &&
    product.netContent.quantity === product.multipack
  const priceMeta = [
    product.multipack != null && !packIsAxis ? `${product.multipack} db-os csomag` : null,
    product.netContent && !packIsAxis && !netIsMultipack ? netContentLabel(product.netContent) : null,
    unitPrice
  ].filter((p): p is string => Boolean(p))
  const largerPack = related.largerPack.slice(0, 2)
  const origin = countryName(product.countryOfOrigin)

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
  const inStockCurated = product.inStock
    ? null
    : (related.alternative.find((c) => c.inStock) ?? null)
  const inStockSimilar = product.inStock ? null : (similar.find((c) => c.inStock) ?? null)
  const alternative: Alternative | null = inStockCurated
    ? {
        href: productPath(inStockCurated.slug),
        title: inStockCurated.title,
        imageUrl: inStockCurated.imageUrl,
        priceGross: inStockCurated.priceGross,
        note: 'Ajánlott helyettesítő, raktáron'
      }
    : inStockSibling
    ? {
        href: productPath(inStockSibling.slug),
        title: variantName(inStockSibling, product.variantAxes) || inStockSibling.title,
        imageUrl: inStockSibling.imageUrl,
        priceGross: inStockSibling.priceGross,
        note: 'Másik változat, raktáron'
      }
    : inStockSimilar
      ? {
          href: productPath(inStockSimilar.slug),
          title: inStockSimilar.title,
          imageUrl: inStockSimilar.imageUrl,
          priceGross: inStockSimilar.priceGross,
          note: 'Hasonló termék, raktáron'
        }
      : null

  const seriesCards: RailCard[] = product.variants
    .filter((v) => !v.current)
    .map((v) => ({
      id: v.id,
      slug: v.slug,
      title: v.title,
      imageUrl: v.imageUrl,
      priceGross: v.priceGross,
      inStock: v.inStock,
      unitPrice: unitPriceLabel(v.priceGross, v.netContent)
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
  const parent = chain[chain.length - 1] ?? null
  const hasManufacturerInfo = Boolean(product.manufacturer || product.safetyInfo)

  const backOverlay = (
    <Link
      href={parent ? categoryPath(parent.slug) : STOREFRONT_HOME}
      aria-label={`Vissza: ${parent ? parent.name : 'Összes kategória'}`}
      className="absolute left-2 top-2 z-10 inline-flex h-10 max-w-[60%] cursor-pointer items-center gap-0.5 rounded-full bg-white/90 pl-1.5 pr-3 text-[13px] font-medium text-ink shadow-sm lg:hidden"
    >
      <ChevronLeft className="size-5 shrink-0" aria-hidden />
      <span className="truncate">{parent ? parent.name : 'Kategóriák'}</span>
    </Link>
  )

  return (
    <StorefrontFrame
      seller={seller}
      settings={settings}
      categories={categories}
      bottomBarSpace
    >
      <DetailsHashOpener />
      <RecordProductView
        item={{
          id: product.id,
          slug: product.slug,
          title: product.title,
          imageUrl: images[0] ?? null,
          priceGross: product.priceGross
        }}
      />
      <main className="mx-auto max-w-[1200px] pb-10 lg:px-8 lg:pb-20 lg:pt-6">
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
            <StorefrontPdpGallery
              images={images}
              alt={product.title}
              alts={product.imageAlts}
              aspect={settings.imageAspect}
              overlay={backOverlay}
            />
          </div>

          <div className="px-4 pt-3 lg:px-0 lg:pt-0">
            {/* Mi ez? */}
            <div className="space-y-1">
              {product.brand || product.isBundle ? (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-secondary">
                  {product.brand ? <span>{product.brand}</span> : null}
                  {product.isBundle ? (
                    <span className="inline-flex items-center gap-1 rounded border border-stone-300 px-1.5 py-0.5 text-[12px] font-medium text-ink">
                      <Package className="size-3.5 shrink-0" aria-hidden />
                      Csomagajánlat
                    </span>
                  ) : null}
                </p>
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
            <div className="mt-2.5 space-y-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[24px] font-bold tabular-nums tracking-tight text-ink">
                  {formatFt(product.priceGross)}
                </span>
                {priceMeta.length > 0 ? (
                  <span className="text-[13px] tabular-nums text-ink-secondary">
                    {priceMeta.join(' · ')}
                  </span>
                ) : null}
              </p>
              <p className="text-[12px] tabular-nums text-ink-muted">
                {settings.showNetPrice
                  ? `nettó ${formatFt(product.priceNet)} + ${product.vatPercent}% áfa`
                  : `Az ár tartalmazza a ${product.vatPercent}% áfát`}
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
              <div className="mt-4">
                <StorefrontPdpVariants
                  axes={product.variantAxes}
                  variants={product.variants}
                  fitAnchor={hasFit ? FIT_ANCHOR : null}
                />
              </div>
            ) : null}

            {largerPack.length > 0 ? (
              <ul className="mt-3 space-y-1" aria-label="Nagyobb kiszerelés">
                {largerPack.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={productPath(c.slug)}
                      className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-stone-200 px-3 py-1.5 text-[13px] hover:border-ink"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-ink-secondary">Nagyobb kiszerelés: </span>
                        <span className="text-ink">{c.title}</span>
                      </span>
                      <span className="shrink-0 text-right tabular-nums">
                        <span className="font-semibold text-ink">{formatFt(c.priceGross)}</span>
                        {c.unitPrice ? (
                          <span className="block text-[12px] text-ink-secondary">{c.unitPrice}</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {/* Mikor és mennyiért kapom meg? — egy sor */}
            <p className="mt-4 flex gap-2 text-[14px] leading-snug">
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
            {product.expectedArrival ? (
              <p className="mt-1 flex gap-2 text-[14px] leading-snug text-ink">
                <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
                Várható érkezés: {arrivalLabel(product.expectedArrival)}
              </p>
            ) : null}

            <div className="mt-3">
              <StorefrontPdpBuyBox
                accessoryId={product.id}
                slug={product.slug}
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

            {alternative ? <AlternativeCard alt={alternative} /> : null}

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

            <SellerLine seller={seller} />

            {related.required.length > 0 ? (
              <div className="-mx-4 mt-8 lg:mx-0">
                <ProductRail title="Kell hozzá" items={related.required} />
              </div>
            ) : null}

            {hasFit ? (
              <section
                id={FIT_ANCHOR}
                aria-labelledby="kulcsadatok-title"
                className="mt-8 scroll-mt-4 space-y-3"
              >
                <h2 id="kulcsadatok-title" className={SECTION_TITLE}>
                  Kulcsadatok
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
                      alt={`${product.title} — méretek`}
                      loading="lazy"
                      className="w-full object-contain p-3"
                    />
                    <figcaption className="border-t border-stone-100 px-3 py-2 text-[12px] text-ink-secondary">
                      Méretek
                    </figcaption>
                  </figure>
                ) : null}
                {product.compatibility.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[14px] font-medium text-ink">Kinek, mihez ajánljuk</p>
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
                {seller.phone || seller.email ? (
                  <p className="text-[13px] leading-snug text-ink-secondary">
                    Nem vagy biztos benne?{' '}
                    {seller.phone ? (
                      <a href={`tel:${seller.phone}`} className={linkCls}>
                        Hívj, segítünk választani
                      </a>
                    ) : (
                      <a
                        href={`mailto:${seller.email}?subject=${encodeURIComponent(`Kérdés: ${product.title}`)}`}
                        className={linkCls}
                      >
                        Írj nekünk
                      </a>
                    )}
                  </p>
                ) : null}
              </section>
            ) : null}

            {/* Részletek — egységes, összecsukható szekciók; üres szekció nincs */}
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

              {product.ingredients ? (
                <PdpSection title="Összetevők">
                  <p className="whitespace-pre-wrap">{product.ingredients}</p>
                </PdpSection>
              ) : null}

              {product.usage ? (
                <PdpSection title="Használat">
                  <p className="whitespace-pre-wrap">{product.usage}</p>
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
                <PdpSection title="Csomag tartalma" defaultOpen={product.isBundle}>
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

              {product.documents.length > 0 ? (
                <PdpSection title="Dokumentumok" count={product.documents.length}>
                  <ul className="space-y-1">
                    {product.documents.map((d) => (
                      <li key={d.id}>
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 hover:bg-stone-50"
                        >
                          <FileText className="size-5 shrink-0 text-ink" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block text-ink underline underline-offset-2">{d.title}</span>
                            <span className="block text-[12px] text-ink-secondary">
                              {[
                                DOCUMENT_KIND_LABEL[d.kind],
                                d.language !== 'hu' ? documentLanguageLabel(d.language) : null,
                                `PDF, ${formatFileSize(d.sizeBytes)}`
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </PdpSection>
              ) : null}

              {product.videoUrl ? (
                <PdpSection title="Videó">
                  <PdpVideo url={product.videoUrl} title={product.title} />
                </PdpSection>
              ) : null}

              <PdpSection id={SHIPPING_ANCHOR} title="Szállítás és visszaküldés">
                <div className="space-y-3">
                  {deliveryRange || settings.shippingFeeGross != null ? (
                    <p>
                      <strong className="font-medium text-ink">Szállítás. </strong>
                      {deliveryRange ? `Átfutás: ${deliveryRange}. ` : ''}
                      {settings.shippingFeeGross != null
                        ? settings.shippingFeeGross === 0
                          ? 'A szállítás ingyenes. '
                          : `Szállítási díj: ${formatFt(settings.shippingFeeGross)}. `
                        : ''}
                      {settings.freeShippingThresholdGross != null &&
                      settings.shippingFeeGross !== 0
                        ? `${formatFt(settings.freeShippingThresholdGross)} feletti rendelésnél ingyenes.`
                        : ''}
                    </p>
                  ) : null}
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

              {reviews.enabled && reviews.count > 0 ? (
                <PdpSection
                  id={REVIEWS_ANCHOR}
                  title="Értékelések"
                  count={reviews.count}
                  aside={
                    <span className="inline-flex items-center gap-1">
                      <Stars value={reviews.average} />
                      <span className="tabular-nums">{formatAverage(reviews.average)}</span>
                    </span>
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
                    {origin ? (
                      <>
                        <dt>Származási ország</dt>
                        <dd className="text-ink">{origin}</dd>
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

            {reviews.enabled && reviews.count === 0 ? (
              <div id={REVIEWS_ANCHOR} className="scroll-mt-4 pt-3">
                <StorefrontPdpReviews
                  accessoryId={product.id}
                  variantLabel={variantLabel}
                  reviews={reviews}
                  privacyUrl={settings.privacyUrl}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-10 space-y-10 lg:mt-16">
          <ProductRail title="Ugyanebből a termékből" items={seriesCards} />
          <ProductRail title="Tartozékok" items={related.accessory} />
          <ProductRail title="Helyette ezt is ajánljuk" items={related.alternative} />
          <ProductRail title="Gyakran együtt vásárolt" items={boughtTogether} />
          <ProductRail
            title="Hasonló termékek"
            items={similar}
            moreHref={similarMore?.href}
            moreLabel={similarMore ? `Összes (${similarMore.count})` : undefined}
          />
          <RecentlyViewedRail excludeId={product.id} />
        </div>
      </main>
    </StorefrontFrame>
  )
}

function AlternativeCard({ alt }: { alt: Alternative }) {
  return (
    <Link
      href={alt.href}
      className="mt-3 flex cursor-pointer items-center gap-3 rounded-md border border-stone-200 p-2.5 hover:border-ink"
    >
      <span className="size-14 shrink-0 overflow-hidden rounded bg-stone-100">
        {alt.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={alt.imageUrl} alt="" loading="lazy" className="size-full object-contain p-1 mix-blend-multiply" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[12px] font-medium text-green-700">
          <CircleCheck className="size-3.5 shrink-0" aria-hidden />
          {alt.note}
        </span>
        <span className="block truncate text-[14px] text-ink">{alt.title}</span>
        <span className="text-[14px] font-semibold tabular-nums text-ink">{formatFt(alt.priceGross)}</span>
      </span>
      <span className="shrink-0 text-[13px] font-medium text-ink underline underline-offset-2">Megnézem</span>
    </Link>
  )
}

/** „Ki árul?” — kis boltnál a bizalom forrása a látható, elérhető eladó. */
function SellerLine({ seller }: { seller: StorefrontSeller }) {
  const city = cityOf(seller.address)
  return (
    <p className="mt-3 flex items-start gap-2 border-t border-stone-100 pt-3 text-[13px] leading-snug text-ink-secondary">
      <Store className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
      <span>
        Forgalmazza: <span className="font-medium text-ink">{seller.name}</span>
        {city ? ` · ${city}` : ''}
        {seller.phone ? (
          <>
            {' · '}
            <a href={`tel:${seller.phone}`} className="cursor-pointer tabular-nums text-ink underline underline-offset-2">
              {seller.phone}
            </a>
          </>
        ) : null}
      </span>
    </p>
  )
}
