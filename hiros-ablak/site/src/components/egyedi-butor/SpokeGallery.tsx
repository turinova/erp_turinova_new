"use client"

import { useCallback, useState } from "react"
import PortfolioMasonry from "@/components/egyedi-butor/PortfolioMasonry"
import StickySurveyBar from "@/components/egyedi-butor/StickySurveyBar"
import type { GalleryItem } from "@/lib/egyedi-butor-data"

/**
 * Az aloldalak galériája. Azért van külön kliens komponens, mert a nagykép
 * megnyitásakor el kell tüntetni a lebegő felmérés-sávot — különben az a kép
 * alsó sávjára ül.
 */
export default function SpokeGallery({
  items,
  heading,
  phoneDisplay,
  phoneTel,
}: {
  items: readonly GalleryItem[]
  heading: string
  phoneDisplay: string
  phoneTel: string
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const onLightboxChange = useCallback((open: boolean) => {
    setLightboxOpen(open)
  }, [])

  return (
    <section
      id="munkaink"
      className="scroll-mt-20 border-t border-black/8 pt-10 sm:pt-12"
      aria-label={heading}
    >
      <div className="mx-auto flex max-w-[1600px] items-baseline justify-between gap-4 px-3 pb-3 sm:px-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">
          {heading}
        </h2>
        <p className="text-xs text-black/45">{items.length} fotó</p>
      </div>

      <PortfolioMasonry items={items} onLightboxChange={onLightboxChange} />

      <StickySurveyBar
        phoneDisplay={phoneDisplay}
        phoneTel={phoneTel}
        hidden={lightboxOpen}
      />
    </section>
  )
}
