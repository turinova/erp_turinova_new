'use client'

import Image from 'next/image'

import { SquaresMosaic } from '@/components/auth/squares-mosaic'
import { cn } from '@/lib/utils'

type AuthMosaicPanelProps = {
  logoSrc?: string
  logoAlt?: string
  className?: string
}

/**
 * Login bal panel: BSP mozaik + fehér vignette + középső logo.
 * Mintázat: main-app / customer-portal login (saját újraírás).
 */
export function AuthMosaicPanel({
  logoSrc = '/images/optinova-logo.png',
  logoAlt = 'Optinova',
  className
}: AuthMosaicPanelProps) {
  return (
    <div
      className={cn(
        'relative hidden min-h-dvh w-[42%] overflow-hidden border-r border-border bg-surface lg:block',
        className
      )}
    >
      <div className="absolute inset-0">
        <SquaresMosaic borderColor="#666666" squareSize={40} />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          WebkitMaskImage:
            'radial-gradient(ellipse 60% 70% at center, black 15%, transparent 75%)',
          maskImage:
            'radial-gradient(ellipse 60% 70% at center, black 15%, transparent 75%)'
        }}
        aria-hidden
      />

      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        <Image
          src={logoSrc}
          alt={logoAlt}
          width={280}
          height={112}
          className="h-[112px] w-auto object-contain"
          priority
        />
      </div>
    </div>
  )
}
