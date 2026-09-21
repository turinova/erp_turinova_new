"use client"

import { useCallback, useMemo, useState } from "react"
import PortfolioHero from "@/components/egyedi-butor/PortfolioHero"
import PortfolioMasonry from "@/components/egyedi-butor/PortfolioMasonry"
import StickySurveyBar from "@/components/egyedi-butor/StickySurveyBar"
import {
  SURVEY_PHONE,
  SURVEY_PHONE_DISPLAY,
  galleryWithoutHero,
} from "@/lib/egyedi-butor-data"

type PortfolioLandingProps = {
  defaultType?: string
  email: string
}

export default function PortfolioLanding({
  defaultType,
  email,
}: PortfolioLandingProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const phoneTel = `tel:${SURVEY_PHONE}`

  const masonryItems = useMemo(() => galleryWithoutHero(), [])

  const onLightboxChange = useCallback((open: boolean) => {
    setLightboxOpen(open)
  }, [])

  return (
    <div className="bg-white">
      <PortfolioHero
        phoneDisplay={SURVEY_PHONE_DISPLAY}
        phoneTel={phoneTel}
        email={email}
        defaultType={defaultType}
      />

      <section className="border-t border-black/6 pt-3 sm:pt-4" aria-label="Munkáink">
        <div className="mx-auto flex max-w-[1600px] items-baseline justify-between gap-4 px-3 pb-3 sm:px-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">
            Munkáink
          </p>
          <p className="text-xs text-black/45">{masonryItems.length} fotó</p>
        </div>
        <PortfolioMasonry
          items={masonryItems}
          onLightboxChange={onLightboxChange}
        />
      </section>

      <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:py-12">
        <p className="text-sm text-black/55">
          Ha hasonlót szeretne az otthonába, kezdjük egy felméréssel.
        </p>
        <a
          href="#felmeres"
          className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-sm font-semibold text-white hover:brightness-95 transition"
        >
          Kérem a felmérést
        </a>
      </div>

      <StickySurveyBar
        phoneDisplay={SURVEY_PHONE_DISPLAY}
        phoneTel={phoneTel}
        hidden={lightboxOpen}
      />
    </div>
  )
}
