"use client"

import { useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

export function RevealOnLoad({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return

      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches

      if (prefersReduced) return

      gsap.fromTo(
        el.querySelectorAll("[data-reveal]"),
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          ease: "power2.out",
          stagger: 0.06,
        },
      )
    },
    { scope: ref },
  )

  return <div ref={ref}>{children}</div>
}

