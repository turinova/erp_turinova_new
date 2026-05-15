import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import Script from "next/script"
import { DEFAULT_OG_IMAGE_PATH, pageMetadata } from "@/lib/seo"
import { RevealOnLoad } from "@/components/site/RevealOnLoad"
import { RevealOnScroll } from "@/components/site/RevealOnScroll"
import {
  COMPANY,
  buildLocalBusinessJsonLd,
  formatPhoneDisplay,
} from "@/lib/company"
import CategoryCard from "@/components/szallitolada-keszites/CategoryCard"
import MaterialCard from "@/components/szallitolada-keszites/MaterialCard"
import FaqAccordion from "@/components/szallitolada-keszites/FaqAccordion"
import QuoteForm from "@/components/szallitolada-keszites/QuoteForm"

export const metadata: Metadata = pageMetadata({
  title: "Szállítóláda, kaloda és rekesz gyártás | Hírös-Ablak Kft.",
  description:
    "Egyedi méretű faládák ipari szállításhoz: szállítóláda, gépláda, kaloda, rekesz. Saját lapszabászat, nincs minimum darabszám, minden alapanyag raktáron, átvétel Kecskeméten.",
  canonical: "/szolgaltatasok/ipari-megoldasok/szallitolada-keszites",
  ogImage: DEFAULT_OG_IMAGE_PATH,
})

const ctaPrimaryDark =
  "inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95 transition shadow-[0_8px_28px_rgba(151,29,37,0.35)]"
const ctaSecondaryDark =
  "inline-flex items-center justify-center rounded-full border border-white/30 bg-white/5 px-6 py-3 text-base font-semibold text-white hover:bg-white/10 transition"

const QUOTE_PHONE = "+36309992800"
const QUOTE_PHONE_DISPLAY = "+36 30 999 2800"
const QUOTE_EMAIL = COMPANY.emails.central

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 items-center justify-center shrink-0"
      >
        <svg
          className="w-3 h-3"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      </span>
      <span className="text-sm sm:text-base text-white/85 leading-snug">
        {children}
      </span>
    </li>
  )
}

function IndustryItem({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80">
      <span aria-hidden className="text-[var(--color-brand)]">
        {icon}
      </span>
      <span>{label}</span>
    </div>
  )
}

