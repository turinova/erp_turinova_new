import { ArrowRightIcon, CreditCardIcon, StarIcon } from 'lucide-react'
import Image from 'next/image'

import { AnimationContainer } from '@/components/marketing/linkify/animation-container'
import {
  BentoCard,
  BentoGrid,
  CARDS
} from '@/components/marketing/linkify/bento-grid'
import { BorderBeam } from '@/components/marketing/linkify/border-beam'
import { LinkifyFooter } from '@/components/marketing/linkify/footer'
import { LampContainer } from '@/components/marketing/linkify/lamp'
import { MagicBadge } from '@/components/marketing/linkify/magic-badge'
import { MagicCard } from '@/components/marketing/linkify/magic-card'
import { MaxWidthWrapper } from '@/components/marketing/linkify/max-width-wrapper'
import { LinkifyNavbar } from '@/components/marketing/linkify/navbar'
import { PricingCards } from '@/components/marketing/linkify/pricing-cards'
import { MarketingMosaicBackdrop } from '@/components/marketing/marketing-mosaic-backdrop'
import {
  COMPANIES,
  PROCESS,
  REVIEWS
} from '@/lib/marketing/linkify/content'
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
                className="relative w-full bg-transparent px-2 pb-20 pt-20 md:py-32"
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

          {/* Companies */}
          <MaxWidthWrapper>
            <AnimationContainer delay={0.4}>
              <div className="py-14">
                <div className="mx-auto px-4 md:px-8">
                  <h2 className="text-center text-sm font-medium uppercase text-zinc-400">
                    Trusted by the best in the industry
                  </h2>
                  <div className="mt-8">
                    <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-6 md:gap-x-16">
                      {COMPANIES.map((company) => (
                        <li key={company.name}>
                          <Image
                            src={company.logo}
                            alt={company.name}
                            width={80}
                            height={80}
                            quality={100}
                            className="h-auto w-28"
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </AnimationContainer>
          </MaxWidthWrapper>

          {/* Features */}
          <MaxWidthWrapper className="pt-10">
            <AnimationContainer delay={0.1}>
              <div className="flex w-full flex-col items-center justify-center py-8">
                <MagicBadge title="Features" />
                <h2 className="mt-6 text-center text-3xl font-medium !leading-[1.1] text-zinc-900 md:text-5xl">
                  Manage Links Like a Pro
                </h2>
                <p className="mt-4 max-w-lg text-center text-lg text-zinc-500">
                  Linkify is a powerful link management tool that helps you
                  shorten, track, and organize all your links in one place.
                </p>
              </div>
            </AnimationContainer>
            <AnimationContainer delay={0.2}>
              <BentoGrid className="py-8">
                {CARDS.map((feature, idx) => (
                  <BentoCard key={idx} {...feature} />
                ))}
              </BentoGrid>
            </AnimationContainer>
          </MaxWidthWrapper>

          {/* Process */}
          <MaxWidthWrapper className="py-10">
            <AnimationContainer delay={0.1}>
              <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center py-8">
                <MagicBadge title="The Process" />
                <h2 className="mt-6 text-center text-3xl font-medium !leading-[1.1] text-zinc-900 md:text-5xl">
                  Effortless link management in 3 steps
                </h2>
                <p className="mt-4 max-w-lg text-center text-lg text-zinc-500">
                  Follow these simple steps to optimize, organize, and share
                  your links with ease.
                </p>
              </div>
            </AnimationContainer>
            <div className="grid w-full grid-cols-1 gap-4 py-8 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
              {PROCESS.map((process, id) => (
                <AnimationContainer delay={0.2 * id} key={process.title}>
                  <MagicCard className="group md:py-8">
                    <div className="flex w-full flex-col items-start justify-center">
                      <process.icon
                        strokeWidth={1.5}
                        className="h-10 w-10 text-zinc-900"
                      />
                      <div className="relative flex flex-col items-start">
                        <span className="absolute -top-6 right-0 flex h-12 w-12 items-center justify-center rounded-full border-2 border-zinc-200 pt-0.5 text-2xl font-medium text-zinc-900">
                          {id + 1}
                        </span>
                        <h3 className="mt-6 text-base font-medium text-zinc-900">
                          {process.title}
                        </h3>
                        <p className="mt-2 text-sm text-zinc-500">
                          {process.description}
                        </p>
                      </div>
                    </div>
                  </MagicCard>
                </AnimationContainer>
              ))}
            </div>
          </MaxWidthWrapper>

          {/* Pricing */}
          <MaxWidthWrapper className="py-10">
            <AnimationContainer delay={0.1}>
              <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center py-8">
                <MagicBadge title="Simple Pricing" />
                <h2 className="mt-6 text-center text-3xl font-medium !leading-[1.1] text-zinc-900 md:text-5xl">
                  Choose a plan that works for you
                </h2>
                <p className="mt-4 max-w-lg text-center text-lg text-zinc-500">
                  Get started with Linkify today and enjoy more features with
                  our pro plans.
                </p>
              </div>
            </AnimationContainer>
            <AnimationContainer delay={0.2}>
              <PricingCards />
            </AnimationContainer>
            <AnimationContainer delay={0.3}>
              <div className="mx-auto mt-12 flex w-full max-w-5xl flex-wrap items-center justify-center gap-6 lg:justify-evenly">
                <div className="flex items-center gap-2">
                  <CreditCardIcon className="h-5 w-5 text-zinc-900" />
                  <span className="text-zinc-500">No credit card required</span>
                </div>
              </div>
            </AnimationContainer>
          </MaxWidthWrapper>

          {/* Reviews */}
          <MaxWidthWrapper className="py-10">
            <AnimationContainer delay={0.1}>
              <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center py-8">
                <MagicBadge title="Our Customers" />
                <h2 className="mt-6 text-center text-3xl font-medium !leading-[1.1] text-zinc-900 md:text-5xl">
                  What our users are saying
                </h2>
                <p className="mt-4 max-w-lg text-center text-lg text-zinc-500">
                  Here&apos;s what some of our users have to say about Linkify.
                </p>
              </div>
            </AnimationContainer>
            <div className="grid grid-cols-1 place-items-start gap-4 py-10 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
              {[
                REVIEWS.slice(0, 3),
                REVIEWS.slice(3, 6),
                REVIEWS.slice(6, 9)
              ].map((column, colIdx) => (
                <div
                  key={colIdx}
                  className="flex h-min flex-col items-start gap-6"
                >
                  {column.map((review, index) => (
                    <AnimationContainer
                      delay={0.2 * index}
                      key={review.username}
                    >
                      <MagicCard className="md:p-0">
                        <div className="flex h-min w-full flex-col">
                          <div className="px-4 pt-4">
                            <p className="text-lg font-medium text-zinc-500">
                              {review.name}
                            </p>
                            <p className="text-sm text-zinc-400">
                              {review.username}
                            </p>
                          </div>
                          <div className="space-y-4 px-4 py-4">
                            <p className="text-zinc-500">{review.review}</p>
                          </div>
                          <div className="mt-auto flex space-x-1 px-4 pb-4">
                            {Array.from({ length: review.rating }, (_, i) => (
                              <StarIcon
                                key={i}
                                className="h-4 w-4 fill-yellow-500 text-yellow-500"
                              />
                            ))}
                          </div>
                        </div>
                      </MagicCard>
                    </AnimationContainer>
                  ))}
                </div>
              ))}
            </div>
          </MaxWidthWrapper>

          {/* CTA Lamp */}
          <MaxWidthWrapper className="mt-20 max-w-[100vw] overflow-x-hidden">
            <AnimationContainer delay={0.1}>
              <LampContainer>
                <div className="relative flex w-full flex-col items-center justify-center text-center">
                  <h2 className="mt-8 bg-gradient-to-b from-zinc-700 to-zinc-400 bg-clip-text py-4 text-center text-4xl font-medium !leading-[1.15] tracking-tight text-transparent md:text-7xl">
                    Step into the future of link management
                  </h2>
                  <p className="mx-auto mt-6 max-w-md text-zinc-500">
                    Experience the cutting-edge solution that transforms how you
                    handle your links. Elevate your online presence with our
                    next-gen platform.
                  </p>
                  <div className="mt-6">
                    <button
                      type="button"
                      className="inline-flex cursor-default items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      Ingyenes konzultáció
                      <ArrowRightIcon className="ml-2 h-4 w-4" />
                    </button>
                  </div>
                </div>
              </LampContainer>
            </AnimationContainer>
          </MaxWidthWrapper>
        </div>
      </main>

      <LinkifyFooter />
    </div>
  )
}
