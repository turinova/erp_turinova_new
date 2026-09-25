'use client'

import { Bell, Check, Mail, Minus, Phone, Plus, ShoppingBag, Truck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { StockNotifyDialog } from '@/components/storefront/stock-notify-dialog'
import { STOREFRONT_FOOTER_ID } from '@/components/storefront/storefront-scroll'
import { buttonVariants } from '@/components/ui/button'
import { formatFt as formatMoneyFt } from '@/lib/storefront/format'
import type { PublicPdpPriceTier } from '@/lib/storefront/pdp'
import { cn } from '@/lib/utils'

type StorefrontPdpBuyBoxProps = {
  accessoryId: string
  imageUrl: string | null
  unitGross: number
  priceTiers: PublicPdpPriceTier[]
  inStock: boolean
  maxQty: number | null
  variantLabel: string | null
  freeShippingThresholdGross: number | null
  shippingFeeGross: number | null
  productTitle: string
  sku: string
  sellerEmail: string | null
  sellerPhone: string | null
  privacyUrl: string | null
}

type CtaAction =
  | { kind: 'mailto'; href: string; label: string; icon: typeof Mail }
  | { kind: 'tel'; href: string; label: string; icon: typeof Phone }
  | { kind: 'notify'; label: string }
  | { kind: 'none'; label: string }

const MAX_QTY = 999

function unitForQty(base: number, tiers: PublicPdpPriceTier[], qty: number) {
  let unit = base
  for (const t of tiers) {
    if (qty >= t.minQty && t.unitGross < unit) unit = t.unitGross
  }
  return unit
}

function useVisible(ref: React.RefObject<Element | null>, fallback: boolean) {
  const [visible, setVisible] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? fallback),
      { threshold: 0 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, fallback])
  return visible
}