export default function SzallitoladaKeszitesPage() {
  const localBusinessJsonLd = buildLocalBusinessJsonLd()

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Szállítóláda, kaloda és rekesz gyártás",
    serviceType: [
      "Szállítóláda gyártás",
      "Gépláda gyártás",
      "Tárolóláda gyártás",
      "Kaloda gyártás",
      "Fa rekesz gyártás",
      "Egyedi ipari csomagolóeszköz",
    ],
    description:
      "Egyedi méretű faládák, kalodák és rekeszek ipari megrendelőknek: gépgyártás, autóipar, elektronika, acélipar és logisztika számára. Saját lapszabászattal és raktárkészlettel, átvétel Kecskeméten.",
    areaServed: { "@type": "Country", name: "Magyarország" },
    provider: {
      "@type": "LocalBusiness",
      name: COMPANY.brand,
      url: COMPANY.website,
      telephone: formatPhoneDisplay(COMPANY.phones.primary),
      address: {
        "@type": "PostalAddress",
        streetAddress: COMPANY.address.street,
        postalCode: COMPANY.address.postalCode,
        addressLocality: COMPANY.address.city,
        addressCountry: COMPANY.address.countryCode,
      },
    },
    audience: {
      "@type": "Audience",
      audienceType: "Ipari megrendelők",
    },
  }

  const faqItems = [
    {
      q: "Milyen méretű ládákat tudnak gyártani?",
      a: "Bármilyen egyedi méretben gyártunk, a kis alkatrészládáktól a több méteres szállítási ládákig és kalodákig. A méretet mindig a szállítandó termékhez igazítjuk, méretkorlátozás nélkül.",
    },
    {
      q: "Milyen alapanyagból készülnek a ládák?",
      a: "Fenyő fűrészáruból (deszka, léc, gerenda, palló), OSB lapból, rétegelt lemezből (nyír, nyár, bükk) és bútorlapból vagy MDF-ből egyaránt. Az anyagot a felhasználási célnak és az igénybevételnek megfelelően javasoljuk.",
    },
    {
      q: "Van minimum rendelési mennyiség?",
      a: "Nincs. Egyetlen darab prototípustól kezdve több százas szériáig vállalunk gyártást.",
    },
    {
      q: "Tudnak belső rögzítést is készíteni a ládába?",
      a: "Igen, igény szerint belső válaszfalakat, rögzítőelemeket, távtartókat, párnafát és habszivacs bélést is készítünk, hogy a szállítandó termék a ládán belül is biztosan a helyén maradjon.",
    },
    {
      q: "Vállalnak sorozatgyártást is?",
      a: "Igen, egyedi és sorozatgyártás egyaránt. Ha ugyanabból a ládatípusból rendszeresen szüksége van nagyobb mennyiségre, keretszerződést is kötünk a folyamatos ellátásért.",
    },
    {
      q: "Hogyan kérhetek árajánlatot?",
      a: `Az oldal alján található űrlapon, e-mailben a ${COMPANY.emails.central} címen, vagy telefonon a ${QUOTE_PHONE_DISPLAY} számon. Érdemes előre megadni a szállítandó termék méreteit, tömegét és a szükséges darabszámot, így gyorsabban tudunk pontos árajánlatot adni.`,
    },
  ]

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }

  return (
    <div className="relative">
      <Script
        id="jsonld-localbusiness-szallitolada"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <Script
        id="jsonld-service-szallitolada"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <Script
        id="jsonld-faq-szallitolada"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <RevealOnLoad>
        {/* HERO – full-bleed cinematic with drone background */}
        <section className="relative isolate overflow-hidden">
          <Image
            src="/img/szallitolada-cegunk.webp"
            alt="A Hírös-Ablak Kft. faipari üzeme Kecskeméten, drónfelvétel"
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover object-center"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/65 to-black/45"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -left-32 -z-10 h-[520px] w-[520px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(151,29,37,0.30) 0%, transparent 65%)",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white/85 backdrop-blur">
                Kecskemét · 1996 óta · Saját üzem
              </p>

              <h1 className="mt-5 text-balance text-4xl md:text-5xl font-semibold tracking-tight text-white">
                Egyedi szállítóládák és ipari csomagolások, pontosan az Ön
                igényeire szabva.
              </h1>

              <div
                aria-hidden
                className="mt-4 h-1.5 w-24 rounded-full bg-[var(--color-brand)]"
              />

              <p className="mt-5 max-w-2xl text-pretty text-base md:text-lg text-white/85">
                Szállítóládákat, gépládákat, kalodákat és rekeszeket az Önök
                termékeihez egyedileg tervezzük és méretezzük. Saját
                lapszabászatunknak és nagy raktári készletünknek köszönhetően
                gyorsan és rugalmasan dolgozunk Kecskeméten.
              </p>

              <ul className="mt-6 grid gap-2.5 max-w-xl">
                <Bullet>
                  1996 óta a faiparban, közel 30 év tapasztalat
                </Bullet>
                <Bullet>
                  1 darabtól sorozatig, nincs minimum mennyiség
                </Bullet>
                <Bullet>
                  Alapanyag raktárról, a gyártás azonnal indulhat
                </Bullet>
              </ul>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a href="#arajanlat" className={ctaPrimaryDark}>
                  Árajánlatot kérek →
                </a>
                <a href={`tel:${QUOTE_PHONE}`} className={ctaSecondaryDark}>
                  Beszéljünk telefonon · {QUOTE_PHONE_DISPLAY}
                </a>
              </div>

              <p className="mt-5 text-xs text-white/55">
                Ipari megrendelőknek Kecskeméten, gyártással és egyeztetéssel.
              </p>
            </div>
          </div>
        </section>

        {/* INDUSTRY STRIP */}
        <section className="bg-stone-wash py-8 md:py-10 border-b border-black/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center gap-4 lg:flex-row lg:gap-6 lg:justify-between">
              <p className="text-sm font-semibold uppercase tracking-wide text-black/55 shrink-0">
                Kinek gyártunk
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
                <IndustryItem
                  icon={
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="9" width="18" height="11" rx="1" />
                      <path d="M7 9V5h10v4" />
                      <path d="M7 14h2M11 14h2M15 14h2" />
                    </svg>
                  }
                  label="Gépgyártás"
                />
                <IndustryItem
                  icon={
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 17h14M3 12l2-5h14l2 5M3 12v5h2M21 12v5h-2M7 17v2M17 17v2" />
                      <circle cx="7" cy="14" r="1" />
                      <circle cx="17" cy="14" r="1" />
                    </svg>
                  }
                  label="Autóipar"
                />
                <IndustryItem
                  icon={
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <path d="M9 9h6v6H9z" />
                      <path d="M4 9h2M4 12h2M4 15h2M18 9h2M18 12h2M18 15h2M9 4v2M12 4v2M15 4v2M9 18v2M12 18v2M15 18v2" />
                    </svg>
                  }
                  label="Elektronika"
                />
                <IndustryItem
                  icon={
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 21V8l9-5 9 5v13" />
                      <path d="M9 21V12h6v9" />
                    </svg>
                  }
                  label="Acélipar"
                />
                <IndustryItem
                  icon={
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M13 2L3 14h7l-1 8 11-14h-7l0-6z" />
                    </svg>
                  }
                  label="Energiaipar"
                />
                <IndustryItem
                  icon={
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="1" y="6" width="15" height="12" rx="1" />
                      <path d="M16 11h4l3 3v4h-7" />
                      <circle cx="6" cy="20" r="2" />
                      <circle cx="19" cy="20" r="2" />
                    </svg>
                  }
                  label="Logisztika"
                />
                <IndustryItem
                  icon={
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2v6M8 4l4 4 4-4M3 14c2 0 3-2 3-2s1 2 3 2 3-2 3-2 1 2 3 2 3-2 3-2v6H3z" />
                    </svg>
                  }
                  label="Mezőgazdaság"
                />
              </div>
            </div>
          </div>
        </section>

        {/* PRODUCT CATEGORIES */}
        <section className="bg-white py-12 md:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Termékkategóriák
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
                <p className="mt-4 text-base md:text-lg text-black/75">
                  Minden ládát az adott szállítmány vagy tárolási igény alapján
                  tervezünk. A típus, méret és belső rögzítés mind az Ön
                  termékéhez igazodik.
                </p>
              </div>
            </RevealOnScroll>

            {/* Reference photo showcase */}
            <RevealOnScroll delay={0.05} className="mt-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <figure className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                  <div className="relative aspect-[4/3] w-full bg-stone-50">
                    <Image
                      src="/img/szallitolada-zart-lada.jpg"
                      alt="Egyedi méretű zárt szállítási láda, OSB és fenyő keretes szerkezettel"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                  <figcaption className="px-5 py-3 text-sm text-black/70 border-t border-black/10">
                    <span className="font-semibold text-slate-900">Példa:</span>{" "}
                    zárt szállítási láda, OSB és fenyőkeret
                  </figcaption>
                </figure>
                <figure className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                  <div className="relative aspect-[4/3] w-full bg-stone-50">
                    <Image
                      src="/img/szallitolada-nyitott-lada.jpg"
                      alt="Nyitott tetejű kaloda belső rögzítő elemekkel"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                  <figcaption className="px-5 py-3 text-sm text-black/70 border-t border-black/10">
                    <span className="font-semibold text-slate-900">Példa:</span>{" "}
                    nyitott kaloda, belső rögzítőkkel
                  </figcaption>
                </figure>
              </div>
            </RevealOnScroll>

            {/* 4 icon-only category cards */}
            <RevealOnScroll delay={0.1} className="mt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                <CategoryCard
                  title="Szállítási láda, gépláda"
                  desc="Gépek, gépalkatrészek, elektronikai berendezések és acélszerkezetek biztonságos közúti szállításához tervezett, strapabíró faláda."
                  bullets={[
                    "Egyedi méretben, a szállítandó termékhez igazítva",
                    "Csavarozott vagy szegezett összeépítés",
                    "Talp- vagy csúszótalp-szerkezet a targoncázhatóságért",
                    "Belső rögzítőelemekkel, párnafával, habszivacs béléssel",
                  ]}
                  icon={
                    <svg
                      className="w-10 h-10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="6" width="18" height="14" rx="1" />
                      <path d="M3 11h18" />
                      <path d="M9 4h6v2H9z" />
                      <path d="M8 16h8" />
                    </svg>
                  }
                />
                <CategoryCard
                  title="Tárolóláda, raktári láda"
                  desc="Raktári tároláshoz, komissiózáshoz és belső anyagmozgatáshoz készített ládák. Alkatrészek, szerszámok, félkész termékek és értéktárgyak rendszerezett tárolására."
                  bullets={[
                    "Egymásra rakható kialakítás a helytakarékos tároláshoz",
                    "Targoncával és kézzel egyaránt mozgatható",
                    "Tartós szerkezet, többszöri felhasználásra tervezve",
                    "Belső rekeszelés, válaszfalak az átlátható tároláshoz",
                  ]}
                  icon={
                    <svg
                      className="w-10 h-10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="6" width="18" height="14" rx="1" />
                      <path d="M3 10h18M9 6v14M15 6v14" />
                      <path d="M3 6V4h18v2" />
                    </svg>
                  }
                />
                <CategoryCard
                  title="Kaloda, fa konténer"
                  desc="Nagyobb méretű, nyitott tetejű fa csomagolóeszközök nehezebb vagy terjedelmesebb áruk tárolásához és szállításához. Felülről berakodható daruval, targoncával."
                  bullets={[
                    "Nagyteherbírású palló- vagy gerendatalp-szerkezet",
                    "Fenyő fűrészáru vagy rétegelt lemez oldalfalak",
                    "Egyedi méretek a szállítandó áruhoz igazítva",
                    "Ipari használatra tervezett, strapabíró kialakítás",
                  ]}
                  icon={
                    <svg
                      className="w-10 h-10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 8v12h18V8" />
                      <path d="M3 8h18" strokeDasharray="2 2" />
                      <path d="M7 12v3M12 12v3M17 12v3" />
                    </svg>
                  }
                />
                <CategoryCard
                  title="Rekesz, keretszerkezet"
                  desc="Könnyebb vagy kevésbé érzékeny termékek szállításához és tárolásához nyitott oldalú vagy félig zárt fa rekeszek, ahol a teljes zárt láda nem szükséges."
                  bullets={[
                    "Léces vagy deszkahéjazatú oldalfalak",
                    "Targoncázható talpszerkezettel",
                    "Kis és nagy méret egyaránt",
                    "Anyagmozgatáshoz, komissiózáshoz, üzemen belüli logisztikához",
                  ]}
                  icon={
                    <svg
                      className="w-10 h-10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 5h18M3 9h18M3 13h18M3 17h18M3 21h18" />
                      <path d="M5 5v16M19 5v16" />
                    </svg>
                  }
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.15} className="mt-8">
              <div className="rounded-2xl border border-black/10 bg-stone-50/60 p-5 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="text-base md:text-lg font-semibold tracking-tight text-slate-900">
                      Egyedi és speciális ládák bármilyen méretben
                    </div>
                    <p className="mt-1 text-sm text-black/70">
                      Extra nagy, extra teherbíró, osztott belterű, összecsukható
                      vagy speciális rögzítésű ládát is készítünk. Ha az Ön
                      terméke nem fér bele szabványos méretbe, megtervezzük hozzá.
                    </p>
                  </div>
                  <a href="#arajanlat" className="shrink-0 inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-[var(--color-brand-contrast)] hover:brightness-95 transition">
                    Árajánlat kérése →
                  </a>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* MATERIALS – with OSB stock photo */}
        <section className="bg-stone-wash py-12 md:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Alapanyagok raktárkészletről
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
                <p className="mt-4 text-base md:text-lg text-black/75">
                  Saját lapszabászatunk minden ládaalapanyagból tart készletet.
                  Nincs várakozás külső beszállítóra: a gyártás azonnal indulhat.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
                <div className="lg:col-span-5">
                  <div className="relative aspect-[4/5] lg:aspect-auto lg:h-full w-full overflow-hidden rounded-2xl border border-black/10">
                    <Image
                      src="/img/szallitolada-osb-keszlet.jpg"
                      alt="OSB lapok raktárkészleten a Hírös-Ablak Kft. üzemében"
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 40vw"
                    />
                    <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-black/70 backdrop-blur px-4 py-3 text-white">
                      <div className="text-sm font-semibold">
                        Minden alapanyag raktáron
                      </div>
                      <div className="text-xs text-white/75 mt-0.5">
                        Fenyő • OSB • Rétegelt lemez • Bútorlap / MDF
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <MaterialCard
                    name="Fenyő fűrészáru"
                    desc="A leggyakoribb ládaanyag: deszka, léc, gerenda, palló."
                    useCases={[
                      "Nehéz gépek, ipari berendezések",
                      "Acélszerkezetek, öntvények",
                      "Szegezett és csavarozott ládákhoz",
                    ]}
                    icon={
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                    }
                  />
                  <MaterialCard
                    name="OSB lap"
                    desc="Gazdaságos, nagy felületű burkoláshoz, jó szilárdsággal."
                    useCases={[
                      "Raktári ládák",
                      "Belső logisztikai csomagolás",
                      "Könnyebb szállítmányok védelme",
                    ]}
                    icon={
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="1" />
                        <path d="M7 7l3 3M14 7l3 3M7 14l3 3M14 14l3 3" />
                      </svg>
                    }
                  />
                  <MaterialCard
                    name="Rétegelt lemez"
                    desc="Nyír, nyár vagy bükk: kimagasló teherbírás kis vastagság mellett."
                    useCases={[
                      "Érzékeny, nagy értékű termékek",
                      "Falemez héjazatú ládákhoz",
                      "Könnyű, mégis erős szerkezet",
                    ]}
                    icon={
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 7h18M3 11h18M3 15h18M3 19h18" />
                        <path d="M3 7l3-4h12l3 4" />
                      </svg>
                    }
                  />
                  <MaterialCard
                    name="Bútorlap és MDF"
                    desc="Esztétikusabb megjelenésű ládákhoz, igényes belső tárolóládákhoz."
                    useCases={[
                      "Bemutatóterembe, showroomhoz",
                      "Kiállítási anyagok csomagolása",
                      "Igényes belső tárolás",
                    ]}
                    icon={
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="4" y="4" width="16" height="16" rx="1" />
                        <path d="M4 9h16" />
                      </svg>
                    }
                  />
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white py-12 md:py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Gyakori kérdések
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
                <p className="mt-4 text-base text-black/70">
                  A leggyakoribb kérdések, amelyekkel beszerzők, mérnökök és
                  logisztikai vezetők keresnek meg minket.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-8">
              <FaqAccordion items={faqItems} />
            </RevealOnScroll>
          </div>
        </section>

        {/* ÁTVÉTEL – 2 column with portrait image */}
        <section className="bg-white py-12 md:py-16 border-y border-black/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-center">
              <RevealOnScroll className="md:col-span-5">
                <div className="relative mx-auto max-w-md md:max-w-none">
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-black/10 bg-stone-50">
                    <Image
                      src="/img/szallitolada-szallitas.webp"
                      alt="Kész ipari ládák, raklapos átvétel előkészítése az üzemben"
                      fill
                      sizes="(max-width: 768px) 100vw, 40vw"
                      className="object-cover object-center"
                    />
                  </div>
                </div>
              </RevealOnScroll>

              <RevealOnScroll delay={0.1} className="md:col-span-7">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                  Átvétel
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Kész ládák átvétele Kecskeméten
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                />
                <p className="mt-4 text-base md:text-lg text-black/75">
                  Minden termék saját üzemünkben készül, az elkészült ládák és
                  csomagolóeszközök személyesen vehetők át Kecskeméten.
                </p>
                <ul className="mt-5 grid gap-2.5 text-sm md:text-base text-black/75">
                  <li className="flex gap-2">
                    <span aria-hidden className="text-[var(--color-brand)]">
                      •
                    </span>
                    <span>
                      Egyedi és sorozatgyártás egyaránt, egyeztetett átvétellel
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span aria-hidden className="text-[var(--color-brand)]">
                      •
                    </span>
                    <span>
                      Targoncázható talpszerkezet a könnyű rakodáshoz
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span aria-hidden className="text-[var(--color-brand)]">
                      •
                    </span>
                    <span>
                      Igény szerint egy- vagy többutas láda kialakítás a saját
                      logisztikájukhoz
                    </span>
                  </li>
                </ul>
              </RevealOnScroll>
            </div>
          </div>
        </section>

        {/* QUOTE FORM + CONTACT */}
        <section
          id="arajanlat"
          className="bg-stone-wash py-12 md:py-16 scroll-mt-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Kérjen árajánlatot
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
                <p className="mt-4 text-base md:text-lg text-black/75">
                  Ossza meg velünk a termék főbb adatait, és hamarosan
                  elküldjük ajánlatunkat a várható gyártási idővel együtt.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                <div className="lg:col-span-7">
                  <div className="rounded-2xl border border-black/10 bg-white p-6 md:p-7">
                    <div className="text-base font-semibold tracking-tight text-slate-900">
                      Árajánlat kérés
                    </div>
                    <p className="mt-1 text-sm text-black/65">
                      Töltse ki, és felvesszük Önnel a kapcsolatot.
                    </p>
                    <div className="mt-5">
                      <QuoteForm
                        phoneDisplay={QUOTE_PHONE_DISPLAY}
                        phoneTel={`tel:${QUOTE_PHONE}`}
                        email={QUOTE_EMAIL}
                      />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5">
                  <div className="rounded-2xl border border-black/10 bg-white p-6 md:p-7 h-full">
                    <div className="text-base font-semibold tracking-tight text-slate-900">
                      Vagy hívjon, írjon
                    </div>
                    <p className="mt-1 text-sm text-black/65">
                      Munkanapokon általában néhány órán belül visszajelzünk.
                    </p>

                    <div className="mt-5 grid gap-3">
                      <a
                        href={`tel:${QUOTE_PHONE}`}
                        className="flex items-center gap-3 rounded-xl border border-black/10 bg-stone-50/60 px-4 py-3 hover:border-[var(--color-brand)]/40 transition"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand)]/8 text-[var(--color-brand)]">
                          <svg
                            className="w-5 h-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                          </svg>
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wide text-black/55 font-semibold">
                            Telefon
                          </div>
                          <div className="text-base font-semibold text-slate-900 truncate">
                            {QUOTE_PHONE_DISPLAY}
                          </div>
                        </div>
                      </a>

                      <a
                        href={`mailto:${QUOTE_EMAIL}`}
                        className="flex items-center gap-3 rounded-xl border border-black/10 bg-stone-50/60 px-4 py-3 hover:border-[var(--color-brand)]/40 transition"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand)]/8 text-[var(--color-brand)]">
                          <svg
                            className="w-5 h-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                          </svg>
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wide text-black/55 font-semibold">
                            E-mail
                          </div>
                          <div className="text-base font-semibold text-slate-900 truncate">
                            {QUOTE_EMAIL}
                          </div>
                        </div>
                      </a>
                    </div>

                    <div className="mt-5 rounded-xl border border-black/10 bg-stone-50/60 p-4">
                      <div className="text-xs uppercase tracking-wide text-black/55 font-semibold">
                        Telephely
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {COMPANY.address.full}
                      </div>
                    </div>

                    <div className="mt-5">
                      <Link
                        href="/kapcsolat"
                        className="inline-flex font-semibold underline underline-offset-4 text-black/75 hover:text-[var(--color-brand)]"
                      >
                        Vagy keressen meg a kapcsolat oldalon →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>
      </RevealOnLoad>
    </div>
  )
}
