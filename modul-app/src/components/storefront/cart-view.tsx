'use client'

import { Mail, Minus, Phone, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { RecentlyViewedRail } from '@/components/storefront/recently-viewed'
import { buttonVariants } from '@/components/ui/button'
import {
  cartCount,
  cartSubtotal,
  clearCart,
  lineUnit,
  removeFromCart,
  setCartQty,
  useCart,
  type CartLine
} from '@/lib/storefront/cart'
import { formatFt } from '@/lib/storefront/format'
import { productPath, STOREFRONT_HOME } from '@/lib/storefront/url'
import { cn } from '@/lib/utils'

type CartViewProps = {
  sellerName: string
  sellerEmail: string | null
  sellerPhone: string | null
  shippingFeeGross: number | null
  freeShippingThresholdGross: number | null
}

function orderBody(lines: CartLine[], subtotal: number, shipping: number | null): string {
  const rows = lines.map((l) => {
    const name = [l.title, l.variantLabel].filter(Boolean).join(' — ')
    return `- ${l.qty} db × ${name} (${l.sku}) — ${formatFt(lineUnit(l) * l.qty)}`
  })
  return [
    'Szeretném megrendelni:',
    '',
    ...rows,
    '',
    `Részösszeg: ${formatFt(subtotal)}`,
    shipping != null ? `Szállítás: ${shipping === 0 ? 'ingyenes' : formatFt(shipping)}` : null,
    '',
    'Nevem:',
    'Szállítási cím:',
    'Telefonszám:'
  ]
    .filter((r): r is string => r !== null)
    .join('\n')
}

export function StorefrontCartView({
  sellerName,
  sellerEmail,
  sellerPhone,
  shippingFeeGross,
  freeShippingThresholdGross
}: CartViewProps) {
  const lines = useCart()
  const [confirmClear, setConfirmClear] = useState(false)

  if (lines.length === 0) {
    return (
      <div className="space-y-10">
        <div className="rounded-md border border-stone-200 px-4 py-10 text-center">
          <ShoppingBag className="mx-auto size-8 text-ink-muted" aria-hidden />
          <p className="mt-3 text-[16px] font-semibold text-ink">A kosarad üres</p>
          <p className="mt-1 text-[14px] text-ink-secondary">
            Nézz körül a termékek között, és tedd kosárba, ami tetszik.
          </p>
          <Link
            href={STOREFRONT_HOME}
            className={cn(buttonVariants({ size: 'lg' }), 'mt-5 h-11 px-5 text-[14px] font-semibold')}
          >
            Termékek megnézése
          </Link>
        </div>
        <div className="-mx-4 lg:mx-0">
          <RecentlyViewedRail />
        </div>
      </div>
    )
  }

  const subtotal = cartSubtotal(lines)
  const freeReached =
    freeShippingThresholdGross != null && subtotal >= freeShippingThresholdGross
  const shipping =
    shippingFeeGross == null ? null : shippingFeeGross === 0 || freeReached ? 0 : shippingFeeGross
  const total = subtotal + (shipping ?? 0)
  const toFree =
    freeShippingThresholdGross != null && shippingFeeGross !== 0 && !freeReached
      ? freeShippingThresholdGross - subtotal
      : null

  const body = orderBody(lines, subtotal, shipping)
  const subject = `Rendelés — ${sellerName} (${cartCount(lines)} db)`
  const mailHref = sellerEmail
    ? `mailto:${sellerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-10">
      <ul className="divide-y divide-stone-100 border-y border-stone-200">
        {lines.map((l) => (
          <li key={l.id} className="flex gap-3 py-4">
            <Link
              href={productPath(l.slug)}
              className="size-20 shrink-0 cursor-pointer overflow-hidden rounded-md bg-stone-100"
            >
              {l.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.imageUrl} alt="" className="size-full object-contain p-1.5 mix-blend-multiply" />
              ) : null}
            </Link>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <Link
                  href={productPath(l.slug)}
                  className="line-clamp-2 cursor-pointer text-[14px] leading-snug text-ink hover:underline"
                >
                  {l.title}
                </Link>
                {l.variantLabel ? (
                  <p className="text-[13px] text-ink-secondary">{l.variantLabel}</p>
                ) : null}
                <p className="text-[13px] tabular-nums text-ink-secondary">
                  {formatFt(lineUnit(l))} / db
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 items-center rounded-md border border-stone-300">
                  <button
                    type="button"
                    aria-label="Kevesebb"
                    disabled={l.qty <= 1}
                    onClick={() => setCartQty(l.id, l.qty - 1)}
                    className="inline-flex size-10 cursor-pointer items-center justify-center disabled:cursor-default disabled:opacity-40"
                  >
                    <Minus className="size-4" aria-hidden />
                  </button>
                  <span className="w-8 text-center text-[14px] tabular-nums" aria-live="polite">
                    {l.qty}
                  </span>
                  <button
                    type="button"
                    aria-label="Több"
                    disabled={l.maxQty != null && l.qty >= l.maxQty}
                    onClick={() => setCartQty(l.id, l.qty + 1)}
                    className="inline-flex size-10 cursor-pointer items-center justify-center disabled:cursor-default disabled:opacity-40"
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
                <span className="text-[15px] font-semibold tabular-nums text-ink">
                  {formatFt(lineUnit(l) * l.qty)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFromCart(l.id)}
                className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 text-[13px] text-ink-secondary underline underline-offset-2 hover:text-ink"
              >
                <Trash2 className="size-3.5" aria-hidden />
                Törlés a kosárból
              </button>
            </div>
          </li>
        ))}
      </ul>

      <aside className="mt-6 space-y-4 lg:sticky lg:top-[76px] lg:mt-0">
        <dl className="space-y-1.5 text-[14px]">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-secondary">Részösszeg</dt>
            <dd className="tabular-nums text-ink">{formatFt(subtotal)}</dd>
          </div>
          {shipping != null ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-secondary">Szállítás</dt>
              <dd className="tabular-nums text-ink">{shipping === 0 ? 'ingyenes' : formatFt(shipping)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-stone-200 pt-2 text-[16px] font-semibold">
            <dt className="text-ink">Összesen</dt>
            <dd className="tabular-nums text-ink">{formatFt(total)}</dd>
          </div>
        </dl>
        {toFree != null && toFree > 0 ? (
          <p className="rounded-md bg-stone-50 px-3 py-2 text-[13px] text-ink">
            Még <span className="font-semibold tabular-nums">{formatFt(toFree)}</span>, és ingyenes a
            szállítás.
          </p>
        ) : null}

        {mailHref ? (
          <a
            href={mailHref}
            className={cn(buttonVariants({ size: 'lg' }), 'h-12 w-full gap-2 text-[15px] font-semibold')}
          >
            <Mail className="size-4" aria-hidden />
            Rendelés elküldése e-mailben
          </a>
        ) : sellerPhone ? (
          <a
            href={`tel:${sellerPhone}`}
            className={cn(buttonVariants({ size: 'lg' }), 'h-12 w-full gap-2 text-[15px] font-semibold')}
          >
            <Phone className="size-4" aria-hidden />
            Rendelés telefonon
          </a>
        ) : null}
        <p className="text-[12px] leading-snug text-ink-secondary">
          {mailHref
            ? 'Online fizetés még nincs: a rendelést e-mailben küldöd el, mi visszaigazoljuk a végösszeget és az átvétel módját.'
            : sellerPhone
              ? 'Online fizetés még nincs: telefonon rendelhetsz, a kosarad segít felsorolni a tételeket.'
              : 'Az online rendelés hamarosan indul — a kosarad addig megmarad ezen az eszközön.'}
          {mailHref && sellerPhone ? (
            <>
              {' '}Telefonon is rendelhetsz:{' '}
              <a href={`tel:${sellerPhone}`} className="cursor-pointer tabular-nums text-ink underline underline-offset-2">
                {sellerPhone}
              </a>
              .
            </>
          ) : null}
        </p>

        {confirmClear ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-ink">Biztosan üríted a kosarat?</span>
            <button
              type="button"
              autoFocus
              onClick={() => setConfirmClear(false)}
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'cursor-pointer')}
            >
              Mégse
            </button>
            <button
              type="button"
              onClick={() => {
                clearCart()
                setConfirmClear(false)
              }}
              className={cn(buttonVariants({ variant: 'danger', size: 'sm' }), 'cursor-pointer')}
            >
              Kosár ürítése
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="inline-flex min-h-8 cursor-pointer items-center text-[13px] text-ink-secondary underline underline-offset-2 hover:text-ink"
          >
            Kosár ürítése
          </button>
        )}
      </aside>
    </div>
  )
}
