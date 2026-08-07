"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"
import {
  SZAKAGI_AREA,
  SZAKAGI_CTA,
  SZAKAGI_FAQ,
  SZAKAGI_HERO,
  SZAKAGI_PROCESS,
  SZAKAGI_PROCESS_HEAD,
  SZAKAGI_RELATED,
  SZAKAGI_TRADES,
  SZAKAGI_TRADES_HEAD,
  SZAKAGI_WHY,
} from "@/lib/szakagi-landing"
import { SzakagiContactForm } from "@/components/site/szakagi/SzakagiContactForm"
import styles from "./szakagi.module.css"

gsap.registerPlugin(ScrollTrigger, useGSAP)

function prefersReducedMotion() {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function rise(
  targets: gsap.TweenTarget,
  trigger: Element | null,
  opts?: { y?: number; stagger?: number },
) {
  if (!trigger || prefersReducedMotion()) return
  gsap.from(targets, {
    opacity: 0,
    y: opts?.y ?? 28,
    duration: 0.75,
    stagger: opts?.stagger ?? 0.06,
    ease: "power2.out",
    immediateRender: false,
    scrollTrigger: {
      trigger,
      start: "top 85%",
      toggleActions: "play none none none",
    },
  })
}

function SzakagiStickyCta() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const target = document.getElementById("szakagi-form")
    if (!target) return

    const io = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    )
    io.observe(target)
    return () => io.disconnect()
  }, [])

  return (
    <div className={styles.stickyCta} data-hidden={hidden ? "true" : "false"}>
      <a
        href="#szakagi-form"
        className="btn-primary inline-flex px-6 py-3 text-sm font-semibold"
      >
        Írjon nekünk
      </a>
    </div>
  )
}

