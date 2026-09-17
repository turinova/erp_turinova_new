import Image from 'next/image'
import Link from 'next/link'

import { AnimationContainer } from '@/components/marketing/linkify/animation-container'
import { MaxWidthWrapper } from '@/components/marketing/linkify/max-width-wrapper'
import { MARKETING_NAV } from '@/lib/marketing/linkify/content'
import {
  COMPANY_LINE,
  SUPPORT_EMAIL
} from '@/lib/marketing/pricing'

const LEGAL = [
  { href: '/aszf', label: 'ÁSZF' },
  { href: '/adatkezelesi-tajekoztato', label: 'Adatkezelés' },
  { href: '/impresszum', label: 'Impresszum' }
] as const

export function LinkifyFooter() {
  return (
    <footer className="relative mx-auto flex w-full max-w-6xl flex-col items-center justify-center border-t border-zinc-200 bg-[radial-gradient(35%_128px_at_50%_0%,rgba(0,0,0,0.04),transparent)] px-6 pb-8 pt-16 lg:px-8 lg:pt-24">
      <div className="absolute left-1/2 top-0 h-1.5 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900" />

      <div className="grid w-full gap-8 md:grid-cols-2 xl:grid-cols-3 xl:gap-8">
        <AnimationContainer delay={0.1}>
          <div className="flex flex-col items-start justify-start md:max-w-[240px]">
            <Image
              src="/images/optinova-logo.png"
              alt="Optinova"
              width={120}
              height={24}
              className="h-6 w-auto"
            />
            <p className="mt-4 text-start text-sm text-zinc-500">
              Ajánlat, gyártás és partnerfolyamat egy helyen — magyar
              gyártóknak.
            </p>
            <p className="mt-3 text-xs text-zinc-400">{COMPANY_LINE}</p>
          </div>
        </AnimationContainer>

        <AnimationContainer delay={0.15}>
          <div>
            <h3 className="text-base font-medium text-zinc-900">Menü</h3>
            <ul className="mt-4 text-sm text-zinc-500">
              {MARKETING_NAV.map((item) => (
                <li key={item.href} className="mt-2 first:mt-0">
                  <Link
                    href={item.href}
                    className="no-underline transition-colors hover:text-zinc-900"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
              <li className="mt-2">
                <Link
                  href="/kapcsolat"
                  className="no-underline transition-colors hover:text-zinc-900"
                >
                  Ingyenes konzultáció
                </Link>
              </li>
            </ul>
          </div>
        </AnimationContainer>

        <AnimationContainer delay={0.2}>
          <div>
            <h3 className="text-base font-medium text-zinc-900">Jogi</h3>
            <ul className="mt-4 text-sm text-zinc-500">
              {LEGAL.map((l) => (
                <li key={l.href} className="mt-2 first:mt-0">
                  <Link
                    href={l.href}
                    className="no-underline transition-colors hover:text-zinc-900"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="mt-2">
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="no-underline transition-colors hover:text-zinc-900"
                >
                  {SUPPORT_EMAIL}
                </a>
              </li>
            </ul>
          </div>
        </AnimationContainer>
      </div>

      <MaxWidthWrapper className="mt-12 border-t border-zinc-200 py-6">
        <p className="text-center text-sm text-zinc-400">
          © {new Date().getFullYear()} Optinova. Minden jog fenntartva.
        </p>
      </MaxWidthWrapper>
    </footer>
  )
}
