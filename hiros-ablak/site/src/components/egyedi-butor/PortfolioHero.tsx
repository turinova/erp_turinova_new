"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import SurveyRequestForm from "./SurveyRequestForm"
import TelClickLink from "./TelClickLink"
import {
  FORM_TRUST,
  HERO_CHIPS,
  HERO_IMAGES,
  heroHeadline,
  type GalleryItem,
} from "@/lib/egyedi-butor-data"

type PortfolioHeroProps = {
  phoneDisplay: string
  phoneTel: string
  email: string
  defaultType?: string
  images?: readonly GalleryItem[]
}

export default function PortfolioHero({
  phoneDisplay,
  phoneTel,
  email,
  defaultType,
  images = HERO_IMAGES,
}: PortfolioHeroProps) {
  const reduce = useReducedMotion()
  const slides = images.length > 0 ? images : HERO_IMAGES
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduce || slides.length < 2) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, 5500)
    return () => window.clearInterval(id)
  }, [reduce, slides.length])

  const current = slides[index] ?? slides[0]

  return (
    <section className="relative bg-slate-950 lg:min-h-[calc(100dvh-3.5rem)] lg:grid lg:grid-cols-[1.2fr_minmax(340px,0.8fr)]">
      {/* Visual */}
      {/* dvh, nem vh: mobilon az URL-sáv össze-kinyitása ne tolja a layoutot. */}
      <div className="relative h-[min(54dvh,480px)] overflow-hidden lg:h-auto lg:min-h-[calc(100dvh-3.5rem)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.src}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.9, ease: "easeOut" }
            }
          >
            <Image
              src={current.src}
              alt={current.alt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover object-center"
            />
          </motion.div>
        </AnimatePresence>

        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/10 lg:bg-gradient-to-r lg:from-black/55 lg:via-black/20 lg:to-transparent"
        />

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:max-w-xl lg:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
            Egyedi bútorgyártás Budapesten
          </p>
          <h1 className="mt-3 text-[clamp(1.65rem,3.8vw,2.85rem)] font-semibold leading-[1.12] tracking-tight text-white">
            {heroHeadline(defaultType)}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80 sm:text-base">
            Csak megcsinálni. Konyha, fürdőszoba, gardrób vagy az egész otthon,
            méretre, a saját üzemünkből.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {HERO_CHIPS.map((chip) => (
              <li
                key={chip}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm"
              >
                {chip}
              </li>
            ))}
          </ul>

          {slides.length > 1 && (
            <div className="mt-6 flex gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.src}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-1 rounded-full transition-all ${
                    i === index ? "w-6 bg-white" : "w-1.5 bg-white/35"
                  }`}
                  aria-label={`${i + 1}. fotó megjelenítése`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form panel — Ads conversion */}
      <div
        id="felmeres"
        className="scroll-mt-24 flex flex-col justify-center border-t border-white/10 bg-white px-4 py-8 sm:px-7 sm:py-10 lg:border-t-0 lg:border-l lg:border-black/8 lg:px-8 lg:py-12"
      >
        <div className="mx-auto w-full max-w-md">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Felmérés az otthonában
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-black/60">
            A felmérés díjmentes, és nem kötelez semmire. Egy munkanapon belül
            hívjuk, és egyeztetünk időpontot.
          </p>

          <ul className="mt-4 flex flex-wrap gap-1.5">
            {FORM_TRUST.map((item) => (
              <li
                key={item}
                className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-black/65"
              >
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <SurveyRequestForm
              key={`hero-${defaultType || "none"}`}
              phoneDisplay={phoneDisplay}
              phoneTel={phoneTel}
              email={email}
              defaultType={defaultType}
              idPrefix="hero-felmeres"
              compact
            />
          </div>

          <p className="mt-4 text-center text-xs text-black/45">
            Inkább telefonon egyeztetne?{" "}
            <TelClickLink
              href={phoneTel}
              location="hero_form"
              phoneDisplay={phoneDisplay}
              className="font-semibold text-slate-900 underline-offset-2 hover:underline"
            >
              {phoneDisplay}
            </TelClickLink>
          </p>
        </div>
      </div>
    </section>
  )
}
