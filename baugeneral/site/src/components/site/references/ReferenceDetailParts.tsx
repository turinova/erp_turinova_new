"use client"

import Link from "next/link"
import { useRef } from "react"
import gsap from "gsap"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"
import type { Reference } from "@/lib/references"
import { referenceDetailPath } from "@/lib/references"

type ReferenceThumbCardProps = {
  reference: Reference
}

export function ReferenceThumbCard({ reference }: ReferenceThumbCardProps) {
  const imageRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  const handleEnter = () => {
    if (reduced || !imageRef.current) return
    gsap.to(imageRef.current, { scale: 1.04, duration: 0.3, ease: "power2.out" })
  }

  const handleLeave = () => {
    if (reduced || !imageRef.current) return
    gsap.to(imageRef.current, { scale: 1, duration: 0.3, ease: "power2.out" })
  }

  return (
    <Link
      href={referenceDetailPath(reference.slug)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="group relative block h-[100px] overflow-hidden rounded-[var(--radius-md)] bg-stone-300 md:h-[110px]"
    >
      <div ref={imageRef} className="absolute inset-0 origin-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={reference.cardImage.src}
          alt={reference.cardImage.alt}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
      <p className="absolute inset-x-0 bottom-0 line-clamp-2 p-2 text-[0.6875rem] font-semibold leading-snug text-white">
        {reference.title}
      </p>
    </Link>
  )
}
