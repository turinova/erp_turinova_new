'use client'

import { ChevronLeft, ChevronRight, ImageIcon, X, ZoomIn } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

type StorefrontPdpGalleryProps = {
  images: string[]
  alt: string
  /** Kép URL → saját leírás. */
  alts?: Record<string, string>
  className?: string
}

function altFor(
  url: string,
  i: number,
  alt: string,
  alts: Record<string, string> | undefined
): string {
  return alts?.[url]?.trim() || (i === 0 ? alt : `${alt} — ${i + 1}`)
}

function useSnapIndex(count: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const w = el.clientWidth
      if (w <= 0) return
      setIndex(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / w))))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [count])

  const goTo = useCallback(
    (next: number, behavior: ScrollBehavior = 'smooth') => {
      const el = ref.current
      if (!el || count === 0) return
      const clamped = Math.max(0, Math.min(count - 1, next))
      el.scrollTo({ left: clamped * el.clientWidth, behavior })
      setIndex(clamped)
    },
    [count]
  )

  return { ref, index, goTo }
}

function Lightbox({
  images,
  alt,
  alts,
  startIndex,
  onClose
}: {
  images: string[]
  alt: string
  alts?: Record<string, string>
  startIndex: number
  onClose: (index: number) => void
}) {
  const { ref, index, goTo } = useSnapIndex(images.length)
  const [zoomed, setZoomed] = useState(false)
  const [origin, setOrigin] = useState('50% 50%')
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    goTo(startIndex, 'auto')
    closeRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [goTo, startIndex])

  useEffect(() => {
    setZoomed(false)
  }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(index)
      if (e.key === 'ArrowRight') goTo(index + 1)
      if (e.key === 'ArrowLeft') goTo(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, index, onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Termékképek nagyítva"
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <p className="text-[13px] font-medium tabular-nums text-ink-secondary">
          {index + 1} / {images.length}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={() => onClose(index)}
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-stone-100"
          aria-label="Bezárás"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={ref}
          className={cn(
            'flex size-full snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            zoomed && 'overflow-x-hidden'
          )}
        >
          {images.map((url, i) => (
            <div
              key={url}
              className="flex size-full shrink-0 snap-center items-center justify-center overflow-hidden [touch-action:pan-x_pinch-zoom]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={altFor(url, i, alt, alts)}
                draggable={false}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = ((e.clientX - rect.left) / rect.width) * 100
                  const y = ((e.clientY - rect.top) / rect.height) * 100
                  setOrigin(`${x}% ${y}%`)
                  setZoomed((z) => !z)
                }}
                style={{ transformOrigin: origin }}
                className={cn(
                  'max-h-full max-w-full select-none object-contain p-4 transition-transform duration-200 motion-reduce:transition-none',
                  zoomed && i === index
                    ? 'scale-[2.2] cursor-zoom-out'
                    : 'cursor-zoom-in'
                )}
              />
            </div>
          ))}
        </div>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-stone-200 bg-white text-ink disabled:opacity-30 sm:flex"
              aria-label="Előző kép"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === images.length - 1}
              className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-stone-200 bg-white text-ink disabled:opacity-30 sm:flex"
              aria-label="Következő kép"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      <p className="shrink-0 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 text-center text-[12px] text-ink-muted">
        Koppints a képre a nagyításhoz
      </p>
    </div>
  )
}

export function StorefrontPdpGallery({
  images,
  alt,
  alts,
  className
}: StorefrontPdpGalleryProps) {
  const count = images.length
  const { ref, index, goTo } = useSnapIndex(count)
  const [lightboxAt, setLightboxAt] = useState<number | null>(null)

  if (count === 0) {
    return (
      <div
        className={cn(
          'flex h-[min(88vw,48svh)] items-center justify-center bg-stone-100 text-ink-muted lg:aspect-square lg:h-auto',
          className
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <ImageIcon className="size-10 opacity-40" aria-hidden />
          <p className="text-[14px] text-ink-secondary">Nincs kép</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('lg:space-y-2', className)}>
      <div className="relative bg-stone-100 lg:rounded-md lg:overflow-hidden">
        <div
          ref={ref}
          className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="region"
          aria-roledescription="carousel"
          aria-label="Termékképek"
        >
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setLightboxAt(i)}
              className="relative h-[min(88vw,48svh)] w-full shrink-0 cursor-zoom-in snap-center lg:aspect-square lg:h-auto"
              aria-label={`Kép ${i + 1} nagyítása`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={altFor(url, i, alt, alts)}
                className="size-full object-contain p-5 mix-blend-multiply sm:p-10"
                draggable={false}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                decoding={i === 0 ? 'sync' : 'async'}
              />
            </button>
          ))}
        </div>

        <span className="pointer-events-none absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full bg-white/90 text-ink-secondary lg:size-auto lg:gap-1 lg:px-2 lg:py-1 lg:text-[11px] lg:font-medium">
          <ZoomIn className="size-4 lg:size-3.5" aria-hidden />
          <span className="sr-only lg:not-sr-only">Nagyítás</span>
        </span>

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="absolute left-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/95 text-ink shadow-sm disabled:pointer-events-none disabled:opacity-30 lg:flex"
              aria-label="Előző kép"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === count - 1}
              className="absolute right-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/95 text-ink shadow-sm disabled:pointer-events-none disabled:opacity-30 lg:flex"
              aria-label="Következő kép"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-secondary">
              {index + 1} / {count}
            </span>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-1.5 lg:hidden"
              aria-hidden
            >
              {images.map((url, i) => (
                <span
                  key={url}
                  className={cn(
                    'h-1.5 rounded-full transition-all motion-reduce:transition-none',
                    i === index ? 'w-4 bg-ink' : 'w-1.5 bg-stone-400'
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <ul
          className="hidden gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden"
          aria-label="Képek"
        >
          {images.map((url, i) => (
            <li key={url} className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Kép ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                className={cn(
                  'relative size-[72px] cursor-pointer overflow-hidden rounded-md border-2 bg-stone-100 transition-colors',
                  i === index
                    ? 'border-ink'
                    : 'border-transparent hover:border-stone-300'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className="size-full object-contain p-1 mix-blend-multiply"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {lightboxAt != null ? (
        <Lightbox
          images={images}
          alt={alt}
          alts={alts}
          startIndex={lightboxAt}
          onClose={(i) => {
            setLightboxAt(null)
            goTo(i, 'auto')
          }}
        />
      ) : null}
    </div>
  )
}
