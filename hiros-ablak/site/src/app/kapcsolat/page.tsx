import Image from "next/image"
import Script from "next/script"
import { getTodayDayIndexBudapest } from "@/lib/opening-hours"
import { RevealOnLoad } from "@/components/site/RevealOnLoad"
import { CopyToClipboardButton } from "@/components/site/CopyToClipboardButton"
import { GpsActions } from "@/components/site/GpsActions"
import { CompanyInfoCard } from "@/components/site/CompanyInfoCard"
import { ContactForm } from "@/components/site/ContactForm"
import { OpeningHoursPill } from "@/components/site/OpeningHoursPill"
import {
  COMPANY,
  appleMapsUrl,
  buildLocalBusinessJsonLd,
  formatLatLngDisplay,
  formatPhoneDisplay,
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
  googleMapsSearchUrl,
  wazeUrl,
} from "@/lib/company"

export const metadata = {
  title: "Kapcsolat",
  description:
    "Hírös-Ablak elérhetőségei: cím, telefon, e-mail, nyitvatartás, GPS koordináták, térkép és kapcsolatfelvételi űrlap. Kecskemét, Mindszenti krt. 10.",
}

const ctaPrimary =
  "inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95"
const ctaSecondary =
  "inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-6 py-3 text-base font-semibold text-black/85 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
const sectionDivider = "my-12 md:my-16 border-t border-black/5"

