import Link from 'next/link'
import { LANDING_V2_NAV, LANDING_V2_DEMO } from '@/components/landing-v2/landing-v2-nav'

const legalLinks = [
  { href: '/terms-and-conditions', label: 'Felhasználási feltételek' },
  { href: '/privacy-policy', label: 'Adatvédelmi irányelvek' },
  { href: '/cookie-policy', label: 'Cookie szabályzat' },
] as const

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12 border-b border-slate-100">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-10 lg:items-start">
          <div className="lg:col-span-5 flex flex-col gap-4 max-w-xl">
            <Link href="/v2" className="inline-flex items-center">
              <img
                src="/images/turinova-logo.png"
                alt="Turinova"
                className="h-7 w-auto object-contain"
              />
            </Link>
            <p className="text-sm text-slate-600 leading-relaxed">
              ERP webshop- és bolti értékesítéshez: készlet, rendelés, integrációk egy platformon. Segítünk a
              versenytárs-elemzésben és az AI-alapú tartalom- és adatgenerálásban, ami az organikus elérést segíti —
              magyar vállalkozásoknak.
            </p>
          </div>

          <div className="lg:col-span-7 flex flex-col gap-6 lg:items-end">
            <nav aria-label="Lábléc navigáció és kapcsolat" className="flex w-full flex-col gap-6 lg:max-w-xl lg:ml-auto lg:text-right">
              <div className="flex flex-wrap justify-end gap-x-5 gap-y-2.5 items-center">
                {LANDING_V2_NAV.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-sm text-slate-600 hover:text-orange-600 transition-colors"
                  >
                    {label}
                  </Link>
                ))}
                <a
                  href={LANDING_V2_DEMO.href}
                  className="text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
                >
                  {LANDING_V2_DEMO.label}
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-x-6 gap-y-1.5 pt-2 border-t border-slate-200">
                <a
                  href="mailto:info@turinova.hu"
                  className="text-sm text-slate-600 hover:text-orange-600 transition-colors"
                >
                  info@turinova.hu
                </a>
                <a href="tel:+36309992800" className="text-sm text-slate-600 hover:text-orange-600 transition-colors">
                  +36 30 999 2800
                </a>
              </div>
            </nav>
          </div>
        </div>
      </div>

      <div className="bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-slate-500 shrink-0">
            © {new Date().getFullYear()} Turinova. Minden jog fenntartva.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {legalLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-slate-500 hover:text-orange-600 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
