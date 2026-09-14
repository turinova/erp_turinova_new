import Image from 'next/image'
import Link from 'next/link'

import { SquaresMosaic } from '@/components/auth/squares-mosaic'
import { cn } from '@/lib/utils'

/**
 * Auth layout: széles monokróm mosaic bal + keskeny (~400px) login sáv jobb.
 * Desktop only mosaic; mobilon csak a form.
 */
export function AuthMosaicShell({
  title,
  description,
  children,
  homeHref,
  wide = false,
  footer
}: {
  title: string
  description: string
  children: React.ReactNode
  homeHref: string
  wide?: boolean
  footer?: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen bg-surface">
      <div className="relative hidden min-h-screen flex-1 overflow-hidden lg:block">
        <SquaresMosaic squareSize={40} borderColor="#a1a1aa" />
        <div
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.65)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            WebkitMaskImage:
              'radial-gradient(ellipse 60% 70% at center, black 20%, transparent 75%)',
            maskImage:
              'radial-gradient(ellipse 60% 70% at center, black 20%, transparent 75%)'
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <Image
            src="/images/optinova-logo.png"
            alt="Optinova"
            width={280}
            height={56}
            className="h-[112px] w-auto object-contain"
            priority
          />
        </div>
      </div>

      <div
        className={cn(
          'flex w-full flex-col justify-center border-border px-5 py-10 lg:shrink-0 lg:border-l lg:px-8',
          wide ? 'lg:w-[480px]' : 'lg:w-[400px]'
        )}
      >
        <div
          className={cn(
            'mx-auto w-full',
            wide ? 'max-w-[440px]' : 'max-w-[360px]'
          )}
        >
          <div className="mb-6 space-y-1 text-center lg:text-left">
            <div className="mb-4 flex justify-center lg:hidden">
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