export default function KapcsolatPage() {
  const today = getTodayDayIndexBudapest()

  const mapHref = googleMapsDirectionsUrl()
  const mapEmbed = googleMapsEmbedUrl()
  const mapSearch = googleMapsSearchUrl()
  const waze = wazeUrl()
  const apple = appleMapsUrl()

  const gpsDisplay = formatLatLngDisplay(
    COMPANY.geo.latitude,
    COMPANY.geo.longitude,
  )

  const jsonLd = buildLocalBusinessJsonLd()

  return (
    <div className="relative bg-stone-wash">
      <Script
        id="jsonld-localbusiness"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="relative bg-grain">
        <RevealOnLoad>
          {/* Section 1 - Full-bleed hero with storefront image */}
          <section
            aria-labelledby="kapcsolat-heading"
            className="relative isolate overflow-hidden"
            data-reveal
          >
            <Image
              src="/img/kapcsolat_hero.jpg"
              alt="HÍRÖS-ABLAK Áruház, Kecskemét, Mindszenti krt. 10."
              fill
              priority
              sizes="100vw"
              className="-z-10 object-cover object-center"
            />
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-gradient-to-r from-black/10 via-black/40 to-black/75"
            />
            <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
              <div className="grid gap-6 md:grid-cols-12 md:items-center">
                <div className="md:col-span-6 md:col-start-7">
                  <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white/85 backdrop-blur">
                    {COMPANY.address.full}
                  </p>
                  <h1
                    id="kapcsolat-heading"
                    className="mt-5 text-balance text-4xl md:text-5xl font-semibold tracking-tight text-white"
                  >
                    Kapcsolat
                  </h1>
                  <div
                    className="mt-4 h-1.5 w-24 rounded-full bg-[var(--color-brand)]"
                    aria-hidden
                  />
                  <p className="mt-4 text-pretty text-base md:text-lg text-white/85">
                    Hívjon, írjon, vagy látogasson el hozzánk az üzletben.
                    Munkanap reggel 8 után általában néhány óra alatt
                    válaszolunk.
                  </p>

                  <div className="mt-5">
                    <OpeningHoursPill />
                  </div>

                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <a
                      href={`tel:${COMPANY.phones.primary}`}
                      className={ctaPrimary}
                    >
                      Beszéljünk telefonon
                    </a>
                    <a
                      href={mapHref}
                      target="_blank"
                      rel="noreferrer"
                      className={ctaSecondary}
                    >
                      Útvonaltervezés
                    </a>
                    <a
                      href={`mailto:${COMPANY.emails.central}`}
                      className={ctaSecondary}
                    >
                      Inkább e-mailt írok
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
            {/* Section 2 - Compact contact panel + sticky map */}
            <section
              aria-labelledby="hol-heading"
              className="grid gap-6 md:grid-cols-12 md:items-start"
              data-reveal
            >
              <h2 id="hol-heading" className="sr-only">
                Elérhetőségek és nyitvatartás
              </h2>

              {/* Left: contact panel with internal sections */}
              <div className="md:col-span-5 rounded-2xl border border-black/10 bg-white p-6 md:p-8">
                {/* Cím */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-black/55">
                      Cím
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-black/90">
                      {COMPANY.address.full}
                    </div>
                  </div>
                  <CopyToClipboardButton
                    text={COMPANY.address.full}
                    className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black/80 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                    label="Cím másolása"
                  />
                </div>

                {/* GPS + map app links (right under Cím, since they belong together) */}
                <div className="mt-5">
                  <div className="text-xs font-medium uppercase tracking-wide text-black/55">
                    GPS koordináták
                  </div>
                  <div className="mt-1 font-mono text-sm text-black/85">
                    {gpsDisplay}
                  </div>
                  <div className="mt-3">
                    <GpsActions
                      latitude={COMPANY.geo.latitude}
                      longitude={COMPANY.geo.longitude}
                      googleMapsUrl={mapSearch}
                      wazeUrl={waze}
                      appleMapsUrl={apple}
                    />
                  </div>
                </div>

                <hr className="my-6 border-t border-black/5" />

                {/* Nyitvatartás */}
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-black/55">
                    Nyitvatartás
                  </div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div
                      className={[
                        "flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2.5",
                        today >= 1 && today <= 5
                          ? "border-l-4 border-l-[var(--color-brand)]"
                          : "",
                      ].join(" ")}
                    >
                      <div className="text-black/75">Hétfő–Péntek</div>
                      <div className="font-semibold text-black/85">
                        {COMPANY.hours.weekdays.opens}–
                        {COMPANY.hours.weekdays.closes}
                      </div>
                    </div>
                    <div
                      className={[
                        "flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2.5",
                        today === 6
                          ? "border-l-4 border-l-[var(--color-brand)]"
                          : "",
                      ].join(" ")}
                    >
                      <div className="text-black/75">Szombat</div>
                      <div className="font-semibold text-black/85">
                        {COMPANY.hours.saturday.opens}–
                        {COMPANY.hours.saturday.closes}
                      </div>
                    </div>
                    <div
                      className={[
                        "flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2.5",
                        today === 7
                          ? "border-l-4 border-l-[var(--color-brand)]"
                          : "",
                      ].join(" ")}
                    >
                      <div className="text-black/75">Vasárnap</div>
                      <div className="font-semibold text-black/85">Zárva</div>
                    </div>
                  </div>
                </div>

                <hr className="my-6 border-t border-black/5" />

                {/* Telefon */}
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-black/55">
                    Telefon
                  </div>
                  <div className="mt-3 grid gap-2 text-base">
                    <a
                      className="underline underline-offset-4 hover:text-[var(--color-brand)]"
                      href={`tel:${COMPANY.phones.primary}`}
                    >
                      {formatPhoneDisplay(COMPANY.phones.primary)}
                    </a>
                    <a
                      className="underline underline-offset-4 hover:text-[var(--color-brand)]"
                      href={`tel:${COMPANY.phones.secondary}`}
                    >
                      {formatPhoneDisplay(COMPANY.phones.secondary)}
                    </a>
                  </div>
                  <div className="mt-2 text-sm text-black/60">
                    Nyitvatartási időben mindkét szám hívható.
                  </div>
                </div>

                <hr className="my-6 border-t border-black/5" />

                {/* E-mail */}
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-black/55">
                    E-mail
                  </div>
                  <p className="mt-2 text-sm text-black/60">
                    Válassza azt a címet, ami a kérdéséhez illik.
                  </p>
                  <div className="mt-3 grid gap-2">
                    <div className="rounded-xl border border-black/10 bg-white px-3 py-2.5">
                      <div className="text-xs font-medium uppercase tracking-wide text-black/55">
                        Áruház, lapszabászat, élzárás
                      </div>
                      <a
                        className="mt-0.5 block text-sm font-semibold underline underline-offset-4 decoration-[var(--color-brand)] hover:text-[var(--color-brand)]"
                        href={`mailto:${COMPANY.emails.procurement}`}
                      >
                        {COMPANY.emails.procurement}
                      </a>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-white px-3 py-2.5">
                      <div className="text-xs font-medium uppercase tracking-wide text-black/55">
                        Számlázás
                      </div>
                      <a
                        className="mt-0.5 block text-sm font-semibold underline underline-offset-4 decoration-[var(--color-brand)] hover:text-[var(--color-brand)]"
                        href={`mailto:${COMPANY.emails.finance}`}
                      >
                        {COMPANY.emails.finance}
                      </a>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-white px-3 py-2.5">
                      <div className="text-xs font-medium uppercase tracking-wide text-black/55">
                        Egyedi bútor és egyéb megkeresés
                      </div>
                      <a
                        className="mt-0.5 block text-sm font-semibold underline underline-offset-4 decoration-[var(--color-brand)] hover:text-[var(--color-brand)]"
                        href={`mailto:${COMPANY.emails.central}`}
                      >
                        {COMPANY.emails.central}
                      </a>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right: tall sticky map */}
              <div className="md:col-span-7 md:sticky md:top-24 md:self-start">
                <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                  <iframe
                    title="Hírös-Ablak, Google Maps"
                    src={mapEmbed}
                    className="block h-full w-full"
                    style={{ border: 0, minHeight: 720 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              </div>
            </section>

            <hr className={sectionDivider} />

            {/* Section 3 - Üzenet form (left) + Cégadatok (right) */}
            <section
              aria-labelledby="uzenet-heading"
              className="grid gap-8 md:grid-cols-12 md:items-start lg:gap-10"
              data-reveal
            >
              {/* Üzenet küldése form */}
              <div className="md:col-span-7">
                <header>
                  <h2
                    id="uzenet-heading"
                    className="text-3xl md:text-4xl font-semibold tracking-tight"
                  >
                    Kapcsolatfelvétel
                  </h2>
                  <p className="mt-3 text-base text-black/70">
                    Írja meg röviden, miben segíthetünk. Munkanapokon felvesszük
                    Önnel a kapcsolatot. Sürgős ügyben kérjük, hívjon minket a
                    fenti telefonszámon.
                  </p>
                </header>
                <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6 md:p-8">
                  <ContactForm />
                </div>
              </div>

              {/* Cégadatok / Impresszum */}
              <div className="md:col-span-5">
                <CompanyInfoCard />
              </div>
            </section>
          </div>
        </RevealOnLoad>
      </div>
    </div>
  )
}