export function StorefrontPdpBuyBox({
  accessoryId,
  imageUrl,
  unitGross,
  priceTiers,
  inStock,
  maxQty,
  variantLabel,
  freeShippingThresholdGross,
  shippingFeeGross,
  productTitle,
  sku,
  sellerEmail,
  sellerPhone,
  privacyUrl
}: StorefrontPdpBuyBoxProps) {
  const [qty, setQty] = useState(1)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notified, setNotified] = useState(false)
  const ctaRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    footerRef.current = document.getElementById(STOREFRONT_FOOTER_ID)
  }, [])

  const inlineVisible = useVisible(ctaRef, true)
  const footerVisible = useVisible(footerRef, false)
  const showBar = !inlineVisible && !footerVisible

  const limit = Math.max(1, Math.min(MAX_QTY, maxQty && maxQty > 0 ? maxQty : MAX_QTY))
  const unit = unitForQty(unitGross, priceTiers, qty)
  const total = unit * qty
  const nextTier = priceTiers.find((t) => t.minQty > qty && t.unitGross < unit)

  const setClamped = (n: number) =>
    setQty(Math.max(1, Math.min(limit, Math.floor(n) || 1)))

  let shippingHint: string | null = null
  if (inStock && freeShippingThresholdGross != null && freeShippingThresholdGross > 0) {
    const missing = freeShippingThresholdGross - total
    shippingHint =
      missing <= 0
        ? 'Ezzel a mennyiséggel ingyenes a szállítás.'
        : `Még ${formatMoneyFt(missing)} az ingyenes szállításig.`
  } else if (inStock && shippingFeeGross === 0) {
    shippingHint = 'Ingyenes szállítás.'
  }

  const itemLine = [productTitle, variantLabel].filter(Boolean).join(' · ')
  let cta: CtaAction
  if (!inStock) {
    cta = { kind: 'notify', label: notified ? 'Értesítést kértél' : 'Szólj, ha megérkezik' }
  } else if (sellerEmail) {
    const body = [
      'Szeretném megrendelni:',
      '',
      itemLine,
      `Cikkszám: ${sku}`,
      `Mennyiség: ${qty} db`,
      `Ár: ${formatMoneyFt(total)} (bruttó)`,
      '',
      'Név:',
      'Szállítási cím vagy személyes átvétel:',
      'Telefonszám:',
      ''
    ].join('\n')
    cta = {
      kind: 'mailto',
      href: `mailto:${sellerEmail}?subject=${encodeURIComponent(`Rendelés: ${productTitle}`)}&body=${encodeURIComponent(body)}`,
      label: 'Megrendelem',
      icon: Mail
    }
  } else if (sellerPhone) {
    cta = {
      kind: 'tel',
      href: `tel:${sellerPhone.replace(/\s/g, '')}`,
      label: 'Megrendelem telefonon',
      icon: Phone
    }
  } else {
    cta = { kind: 'none', label: 'Kosárba' }
  }

  const footnote =
    cta.kind === 'mailto'
      ? 'Online fizetés még nincs: a gomb kitöltött rendelési e-mailt nyit, a rendelés a visszaigazolásunkkal végleges.'
      : cta.kind === 'tel'
        ? 'Online fizetés még nincs — telefonon veszünk fel rendelést.'
        : cta.kind === 'none'
          ? 'Az online rendelés hamarosan indul.'
          : null

  function renderCta(className: string, withTotal: boolean, tabIndex?: number) {
    const cls = cn(
      buttonVariants({ size: 'lg' }),
      'h-12 gap-2 text-[15px] font-semibold',
      className
    )
    const text = (
      <span className="truncate">
        {cta.label}
        {withTotal && cta.kind !== 'notify' && cta.kind !== 'tel'
          ? ` · ${formatMoneyFt(total)}`
          : ''}
      </span>
    )
    if (cta.kind === 'notify') {
      return (
        <button
          type="button"
          tabIndex={tabIndex}
          disabled={notified}
          onClick={() => setNotifyOpen(true)}
          className={cn(cls, 'cursor-pointer disabled:cursor-default disabled:opacity-70')}
        >
          {notified ? (
            <Check className="size-4 shrink-0" aria-hidden />
          ) : (
            <Bell className="size-4 shrink-0" aria-hidden />
          )}
          {text}
        </button>
      )
    }
    if (cta.kind === 'none') {
      return (
        <button
          type="button"
          disabled
          tabIndex={tabIndex}
          className={cn(cls, 'cursor-not-allowed disabled:opacity-60')}
        >
          <ShoppingBag className="size-4 shrink-0" aria-hidden />
          {text}
        </button>
      )
    }
    const Icon = cta.icon
    return (
      <a href={cta.href} tabIndex={tabIndex} className={cn(cls, 'cursor-pointer')}>
        <Icon className="size-4 shrink-0" aria-hidden />
        {text}
      </a>
    )
  }

  return (
    <>
      <div ref={ctaRef} className="space-y-3">
        {inStock && priceTiers.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Mennyiségi árak">
            {priceTiers.map((t) => {
              const active = qty >= t.minQty && unit === t.unitGross
              return (
                <li key={t.minQty}>
                  <button
                    type="button"
                    onClick={() => setClamped(t.minQty)}
                    aria-pressed={active}
                    className={cn(
                      'min-h-11 cursor-pointer rounded-md border px-2.5 py-1.5 text-left text-[12px] leading-tight transition-colors',
                      active
                        ? 'border-ink bg-ink text-white'
                        : 'border-stone-300 bg-white text-ink hover:border-ink'
                    )}
                  >
                    <span className="block font-semibold tabular-nums">
                      {t.minQty} db-tól
                    </span>
                    <span className="tabular-nums">
                      {formatMoneyFt(t.unitGross)} / db
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}

        <div className="flex items-stretch gap-2">
          {inStock ? (
            <div
              className="inline-flex h-12 shrink-0 items-center rounded-md border border-stone-300 bg-white"
              role="group"
              aria-label="Mennyiség"
            >
              <button
                type="button"
                onClick={() => setClamped(qty - 1)}
                disabled={qty <= 1}
                className="flex size-11 cursor-pointer items-center justify-center text-ink disabled:cursor-not-allowed disabled:text-ink-muted"
                aria-label="Kevesebb"
              >
                <Minus className="size-4" aria-hidden />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={limit}
                value={qty}
                onChange={(e) => setClamped(Number(e.target.value))}
                className="h-full w-9 appearance-none bg-transparent text-center text-[15px] font-semibold tabular-nums text-ink outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Darabszám"
              />
              <button
                type="button"
                onClick={() => setClamped(qty + 1)}
                disabled={qty >= limit}
                className="flex size-11 cursor-pointer items-center justify-center text-ink disabled:cursor-not-allowed disabled:text-ink-muted"
                aria-label="Több"
              >
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}
          {renderCta('min-w-0 flex-1', true)}
        </div>

        {qty > 1 || nextTier || shippingHint ? (
          <div className="space-y-1 text-[13px] text-ink-secondary">
            {qty > 1 ? (
              <p className="tabular-nums">
                {qty} db × {formatMoneyFt(unit)}
                {unit < unitGross ? (
                  <span className="font-medium text-ink">
                    {' '}
                    · megtakarítás {formatMoneyFt((unitGross - unit) * qty)}
                  </span>
                ) : null}
              </p>
            ) : null}
            {nextTier ? (
              <p>
                {nextTier.minQty} db-tól{' '}
                <span className="font-medium tabular-nums text-ink">
                  {formatMoneyFt(nextTier.unitGross)} / db
                </span>
              </p>
            ) : null}
            {shippingHint ? (
              <p className="flex items-center gap-1.5">
                <Truck className="size-3.5 shrink-0 text-ink" aria-hidden />
                {shippingHint}
              </p>
            ) : null}
          </div>
        ) : null}

        {footnote ? (
          <p className="text-[12px] leading-snug text-ink-muted">{footnote}</p>
        ) : null}
      </div>

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] transition-transform duration-200 motion-reduce:transition-none lg:hidden',
          showBar ? 'translate-y-0' : 'pointer-events-none translate-y-full'
        )}
        aria-hidden={!showBar}
      >
        <div className="flex items-center gap-3 px-4 py-2">
          {imageUrl ? (
            <span className="size-11 shrink-0 overflow-hidden rounded-md bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                className="size-full object-contain p-0.5 mix-blend-multiply"
              />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            {variantLabel ? (
              <p className="truncate text-[12px] text-ink-secondary">{variantLabel}</p>
            ) : null}
            <p className="truncate text-[16px] font-semibold tabular-nums text-ink">
              {formatMoneyFt(total)}
              {qty > 1 ? (
                <span className="text-[12px] font-normal text-ink-secondary"> · {qty} db</span>
              ) : null}
            </p>
          </div>
          {renderCta('min-w-[9rem] shrink-0 px-4', false, showBar ? 0 : -1)}
        </div>
      </div>

      {cta.kind === 'notify' ? (
        <StockNotifyDialog
          open={notifyOpen}
          onOpenChange={setNotifyOpen}
          accessoryId={accessoryId}
          productTitle={productTitle}
          variantLabel={variantLabel}
          privacyUrl={privacyUrl}
          onDone={() => setNotified(true)}
        />
      ) : null}
    </>
  )
}
