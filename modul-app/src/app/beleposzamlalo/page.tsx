import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, ImageIcon } from 'lucide-react'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { buttonVariants } from '@/components/ui/button'
import {
  BELEPOSZAMLALO_AUDIENCE,
  BELEPOSZAMLALO_FEATURES,
  BELEPOSZAMLALO_HERO,
  BELEPOSZAMLALO_PAINS,
  BELEPOSZAMLALO_STORE_NOTE
} from '@/lib/marketing/beleposzamlalo'
import { formatHufNet, formatHufPlain, MARKETING_PRICING } from '@/lib/marketing/pricing'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Belépőszámláló',
  description:
    'AI kamera a bejáraton: napi és óránkénti belépőszám. Látod, mikor van valódi forgalom a boltban.'
}

const ADDON = MARKETING_PRICING.addons.footcounter
const StoreIcon = BELEPOSZAMLALO_STORE_NOTE.Icon

export default function BeleposzamlaloPage() {
  return (
    <MarketingShell activeHref="/beleposzamlalo">
      <article>
        <header className="border-b border-border bg-gradient-to-b from-indigo-50 via-white to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-14 lg:py-20">
            <div>
              <span className="inline-flex h-7 items-center rounded-full border border-indigo-200 bg-indigo-100 px-3 text-[12px] font-medium text-indigo-900">
                {BELEPOSZAMLALO_HERO.eyebrow}
              </span>
              <h1 className="mt-4 max-w-xl text-[2.1rem] font-semibold tracking-tight text-ink md:text-[2.5rem] md:leading-[1.12]">
                {BELEPOSZAMLALO_HERO.title}
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-secondary md:text-[16px]">
                {BELEPOSZAMLALO_HERO.body}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/kapcsolat"
                  className={cn(
                    buttonVariants({ variant: 'primary', size: 'md' }),
                    'no-underline'
                  )}
                >
                  Kérek bemutatót
                </Link>
                <Link
                  href="/egyedi-modulok"
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'md' }),
                    'no-underline'
                  )}
                >
                  Egyedi modulok
                </Link>
              </div>
              <p className="mt-4 text-[13px] text-ink-muted">
                Add-on · {formatHufPlain(ADDON.priceMonthlyHuf)} Ft nettó/hó
                {ADDON.hardwareNote ? ` · ${ADDON.hardwareNote}` : null}
              </p>
            </div>
            <MediaPlaceholder
              label={BELEPOSZAMLALO_HERO.mediaLabel}
              tint="indigo"
            />
          </div>
        </header>

        <section className="border-b border-border bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 className="text-[1.625rem] font-semibold tracking-tight text-ink">
              Miért szokott elcsúszni
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {BELEPOSZAMLALO_PAINS.map((pain) => {
                const Icon = pain.Icon
                return (
                  <div
                    key={pain.title}
                    className="rounded-xl border border-border bg-subtle p-5"
                  >
                    <span className="inline-flex size-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                      <Icon className="size-5" strokeWidth={2} aria-hidden />
                    </span>
                    <p className="mt-3.5 text-[14.5px] font-semibold text-ink">
                      {pain.title}
                    </p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-secondary">
                      {pain.body}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-indigo-50/60">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 className="text-[1.625rem] font-semibold tracking-tight text-ink">
              Mit kapsz a modulban
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {BELEPOSZAMLALO_FEATURES.map((f) => {
                const Icon = f.Icon
                return (
                  <div
                    key={f.title}
                    className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-white px-4 py-4"
                  >
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                      <Icon className="size-4" strokeWidth={2} aria-hidden />
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold text-ink">
                        {f.title}
                      </p>
                      <p className="mt-1 text-[13px] leading-snug text-ink-secondary">
                        {f.body}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-white px-4 py-4">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-ink">
                <StoreIcon className="size-4" strokeWidth={2} aria-hidden />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-ink">
                  {BELEPOSZAMLALO_STORE_NOTE.title}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-ink-secondary">
                  {BELEPOSZAMLALO_STORE_NOTE.body}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 className="text-[1.625rem] font-semibold tracking-tight text-ink">
              Kinek való?
            </h2>
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {BELEPOSZAMLALO_AUDIENCE.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[14px] leading-snug text-ink"
                >
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-indigo-700"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[13px] text-ink-muted">
              Havidíj {formatHufNet(ADDON.priceMonthlyHuf)} + saját gyártású AI
              kamera egyszeri díja (árajánlat).
            </p>
          </div>
        </section>

        <div className="bg-white px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-zinc-950 p-8 md:p-12">
            <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
              <div className="max-w-lg">
                <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Mutatjuk a forgalmi nézetet élőben
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
                  Végignézzük, hogyan nézne ki a ti bejáratotokon — kamerával és
                  a riporttal együtt.
                </p>
              </div>
              <Link
                href="/kapcsolat"
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'md' }),
                  'h-11 shrink-0 no-underline'
                )}
              >
                Kérek bemutatót
                <ArrowRight className="ml-1.5 size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </article>
    </MarketingShell>
  )
}

function MediaPlaceholder({
  label,
  tint
}: {
  label: string
  tint: 'emerald' | 'indigo'
}) {
  const frame =
    tint === 'emerald'
      ? 'border-emerald-200 bg-gradient-to-br from-emerald-100 to-emerald-50'
      : 'border-indigo-200 bg-gradient-to-br from-indigo-100 to-indigo-50'
  const play =
    tint === 'emerald' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'

  return (
    <div className={cn('overflow-hidden rounded-2xl border shadow-sm', frame)}>
      <div className="flex items-center gap-1.5 border-b border-black/5 bg-white/50 px-3 py-2">
        <span className="size-2 rounded-full bg-black/15" />
        <span className="size-2 rounded-full bg-black/15" />
        <span className="size-2 rounded-full bg-black/15" />
        <span className="ml-2 text-[11px] font-medium text-ink-muted">
          Kép helye
        </span>
      </div>
      <div className="relative flex aspect-[16/10] flex-col items-center justify-center gap-3 px-6">
        <div className="absolute inset-6 rounded-lg border border-dashed border-black/10 bg-white/40" />
        <span
          className={cn(
            'relative z-[1] flex size-12 items-center justify-center rounded-2xl shadow-sm',
            play
          )}
        >
          <ImageIcon className="size-6" strokeWidth={1.75} aria-hidden />
        </span>
        <p className="relative z-[1] max-w-xs text-center text-[12.5px] font-medium leading-snug text-ink-secondary">
          {label}
        </p>
      </div>
    </div>
  )
}
