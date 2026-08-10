"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import gsap from "gsap"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"
import type { Reference } from "@/lib/references"
import { referenceDetailPath } from "@/lib/references"

export type ReferenceCardSize = "wide" | "standard"

type ReferenceVisualCardProps = {
  reference: Reference
  size?: ReferenceCardSize
  entranceIndex?: number
}

export function ReferenceVisualCard({
  reference,
  size = "standard",
  entranceIndex = 0,
}: ReferenceVisualCardProps) {
  const linkRef = useRef<HTMLAnchorElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const wide = size === "wide"

  useEffect(() => {
    const link = linkRef.current
    if (reduced || !link) return

    gsap.fromTo(
      link,
      { opacity: 0, y: 18 },
      {
        opacity: 1,
        y: 0,
        duration: 0.55,
        delay: entranceIndex * 0.06,
        ease: "power3.out",
      },
    )
  }, [entranceIndex, reduced])

  const handleEnter = () => {
    if (reduced) return
    if (imageRef.current) {
      gsap.to(imageRef.current, {
        scale: 1.06,
        duration: 0.55,
        ease: "power2.out",
      })
    }
    if (overlayRef.current) {
      gsap.to(overlayRef.current, {
        opacity: 1,
        duration: 0.35,
        ease: "power2.out",
      })
    }
  }

  const handleLeave = () => {
    if (reduced) return
    if (imageRef.current) {
      gsap.to(imageRef.current, {
        scale: 1,
        duration: 0.55,
        ease: "power2.out",
      })
    }
    if (overlayRef.current) {
      gsap.to(overlayRef.current, {
        opacity: 0.72,
        duration: 0.35,
        ease: "power2.out",
      })
    }
  }

  return (
    <Link
      ref={linkRef}
      href={referenceDetailPath(reference.slug)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={[
        "ref-card group relative block overflow-hidden rounded-[var(--radius-md)]",
        "bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]",
        wide
          ? "min-h-[360px] sm:col-span-2 sm:min-h-[400px] lg:col-span-2 lg:min-h-[440px]"
          : "min-h-[360px] sm:min-h-[400px] lg:min-h-[440px]",
      ].join(" ")}
    >
      <div ref={imageRef} className="absolute inset-0 origin-center will-change-transform">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={reference.cardImage.src}
          alt={reference.cardImage.alt}
          className="h-full w-full object-cover"
        />
      </div>

      <div
        ref={overlayRef}
        className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/5 opacity-[0.72] transition-opacity"
        aria-hidden
      />

      <div
        className={[
          "absolute inset-x-0 bottom-0 z-[1] flex flex-col justify-end",
          wide ? "p-5 md:p-7" : "p-4 md:p-5",
        ].join(" ")}
      >
        <h2
          className={[
            "font-semibold leading-[1.15] tracking-tight text-white",
            "[text-shadow:0_1px_2px_rgba(0,0,0,0.45)]",
            wide ? "text-xl md:text-2xl" : "text-lg md:text-xl",
          ].join(" ")}
        >
          {reference.title}
        </h2>
      </div>
    </Link>
  )
}
