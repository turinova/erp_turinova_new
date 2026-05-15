import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import Script from "next/script"
import { DEFAULT_OG_IMAGE_PATH, pageMetadata } from "@/lib/seo"
import { RevealOnLoad } from "@/components/site/RevealOnLoad"
import { RevealOnScroll } from "@/components/site/RevealOnScroll"
import { COMPANY } from "@/lib/company"
import { LINKS } from "@/lib/links"
import OptiMockup from "@/components/online-lapszabaszat/OptiMockup"
import SavedQuotesMockup from "@/components/online-lapszabaszat/SavedQuotesMockup"
import OrdersMockup from "@/components/online-lapszabaszat/OrdersMockup"
import PhoneSmsMockup from "@/components/online-lapszabaszat/PhoneSmsMockup"
import BeforeAfter from "@/components/online-lapszabaszat/BeforeAfter"

export const metadata: Metadata = pageMetadata({
  title: "Online lapszabászati rendelés Kecskeméten",
  description:
    "Saját fejlesztésű online lapszabászati rendelő rendszer. Adja meg a panelek méreteit és élzárását, a rendszer kiszámolja a pontos árat. Mentett projektek, online rendelés, valós idejű követés és automatikus SMS értesítés. A HÍRÖS-Ablak Kft. Turinova rendszere.",
  canonical: "/szolgaltatasok/online-lapszabaszat",
  ogImage: DEFAULT_OG_IMAGE_PATH,
})

const ctaPrimary =
  "inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95 transition"
const ctaPrimaryDark =
  "inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95 transition shadow-[0_8px_28px_rgba(151,29,37,0.35)]"
const ctaSecondaryDark =
  "inline-flex items-center justify-center rounded-full border border-white/30 bg-white/5 px-6 py-3 text-base font-semibold text-white hover:bg-white/10 transition"
const ctaSecondaryLight =
  "inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-6 py-3 text-base font-semibold text-black/85 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition"

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

function FeatureCard({
  title,
  desc,
  icon,
}: {
  title: string
  desc: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 hover:border-[var(--color-brand)]/40 transition">
      <div className="w-10 h-10 rounded-lg bg-[var(--color-brand)]/8 text-[var(--color-brand)] flex items-center justify-center">
        {icon}
      </div>
      <p className="mt-3 text-base font-semibold tracking-tight text-slate-900">
        {title}
      </p>
      <p className="mt-1 text-sm text-black/65 leading-snug">{desc}</p>
    </div>
  )
}

function StepNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex w-12 h-12 rounded-full bg-[var(--color-brand)] text-white items-center justify-center text-xl font-semibold"
    >
      {n}
    </span>
  )
}

