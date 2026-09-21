"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion"
import type { GalleryItem } from "@/lib/egyedi-butor-data"

/** Ennyi vízszintes elhúzás után váltunk képet mobilon. */
const SWIPE_THRESHOLD = 60

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {dir === "left" ? (
        <path d="M15 18l-6-6 6-6" />
      ) : (
        <path d="M9 18l6-6-6-6" />
      )}
    </svg>
  )
}

function Close() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function Lightbox({
  items,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  items: readonly GalleryItem[]
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const reduce = useReducedMotion()
  const item = items[index]

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") onPrev()
      if (e.key === "ArrowRight") onNext()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose, onPrev, onNext])

  if (!item) return null

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={item.alt}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/94 p-3 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.22 }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20 sm:right-5 sm:top-5"
        aria-label="Bezárás"
      >
        <Close />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onPrev()
        }}
        className="absolute left-2 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20"
        aria-label="Előző"
      >
        <Chevron dir="left" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onNext()
        }}
        className="absolute right-2 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20"
        aria-label="Következő"
      >
        <Chevron dir="right" />
      </button>

      <motion.div
        key={item.src}
        className="relative h-[min(88dvh,920px)] w-full max-w-6xl touch-pan-y"
        initial={reduce ? false : { opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        drag="x"
        dragSnapToOrigin
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDragEnd={(_, info) => {
          if (info.offset.x < -SWIPE_THRESHOLD) onNext()
          else if (info.offset.x > SWIPE_THRESHOLD) onPrev()
        }}
      >
        <Image
          src={item.src}
          alt={item.alt}
          fill
          priority
          sizes="100vw"
          className="object-contain"
        />
        <p className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2.5 py-1 text-xs tabular-nums text-white/80">
          {index + 1} / {items.length}
        </p>
      </motion.div>
    </motion.div>
  )
}

type PortfolioMasonryProps = {
  items: readonly GalleryItem[]
  onLightboxChange?: (open: boolean) => void
}

/** Intrinsic-ratio masonry — images keep natural proportions (no fake crop). */
export default function PortfolioMasonry({
  items,
  onLightboxChange,
}: PortfolioMasonryProps) {
  const [lightbox, setLightbox] = useState<number | null>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    onLightboxChange?.(lightbox !== null)
  }, [lightbox, onLightboxChange])

  const onPrev = useCallback(() => {
    setLightbox((i) =>
      i === null ? null : (i - 1 + items.length) % items.length,
    )
  }, [items.length])

  const onNext = useCallback(() => {
    setLightbox((i) => (i === null ? null : (i + 1) % items.length))
  }, [items.length])

  if (items.length === 0) return null

  return (
    <>
      <div className="columns-2 gap-1 px-1 sm:columns-3 sm:gap-1.5 sm:px-1.5 lg:columns-4 lg:gap-2 lg:px-2">
        {items.map((item, i) => (
          <motion.button
            key={item.src}
            type="button"
            onClick={() => setLightbox(i)}
            className="mb-1 w-full break-inside-avoid overflow-hidden bg-stone-100 sm:mb-1.5 lg:mb-2 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -4% 0px" }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.35, ease: "easeOut", delay: (i % 6) * 0.025 }
            }
            aria-label={`${item.alt}, ${i + 1}. fotó megnyitása`}
          >
            {/* A galéria a heron kívül esik minden méreten, ezért mind lazy. */}
            <Image
              src={item.src}
              alt={item.alt}
              width={item.width}
              height={item.height}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="h-auto w-full transition duration-500 ease-out group-hover:brightness-[1.03] group-hover:scale-[1.015]"
            />
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {lightbox !== null && (
          <Lightbox
            items={items}
            index={lightbox}
            onClose={() => setLightbox(null)}
            onPrev={onPrev}
            onNext={onNext}
          />
        )}
      </AnimatePresence>
    </>
  )
}
