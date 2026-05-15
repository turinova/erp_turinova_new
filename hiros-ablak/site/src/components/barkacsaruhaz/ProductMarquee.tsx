"use client"

import Image from "next/image"
import { useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

export type MarqueeItem = {
  label: string
  brand?: string
  icon: React.ReactNode
  /** Optional product photo (public path), e.g. /img/foo.png */
  imageSrc?: string
}

type ProductMarqueeProps = {
  items: MarqueeItem[]
  direction?: "left" | "right"
  duration?: number
  tileWidth?: number
  ariaLabel?: string
  /**
   * Tailwind-friendly mask gradient classes for the edge fades.
   * Defaults to a light (stone-50) background.
   */
  maskFromClass?: string
  maskToClass?: string
  /**
   * Tile color theme. Use "dark" when the marquee sits on a dark background.
   */
  theme?: "light" | "dark"
}

export function ProductMarquee({
  items,
  direction = "left",
  duration = 40,
  tileWidth = 220,
  ariaLabel,
  maskFromClass = "from-stone-50",
  maskToClass = "to-transparent",
  theme = "light",
}: ProductMarqueeProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)

  useGSAP(
    () => {
      const el = trackRef.current
      if (!el) return

      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches

      if (prefersReduced) return

      const start = direction === "left" ? "0%" : "-50%"
      const end = direction === "left" ? "-50%" : "0%"

      const tween = gsap.fromTo(
        el,
        { xPercent: parseFloat(start) },
        {
          xPercent: parseFloat(end),
          duration,
          ease: "none",
          repeat: -1,
        },
      )

      const onEnter = () => tween.timeScale(0.25)
      const onLeave = () => tween.timeScale(1)

      el.addEventListener("mouseenter", onEnter)
      el.addEventListener("mouseleave", onLeave)
      el.addEventListener("focusin", onEnter)
      el.addEventListener("focusout", onLeave)

      return () => {
        el.removeEventListener("mouseenter", onEnter)
        el.removeEventListener("mouseleave", onLeave)
        el.removeEventListener("focusin", onEnter)
        el.removeEventListener("focusout", onLeave)
        tween.kill()
      }
    },
    { scope: trackRef, dependencies: [direction, duration] },
  )

  // Duplicate items for seamless loop
  const doubled = [...items, ...items]

  return (
    <div
      className="relative overflow-hidden"
      aria-label={ariaLabel}
      role={ariaLabel ? "region" : undefined}
    >
      {/* Edge fade masks */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-24 bg-gradient-to-r ${maskFromClass} ${maskToClass}`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-24 bg-gradient-to-l ${maskFromClass} ${maskToClass}`}
      />

      <div
        ref={trackRef}
        className="flex gap-3 sm:gap-4 will-change-transform"
        style={{ width: "max-content" }}
      >
        {doubled.map((item, i) => (
          <ProductTile
            key={`${item.label}-${i}`}
            label={item.label}
            brand={item.brand}
            icon={item.icon}
            imageSrc={item.imageSrc}
            width={tileWidth}
            theme={theme}
          />
        ))}
      </div>
    </div>
  )
}

function ProductTile({
  label,
  brand,
  icon,
  imageSrc,
  width,
  theme,
}: {
  label: string
  brand?: string
  icon: React.ReactNode
  imageSrc?: string
  width: number
  theme: "light" | "dark"
}) {
  const isDark = theme === "dark"

  return (
    <div
      className={
        isDark
          ? "group relative aspect-square shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 transition hover:border-[var(--color-brand)]/60 hover:shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
          : "group relative aspect-square shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-white via-stone-50 to-stone-100 transition hover:border-[var(--color-brand)]/40 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
      }
      style={{ width: `${width}px` }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5 bg-[var(--color-brand)]/40 transition group-hover:bg-[var(--color-brand)]"
      />
      <div
        aria-hidden
        className={
          isDark
            ? "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--color-brand)]/15 blur-2xl transition group-hover:bg-[var(--color-brand)]/25"
            : "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--color-brand)]/5 blur-2xl transition group-hover:bg-[var(--color-brand)]/10"
        }
      />
      {imageSrc ? (
        <div className="absolute inset-3 z-[1] sm:inset-4">
          <Image
            src={imageSrc}
            alt={label}
            fill
            unoptimized
            sizes="(max-width: 640px) 30vw, 220px"
            className="object-contain transition duration-500 group-hover:scale-105"
          />
        </div>
      ) : (
        <div
          className={`absolute inset-0 flex items-center justify-center transition duration-500 group-hover:scale-110 ${
            isDark
              ? "text-[var(--color-brand)]/80 group-hover:text-[var(--color-brand)]"
              : "text-[var(--color-brand)]/65 group-hover:text-[var(--color-brand)]"
          }`}
        >
          <div className="h-12 w-12 sm:h-14 sm:w-14">{icon}</div>
        </div>
      )}
      <div className="absolute inset-x-3 bottom-3 z-[2]">
        <div
          className={`truncate text-sm font-semibold tracking-tight ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {label}
        </div>
        {brand && (
          <div
            className={`mt-0.5 truncate text-[11px] uppercase tracking-wide ${
              isDark ? "text-white/55" : "text-black/50"
            }`}
          >
            {brand}
          </div>
        )}
      </div>
    </div>
  )
}
