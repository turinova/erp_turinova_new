import { ArrowRightIcon } from 'lucide-react'
import Image from 'next/image'

import { AnimationContainer } from '@/components/marketing/linkify/animation-container'
import {
  BentoCard,
  BentoGrid,
  CARDS
} from '@/components/marketing/linkify/bento-grid'
import { BorderBeam } from '@/components/marketing/linkify/border-beam'
import { LinkifyFooter } from '@/components/marketing/linkify/footer'
import { MagicBadge } from '@/components/marketing/linkify/magic-badge'
import { MaxWidthWrapper } from '@/components/marketing/linkify/max-width-wrapper'
import { LinkifyNavbar } from '@/components/marketing/linkify/navbar'
import { HomeCtaForm } from '@/components/marketing/home-cta-form'
import { MarketingMosaicBackdrop } from '@/components/marketing/marketing-mosaic-backdrop'
import { LINKIFY_ASSET } from '@/lib/marketing/linkify/paths'

/** Linkify marketing home — Optinova brand + login mosaic hero backdrop. */
export function MarketingHomePage() {
  return (
    <div className="linkify-root relative min-h-dvh bg-white text-zinc-900">
      <MarketingMosaicBackdrop />

      <LinkifyNavbar />
      <div className="h-14" aria-hidden />

      <main className="relative z-10 mx-auto w-full overflow-x-hidden">
        <div className="size-full">
          {/* Hero */}
          <MaxWidthWrapper>
            <div className="flex w-full flex-col items-center justify-center text-center">
              <AnimationContainer className="flex w-full flex-col items-center justify-center pt-2 text-center">
                <h1 className="w-full pb-6 pt-2 text-center text-5xl font-medium !leading-[1.15] tracking-normal text-balance text-zinc-900 sm:text-6xl md:text-7xl lg:text-8xl">
                  <span className="inline-block bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">
                    Optimalizáld
                  </span>{' '}
                  céged működését
                </h1>

                <p className="mb-12 max-w-2xl text-lg font-medium tracking-tight text-balance text-zinc-800 md:text-xl">
                  A növekedés első lépése nem több ember. Hanem egy jobb rendszer
                </p>

                <div className="z-50 flex items-center justify-center gap-4 whitespace-nowrap">
                  <button
                    type="button"
                    className="inline-flex cursor-default items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                  >
                    Átlátható céget szeretnék
                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </AnimationContainer>

              <AnimationContainer
                delay={0.2}
                className="relative w-full bg-transparent px-2 pb-8 pt-20 md:pb-12 md:pt-32"
              >
                <div className="lf-gradient absolute left-1/2 top-[10%] h-1/4 w-3/4 -translate-x-1/2 animate-lf-image-glow blur-[5rem] md:h-1/3" />
                <div className="-m-2 rounded-xl bg-white/50 p-2 ring-1 ring-inset ring-zinc-900/10 backdrop-blur-3xl lg:-m-4 lg:rounded-2xl">
                  <BorderBeam size={250} duration={12} delay={9} />
                  <Image
                    src={LINKIFY_ASSET('dashboard.svg')}
                    alt="Dashboard"
                    width={1200}
                    height={1200}
                    quality={100}
                    className="rounded-md bg-zinc-100 ring-1 ring-zinc-200 lg:rounded-xl"
                    priority
                  />
                  <div className="absolute inset-x-0 -bottom-4 z-40 h-1/2 w-full bg-gradient-to-t from-white" />
                  <div className="absolute inset-x-0 bottom-0 z-50 h-1/4 w-full bg-gradient-to-t from-white md:-bottom-8" />
                </div>
              </AnimationContainer>
            </div>
          </MaxWidthWrapper>

          {/* Features */}
          <MaxWidthWrapper>
            <AnimationContainer delay={0.1}>
              <div className="flex w-full flex-col items-center justify-center pb-6">
                <MagicBadge title="Modulok" />
                <h2 className="mt-6 text-center text-3xl font-medium !leading-[1.1] text-zinc-900 md:text-5xl">
                  A napi működés egy rendszerben
                </h2>
                <p className="mt-4 max-w-xl text-center text-lg text-zinc-500">
                  Készlet, beszerzés, pénztár és gyártás ugyanazon az adaton
                  dolgozik. Nincs külön program és nincs kétszer rögzített
                  adat.
                </p>
              </div>
            </AnimationContainer>
            <AnimationContainer delay={0.2}>
              <BentoGrid className="py-8">
                {CARDS.map((feature) => (
                  <BentoCard key={feature.name} {...feature} />
                ))}
              </BentoGrid>
              <p className="pb-4 text-center text-sm text-zinc-500">
                Ezek a leggyakrabban használt modulok. A rendszer ennél
                lényegesen többet tud, az árajánlatoktól a partnerportálig.{' '}
                <a
                  href="/hogyan-mukodik"
                  className="font-medium text-zinc-800 no-underline underline-offset-2 hover:underline"
                >
                  Nézd meg a funkciókat
                </a>
                .
              </p>
            </AnimationContainer>
          </MaxWidthWrapper>

          {/* CTA — ingyenes konzultáció */}
          <MaxWidthWrapper className="pb-16 pt-12 md:pb-24 md:pt-16">
            <AnimationContainer delay={0.1}>
              <div className="rounded-3xl bg-zinc-950 p-6 shadow-[0_24px_60px_-24px_rgba(24,24,27,0.45)] md:p-14">
                <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                  <div>
                    <span className="inline-flex h-7 items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-3 text-xs font-medium uppercase tracking-wide text-orange-400">
                      Ingyenes konzultáció
                    </span>
                    <h2 className="mt-6 text-3xl font-medium !leading-[1.1] text-white md:text-5xl">
                      Beszéljük át a folyamataitokat
                    </h2>
                    <p className="mt-5 max-w-md text-lg text-zinc-400">
                      Átnézzük, hol megy el a legtöbb idő a napi működésben, és
                      melyik modul váltja ki elsőként. Ehhez elég egy
                      telefonszám.
                    </p>
                  </div>
                  <HomeCtaForm />
                </div>
              </div>
            </AnimationContainer>
          </MaxWidthWrapper>
        </div>
      </main>

      <LinkifyFooter />
    </div>
  )
}
