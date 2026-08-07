"use client"

import Link from "next/link"
import { useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"
import {
  ASZTALOS_CTA,
  ASZTALOS_FACTS,
  ASZTALOS_FAQ,
  ASZTALOS_GALLERY,
  ASZTALOS_GALLERY_HEAD,
  ASZTALOS_HERO,
  ASZTALOS_PARTNER,
  ASZTALOS_PROCESS,
  ASZTALOS_PROCESS_HEAD,
  ASZTALOS_STORY,
} from "@/lib/asztalos-landing"
import styles from "./asztalos.module.css"

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
    y: opts?.y ?? 32,
    duration: 0.85,
    stagger: opts?.stagger ?? 0.08,
    ease: "power2.out",
    immediateRender: false,
    scrollTrigger: {
      trigger,
      start: "top 82%",
      toggleActions: "play none none none",
    },
  })
}

export function AsztalosLanding() {
  const rootRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const storyRef = useRef<HTMLElement>(null)
  const galleryRef = useRef<HTMLElement>(null)
  const processRef = useRef<HTMLElement>(null)
  const partnerRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const hero = heroRef.current
      if (hero && !prefersReducedMotion()) {
        const title = hero.querySelector(`.${styles.heroTitle}`)
        const lead = hero.querySelector(`.${styles.heroLead}`)
        const actions = hero.querySelector(`.${styles.heroActions}`)
        const img = hero.querySelector(`.${styles.heroMedia} img`)
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
        if (img) {
          gsap.set(img, { scale: 1.12 })
          tl.to(img, { scale: 1.06, duration: 2.2 }, 0)
        }
        tl.from(
          [title, lead, actions],
          { y: 36, opacity: 0, duration: 1, stagger: 0.12 },
          0.15,
        )
      }

      rise(
        storyRef.current?.querySelectorAll(
          `.${styles.sectionTitle}, .${styles.storyBody} p, .${styles.storyMedia}`,
        ) ?? [],
        storyRef.current,
        { stagger: 0.1 },
      )
      rise(
        galleryRef.current?.querySelectorAll(`.${styles.masonryItem}`) ?? [],
        galleryRef.current,
        { y: 24, stagger: 0.04 },
      )
      rise(
        processRef.current?.querySelectorAll(`.${styles.journeyCard}`) ?? [],
        processRef.current,
        { stagger: 0.1 },
      )
      rise(
        partnerRef.current?.querySelectorAll(
          `.${styles.sectionTitle}, .${styles.partnerBody}, .${styles.partnerFacts}, .${styles.partnerLinks}`,
        ) ?? [],
        partnerRef.current,
        { stagger: 0.1 },
      )
    },
    { scope: rootRef },
  )

  return (
    <div ref={rootRef} className={styles.page}>
      {/* Hero */}
      <section ref={heroRef} className={styles.hero} aria-labelledby="asztalos-hero-title">
        <div className={styles.heroMedia} aria-hidden={false}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ASZTALOS_HERO.image} alt={ASZTALOS_HERO.imageAlt} />
        </div>
        <div className={styles.heroScrim} aria-hidden />
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>{ASZTALOS_HERO.eyebrow}</p>
          <h1 id="asztalos-hero-title" className={styles.heroTitle}>
            {ASZTALOS_HERO.title}
          </h1>
          <p className={styles.heroLead}>{ASZTALOS_HERO.lead}</p>
          <div className={styles.heroActions}>
            <Link
              href={ASZTALOS_HERO.ctaPrimary.href}
              className="btn-primary px-6 py-3 text-sm font-semibold"
            >
              {ASZTALOS_HERO.ctaPrimary.label}
            </Link>
            <a
              href={ASZTALOS_HERO.ctaSecondary.href}
              className="btn-secondary px-6 py-3 text-sm font-semibold"
            >
              {ASZTALOS_HERO.ctaSecondary.label}
            </a>
          </div>
          <p className={styles.scrollCue}>Görgessen</p>
        </div>
      </section>

      {/* Facts */}
      <section className={styles.facts} aria-label="Gyors tények">
        <dl className={styles.factsGrid}>
          {ASZTALOS_FACTS.map((fact) => (
            <div key={fact.label} className={styles.fact}>
              <dt className="sr-only">{fact.label}</dt>
              <dd className={styles.factValue}>{fact.value}</dd>
              <p className={styles.factLabel}>{fact.label}</p>
            </div>
          ))}
        </dl>
      </section>

      {/* Story */}
      <section
        ref={storyRef}
        className={styles.section}
        aria-labelledby="asztalos-story-title"
      >
        <div className={styles.storyGrid}>
          <div>
            <p className={styles.sectionLabel}>{ASZTALOS_STORY.label}</p>
            <h2 id="asztalos-story-title" className={styles.sectionTitle}>
              {ASZTALOS_STORY.title}
            </h2>
            <div className={styles.storyBody}>
              {ASZTALOS_STORY.body.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </div>
          <div className={styles.storyMedia}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ASZTALOS_STORY.image} alt={ASZTALOS_STORY.imageAlt} />
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section
        id="galeria"
        ref={galleryRef}
        className={styles.gallery}
        aria-labelledby="asztalos-gallery-title"
      >
        <div className={styles.galleryHead}>
          <p className={styles.sectionLabelDark}>{ASZTALOS_GALLERY_HEAD.label}</p>
          <h2 id="asztalos-gallery-title" className={styles.sectionTitle}>
            {ASZTALOS_GALLERY_HEAD.title}
          </h2>
        </div>
        <div className={styles.masonry}>
          {ASZTALOS_GALLERY.map((item) => (
            <figure key={item.src} className={styles.masonryItem}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt={item.alt} loading="lazy" />
            </figure>
          ))}
        </div>
      </section>

      {/* Process — laikus lépések (elrendezés → beépítés) */}
      <section
        ref={processRef}
        className={styles.section}
        aria-labelledby="asztalos-process-title"
      >
        <p className={styles.sectionLabel}>{ASZTALOS_PROCESS_HEAD.label}</p>
        <h2 id="asztalos-process-title" className={styles.sectionTitle}>
          {ASZTALOS_PROCESS_HEAD.title}
        </h2>
        <p className={styles.processIntro}>{ASZTALOS_PROCESS_HEAD.intro}</p>
        <ol className={styles.journeyList}>
          {ASZTALOS_PROCESS.map((step) => (
            <li key={step.step}>
              <article className={styles.journeyCard}>
                <div className={styles.journeyMedia}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={step.image} alt={step.imageAlt} loading="lazy" />
                </div>
                <div className={styles.journeyBody}>
                  <p className={styles.journeyStep}>{step.step}</p>
                  <h3 className={styles.journeyTitle}>{step.title}</h3>
                  <p className={styles.journeyText}>{step.description}</p>
                </div>
              </article>
            </li>
          ))}
        </ol>
      </section>

      {/* Partner */}
      <section
        ref={partnerRef}
        className={styles.section}
        aria-labelledby="asztalos-partner-title"
      >
        <div className={styles.partnerGrid}>
          <div className={styles.partnerMedia}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ASZTALOS_PARTNER.image}
              alt={ASZTALOS_PARTNER.imageAlt}
              loading="lazy"
            />
          </div>
          <div className={styles.partnerCopy}>
            <p className={styles.sectionLabel}>{ASZTALOS_PARTNER.eyebrow}</p>
            <h2 id="asztalos-partner-title" className={styles.sectionTitle}>
              {ASZTALOS_PARTNER.title}
            </h2>
            <p className={styles.partnerBody}>{ASZTALOS_PARTNER.body}</p>
            <dl className={styles.partnerFacts}>
              {ASZTALOS_PARTNER.facts.map((f) => (
                <div key={f.label}>
                  <dt className={styles.partnerFactLabel}>{f.label}</dt>
                  <dd className={styles.partnerFactValue}>{f.value}</dd>
                </div>
              ))}
            </dl>
            <div className={styles.partnerLinks}>
              <a
                href={ASZTALOS_PARTNER.website}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary px-4 py-2.5 text-sm font-semibold"
              >
                Hírös-Ablak weboldal
              </a>
              <a
                href={ASZTALOS_PARTNER.lapszabaszat}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.partnerGhost}
              >
                Lapszabászat Kecskeméten
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={styles.faq} aria-labelledby="asztalos-faq-title">
        <div className={styles.section}>
          <p className={styles.sectionLabelDark}>Kérdések</p>
          <h2 id="asztalos-faq-title" className={styles.sectionTitle}>
            Gyakori kérdések
          </h2>
          <div className={styles.faqList}>
            {ASZTALOS_FAQ.map((item) => (
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

      {/* CTA */}
      <section className={styles.cta} aria-labelledby="asztalos-cta-title">
        <div className={styles.ctaMedia}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ASZTALOS_CTA.image} alt={ASZTALOS_CTA.imageAlt} loading="lazy" />
        </div>
        <div className={styles.ctaScrim} aria-hidden />
        <div className={styles.ctaInner}>
          <h2 id="asztalos-cta-title" className={styles.ctaTitle}>
            {ASZTALOS_CTA.title}
          </h2>
          <p className={styles.ctaBody}>{ASZTALOS_CTA.body}</p>
          <div className={styles.ctaActions}>
            <Link href="/kapcsolat" className="btn-primary px-6 py-3 text-sm font-semibold">
              Üzenet írása
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
