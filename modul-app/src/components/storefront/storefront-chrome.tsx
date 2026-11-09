import { Facebook, Instagram, Linkedin, Youtube } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { CartButton, CategoryMenu, type MenuCategory } from '@/components/storefront/header-actions'
import { StorefrontSearchOverlay } from '@/components/storefront/search-overlay'
import { FooterGroup, HideOnScrollHeader, STOREFRONT_FOOTER_ID } from '@/components/storefront/storefront-scroll'
import type { StorefrontCategory, StorefrontSeller } from '@/lib/storefront/shell'
import { STOREFRONT_HOME } from '@/lib/storefront/url'
import { cn } from '@/lib/utils'
import {
  LEGAL_DOCS,
  legalPath,
  PAYMENT_METHODS,
  WITHDRAWAL_ANCHOR,
  WITHDRAWAL_LABEL
} from '@/lib/webshop/legal/constants'
import type { PaymentCode } from '@/lib/webshop/legal/types'
import type { StorefrontSettings } from '@/lib/webshop/settings'

const footerLink = 'cursor-pointer text-[14px] hover:text-ink hover:underline'
const POPULAR_MAX = 8

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M16.6 5.82A4.74 4.74 0 0 1 14.9 2h-3.2v13.06a2.52 2.52 0 1 1-1.76-2.4V9.4a5.7 5.7 0 1 0 4.96 5.64V9.5a8 8 0 0 0 4.66 1.48V7.78a4.75 4.75 0 0 1-2.96-1.96Z" />
    </svg>
  )
}

type SocialItem = { href: string; label: string; icon: ReactNode }

function socialItems(settings: StorefrontSettings): SocialItem[] {
  const out: SocialItem[] = []
  const icon = 'size-5'
  if (settings.socialFacebook) {
    out.push({ href: settings.socialFacebook, label: 'Facebook', icon: <Facebook className={icon} aria-hidden /> })
  }
  if (settings.socialInstagram) {
    out.push({ href: settings.socialInstagram, label: 'Instagram', icon: <Instagram className={icon} aria-hidden /> })
  }
  if (settings.socialYoutube) {
    out.push({ href: settings.socialYoutube, label: 'YouTube', icon: <Youtube className={icon} aria-hidden /> })
  }
  if (settings.socialTiktok) {
    out.push({ href: settings.socialTiktok, label: 'TikTok', icon: <TikTokIcon className={icon} /> })
  }
  if (settings.socialLinkedin) {
    out.push({ href: settings.socialLinkedin, label: 'LinkedIn', icon: <Linkedin className={icon} aria-hidden /> })
  }
  return out
}

