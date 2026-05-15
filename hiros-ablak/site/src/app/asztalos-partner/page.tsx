import Link from "next/link"
import Image from "next/image"
import Script from "next/script"
import { RevealOnLoad } from "@/components/site/RevealOnLoad"
import { RevealOnScroll } from "@/components/site/RevealOnScroll"
import {
  COMPANY,
  buildLocalBusinessJsonLd,
  formatPhoneDisplay,
} from "@/lib/company"
import FaqAccordion from "@/components/szallitolada-keszites/FaqAccordion"
import PartnerForm from "@/components/asztalos-partner/PartnerForm"

export const metadata = {
  title: "Asztalos partner program | Hírös-Ablak Kft.",
  description:
    "Asztalos partnerprogram Kecskeméten: belépő partneri kedvezmény az első rendeléstől, havi kvóta alapján növekvő. Hitelkeret, elsőbbségi gyártás, online rendelés. 1996 óta.",
  alternates: {
    canonical: "/asztalos-partner",
  },
  openGraph: {
    title: "Asztalos partner program | Hírös-Ablak Kft.",
    description:
      "Belépő partneri kedvezmény az első rendeléstől, havi kvóta alapján növekvő. Hitelkeret, elsőbbségi gyártás, online rendelés. 1996 óta.",
    url: "/asztalos-partner",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Asztalos partner program | Hírös-Ablak Kft.",
    description:
      "Belépő partneri kedvezmény az első rendeléstől, havi kvóta alapján növekvő. 1996 óta.",
  },
}

const ctaPrimaryDark =
  "inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95 transition shadow-[0_8px_28px_rgba(151,29,37,0.35)]"
const ctaSecondaryDark =
  "inline-flex items-center justify-center rounded-full border border-white/30 bg-white/5 px-6 py-3 text-base font-semibold text-white hover:bg-white/10 transition"

const PARTNER_PHONE = "+36309992800"
const PARTNER_PHONE_DISPLAY = "+36 30 999 2800"
const PARTNER_EMAIL = COMPANY.emails.central

function CheckBullet({ children }: { children: React.ReactNode }) {
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

function PainBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-rose-100 text-rose-600 items-center justify-center shrink-0"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          viewBox="0 0 24 24"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </span>
      <span className="text-sm sm:text-base text-black/75 leading-snug">
        {children}
      </span>
    </li>
  )
}

function BenefitCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 md:p-7 h-full hover:border-[var(--color-brand)]/40 transition">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-brand)]/8 text-[var(--color-brand)]">
        {icon}
      </div>
      <div className="mt-4 text-base font-semibold tracking-tight text-slate-900">
        {title}
      </div>
      <p className="mt-1.5 text-sm text-black/70 leading-relaxed">{desc}</p>
    </div>
  )
}

function StatCard({
  value,
  label,
}: {
  value: string
  label: string
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 text-center">
      <div className="text-3xl md:text-4xl font-semibold tracking-tight text-[var(--color-brand)]">
        {value}
      </div>
      <div className="mt-2 text-sm text-black/65">{label}</div>
    </div>
  )
}

