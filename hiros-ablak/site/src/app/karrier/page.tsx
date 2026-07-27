import type { Metadata } from "next"
import Script from "next/script"
import {
  pageMetadata,
  DEFAULT_OG_IMAGE_PATH,
  buildBreadcrumbJsonLd,
} from "@/lib/seo"
import {
  COMPANY,
  formatPhoneDisplay,
  googleMapsDirectionsUrl,
  buildLocalBusinessJsonLd,
} from "@/lib/company"
import { getActiveJobs, buildJobPostingJsonLd } from "@/lib/jobs"
import CareerForm from "@/components/karrier/CareerForm"

const phoneTel = `tel:${COMPANY.phones.primary}`
const phoneDisplay = formatPhoneDisplay(COMPANY.phones.primary)

export const metadata: Metadata = pageMetadata({
  title: "Élzárógép-kezelő állás Kecskemét",
  description:
    "Élzárógép-kezelőt keresünk Kecskeméten, teljes munkaidőbe. Stabil munka, modern géppark. Jelentkezz: www.hirosablak.hu/karrier vagy személyesen a Mindszenti krt. 10-ben.",
  canonical: "/karrier",
  ogImage: DEFAULT_OG_IMAGE_PATH,
})

export default function KarrierPage() {
  const jobs = getActiveJobs()
  const job = jobs[0]
  const jobSchemas = jobs.map(buildJobPostingJsonLd)
  const hours = COMPANY.hours

  return (
    <>
      <Script
        id="jsonld-localbusiness-karrier"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildLocalBusinessJsonLd()),
        }}
      />
      <Script
        id="jsonld-breadcrumb-karrier"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBreadcrumbJsonLd([
              { name: "Főoldal", path: "/" },
              { name: "Karrier", path: "/karrier" },
            ]),
          ),
        }}
      />
      {jobSchemas.map((schema, i) => (
        <Script
          key={jobs[i].slug}
          id={`jsonld-job-${jobs[i].slug}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <main className="bg-stone-wash min-h-[70vh]">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
          <header className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-brand)]">
              Karrier
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-black/90 sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
              Élzárógép-kezelőt keresünk
            </h1>
            <p className="mt-3 text-lg leading-relaxed text-black/70 sm:text-xl">
              {job
                ? "Kecskeméti gyártóüzemünkbe, teljes munkaidőbe. Jelentkezz az űrlapon, vagy gyere be személyesen."
                : "Most nincs nyitott állás — hagyd meg a számod, szólunk ha lesz."}
            </p>
          </header>

          <div className="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-2 lg:items-start lg:gap-8">
            <div className="grid gap-6">
              {job && (
                <section
                  id={job.slug}
                  className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6 lg:p-7"
                >
                  <h2 className="text-xl font-bold text-black/90 sm:text-2xl">
                    {job.title}
                  </h2>
                  <p className="mt-2 text-sm text-black/55 sm:text-base">
                    {job.location} · {job.employmentLabel}
                  </p>
                  <ul className="mt-4 grid gap-2.5">
                    {job.tasks.map((t) => (
                      <li
                        key={t}
                        className="flex gap-2 text-base text-black/75 sm:text-[17px]"
                      >
                        <span className="text-[var(--color-brand)]" aria-hidden>
                          •
                        </span>
                        {t}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 rounded-xl bg-black/[0.03] px-4 py-3 text-base leading-snug text-black/75">
                    Faipari tapasztalat vagy termelőgép-kezelés előny — precíz,
                    rendezett munkavégzés.
                  </p>
                </section>
              )}

              <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6 lg:p-7">
                <h2 className="text-lg font-bold text-black/90 sm:text-xl">
                  Gyere be az üzletbe
                </h2>
                <p className="mt-2 text-base text-black/70">
                  Személyesen is jelentkezhetsz a székhelyünkön.
                </p>
                <p className="mt-4 text-base font-medium text-black/85 sm:text-lg">
                  {COMPANY.address.full}
                </p>
                <p className="mt-1 text-sm text-black/55 sm:text-base">
                  H–P {hours.weekdays.opens}–{hours.weekdays.closes}
                  {" · "}
                  Szo {hours.saturday.opens}–{hours.saturday.closes}
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <a
                    href={googleMapsDirectionsUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-black/15 bg-white px-4 py-3 text-base font-semibold text-black/85 hover:bg-black/[0.04]"
                  >
                    Útvonal a térképen
                  </a>
                  <a
                    href={phoneTel}
                    className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-black/15 bg-white px-4 py-3 text-base font-semibold text-black/85 hover:bg-black/[0.04]"
                  >
                    Hívj: {phoneDisplay}
                  </a>
                </div>
              </section>
            </div>

            <section
              id="jelentkezes"
              className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24 lg:p-7"
            >
              <h2 className="text-lg font-bold text-black/90 sm:text-xl">
                Jelentkezz online
              </h2>
              <p className="mt-2 text-base text-black/70">
                Név, telefon, e-mail. Önéletrajz nem kötelező.
              </p>
              <div className="mt-5">
                <CareerForm
                  jobSlug={job?.slug ?? "general"}
                  phoneDisplay={phoneDisplay}
                  phoneTel={phoneTel}
                />
              </div>
              <p className="mt-4 text-center text-base text-black/60 lg:text-left">
                Inkább telefonon?{" "}
                <a
                  href={phoneTel}
                  className="font-semibold text-[var(--color-brand)] underline underline-offset-4"
                >
                  {phoneDisplay}
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
