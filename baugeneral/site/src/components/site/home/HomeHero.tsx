"use client"

import Image from "next/image"
import Link from "next/link"
import { useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"
import { HEADER_CTA } from "@/lib/nav-data"
import styles from "./HomeHero.module.css"

gsap.registerPlugin(ScrollTrigger, useGSAP)

const HEADLINE = "Minőségben otthon vagyunk."

function splitWords(text: string) {
  return text.split(" ").map((word, i, arr) => (
    <span key={`${word}-${i}`}>
      <span className={styles.wordWrap} aria-hidden>
        <span className={`${styles.word} js-hero-word`}>{word}</span>
      </span>
      {i < arr.length - 1 ? " " : null}
    </span>
  ))
}

/**
 * FIND-inspired hero — single house layer (no composite crossfade flicker).
 * Scroll scrub always runs (even with prefers-reduced-motion).
 */
export function HomeHero() {
  const rootRef = useRef<HTMLElement>(null)
  const houseRef = useRef<HTMLDivElement>(null)
  const cloudLRef = useRef<HTMLDivElement>(null)
  const cloudRRef = useRef<HTMLDivElement>(null)
  const smokeRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const words = root.querySelectorAll<HTMLElement>(".js-hero-word")
      const houseImg = houseRef.current?.querySelector("img")

      // ——— Intro (load) ———
      gsap.set(root, { autoAlpha: 0 })

      const intro = gsap.timeline({ paused: true })
      intro.to(root, { autoAlpha: 1, duration: reduced ? 0.2 : 0.6 }, 0)

      if (!reduced) {
        intro.from(
          words,
          { y: "110%", duration: 1.2, stagger: 0.1, ease: "power3.out" },
          0,
        )
        intro.from(
          [textRef.current, actionsRef.current],
          { y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.08, ease: "power3.out" },
          0.4,
        )
        intro.from(cloudLRef.current, { y: "50%", duration: 3, ease: "expo.out" }, 0)
        intro.from(cloudRRef.current, { y: "100%", duration: 4, ease: "expo.out" }, 0.1)
        if (houseImg) {
          intro.from(houseImg, { opacity: 0, duration: 0.6 }, 0.2)
          intro.from(houseImg, { y: "3%", duration: 3, ease: "expo.out" }, 0.2)
        }
      }

      // ——— Scroll scrub ———
      const scrub = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "bottom top",
          scrub: 0.5,
          invalidateOnRefresh: true,
        },
      })

      scrub.to(
        houseRef.current,
        { y: "-22%", scale: 1.1, duration: 1, ease: "none" },
        0,
      )
      scrub.to(smokeRef.current, { y: "0%", duration: 1, ease: "none" }, 0)
      scrub.to(cloudLRef.current, { x: "-10%", duration: 1, ease: "none" }, 0)
      scrub.to(cloudRRef.current, { x: "10%", duration: 1, ease: "none" }, 0)
      scrub.to(
        contentRef.current,
        { y: "12%", scale: 0.96, duration: 1, ease: "none" },
        0,
      )
      // Fade late — early opacity drop looked like a flash on first scroll
      scrub.to(contentRef.current, { opacity: 0, duration: 0.35, ease: "none" }, 0.4)

      const playIntro = () => {
        requestAnimationFrame(() => intro.play(0))
      }

      // Wait for images so ScrollTrigger measurements are correct
      const imgs = Array.from(root.querySelectorAll("img"))
      let pending = imgs.filter((img) => !img.complete).length

      const ready = () => {
        ScrollTrigger.refresh()
        playIntro()
      }

      if (pending === 0) {
        window.setTimeout(ready, 80)
      } else {
        imgs.forEach((img) => {
          if (img.complete) return
          const done = () => {
            pending -= 1
            if (pending <= 0) ready()
          }
          img.addEventListener("load", done, { once: true })
          img.addEventListener("error", done, { once: true })
        })
        // Fallback if loads hang
        window.setTimeout(ready, 1200)
      }
    },
    { scope: rootRef },
  )

  return (
    <section ref={rootRef} className={styles.root} aria-label="Kezdőbanner">
      <div className={styles.top}>
        <div className={styles.bg}>
          <div className={styles.house} ref={houseRef}>
            <Image
              src="/img/hero/house.jpg"
              alt=""
              width={2500}
              height={1773}
              priority
              loading="eager"
              fetchPriority="high"
              unoptimized
              sizes="100vw"
              draggable={false}
            />
          </div>

          <div className={styles.clouds}>
            <div className={styles.cloud} ref={cloudLRef}>
              <Image
                src="/img/hero/cloud.png"
                alt=""
                width={1400}
                height={594}
                unoptimized
                sizes="(max-width: 640px) 75vw, 50vw"
                draggable={false}
              />
            </div>
            <div className={styles.cloud} ref={cloudRRef}>
              <Image
                src="/img/hero/cloud.png"
                alt=""
                width={1400}
                height={594}
                unoptimized
                sizes="(max-width: 640px) 75vw, 50vw"
                draggable={false}
              />
            </div>
          </div>

          <div className={styles.smoke} ref={smokeRef}>
            <Image
              src="/img/hero/smoke.png"
              alt=""
              width={1920}
              height={620}
              priority
              loading="eager"
              fetchPriority="high"
              unoptimized
              sizes="100vw"
              draggable={false}
            />
          </div>
        </div>

        <div className={styles.content} ref={contentRef}>
          <div className={styles.inner}>
            <div className={styles.title}>
              <h1>
                <span className="sr-only">{HEADLINE}</span>
                {splitWords(HEADLINE)}
              </h1>
            </div>
            <div className={styles.text} ref={textRef}>
              <p>
                Generálkivitelezés. Egy felelős csapat.{" "}
                <span className={styles.em}>
                  A tervektől az átadásig, ahogy megegyeztünk.
                </span>
              </p>
            </div>
            <div className={styles.actions} ref={actionsRef}>
              <Link href={HEADER_CTA.href} className={styles.cta}>
                {HEADER_CTA.label}
                <span className={styles.ctaArrow} aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M3.315 10.996h16.623l-.884.707-8.084-8.135h2.526l8.261 8.337-8.286 8.337h-2.526l8.11-8.135.883.708H3.315z"
                    />
                  </svg>
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.bottom} aria-hidden>
        <div className={styles.overlap}>
          <div className={styles.smoke}>
            <Image
              src="/img/hero/smoke.png"
              alt=""
              width={1920}
              height={620}
              unoptimized
              sizes="100vw"
              draggable={false}
            />
          </div>
          <div className={styles.overlay} />
        </div>
      </div>
    </section>
  )
}