export function SzakagiLanding() {
  const rootRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const tradesRef = useRef<HTMLElement>(null)
  const whyRef = useRef<HTMLElement>(null)
  const processRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const hero = heroRef.current
      if (hero && !prefersReducedMotion()) {
        const title = hero.querySelector(`.${styles.heroTitle}`)
        const lead = hero.querySelector(`.${styles.heroLead}`)
        const actions = hero.querySelector(`.${styles.heroActions}`)
        gsap.from([title, lead, actions], {
          y: 24,
          opacity: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: "power3.out",
        })
      }

      rise(
        tradesRef.current?.querySelectorAll(`.${styles.tradeArticle}`) ?? [],
        tradesRef.current,
        { y: 24, stagger: 0.05 },
      )
      rise(
        whyRef.current?.querySelectorAll(
          `.${styles.sectionTitleCompact}, .${styles.whyBody} p, .${styles.whyMedia}`,
        ) ?? [],
        whyRef.current,
        { stagger: 0.08 },
      )
      rise(
        processRef.current?.querySelectorAll(`.${styles.processCard}`) ?? [],
        processRef.current,
        { stagger: 0.08 },
      )
    },
    { scope: rootRef },
  )

  return (
    <div ref={rootRef} className={styles.page}>
      <section ref={heroRef} className={styles.hero} aria-labelledby="szakagi-hero-title">
        <div className={styles.heroMedia} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SZAKAGI_HERO.image} alt="" />
        </div>
        <div className={styles.heroScrim} aria-hidden />
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>{SZAKAGI_HERO.eyebrow}</p>
          <h1 id="szakagi-hero-title" className={styles.heroTitle}>
            {SZAKAGI_HERO.title}
          </h1>
          <p className={styles.heroLead}>{SZAKAGI_HERO.lead}</p>
          <div className={styles.heroActions}>
            <a
              href={SZAKAGI_HERO.ctaPrimary.href}
              className="btn-primary px-6 py-3 text-sm font-semibold"
            >
              {SZAKAGI_HERO.ctaPrimary.label}
            </a>
            <a
              href={SZAKAGI_HERO.ctaSecondary.href}
              className="btn-secondary px-6 py-3 text-sm font-semibold"
            >
              {SZAKAGI_HERO.ctaSecondary.label}
            </a>
          </div>
        </div>
      </section>

      <section
        id="szakagak"
        ref={tradesRef}
        className={styles.section}
        aria-labelledby="szakagi-trades-title"
      >
        <p className={styles.sectionLabel}>{SZAKAGI_TRADES_HEAD.label}</p>
        <h2 id="szakagi-trades-title" className={styles.sectionTitle}>
          {SZAKAGI_TRADES_HEAD.title}
        </h2>
        <p className={styles.sectionIntro}>{SZAKAGI_TRADES_HEAD.intro}</p>

        <nav className={styles.chips} aria-label="Szakágak gyorslista">
          {SZAKAGI_TRADES.map((trade) => (
            <a key={trade.id} href={`#${trade.id}`} className={styles.chip}>
              {trade.title}
            </a>
          ))}
        </nav>

        <div className={styles.tradeList}>
          {SZAKAGI_TRADES.map((trade) => (
            <article key={trade.id} id={trade.id} className={styles.tradeArticle}>
              <div className={styles.tradeMedia}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={trade.image} alt={trade.imageAlt} loading="lazy" />
              </div>
              <div className={styles.tradeCopy}>
                <h2 className={styles.tradeSeoTitle}>{trade.seoTitle}</h2>
                <p className={styles.tradeLead}>{trade.description}</p>
                <div className={styles.tradeBody}>
                  {trade.body.map((p) => (
                    <p key={p.slice(0, 36)}>{p}</p>
                  ))}
                </div>
                <ul className={styles.tradeBullets}>
                  {trade.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <a
                  href={`?szakag=${trade.id}#szakagi-form`}
                  className={styles.tradeCta}
                >
                  Érdekel: {trade.title}
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        id="szakagi-form"
        className={styles.formBand}
        aria-labelledby="szakagi-cta-title"
      >
        <div className={styles.sectionCompact}>
          <p className={styles.sectionLabel}>Kapcsolat</p>
          <h2 id="szakagi-cta-title" className={styles.sectionTitleCompact}>
            {SZAKAGI_CTA.title}
          </h2>
          <p className={styles.sectionIntroCompact}>{SZAKAGI_CTA.body}</p>
          <div className={styles.formPanel}>
            <SzakagiContactForm />
          </div>
          <p className={styles.formAlt}>
            Teljes generálprojekt vagy nagyobb beruházás?{" "}
            <Link href="/kapcsolat">A Kapcsolat oldalon</Link> részletesebben is
            írhat.
          </p>
        </div>
      </section>

      <section
        className={styles.sectionCompact}
        aria-labelledby="szakagi-area-title"
      >
        <p className={styles.sectionLabel}>{SZAKAGI_AREA.label}</p>
        <h2 id="szakagi-area-title" className={styles.sectionTitleCompact}>
          {SZAKAGI_AREA.title}
        </h2>
        <div className={styles.areaBody}>
          {SZAKAGI_AREA.body.map((p) => (
            <p key={p.slice(0, 32)}>{p}</p>
          ))}
        </div>
      </section>

      <section
        ref={whyRef}
        className={styles.sectionCompact}
        aria-labelledby="szakagi-why-title"
      >
        <div className={styles.whyGrid}>
          <div>
            <p className={styles.sectionLabel}>{SZAKAGI_WHY.label}</p>
            <h2 id="szakagi-why-title" className={styles.sectionTitleCompact}>
              {SZAKAGI_WHY.title}
            </h2>
            <div className={styles.whyBody}>
              {SZAKAGI_WHY.body.map((p) => (
                <p key={p.slice(0, 28)}>{p}</p>
              ))}
            </div>
          </div>
          <div className={styles.whyMedia}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SZAKAGI_WHY.image} alt={SZAKAGI_WHY.imageAlt} loading="lazy" />
          </div>
        </div>
      </section>

      <section
        ref={processRef}
        className={styles.sectionCompact}
        aria-labelledby="szakagi-process-title"
      >
        <p className={styles.sectionLabel}>{SZAKAGI_PROCESS_HEAD.label}</p>
        <h2 id="szakagi-process-title" className={styles.sectionTitleCompact}>
          {SZAKAGI_PROCESS_HEAD.title}
        </h2>
        <p className={styles.sectionIntroCompact}>{SZAKAGI_PROCESS_HEAD.intro}</p>
        <ol className={styles.processList}>
          {SZAKAGI_PROCESS.map((step) => (
            <li key={step.step}>
              <article className={styles.processCard}>
                <p className={styles.processStep}>{step.step}</p>
                <h3 className={styles.processTitle}>{step.title}</h3>
                <p className={styles.processText}>{step.description}</p>
              </article>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.faq} aria-labelledby="szakagi-faq-title">
        <div className={styles.sectionCompact}>
          <p className={styles.sectionLabel}>Kérdések</p>
          <h2 id="szakagi-faq-title" className={styles.sectionTitleCompact}>
            Gyakori kérdések
          </h2>
          <div className={styles.faqList}>
            {SZAKAGI_FAQ.map((item) => (
              <details key={item.id} className={styles.faqItem}>
                <summary>{item.q}</summary>
                <div className={styles.faqAnswer}>
                  {item.a.split("\n\n").map((para) => (
                    <p key={para.slice(0, 40)}>{para}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.closing} aria-label="Kapcsolódó oldalak">
        <div className={styles.sectionCompact}>
          <p className={styles.closingLead}>
            Maradt kérdés?{" "}
            <a href="#szakagi-form">Írjon a szakági űrlapon</a>
            {" · "}
            <Link href="/kapcsolat">Kapcsolat</Link>
          </p>
          <nav className={styles.relatedLight} aria-label="További oldalak">
            {SZAKAGI_RELATED.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <SzakagiStickyCta />
    </div>
  )
}
