"use client"

import { useEffect } from "react"
import Lenis from "lenis"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

/**
 * FIND stack: Lenis + GSAP ticker + ScrollTrigger.update
 * Always enabled — reduced-motion only softens duration, never disables scrub.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const lenis = new Lenis({
      duration: reduced ? 0.6 : 1.15,
      smoothWheel: !reduced,
      touchMultiplier: 1.2,
      autoRaf: false,
    })

    window.__lenis = lenis
    document.documentElement.classList.add("lenis")

    lenis.on("scroll", ScrollTrigger.update)

    const ticker = (time: number) => {
      lenis.raf(time * 1000)
    }
    gsap.ticker.add(ticker)
    gsap.ticker.lagSmoothing(0)

    const onResize = () => {
      ScrollTrigger.refresh()
    }
    window.addEventListener("resize", onResize)

    const refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 400)

    return () => {
      window.clearTimeout(refreshTimer)
      window.removeEventListener("resize", onResize)
      gsap.ticker.remove(ticker)
      lenis.destroy()
      delete window.__lenis
      document.documentElement.classList.remove("lenis")
    }
  }, [])

  return <>{children}</>
}
