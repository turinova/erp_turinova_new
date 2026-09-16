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
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,#e7e5e4_0%,transparent_55%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #d6d3d1 1px, transparent 1px), linear-gradient(to bottom, #d6d3d1 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage:
            'radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 75%)'
        }}
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
        <Image
          src="/images/optinova-logo.png"
          alt="Optinova"
          width={280}
          height={56}
          className="h-14 w-auto object-contain sm:h-16"
          priority
        />

        <h1 className="mt-10 text-[2rem] font-semibold tracking-tight text-[#18181b] sm:text-[2.5rem]">
          Hamarosan
        </h1>

        <ul className="mt-10 flex w-full flex-col gap-3 sm:max-w-xs">
          <li>
            <a
              href={`tel:${SUPPORT_PHONE_E164}`}
              className="flex h-11 items-center justify-center gap-2 rounded-md border border-[#e5e5e5] bg-white px-4 text-[14px] font-medium text-[#18181b] no-underline shadow-sm transition-colors duration-150 hover:border-[#d4d4d4] hover:bg-[#fafafa]"
            >
              <Phone className="size-4 shrink-0 text-[#737373]" aria-hidden />
              {SUPPORT_PHONE_DISPLAY}
            </a>
          </li>
          <li>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Optinova — érdeklődés')}`}
              className="flex h-11 items-center justify-center gap-2 rounded-md border border-[#e5e5e5] bg-white px-4 text-[14px] font-medium text-[#18181b] no-underline shadow-sm transition-colors duration-150 hover:border-[#d4d4d4] hover:bg-[#fafafa]"
            >
              <Mail className="size-4 shrink-0 text-[#737373]" aria-hidden />
              {SUPPORT_EMAIL}
            </a>
          </li>
        </ul>
      </div>
    </main>
  )
}
