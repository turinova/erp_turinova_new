'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

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
  const h = { sm: 'h-11', md: 'h-10', lg: 'h-14 md:h-16' }[size]
  const maxW = {
    sm: 'max-w-[200px]',
    md: 'max-w-[180px]',
    lg: 'max-w-[280px]'
  }[size]

  if (logoUrl) {
    // Külső Supabase URL: sima <img>, mert production next/image remotePatterns nélkül elhasal.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className={cn(h, 'w-auto object-contain', maxW, className)}
      />
    )
  }

  return (
    <p
      className={cn(
        'truncate font-semibold text-ink',
        size === 'lg' && 'text-[28px] md:text-[32px]',
        size === 'md' && 'text-[16px]',
        size === 'sm' && 'text-[16px]',
        className
      )}
    >
      {name}
    </p>
  )
}

const HERO_LOGO_AREA = 90_000
const HERO_LOGO_MAX_W = 680
const HERO_LOGO_MAX_H = 200

/** Azonos látszó területre méretez: hosszú felirat és négyzetes jel is egyformán „súlyos”. */
export function heroLogoBox(ratio: number): { width: number; height: number } {
  let width = Math.sqrt(HERO_LOGO_AREA * ratio)
  let height = width / ratio
  if (width > HERO_LOGO_MAX_W) {
    width = HERO_LOGO_MAX_W
    height = width / ratio
  }
  if (height > HERO_LOGO_MAX_H) {
    height = HERO_LOGO_MAX_H
    width = height * ratio
  }
  return { width: Math.round(width), height: Math.round(height) }
}

export function TenantHeroLogo({
  name,
  logoUrl,
  className
}: {
  name: string
  logoUrl: string | null
  className?: string
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [box, setBox] = useState<{ width: number; height: number } | null>(
    null
  )
  const [failed, setFailed] = useState(false)

  function measure(img: HTMLImageElement) {
    if (!img.naturalWidth || !img.naturalHeight) return
    setBox(heroLogoBox(img.naturalWidth / img.naturalHeight))
  }

  useEffect(() => {
    setFailed(false)
    const img = imgRef.current
    if (img?.complete) measure(img)
  }, [logoUrl])

  if (!logoUrl || failed) {
    return (
      <p
        className={cn(
          'text-[48px] font-semibold leading-[1.05] tracking-tight text-ink lg:text-[64px]',
          className
        )}
      >
        {name}
      </p>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={logoUrl}
      alt={name}
      onLoad={(e) => measure(e.currentTarget)}
      onError={() => setFailed(true)}
      style={
        box ?? { height: 120, width: 'auto', maxWidth: HERO_LOGO_MAX_W }
      }
      className={cn(
        'block max-w-full object-contain object-left',
        !box && 'invisible',
        className
      )}
    />
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
