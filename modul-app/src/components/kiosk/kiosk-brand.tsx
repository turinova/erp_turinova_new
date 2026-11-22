'use client'

import Image from 'next/image'

import { cn } from '@/lib/utils'

const TURINOVA_LOGO = '/images/turinova-logo.png'

export function TenantBrandMark({
  name,
  logoUrl,
  size = 'md',
  className
}: {
  name: string
  logoUrl: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const h =
    size === 'lg' ? 'h-14 md:h-16' : size === 'sm' ? 'h-8' : 'h-10'
  const maxW =
    size === 'lg' ? 'max-w-[280px]' : size === 'sm' ? 'max-w-[140px]' : 'max-w-[180px]'

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={name}
        width={size === 'lg' ? 280 : size === 'sm' ? 140 : 180}
        height={size === 'lg' ? 64 : size === 'sm' ? 32 : 40}
        className={cn(h, 'w-auto object-contain', maxW, className)}
        priority={size === 'lg'}
      />
    )
  }

  return (
    <p
      className={cn(
        'truncate font-semibold text-ink',
        size === 'lg' && 'text-[28px] md:text-[32px]',
        size === 'md' && 'text-[16px]',
        size === 'sm' && 'text-[14px]',
        className
      )}
    >
      {name}
    </p>
  )
}

export function TurinovaPowered({
  className,
  compact
}: {
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 text-ink-muted',
        className
      )}
    >
      <span className={cn(compact ? 'text-[11px]' : 'text-[12px]')}>
        Powered by
      </span>
      <Image
        src={TURINOVA_LOGO}
        alt="Turinova"
        width={compact ? 88 : 110}
        height={compact ? 18 : 22}
        className={cn(
          'w-auto object-contain opacity-80',
          compact ? 'h-4' : 'h-5'
        )}
      />
    </div>
  )
}
