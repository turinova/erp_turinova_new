import { Mail, Phone } from 'lucide-react'
import Link from 'next/link'

import { CartButton, CategoryMenu, type MenuCategory } from '@/components/storefront/header-actions'
import { StorefrontSearchOverlay } from '@/components/storefront/search-overlay'
import { FooterGroup, HideOnScrollHeader, STOREFRONT_FOOTER_ID } from '@/components/storefront/storefront-scroll'
import type { StorefrontCategory, StorefrontSeller } from '@/lib/storefront/shell'
import { categoryPath, STOREFRONT_HOME } from '@/lib/storefront/url'
import { cn } from '@/lib/utils'
import type { StorefrontSettings } from '@/lib/webshop/settings'

const iconBtn =
  'inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-stone-100'

const footerLink = 'cursor-pointer hover:text-ink hover:underline'

const POPULAR_MAX = 8

export function StorefrontHeader({
  seller,
  categories
}: {
  seller: StorefrontSeller
  categories: StorefrontCategory[]
}) {
  const menu: MenuCategory[] = categories.map(({ id, name, slug, parentId, productCount }) => ({
    id,
    name,
    slug,
    parentId,
    productCount
  }))
  const popular = categories
    .filter(c => c.parentId == null && c.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, POPULAR_MAX)
    .map(({ id, name, slug }) => ({ id, name, slug }))

  return (
    <HideOnScrollHeader>
      <div className='mx-auto flex h-[52px] max-w-[1200px] items-center justify-between gap-2 px-4 lg:px-8'>
        <div className='flex min-w-0 items-center'>
          <CategoryMenu categories={menu} />
          <Link
            href={STOREFRONT_HOME}
            className='flex min-w-0 cursor-pointer items-center gap-2.5'
            aria-label={`${seller.name} — kategóriák`}
          >
            {seller.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.logoUrl} alt={seller.name} className='h-7 w-auto max-w-[140px] object-contain' />
            ) : (
              <span className='truncate text-[15px] font-semibold tracking-tight text-ink'>{seller.name}</span>
            )}
          </Link>
        </div>
        <div className='flex shrink-0 items-center'>
          <StorefrontSearchOverlay popular={popular} />
          {seller.phone ? (
            <a
              href={`tel:${seller.phone}`}
              className={cn(iconBtn, 'max-[379px]:hidden')}
              aria-label={`Hívás: ${seller.phone}`}
            >
              <Phone className='size-[18px]' aria-hidden />
            </a>
          ) : null}
          <CartButton />
        </div>
      </div>
    </HideOnScrollHeader>
  )
}

