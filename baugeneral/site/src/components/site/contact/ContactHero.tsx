import { COMPANY } from "@/lib/company"

const HERO_IMAGE = "/img/kapcsolat/hero.jpg"

export function ContactHero() {
  return (
    <section aria-labelledby="kapcsolat-heading" className="relative isolate overflow-hidden">
      <div className="header-brand-strip absolute inset-x-0 top-0 z-10" aria-hidden />

      <div className="relative w-full min-h-[220px] aspect-[16/9] max-h-[min(56vh,480px)] md:aspect-[21/9] md:max-h-[min(58vh,520px)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMAGE}
          alt="BauGenerál generálkivitelezés, kapcsolat"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-[color-mix(in_srgb,var(--color-brand)_28%,transparent)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_80%,rgba(0,0,0,0.55),transparent_55%)]"
        />

        <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-6xl px-4 pb-8 pt-16 md:pb-11 md:pt-20">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/70">
            BauGenerál Kft. · Kecskemét
          </p>
          <h1
            id="kapcsolat-heading"
            className="mt-2 max-w-2xl text-balance font-display text-4xl font-semibold tracking-tight text-white md:text-5xl"
          >
            Kapcsolat
          </h1>
          <p className="mt-3 max-w-lg text-pretty text-base leading-relaxed text-white/88 md:text-lg">
            Van egy projektje? Írjon nekünk, és e-mailben jelentkezünk.
          </p>
          <p className="mt-2 text-sm text-white/65">{COMPANY.address.full}</p>
          <a
            href="#uzenet"
            className="btn-primary mt-6 inline-flex px-6 py-3 text-sm font-semibold"
          >
            Üzenet írása
          </a>
        </div>
      </div>
    </section>
  )
}
