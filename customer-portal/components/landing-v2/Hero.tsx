'use client'

import SolutionMock from '@/components/landing-v2/solutions/SolutionMock'

export default function Hero() {
  return (
    <section
      id="home"
      className="relative w-full overflow-hidden bg-[#141210] pt-16 pb-20 sm:pt-20 sm:pb-24"
    >
      {/* Soft amber stage behind the mock */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 70% at 78% 48%, rgba(234, 88, 12, 0.16) 0%, transparent 62%), radial-gradient(ellipse 40% 50% at 18% 80%, rgba(255, 251, 245, 0.04) 0%, transparent 55%)',
        }}
      />
      {/* Halk grid */}
      <div aria-hidden className="lv2-hero-grid pointer-events-none absolute inset-0 opacity-[0.055]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] gap-12 lg:gap-16 items-center">
          <div className="order-2 lg:order-1 flex flex-col gap-8 max-w-xl">
            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.12] text-[#fffbf5]">
              Szoftver webshopoknak és gyártóknak.
            </h1>
            <a
              href="#demo"
              className="inline-flex w-fit items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
            >
              Kérek visszahívást
            </a>
          </div>

          <div className="order-1 lg:order-2 relative w-full max-w-[560px] mx-auto lg:ml-auto lg:mr-0">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 sm:-inset-8 rounded-[2rem] bg-orange-500/20 blur-3xl"
            />
            <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)]">
              <SolutionMock kind="orders" compact />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
