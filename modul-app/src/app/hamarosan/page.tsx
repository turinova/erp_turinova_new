import type { Metadata } from 'next'
import Image from 'next/image'
import { Mail, Phone } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Hamarosan',
  description: 'Az Optinova hamarosan elérhető. Vedd fel velünk a kapcsolatot.'
}

const SUPPORT_PHONE_DISPLAY = '+36 30 999 2800'
const SUPPORT_PHONE_E164 = '+36309992800'
const SUPPORT_EMAIL = 'info@turinova.hu'

export default function ComingSoonPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] px-6 py-16">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_30%,#27272a_0%,transparent_60%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.2]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #3f3f46 1px, transparent 1px), linear-gradient(to bottom, #3f3f46 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage:
            'radial-gradient(ellipse 70%_60% at 50% 40%, black 20%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 75%)'
        }}
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
        <Image
          src="/images/optinova-logo-on-dark.png"
          alt="Optinova"
          width={320}
          height={80}
          className="h-14 w-auto object-contain sm:h-16"
          priority
        />

        <h1 className="mt-10 text-[2rem] font-semibold tracking-tight text-white sm:text-[2.5rem]">
          Hamarosan
        </h1>

        <ul className="mt-10 flex w-full flex-col gap-3 sm:max-w-xs">
          <li>
            <a
              href={`tel:${SUPPORT_PHONE_E164}`}
              className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 text-[14px] font-medium text-white no-underline transition-colors duration-150 hover:bg-white/10"
            >
              <Phone className="size-4 shrink-0 text-white/60" aria-hidden />
              {SUPPORT_PHONE_DISPLAY}
            </a>
          </li>
          <li>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Optinova — érdeklődés')}`}
              className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 text-[14px] font-medium text-white no-underline transition-colors duration-150 hover:bg-white/10"
            >
              <Mail className="size-4 shrink-0 text-white/60" aria-hidden />
              {SUPPORT_EMAIL}
            </a>
          </li>
        </ul>
      </div>
    </main>
  )
}