export function StorefrontFooter({
  seller,
  settings,
  categories,
  bottomBarSpace = false
}: {
  seller: StorefrontSeller
  settings: StorefrontSettings
  categories: StorefrontCategory[]
  /** Mobil ragadós vásárlósáv alatti hely. */
  bottomBarSpace?: boolean
}) {
  const legalLinks = [
    settings.termsUrl ? { href: settings.termsUrl, label: 'ÁSZF' } : null,
    settings.privacyUrl ? { href: settings.privacyUrl, label: 'Adatkezelés' } : null
  ].filter((l): l is { href: string; label: string } => l != null)

  const host = [settings.hostingProviderName, settings.hostingProviderAddress, settings.hostingProviderEmail].filter(
    Boolean
  )

  const topCategories = categories.filter(c => c.parentId == null && c.productCount > 0).slice(0, 12)

  const companyLines = [
    seller.address ? `Székhely: ${seller.address}` : null,
    seller.registrationNumber ? `Cégjegyzékszám: ${seller.registrationNumber}` : null,
    seller.taxNumber ? `Adószám: ${seller.taxNumber}` : null,
    seller.vatId ? `Közösségi adószám: ${seller.vatId}` : null
  ].filter((l): l is string => Boolean(l))

  const hasContact = Boolean(seller.phone || seller.email)
  const hasCustomerInfo = legalLinks.length > 0 || Boolean(settings.complaintInfo) || host.length > 0

  return (
    <footer
      id={STOREFRONT_FOOTER_ID}
      className={cn(
        'border-t border-stone-200 bg-stone-50 text-[13px] leading-relaxed text-ink-secondary',
        bottomBarSpace && 'pb-20 lg:pb-0'
      )}
    >
      <div className='mx-auto max-w-[1200px] px-4 pt-8 lg:px-8 lg:pt-10'>
        {hasContact ? (
          <section aria-labelledby='footer-contact' className='pb-6 lg:pb-8'>
            <h2 id='footer-contact' className='text-[15px] font-semibold text-ink'>
              Segítünk választani
            </h2>
            <p className='mt-0.5'>Termék, szállítás, rendelés — kérdezz bátran.</p>
            <div className='mt-3 flex flex-col gap-2 sm:flex-row'>
              {seller.phone ? (
                <a
                  href={`tel:${seller.phone}`}
                  className='inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-[14px] font-medium text-ink hover:border-stone-400'
                >
                  <Phone className='size-4' aria-hidden />
                  {seller.phone}
                </a>
              ) : null}
              {seller.email ? (
                <a
                  href={`mailto:${seller.email}`}
                  className='inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-[14px] font-medium text-ink hover:border-stone-400'
                >
                  <Mail className='size-4' aria-hidden />
                  {seller.email}
                </a>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className='border-t border-stone-200 lg:grid lg:grid-cols-3 lg:gap-8 lg:border-0'>
          {topCategories.length > 0 ? (
            <FooterGroup id='footer-cats' title='Kategóriák'>
              <ul className='space-y-1.5 lg:space-y-1'>
                {topCategories.map(c => (
                  <li key={c.id}>
                    <Link href={categoryPath(c.slug)} className={footerLink}>
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterGroup>
          ) : null}

          {hasCustomerInfo ? (
            <FooterGroup id='footer-info' title='Vásárlói információk'>
              <div className='space-y-2'>
                {legalLinks.length > 0 ? (
                  <ul className='space-y-1.5 lg:space-y-1'>
                    {settings.termsUrl ? (
                      <li>
                        <a href={settings.termsUrl} className={footerLink}>
                          Általános Szerződési Feltételek
                        </a>
                      </li>
                    ) : null}
                    {settings.privacyUrl ? (
                      <li>
                        <a href={settings.privacyUrl} className={footerLink}>
                          Adatkezelési tájékoztató
                        </a>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                {settings.complaintInfo ? (
                  <p className='whitespace-pre-wrap'>
                    <span className='font-medium text-ink'>Panaszkezelés. </span>
                    {settings.complaintInfo}
                  </p>
                ) : null}
                {host.length > 0 ? (
                  <p>
                    <span className='font-medium text-ink'>Tárhely-szolgáltató. </span>
                    {host.join(', ')}
                  </p>
                ) : null}
              </div>
            </FooterGroup>
          ) : null}

          <FooterGroup id='footer-company' title='Cégadatok'>
            <div className='space-y-0.5'>
              <p className='font-medium text-ink'>{seller.name}</p>
              {companyLines.map(l => (
                <p key={l}>{l}</p>
              ))}
            </div>
          </FooterGroup>
        </div>

        <div className='flex flex-wrap items-center gap-x-3 gap-y-1 py-5 text-[12px] text-ink-muted lg:mt-6 lg:border-t lg:border-stone-200'>
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
    <div className='flex min-h-dvh flex-col bg-white text-[15px] font-normal text-ink'>
      <StorefrontHeader seller={seller} categories={categories} />
      <div className='flex-1'>{children}</div>
      <StorefrontFooter seller={seller} settings={settings} categories={categories} bottomBarSpace={bottomBarSpace} />
    </div>
  )
}