export default function OnlineLapszabaszatPage() {
  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Online lapszabászati rendelés",
    serviceType: "Online lapszabászati rendelés",
    description:
      "Saját fejlesztésű online lapszabászati rendelő rendszer asztalosoknak. Panellistából azonnali árajánlat, mentett projektek, vizuális szabásterv, online beküldés, valós idejű követés és SMS értesítés.",
    areaServed: { "@type": "Country", name: "Magyarország" },
    provider: {
      "@type": "LocalBusiness",
      name: COMPANY.brand,
      url: COMPANY.website,
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
      audienceType: "Asztalosok és bútorgyártók",
    },
    offers: {
      "@type": "Offer",
      url: LINKS.register,
      availability: "https://schema.org/InStock",
      priceCurrency: "HUF",
    },
  }

  return (
    <div className="relative">
      <Script
        id="jsonld-service-online-lapszabaszat"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />

      <RevealOnLoad>
        {/* ============================================================== */}
        {/* HERO                                                            */}
        {/* ============================================================== */}
        <section
          className="relative isolate overflow-hidden"
          style={{
            background:
              "linear-gradient(160deg, #0f172a 0%, #1f2937 45%, #111827 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(151,29,37,0.32) 0%, transparent 65%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-24 h-[420px] w-[420px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 65%)",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left side: copy */}
              <div className="order-2 lg:order-1 lg:col-span-6">
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white/85 backdrop-blur">
                    Kecskemét · 1996 óta · Saját fejlesztésű rendszer
                  </p>
                  <span className="inline-flex items-center rounded-md bg-white/95 px-2.5 py-1 shadow-sm">
                    <Image
                      src="/img/turinova_logo.png"
                      alt="Turinova"
                      width={2500}
                      height={487}
                      style={{ height: "auto", width: "82px" }}
                      priority
                    />
                  </span>
                </div>

                <h1 className="mt-5 text-balance text-4xl md:text-5xl font-semibold tracking-tight text-white">
                  Méretek, anyag, élzárás egy helyen. A vágást és élzárást mi
                  végezzük.
                </h1>

                <div
                  className="mt-4 h-1.5 w-24 rounded-full bg-[var(--color-brand)]"
                  aria-hidden
                />

                <p className="mt-4 max-w-xl text-pretty text-base md:text-lg text-white/85">
                  Adja meg a paneleket: méret, anyag, élzárás. Az árat
                  azonnal látja, a projektet pedig elmentheti.
                </p>

                <ul className="mt-6 grid gap-2.5 max-w-md">
                  <Bullet>
                    Azonnali, panelenkénti árazás regisztráció után
                  </Bullet>
                  <Bullet>
                    Mentett projektek, később bármikor folytathatók
                  </Bullet>
                  <Bullet>
                    Vizuális szabásterv és PDF letöltés a rendelés előtt
                  </Bullet>
                  <Bullet>Automatikus SMS értesítés a gyártás elkészültekor</Bullet>
                </ul>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href={LINKS.register}
                    target="_blank"
                    rel="noreferrer"
                    className={ctaPrimaryDark}
                  >
                    Online árajánlat, kb. 2 perc
                  </a>
                  <a href="#hogyan-mukodik" className={ctaSecondaryDark}>
                    Hogyan működik?
                  </a>
                </div>

                <p className="mt-5 text-xs text-white/55">
                  3–5 munkanap, árajánlatban pontosítva · Átvétel Kecskeméten
                </p>
              </div>

              {/* Right side: input phase mockup */}
              <div className="order-1 lg:order-2 lg:col-span-6 flex justify-center lg:justify-end">
                <div className="relative w-full max-w-[640px]">
                  <OptiMockup variant="input" />

                  <div className="hidden md:flex absolute -top-4 -left-4 items-center gap-2 bg-white rounded-xl border border-slate-200 shadow-md px-3 py-2 max-w-[230px]">
                    <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625"
                        />
                      </svg>
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 leading-tight">
                        Asztalos-pontos űrlap
                      </p>
                      <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                        Szálirány, élzárás 4 oldalon
                      </p>
                    </div>
                  </div>

                  <div className="hidden md:flex absolute -bottom-5 -right-4 items-center gap-2 bg-white rounded-xl border border-slate-200 shadow-md px-3 py-2 max-w-[230px]">
                    <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 leading-tight">
                        Azonnali árazás
                      </p>
                      <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                        Pánthely, duplungolás, szögvágás
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* BEFORE / AFTER                                                  */}
        {/* ============================================================== */}
        <section className="bg-stone-wash py-10 md:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="max-w-2xl">
                <h2 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Hogyan változik a folyamat?
                </h2>
                <div
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                  aria-hidden
                />
                <p className="mt-4 text-base md:text-lg text-black/75">
                  Az árajánlatot, a szabástervet és a rendelés állapotát
                  egyetlen felületen kezeli. Telefonos egyeztetés és e-mailezés
                  helyett az Ön saját ütemezésében.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-8">
              <BeforeAfter />
            </RevealOnScroll>
          </div>
        </section>

        {/* ============================================================== */}
        {/* HOGYAN MŰKÖDIK / Opti spotlight                                 */}
        {/* ============================================================== */}
        <section
          id="hogyan-mukodik"
          className="relative overflow-hidden py-12 md:py-16 bg-white"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-brand)]/30 to-transparent"
          />

          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="max-w-3xl">
                <h2 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Optimalizálás és árajánlat
                </h2>
                <div
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                  aria-hidden
                />
                <p className="mt-4 text-base md:text-lg text-black/75">
                  A panelek megadása után a rendszer optimalizálja a
                  táblafelhasználást a szálirány figyelembe vételével, és
                  tételesen árazza a rendelést. A szabásterv és a végösszeg
                  ugyanazon a felületen látható.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-8">
              <div className="relative">
                <div
                  className="absolute -inset-6 -z-10 rounded-[2rem] opacity-60"
                  style={{
                    background:
                      "radial-gradient(60% 60% at 50% 50%, rgba(151,29,37,0.10), transparent 70%)",
                  }}
                  aria-hidden
                />
                <div className="flex justify-center">
                  <OptiMockup variant="result" />
                </div>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.15}>
              <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SubStep
                  n={1}
                  title="Optimalizálás"
                  desc="A rendszer kiszámolja a táblafelhasználást, szálirány figyelembe véve."
                />
                <SubStep
                  n={2}
                  title="Vizuális szabásterv"
                  desc="Anyagonként látható az elrendezés, a szegélyezés és a hulladék."
                />
                <SubStep
                  n={3}
                  title="Tételes árajánlat"
                  desc="Tábla, élzárás, vágási díj és megmunkálás nettó, ÁFA és bruttó bontásban."
                />
                <SubStep
                  n={4}
                  title="Mentés vagy beküldés"
                  desc="PDF letöltés, projektmentés vagy közvetlen rendelésbeküldés."
                />
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ============================================================== */}
        {/* WORKFLOW: saved, orders, SMS                                    */}
        {/* ============================================================== */}
        <section className="bg-stone-wash py-12 md:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="max-w-3xl">
                <h2 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Mentés, beküldés, követés
                </h2>
                <div
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                  aria-hidden
                />
                <p className="mt-4 text-base md:text-lg text-black/75">
                  A projektjei mentve maradnak. A beküldött rendelések
                  állapotát valós időben látja. Amikor a panelek
                  elkészültek, automatikus SMS-ben jelezzük.
                </p>
              </div>
            </RevealOnScroll>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              <RevealOnScroll>
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <StepNumber n={1} />
                    <div>
                      <p className="text-base font-semibold tracking-tight text-slate-900">
                        Mentés
                      </p>
                      <p className="text-sm text-black/60">Projektarchívum</p>
                    </div>
                  </div>
                  <SavedQuotesMockup />
                  <p className="mt-4 text-sm text-black/70 leading-snug">
                    Több projekt párhuzamosan, mind elmentve. Bármikor
                    visszatérhet, módosíthat, újraárazhat.
                  </p>
                </div>
              </RevealOnScroll>

              <RevealOnScroll delay={0.1}>
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <StepNumber n={2} />
                    <div>
                      <p className="text-base font-semibold tracking-tight text-slate-900">
                        Beküldés
                      </p>
                      <p className="text-sm text-black/60">
                        Online rendelés és követés
                      </p>
                    </div>
                  </div>
                  <OrdersMockup />
                  <p className="mt-4 text-sm text-black/70 leading-snug">
                    A beküldés egy kattintás. Ezt követően látja, hogy a
                    rendelése besorolásra vár, gyártásban van vagy átvehető.
                  </p>
                </div>
              </RevealOnScroll>

              <RevealOnScroll delay={0.2}>
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <StepNumber n={3} />
                    <div>
                      <p className="text-base font-semibold tracking-tight text-slate-900">
                        SMS, ha kész
                      </p>
                      <p className="text-sm text-black/60">
                        Nem kell telefonálnia
                      </p>
                    </div>
                  </div>
                  <PhoneSmsMockup />
                  <p className="mt-4 text-sm text-black/70 leading-snug">
                    Amint a panelek elkészültek, automatikus SMS-ben
                    jelezzük. Az átvétel Kecskeméten, az áruházunkban.
                  </p>
                </div>
              </RevealOnScroll>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* FUNCTIONS GRID                                                  */}
        {/* ============================================================== */}
        <section className="bg-white py-12 md:py-14 border-y border-black/10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="max-w-2xl">
                <h2 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  A rendszer funkciói
                </h2>
                <div
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                  aria-hidden
                />
                <p className="mt-4 text-base text-black/70">
                  A lapszabászati rendelés minden lépése egyetlen felületen,
                  böngészőből elérhető.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1}>
              <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <FeatureCard
                  title="Élzárás 4 oldalon"
                  desc="Minden panelnél, oldalanként külön kérheti."
                  icon={
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 6h16.5M3.75 12h16.5M3.75 18h16.5"
                      />
                    </svg>
                  }
                />
                <FeatureCard
                  title="Pontos méretek"
                  desc="Milliméter pontosan, az Ön rajzai alapján."
                  icon={
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5"
                      />
                    </svg>
                  }
                />
                <FeatureCard
                  title="Anyagkatalógus"
                  desc="A nálunk forgalmazott márkák raktárkészletből."
                  icon={
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 15.75 7.5 10.5l4.72 4.72a.75.75 0 0 0 1.06 0l3.97-3.97 4.5 4.5M21.75 15.75v-7.5A2.25 2.25 0 0 0 19.5 6h-15a2.25 2.25 0 0 0-2.25 2.25v7.5A2.25 2.25 0 0 0 4.5 18h15a2.25 2.25 0 0 0 2.25-2.25Z"
                      />
                    </svg>
                  }
                />
                <FeatureCard
                  title="Azonnali árazás"
                  desc="A rendszer azonnal kalkulál, nem kell ajánlatra várnia."
                  icon={
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z" />
                    </svg>
                  }
                />
                <FeatureCard
                  title="PDF szabásterv"
                  desc="Letölthető, archiválható, megosztható."
                  icon={
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                      />
                    </svg>
                  }
                />
                <FeatureCard
                  title="SMS értesítés"
                  desc="Megírjuk, amint a panelek elkészültek."
                  icon={
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.5 1.875a1.125 1.125 0 0 1 2.25 0v8.219c.517.162 1.02.382 1.5.659V3.375a1.125 1.125 0 0 1 2.25 0v10.937a4.505 4.505 0 0 0-3.25 2.373 8.963 8.963 0 0 1 4-.935A.75.75 0 0 0 18 15v-2.266a3.368 3.368 0 0 1 .988-2.37 1.125 1.125 0 0 1 1.591 1.59 1.118 1.118 0 0 0-.329.79v3.006h-.005a6 6 0 0 1-1.752 4.007l-1.736 1.736a6 6 0 0 1-4.242 1.757H10.5a7.5 7.5 0 0 1-7.5-7.5V6.375a1.125 1.125 0 0 1 2.25 0v5.519c.46-.452.965-.832 1.5-1.141V3.375a1.125 1.125 0 0 1 2.25 0v6.526c.495-.1.997-.151 1.5-.151V1.875Z"
                      />
                    </svg>
                  }
                />
                <FeatureCard
                  title="Valós idejű követés"
                  desc="Lássa, hogy a rendelése hol tart a gyártásban."
                  icon={
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                      />
                    </svg>
                  }
                />
                <FeatureCard
                  title="Online rendelés"
                  desc="E-mail és telefon nélkül, egy kattintással."
                  icon={
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
                      />
                    </svg>
                  }
                />
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ============================================================== */}
        {/* 3 STEPS                                                          */}
        {/* ============================================================== */}
        <section className="bg-white py-12 md:py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="max-w-2xl">
                <h2 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Hogyan kezdjen hozzá?
                </h2>
                <div
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                  aria-hidden
                />
                <p className="mt-4 text-base text-black/70">
                  Három lépés a regisztrációtól az első rendelésig.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1}>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <BigStep
                  n={1}
                  title="Regisztráció"
                  desc="Egy perc, e-mail cím és jelszó. Bankkártya nem szükséges."
                />
                <BigStep
                  n={2}
                  title="Első projekt"
                  desc="Anyag, méretek, élzárás. A rendszer azonnal kalkulálja az árat."
                />
                <BigStep
                  n={3}
                  title="Beküldés"
                  desc="Készen áll? Egy kattintás. SMS-t küldünk, ha a gyártás kész."
                />
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ============================================================== */}
        {/* CLOSING CTA                                                     */}
        {/* ============================================================== */}
        <section
          className="relative isolate overflow-hidden py-12 md:py-16"
          style={{
            background:
              "linear-gradient(160deg, #0f172a 0%, #1f2937 50%, #111827 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(151,29,37,0.30) 0%, transparent 65%)",
            }}
          />

          <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
            <span className="inline-flex items-center rounded-md bg-white/95 px-3 py-1.5 shadow-sm">
              <Image
                src="/img/turinova_logo.png"
                alt="Turinova"
                width={2500}
                height={487}
                style={{ height: "auto", width: "154px" }}
              />
            </span>

            <h2 className="mt-5 text-balance text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-white">
              Indítson el egy projektet 2 perc alatt
            </h2>
            <div
              className="mt-4 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
              aria-hidden
            />
            <p className="mt-5 text-base md:text-lg text-white/85">
              A regisztráció ingyenes, e-mail-cím és jelszó. Az anyagválasztásnál
              a teljes raktárkészletünk elérhető: fenyő, OSB, bútorlap, munkalap.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center sm:items-center">
              <a
                href={LINKS.register}
                target="_blank"
                rel="noreferrer"
                className={ctaPrimaryDark}
              >
                Online árajánlat, kb. 2 perc
              </a>
              <Link
                href="/szolgaltatasok/lapszabaszat-es-elzaras"
                className={ctaSecondaryDark}
              >
                A lapszabászati szolgáltatás
              </Link>
            </div>

            <p className="mt-6 text-xs text-white/55">
              A Turinova rendszert a HÍRÖS-Ablak Kft. fejleszti és üzemelteti{" "}
              {COMPANY.address.city}en, 1996 óta.
            </p>
          </div>
        </section>
      </RevealOnLoad>
    </div>
  )
}

function SubStep({
  n,
  title,
  desc,
}: {
  n: number
  title: string
  desc: string
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand)]">
        {n}. lépés
      </p>
      <p className="mt-1 text-base font-semibold tracking-tight text-slate-900">
        {title}
      </p>
      <p className="mt-1 text-sm text-black/65 leading-snug">{desc}</p>
    </div>
  )
}

function BigStep({
  n,
  title,
  desc,
}: {
  n: number
  title: string
  desc: string
}) {
  return (
    <div className="text-center">
      <div className="inline-flex w-14 h-14 rounded-2xl bg-[var(--color-brand)] text-white items-center justify-center text-2xl font-semibold">
        {n}
      </div>
      <p className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
        {title}
      </p>
      <p className="mt-1.5 text-sm text-black/70 leading-snug">{desc}</p>
    </div>
  )
}