export default function AsztalosPartnerPage() {
  const localBusinessJsonLd = buildLocalBusinessJsonLd()

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Asztalos partner program",
    serviceType: [
      "Lapszabászat",
      "Élzárás",
      "Munkalap",
      "Vasalat és barkácsáruház",
    ],
    description:
      "Asztalos partnerprogram Kecskeméten. Belépő partneri kedvezmény az első rendeléstől, havi kvóta alapján növekvő. Hitelkeret, elsőbbségi gyártás, online rendelés.",
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
      audienceType: "Asztalosok, bútorgyártók, belsőépítészek",
    },
  }

  const faqItems = [
    {
      q: "Mennyi a partneri kedvezmény?",
      a: "Egy belépő kedvezménnyel indulsz az első rendelésnél. Ha havi kvótát teljesítesz, a kedvezményed automatikusan emelkedik. A pontos számokat személyesen átbeszéljük.",
    },
    {
      q: "Kell előre szerződést kötni vagy regisztrálni?",
      a: "Nem. Hívj minket, vagy gyere be Kecskemétre, és átbeszéljük a részleteket.",
    },
    {
      q: "Mi van, ha kicsi a műhely és nem rendelek havonta?",
      a: "Akkor is partnerünk vagy. A belépő partneri kedvezmény minden rendelésnél alapból megvan. A havi kvóta csak a növekvő kedvezményhez szükséges.",
    },
    {
      q: "Hogy működik a hitelkeret?",
      a: "Egy keretösszeg, amin belül halasztva fizethetsz. A számlákat projektenként csoportosítjuk, így mindig látod, melyik munka mennyibe került.",
    },
    {
      q: "Online lehet rendelni?",
      a: `Lapszabászatot, élzárást, bútorlapot és munkalapot a Turinova rendszerünkben. Vasalatot és barkács cikkeket egyelőre személyesen vagy telefonon (${PARTNER_PHONE_DISPLAY}).`,
    },
    {
      q: "Tudtok segíteni az anyagválasztásban?",
      a: "Igen, plusz költség nélkül. Hozd a rajzot vagy az ötletet, és átbeszéljük a legjobb megoldást.",
    },
    {
      q: "Mit jelent az elsőbbségi gyártás?",
      a: "Asztalos partnerként a projektjeid előrébb kerülnek a gépsoron. Nem kell heteket várnod, mert egy lakossági rendelés előbbre került.",
    },
    {
      q: "Kinek való a partnerprogram?",
      a: "Asztalosoknak, bútorgyártó kisvállalkozóknak, belsőépítészeknek és kivitelezőknek. Annak, akinek visszatérő, projekt alapú igénye van.",
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
        id="jsonld-localbusiness-asztalos-partner"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <Script
        id="jsonld-service-asztalos-partner"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <Script
        id="jsonld-faq-asztalos-partner"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <RevealOnLoad>
        {/* HERO */}
        <section className="relative isolate overflow-hidden">
          <Image
            src="/img/BIESSE_SELCO_10660_oriz.jpg"
            alt="Lapszabászati gép közelről, a Hírös-Ablak Kft. üzemében"
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover object-center"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/70 to-black/55"
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
                Kecskemét · Asztalos partner program · 1996 óta
              </p>

              <h1 className="mt-5 text-balance text-4xl md:text-5xl font-semibold tracking-tight text-white">
                Egy partner, akire számíthatsz. Aki Rád is számít.
              </h1>

              <div
                aria-hidden
                className="mt-4 h-1.5 w-24 rounded-full bg-[var(--color-brand)]"
              />

              <p className="mt-5 max-w-2xl text-pretty text-base md:text-lg text-white/85">
                Belépő partneri kedvezmény az első rendeléstől, ami havi kvóta
                teljesítésével nő. Hitelkeret, elsőbbségi gyártás és online
                rendelés. Lapszabászat, élzárás, munkalap és vasalat egy helyen.
              </p>

              <ul className="mt-6 grid gap-2.5 max-w-xl">
                <CheckBullet>
                  30 év Kecskeméten, magyar tulajdon, saját üzem
                </CheckBullet>
                <CheckBullet>
                  Belépő kedvezmény az első rendeléstől, havi kvótával nő
                </CheckBullet>
                <CheckBullet>
                  Online rendelés, valós idejű követés, SMS értesítés
                </CheckBullet>
              </ul>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a href="#kapcsolat" className={ctaPrimaryDark}>
                  Kérj visszahívást
                </a>
                <a
                  href={`tel:${PARTNER_PHONE}`}
                  className={ctaSecondaryDark}
                >
                  Hívj: {PARTNER_PHONE_DISPLAY}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="bg-stone-wash py-6 md:py-8 border-b border-black/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="text-sm font-semibold text-black/85">
                <span className="text-[var(--color-brand)]">1996</span> óta
                Kecskeméten
              </div>
              <div className="text-sm font-semibold text-black/85">
                Magyar tulajdon
              </div>
              <div className="text-sm font-semibold text-black/85">
                Saját üzem és lapszabászat
              </div>
              <div className="text-sm font-semibold text-black/85">
                Asztalos partnerek százaival
              </div>
            </div>
          </div>
        </section>

        {/* PAIN POINTS */}
        <section className="bg-white py-12 md:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-3xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                  Ismerős?
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Ismerős a műhelyből?
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <ul className="grid gap-3 md:grid-cols-2 max-w-3xl mx-auto">
                <PainBullet>
                  Heteket vársz, hogy egy projektet legyártsanak
                </PainBullet>
                <PainBullet>
                  Csak utólag derül ki, mennyibe fog kerülni
                </PainBullet>
                <PainBullet>
                  Hiányos teljesítés, és mindenki a másikra mutogat
                </PainBullet>
                <PainBullet>
                  Az anyagért az egyik helyre, a vasalatért egy másikra mész
                </PainBullet>
                <PainBullet>
                  A telefon süket, az e-mailre 2 nap múlva jön válasz
                </PainBullet>
                <PainBullet>
                  A számlák szétszórva, projektenként semmi sem átlátható
                </PainBullet>
              </ul>
            </RevealOnScroll>
          </div>
        </section>

        {/* BENEFITS (4 only, no fluff) */}
        <section className="bg-stone-wash py-12 md:py-16 border-y border-black/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-3xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                  Partneri feltételek
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Mit kapsz partnerként
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <BenefitCard
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
                      <path d="M3 17l6-6 4 4 8-8" />
                      <path d="M14 7h7v7" />
                    </svg>
                  }
                  title="Növekvő kedvezmény"
                  desc="Belépő kedvezménnyel indulsz az első rendelésnél, ami havi kvóta teljesítésével automatikusan emelkedik."
                />
                <BenefitCard
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
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <path d="M2 10h20" />
                      <circle cx="7" cy="14" r="1" />
                      <path d="M11 14h4" />
                    </svg>
                  }
                  title="Hitelkeret, projektenkénti számlázás"
                  desc="Halasztott fizetés egy keretösszegen belül. A számlákat projektenként csoportosítjuk, hogy lásd, mit hozott egy munka."
                />
                <BenefitCard
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
                      <path d="M3 12h12M11 6l4 6-4 6" />
                      <path d="M19 4v16" />
                    </svg>
                  }
                  title="Elsőbbségi gyártás"
                  desc="Asztalos partnereink előrébb kerülnek a gépeknél. A te projekted nem áll át lakossági rendelések miatt."
                />
                <BenefitCard
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
                      <rect x="3" y="4" width="18" height="14" rx="2" />
                      <path d="M8 20h8M12 18v2" />
                      <path d="M7 9l3 3 7-7" />
                    </svg>
                  }
                  title="Online rendelés és követés"
                  desc="A Turinova rendszerünkben kalkulálsz, mentesz, beküldesz. SMS-t küldünk, amikor a rendelés elkészül."
                />
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* HOW THE DISCOUNT WORKS */}
        <section className="bg-white py-12 md:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-3xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                  A kedvezmény
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Így nő a kedvezményed
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-black/10 bg-white p-6 md:p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-brand)]/8 text-[var(--color-brand)]">
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="mt-4 text-base font-semibold tracking-tight text-slate-900">
                    Belépő kedvezmény az első rendeléstől
                  </div>
                  <p className="mt-1.5 text-sm text-black/70 leading-relaxed">
                    Amint asztalos partnerként megrendelést adsz le,
                    automatikusan megkapod a belépő partneri kedvezményt.
                    Nincs külön regisztráció, nincs előzetes szerződés.
                  </p>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white p-6 md:p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-brand)]/8 text-[var(--color-brand)]">
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 17l6-6 4 4 8-8" />
                      <path d="M14 7h7v7" />
                    </svg>
                  </div>
                  <div className="mt-4 text-base font-semibold tracking-tight text-slate-900">
                    Havi kvótával nő
                  </div>
                  <p className="mt-1.5 text-sm text-black/70 leading-relaxed">
                    Ha rendszeresen rendelsz tőlünk, havi kvóta alapján
                    automatikusan emelkedik a kedvezményed. A részleteket az
                    első kapcsolatfelvételnél átbeszéljük.
                  </p>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* SERVICES */}
        <section className="bg-stone-wash py-12 md:py-16 border-y border-black/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-3xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                  Egy helyen, ami kell
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Amit egy fedél alatt elintézhetsz
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                {/* Lapszabászat */}
                <Link
                  href="/szolgaltatasok/lapszabaszat-es-elzaras"
                  className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white hover:border-[var(--color-brand)]/40 transition"
                >
                  <div className="relative aspect-[4/3] w-full bg-stone-50">
                    <Image
                      src="/img/BIESSE_SELCO_10660_oriz.jpg"
                      alt="Lapszabászati gép a Hírös-Ablak Kft. üzemében"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 25vw"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="text-base font-semibold tracking-tight text-slate-900">
                      Lapszabászat
                    </div>
                    <p className="mt-1.5 text-sm text-black/70 leading-snug">
                      Bútorlap, HDF, munkalap méretre vágva, optimalizált
                      táblafelhasználással.
                    </p>
                    <div className="mt-auto pt-4 text-xs font-semibold text-[var(--color-brand)] group-hover:underline">
                      Részletek →
                    </div>
                  </div>
                </Link>

                {/* Élzárás */}
                <Link
                  href="/szolgaltatasok/lapszabaszat-es-elzaras"
                  className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white hover:border-[var(--color-brand)]/40 transition"
                >
                  <div className="relative aspect-[4/3] w-full bg-stone-50">
                    <Image
                      src="/img/IMG_8159.jpeg.webp"
                      alt="Élzárás gépi megmunkálás a Hírös-Ablak üzemében"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 25vw"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="text-base font-semibold tracking-tight text-slate-900">
                      Élzárás
                    </div>
                    <p className="mt-1.5 text-sm text-black/70 leading-snug">
                      ABS, élfólia, élléc, élfurnér. Vízzáró gépi élzárás
                      minden vastagságban.
                    </p>
                    <div className="mt-auto pt-4 text-xs font-semibold text-[var(--color-brand)] group-hover:underline">
                      Részletek →
                    </div>
                  </div>
                </Link>

                {/* Munkalap */}
                <Link
                  href="/munkalap"
                  className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white hover:border-[var(--color-brand)]/40 transition"
                >
                  <div className="relative aspect-[4/3] w-full bg-stone-50">
                    <Image
                      src="/img/munkalap_hero.webp"
                      alt="Munkalap kínálat"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 25vw"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="text-base font-semibold tracking-tight text-slate-900">
                      Munkalap
                    </div>
                    <p className="mt-1.5 text-sm text-black/70 leading-snug">
                      Postforming és kompakt munkalap, méretre vágva,
                      élzárva.
                    </p>
                    <div className="mt-auto pt-4 text-xs font-semibold text-[var(--color-brand)] group-hover:underline">
                      Kínálat →
                    </div>
                  </div>
                </Link>

                {/* Barkácsáruház */}
                <Link
                  href="/barkacsaruhaz-kecskemet"
                  className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white hover:border-[var(--color-brand)]/40 transition"
                >
                  <div className="relative aspect-[4/3] w-full bg-stone-50">
                    <Image
                      src="/img/bemutatot_terem.jpg"
                      alt="500 m²-es bemutatóterem a Hírös-Ablak barkácsáruházban, Kecskeméten"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 25vw"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="text-base font-semibold tracking-tight text-slate-900">
                      Barkácsáruházunk
                    </div>
                    <p className="mt-1.5 text-sm text-black/70 leading-snug">
                      Vasalat, pánt, csavar, fogantyú, fiókrendszer, élzáró,
                      ragasztó. Raktárról.
                    </p>
                    <div className="mt-auto pt-4 text-xs font-semibold text-[var(--color-brand)] group-hover:underline">
                      Üzletünk →
                    </div>
                  </div>
                </Link>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* TRUST NUMBERS */}
        <section className="bg-white py-12 md:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  1996 óta dolgozunk asztalosokkal
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <div className="grid gap-4 md:grid-cols-4">
                <StatCard
                  value="30+"
                  label="év Kecskeméten, ugyanazon a helyszínen"
                />
                <StatCard
                  value="100+"
                  label="aktív asztalos partner"
                />
                <StatCard value="3–5" label="munkanap átlagos átfutás" />
                <StatCard
                  value="100%"
                  label="magyar tulajdon, saját üzem"
                />
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-stone-wash py-12 md:py-16 border-y border-black/10">
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
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-8">
              <FaqAccordion items={faqItems} />
            </RevealOnScroll>
          </div>
        </section>

        {/* CONTACT + FORM */}
        <section
          id="kapcsolat"
          className="bg-white py-12 md:py-16 scroll-mt-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Lépj velünk kapcsolatba
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
                <p className="mt-4 text-base md:text-lg text-black/75">
                  Hívj minket, vagy küldd el az adataidat. Visszahívunk és
                  átbeszéljük a részleteket.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
                {/* Contact block */}
                <div className="lg:col-span-5">
                  <div className="rounded-2xl border border-black/10 bg-stone-50/60 p-6 md:p-7 h-full">
                    <div className="text-base font-semibold tracking-tight text-slate-900">
                      Hívj minket
                    </div>
                    <p className="mt-1 text-sm text-black/65">
                      Munkanap 8 és 17 óra között
                    </p>
                    <a
                      href={`tel:${PARTNER_PHONE}`}
                      className="mt-4 flex items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 hover:border-[var(--color-brand)]/40 transition"
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
                          {PARTNER_PHONE_DISPLAY}
                        </div>
                      </div>
                    </a>

                    <div className="mt-6 text-base font-semibold tracking-tight text-slate-900">
                      Vagy gyere be
                    </div>
                    <p className="mt-1 text-sm text-black/65">
                      6000 Kecskemét, Mindszenti krt. 10.
                    </p>
                    <p className="mt-1 text-sm text-black/65">
                      H–P: 8:00–17:00, Szo: 8:00–12:00
                    </p>
                    <a
                      href="https://www.google.com/maps/dir/?api=1&destination=6000+Kecskem%C3%A9t,+Mindszenti+krt.+10."
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold text-black/85 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition"
                    >
                      Útvonaltervezés →
                    </a>
                  </div>
                </div>

                {/* Form */}
                <div className="lg:col-span-7">
                  <div className="rounded-2xl border border-black/10 bg-white p-6 md:p-7">
                    <div className="text-base font-semibold tracking-tight text-slate-900">
                      Kérj visszahívást
                    </div>
                    <p className="mt-1 text-sm text-black/65">
                      Munkanapokon néhány órán belül visszajelzünk.
                    </p>
                    <div className="mt-5">
                      <PartnerForm
                        phoneDisplay={PARTNER_PHONE_DISPLAY}
                        phoneTel={`tel:${PARTNER_PHONE}`}
                        email={PARTNER_EMAIL}
                      />
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
