import Image from "next/image"
import Link from "next/link"
import {
  HOME_FAQ,
  HOME_OFFER,
  HOME_OUTRO,
  HOME_PROMISES,
  HOME_WORKS,
} from "@/lib/home-landing"
import { getActiveProjectCount } from "@/lib/projects"
import {
  getPublishedReferences,
  getReferenceBySlug,
  REFERENCE_TYPE_LABELS,
  referenceDetailPath,
} from "@/lib/references"
import styles from "./home-below.module.css"

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        d="M3.315 10.996h16.623l-.884.707-8.084-8.135h2.526l8.261 8.337-8.286 8.337h-2.526l8.11-8.135.883.708H3.315z"
      />
    </svg>
  )
}

function getWorkReferences() {
  const curated = HOME_WORKS.slugs
    .map((slug) => getReferenceBySlug(slug))
    .filter((r) => r !== undefined)
  return curated.length > 0 ? curated : getPublishedReferences().slice(0, 3)
}

const OFFER_SIZE_CLASS = {
  feature: styles.offerFeature,
  md: styles.offerMd,
  lg: styles.offerLg,
} as const

/** 01 — Bento service cards (varied sizes, no lonely last tile) */
function HomeOffer() {
  return (
    <section className={styles.offer} aria-labelledby="home-offer-title">
      <div className={styles.container}>
        <p className={styles.label}>{HOME_OFFER.label}</p>
        <h2 id="home-offer-title" className={styles.offerTitle}>
          {HOME_OFFER.title}
        </h2>
        <p className={styles.offerLead}>{HOME_OFFER.lead}</p>

        <ul className={styles.offerGrid}>
          {HOME_OFFER.cards.map((item) => (
            <li
              key={item.href}
              className={`${styles.offerCell} ${OFFER_SIZE_CLASS[item.size]}`}
            >
              <Link href={item.href} className={styles.offerCard}>
                <span className={styles.offerMedia} aria-hidden>
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 50vw"
                    className={styles.offerImg}
                  />
                </span>
                <span className={styles.offerBody}>
                  <span className={styles.offerCardLabel}>{item.label}</span>
                  <span className={styles.offerCardText}>{item.text}</span>
                  <span className={styles.offerArrow} aria-hidden>
                    <ArrowIcon />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** 02 — Three static promises */
function HomePromises() {
  return (
    <section
      className={styles.promises}
      aria-labelledby="home-promises-title"
    >
      <div className={styles.container}>
        <p className={styles.labelLight}>{HOME_PROMISES.label}</p>
        <h2 id="home-promises-title" className={styles.promisesTitle}>
          {HOME_PROMISES.title}
        </h2>
        <ol className={styles.promisesGrid}>
          {HOME_PROMISES.items.map((item) => (
            <li key={item.index} className={styles.promiseItem}>
              <span className={styles.promiseIndex} aria-hidden>
                {item.index}
              </span>
              <h3 className={styles.promiseHeading}>{item.title}</h3>
              <p className={styles.promiseBody}>{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** 03 — Simple works grid */
function HomeWorks() {
  const references = getWorkReferences()
  const activeCount = getActiveProjectCount()

  return (
    <section className={styles.works} aria-labelledby="home-works-title">
      <div className={styles.container}>
        <div className={styles.worksHead}>
          <div>
            <p className={styles.label}>{HOME_WORKS.label}</p>
            <h2 id="home-works-title" className={styles.worksTitle}>
              {HOME_WORKS.title}
            </h2>
          </div>
          <div className={styles.worksLinks}>
            <Link href={HOME_WORKS.ctaHref} className={styles.textLink}>
              {HOME_WORKS.cta}
              <ArrowIcon />
            </Link>
            <Link href={HOME_WORKS.secondaryCtaHref} className={styles.textLink}>
              {HOME_WORKS.secondaryCta}
              {activeCount > 0 ? (
                <span className={styles.textLinkNote}>{activeCount} aktív</span>
              ) : null}
              <ArrowIcon />
            </Link>
          </div>
        </div>

        <ul className={styles.worksGrid}>
          {references.map((reference) => (
            <li key={reference.slug}>
              <Link
                href={referenceDetailPath(reference.slug)}
                className={styles.workCard}
              >
                <span className={styles.workMedia} aria-hidden>
                  <Image
                    src={reference.heroImage.src}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className={styles.workImg}
                  />
                </span>
                <span className={styles.workMeta}>
                  {REFERENCE_TYPE_LABELS[reference.type]} · {reference.city} ·{" "}
                  {reference.yearCompleted}
                </span>
                <span className={styles.workTitle}>{reference.title}</span>
                <span className={styles.workCta}>
                  {HOME_WORKS.panelCta}
                  <ArrowIcon />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** 04 — FAQ */
function HomeFaq() {
  return (
    <section className={styles.faq} aria-labelledby="home-faq-title">
      <div className={styles.containerNarrow}>
        <h2 id="home-faq-title" className={styles.faqTitle}>
          {HOME_FAQ.title}
        </h2>
        <div className={styles.faqList}>
          {HOME_FAQ.items.map((item) => (
            <details key={item.q} className={styles.faqItem}>
              <summary>{item.q}</summary>
              <p className={styles.faqAnswer}>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/** 05 — Single CTA */
function HomeOutro() {
  return (
    <section className={styles.outro} aria-labelledby="home-outro-title">
      <div className={styles.outroBg} aria-hidden>
        <Image
          src={HOME_OUTRO.image}
          alt=""
          fill
          sizes="100vw"
          className={styles.outroImg}
        />
      </div>
      <div className={`${styles.container} ${styles.outroInner}`}>
        <h2 id="home-outro-title" className={styles.outroTitle}>
          {HOME_OUTRO.title}
        </h2>
        <Link href={HOME_OUTRO.ctaHref} className={styles.ctaLight}>
          {HOME_OUTRO.cta}
          <ArrowIcon />
        </Link>
        <p className={styles.outroNote}>{HOME_OUTRO.note}</p>
      </div>
    </section>
  )
}

/** Below-fold: offer → promises → works → FAQ → CTA. Hero stays in HomeHero. */
export function HomeBelowFold() {
  return (
    <div className={styles.shell}>
      <HomeOffer />
      <HomePromises />
      <HomeWorks />
      <HomeFaq />
      <HomeOutro />
    </div>
  )
}