/** Kártyajelek / módok — csak az engedélyezett fizetések. */
function PaymentMarks({ methods }: { methods: PaymentCode[] }) {
  if (methods.length === 0) return null
  const card = methods.includes('card')
  const marks: string[] = []
  if (card) marks.push('Visa', 'Mastercard', 'Apple Pay', 'Google Pay')
  if (methods.includes('transfer')) marks.push(PAYMENT_METHODS.transfer.label)
  if (methods.includes('pickup_cash') || methods.includes('pickup_card')) {
    marks.push('Személyes átvétel')
  }
  if (methods.includes('cod')) marks.push(PAYMENT_METHODS.cod.label)
  if (marks.length === 0) return null

  return (
    <div className="mt-8 border-t border-stone-200 pt-6">
      <p className="text-[13px] font-medium text-ink">Fizetés</p>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Elfogadott fizetési módok">
        {marks.map(m => (
          <li
            key={m}
            className="rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-secondary"
          >
            {m}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function StorefrontHeader({
  seller,
  categories
}: {
  seller: StorefrontSeller
  categories: StorefrontCategory[]
}) {
  const menu: MenuCategory[] = categories.map(({ id, name, slug, parentId, productCount, cover }) => ({
    id,
    name,
    slug,
    parentId,
    productCount,
    imageUrl: cover?.imageUrl ?? null
  }))
  const popular = categories
    .filter(c => c.parentId == null && c.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, POPULAR_MAX)
    .map(({ id, name, slug, cover }) => ({ id, name, slug, imageUrl: cover?.imageUrl ?? null }))

  return (
    <HideOnScrollHeader>
      <div className="mx-auto flex h-[52px] max-w-[1200px] items-center justify-between gap-2 px-4 lg:px-8">
        <div className="flex min-w-0 items-center">
          <CategoryMenu categories={menu} />
          <Link
            href={STOREFRONT_HOME}
            className="flex min-w-0 cursor-pointer items-center gap-2.5"
            aria-label={`${seller.name} — kategóriák`}
          >
            {seller.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.logoUrl} alt={seller.name} className="h-7 w-auto max-w-[140px] object-contain" />
            ) : (
              <span className="truncate text-[15px] font-semibold tracking-tight text-ink">{seller.name}</span>
            )}
          </Link>
        </div>
        <div className="flex shrink-0 items-center">
          <StorefrontSearchOverlay popular={popular} />
          <CartButton />
        </div>
      </div>
    </HideOnScrollHeader>
  )
}

export function StorefrontFooter({
  seller,
  settings,
  bottomBarSpace = false
}: {
  seller: StorefrontSeller
  settings: StorefrontSettings
  /** Unused: kept for call-site stability; categories live in the header. */
  categories?: StorefrontCategory[]
  /** Mobil ragadós vásárlósáv alatti hely. */
  bottomBarSpace?: boolean
}) {
  const social = socialItems(settings)
  const shopLinks = [
    { href: legalPath('szallitas-es-fizetes'), label: LEGAL_DOCS['szallitas-es-fizetes'].short },
    { href: `${legalPath('elallas')}#${WITHDRAWAL_ANCHOR}`, label: WITHDRAWAL_LABEL },
    { href: legalPath('panaszkezeles'), label: LEGAL_DOCS.panaszkezeles.short }
  ]
  const legalLinks = [
    { href: settings.termsUrl, label: LEGAL_DOCS.aszf.short },
    { href: settings.privacyUrl, label: LEGAL_DOCS.adatkezeles.short },
    { href: legalPath('impresszum'), label: LEGAL_DOCS.impresszum.short },
    { href: legalPath('sutik'), label: LEGAL_DOCS.sutik.short },
    { href: legalPath('akadalymentesseg'), label: LEGAL_DOCS.akadalymentesseg.short }
  ]

  const cols = social.length > 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'

  return (
    <footer
      id={STOREFRONT_FOOTER_ID}
      className={cn(
        'border-t border-stone-200 bg-stone-50 text-[14px] leading-relaxed text-ink-secondary',
        bottomBarSpace && 'pb-20 lg:pb-0'
      )}
    >
      <div className="mx-auto max-w-[1200px] px-4 pt-10 lg:px-8 lg:pt-12">
        <div className={cn('lg:grid lg:gap-12', cols)}>
          <FooterGroup id="footer-seller" title={seller.name}>
            <div className="space-y-2.5">
              {seller.address ? <p className="max-w-sm text-ink-secondary">{seller.address}</p> : null}
              {seller.email ? (
                <p>
                  <a href={`mailto:${seller.email}`} className={footerLink}>
                    {seller.email}
                  </a>
                </p>
              ) : null}
              {seller.phone ? (
                <p>
                  <a href={`tel:${seller.phone.replace(/\s+/g, '')}`} className={footerLink}>
                    {seller.phone}
                  </a>
                </p>
              ) : null}
              {!seller.address && !seller.email && !seller.phone ? (
                <p>
                  <Link href={legalPath('impresszum')} className={footerLink}>
                    Impresszum
                  </Link>
                </p>
              ) : null}
            </div>
          </FooterGroup>

          <FooterGroup id="footer-shop" title="Vásárlás">
            <ul className="space-y-2.5">
              {shopLinks.map(l => (
                <li key={l.href}>
                  <a href={l.href} className={footerLink}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </FooterGroup>

          {social.length > 0 ? (
            <FooterGroup id="footer-social" title="Kövess minket">
              <ul className="flex flex-wrap gap-3">
                {social.map(s => (
                  <li key={s.href}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md border border-stone-200 bg-white text-ink hover:border-stone-400"
                    >
                      {s.icon}
                    </a>
                  </li>
                ))}
              </ul>
            </FooterGroup>
          ) : null}
        </div>

        <PaymentMarks methods={settings.paymentMethods} />

        <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone-200 py-6 text-[12px] text-ink-muted">
          <span>
            © {new Date().getFullYear()} {seller.name}
          </span>
          {legalLinks.map(l => (
            <a key={l.href} href={l.href} className={footerLink}>
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}

export function StorefrontFrame({
  seller,
  settings,
  categories,
  bottomBarSpace = false,
  children
}: {
  seller: StorefrontSeller
  settings: StorefrontSettings
  categories: StorefrontCategory[]
  bottomBarSpace?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-white text-[15px] font-normal text-ink">
      <StorefrontHeader seller={seller} categories={categories} />
      <div className="flex-1">{children}</div>
      <StorefrontFooter seller={seller} settings={settings} bottomBarSpace={bottomBarSpace} />
    </div>
  )
}
