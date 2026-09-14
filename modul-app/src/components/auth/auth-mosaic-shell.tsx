import Image from 'next/image'
import Link from 'next/link'

import { SquaresMosaic } from '@/components/auth/squares-mosaic'
import { cn } from '@/lib/utils'

/**
 * Auth layout: széles mosaic bal + keskeny form sáv.
 * variant=partner: melegebb hangulat + „Asztalos” jelölés (nem staff klón).
 */
export function AuthMosaicShell({
  title,
  description,
  children,
  homeHref,
  wide = false,
  footer,
  variant = 'staff',
  badge
}: {
  title: string
  description: string
  children: React.ReactNode
  homeHref: string
  wide?: boolean
  footer?: React.ReactNode
  variant?: 'staff' | 'partner'
  badge?: string
}) {
  const isPartner = variant === 'partner'
  const borderColor = isPartner ? '#a8a29e' : '#a1a1aa'
  const railClass = isPartner
    ? 'bg-stone-50 lg:border-stone-200'
    : 'bg-surface'

  return (
    <div className={cn('relative flex min-h-screen', railClass)}>
      <div className="relative hidden min-h-screen flex-1 overflow-hidden lg:block">
        <SquaresMosaic squareSize={40} borderColor={borderColor} />
        <div
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{
            backgroundColor: isPartner
              ? 'rgba(250, 250, 249, 0.72)'
              : 'rgba(255, 255, 255, 0.65)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            WebkitMaskImage:
              'radial-gradient(ellipse 60% 70% at center, black 20%, transparent 75%)',
            maskImage:
              'radial-gradient(ellipse 60% 70% at center, black 20%, transparent 75%)'
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-3">
          <Image
            src="/images/optinova-logo.png"
            alt="Optinova"
            width={280}
            height={56}
            className="h-[112px] w-auto object-contain"
            priority
          />
          {isPartner ? (
            <span className="rounded-md border border-stone-300 bg-white/90 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-stone-700">
              {badge ?? 'ASZTALOS PORTÁL'}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'flex w-full flex-col justify-center border-border px-5 py-10 lg:shrink-0 lg:border-l lg:px-8',
          wide ? 'lg:w-[480px]' : 'lg:w-[400px]',
          isPartner && 'lg:border-stone-200'
        )}
      >
        <div
          className={cn(
            'mx-auto w-full',
            wide ? 'max-w-[440px]' : 'max-w-[360px]'
          )}
        >
          <div className="mb-6 space-y-1 text-center lg:text-left">
            <div className="mb-4 flex flex-col items-center gap-2 lg:hidden">
              <Link href={homeHref} className="inline-flex no-underline">
                <Image
                  src="/images/optinova-logo.png"
                  alt="Optinova"
                  width={140}
                  height={28}
                  className="h-7 w-auto"
                  priority
                />
              </Link>
              {isPartner ? (
                <span className="rounded-md border border-stone-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                  {badge ?? 'ASZTALOS PORTÁL'}
                </span>
              ) : null}
            </div>
            <h1 className="text-[18px] font-semibold text-ink">{title}</h1>
            <p className="text-[13px] text-ink-secondary">{description}</p>
          </div>
          {children}
          {footer}
        </div>
      </div>
    </div>
  )
}
