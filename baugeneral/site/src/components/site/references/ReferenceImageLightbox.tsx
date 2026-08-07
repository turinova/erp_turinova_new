"use client"

import { useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import type { ReferenceImage } from "@/lib/references"

type ReferenceImageLightboxProps = {
  images: ReferenceImage[]
  index: number | null
  onClose: () => void
  onNavigate: (index: number) => void
}

function ExpandIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 text-white"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
      />
    </svg>
  )
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      {direction === "left" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      )}
    </svg>
  )
}

export function ReferenceImageLightbox({
  images,
  index,
  onClose,
  onNavigate,
}: ReferenceImageLightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const open = index !== null && images[index] !== undefined
  const current = open ? images[index!] : null
  const hasMultiple = images.length > 1

  const goPrev = useCallback(() => {
    if (index === null) return
    onNavigate((index - 1 + images.length) % images.length)
  }, [images.length, index, onNavigate])

  const goNext = useCallback(() => {
    if (index === null) return
    onNavigate((index + 1) % images.length)
  }, [images.length, index, onNavigate])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
        return
      }
      if (event.key === "ArrowLeft") goPrev()
      if (event.key === "ArrowRight") goNext()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [goNext, goPrev, onClose, open])

  if (!open || !current) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Kép nagyítása"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-zoom-out"
        aria-label="Bezárás"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-full w-full max-w-6xl flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between gap-3 text-white/80">
          <p className="text-sm tabular-nums">
            {(index ?? 0) + 1} / {images.length}
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Bezárás
          </button>
        </div>

        <div className="relative flex w-full flex-1 items-center justify-center">
          {hasMultiple ? (
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-0 z-20 hidden rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 md:flex"
              aria-label="Előző kép"
            >
              <ChevronIcon direction="left" />
            </button>
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.src}
            alt={current.alt}
            className="max-h-[min(78vh,900px)] w-auto max-w-full rounded-[var(--radius-md)] object-contain shadow-2xl"
          />

          {hasMultiple ? (
            <button
              type="button"
              onClick={goNext}
              className="absolute right-0 z-20 hidden rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 md:flex"
              aria-label="Következő kép"
            >
              <ChevronIcon direction="right" />
            </button>
          ) : null}
        </div>

        <p className="max-w-2xl text-center text-xs text-white/55">{current.alt}</p>

        {hasMultiple ? (
          <div className="flex w-full gap-2 overflow-x-auto pb-1 md:justify-center">
            {images.map((image, imageIndex) => (
              <button
                key={`thumb-${imageIndex}`}
                type="button"
                onClick={() => onNavigate(imageIndex)}
                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2 transition ${
                  imageIndex === index
                    ? "border-white"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
                aria-label={`${imageIndex + 1}. kép`}
                aria-current={imageIndex === index ? "true" : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.src}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export function GalleryZoomHint() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      <ExpandIcon />
    </span>
  )
}
