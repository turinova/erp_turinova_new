"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import gsap from "gsap"
import { ReferenceTypeChip } from "@/components/site/references/ReferenceTypeChip"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"
import type { Reference } from "@/lib/references"
import { referenceDetailPath } from "@/lib/references"

type ReferenceVisualCardProps = {
  reference: Reference
  size?: "featured" | "standard"
  entranceIndex?: number
}

function formatMeta(reference: Reference) {
  const parts = [reference.city, String(reference.yearCompleted)]
  if (reference.areaSqm) {
    parts.push(`${reference.areaSqm.toLocaleString("hu-HU")} m²`)
  }
  parts.push(reference.duration)
  return parts.join(" · ")
}

export function ReferenceVisualCard({
  reference,
  size = "standard",
  entranceIndex = 0,
}: ReferenceVisualCardProps) {
  const linkRef = useRef<HTMLAnchorElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const featured = size === "featured" || Boolean(reference.featured)

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
    if (reduced || !imageRef.current) return
    gsap.to(imageRef.current, { scale: 1.04, duration: 0.35, ease: "power2.out" })
  }

  const handleLeave = () => {
    if (reduced || !imageRef.current) return
    gsap.to(imageRef.current, { scale: 1, duration: 0.35, ease: "power2.out" })
  }

  const imageHeight = featured
    ? "h-[200px] md:h-[260px]"
    : "h-[160px] md:h-[180px]"

  return (
    <Link
      ref={linkRef}
      href={referenceDetailPath(reference.slug)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={[
        "ref-card group flex h-full flex-col overflow-hidden rounded-[var(--radius-md)]",
        "border border-black/[0.06] bg-white shadow-[var(--shadow-soft)]",
        "transition-[box-shadow,transform] duration-300 hover:shadow-[var(--shadow-card)]",
        featured ? "md:col-span-2" : "",
      ].join(" ")}
    >
      <div className={`relative shrink-0 overflow-hidden ${imageHeight}`}>
        <div ref={imageRef} className="absolute inset-0 origin-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reference.cardImage.src}
            alt={reference.cardImage.alt}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />

        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
          <ReferenceTypeChip type={reference.type} onImage />
          {reference.featured ? (
            <span className="rounded-full bg-[var(--color-brand)] px-2.5 py-0.5 text-[0.6875rem] font-semibold text-white">
              Fő profil
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-3.5 py-3.5 md:px-4 md:py-4">
        <h2 className="text-[0.9375rem] font-semibold leading-snug tracking-tight text-[var(--foreground)] md:text-base">
          {reference.title}
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-black/55 md:text-[0.8125rem]">
          {formatMeta(reference)}
        </p>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-black/45 md:text-[0.8125rem]">
          {reference.listTeaser}
        </p>
      </div>
    </Link>
  )
}
