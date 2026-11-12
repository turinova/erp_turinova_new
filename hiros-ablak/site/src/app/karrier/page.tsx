import type { Metadata } from "next"
import Image from "next/image"
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
import { CareerJobViewTracker } from "@/components/karrier/CareerJobViewTracker"

const phoneTel = `tel:${COMPANY.phones.primary}`
const phoneDisplay = formatPhoneDisplay(COMPANY.phones.primary)

/** Hero képek: barkacsaruhaz-kecskemet + kapcsolat oldalak. */
const STORE_PHOTOS = [
  {
    src: "/img/bemutato_hero.jpg",
    alt: "Hírös-Ablak barkácsáruház bemutatóterem Kecskeméten",
  },
  {
    src: "/img/kapcsolat_hero.jpg",
    alt: "Hírös-Ablak üzlet, Mindszenti krt. 10.",
  },
] as const

export const metadata: Metadata = pageMetadata({
  title: "Bolti eladó állás Kecskemét",
  description:
    "Bolti eladót keresünk Kecskeméten, Mindszenti krt. 10. Hétfő–péntek 7:30-tól 17:00-ig, időnként szombat délelőtt. Jelentkezz: www.hirosablak.hu/karrier vagy személyesen.",
  canonical: "/karrier",
  ogImage: DEFAULT_OG_IMAGE_PATH,
})

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-2 grid gap-1.5">
      {items.map((t) => (
        <li key={t} className="flex gap-2 text-sm text-black/75 sm:text-base">
          <span className="shrink-0 text-[var(--color-brand)]" aria-hidden>
            •
          </span>
          <span className="min-w-0">{t}</span>
        </li>
      ))}
    </ul>
  )
}

type PageProps = {
  searchParams?: Promise<{ cv?: string }>
}

export default async function KarrierPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {}
  const cvRequired = sp.cv !== "optional"

  const jobs = getActiveJobs()
  const job = jobs[0]
  const jobSchemas = jobs.map(buildJobPostingJsonLd)

  return (
    <>
      <script
        id="jsonld-localbusiness-karrier"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildLocalBusinessJsonLd()),
        }}
      />
      <script
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
        <script
          key={jobs[i].slug}
          id={`jsonld-job-${jobs[i].slug}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      {job && <CareerJobViewTracker jobSlug={job.slug} />}

      <div className="bg-stone-wash min-h-[70vh]">
        <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10 lg:py-12">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-brand)]">
              Karrier
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-black/90 sm:text-3xl lg:text-[2.25rem] lg:leading-tight">
              Bolti eladót keresünk
            </h1>
            {job ? (
              <div className="mt-3 rounded-xl border border-[var(--color-brand)]/20 bg-white px-3.5 py-3 text-sm text-black/80 sm:text-base">
                <p className="font-medium text-black/90">
                  Kecskemét, Mindszenti krt. 10.
                </p>
                <p className="mt-1 leading-snug">
                  Hétfő–péntek 7:30-tól 17:00-ig
                </p>
                <p className="mt-0.5 leading-snug text-black/60">
                  Időnként szombat 8:00-tól 12:00-ig
                </p>
                <a
                  href="#jelentkezes"
                  className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-white hover:brightness-95 lg:hidden"
                >
                  Jelentkezem
                </a>
              </div>
            ) : (
              <p className="mt-3 text-base text-black/70">
                Most nincs nyitott állás. Hagyd meg a telefonszámod, szólunk, ha
                lesz.
              </p>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
            {STORE_PHOTOS.map((photo) => (
              <div
                key={photo.src}
                className="relative aspect-[16/10] overflow-hidden rounded-xl border border-black/10 bg-black/5"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(max-width: 640px) 50vw, 420px"
                  className="object-cover"
                  priority
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-black/55">
            Barkácsáruház és bemutatóterem a Mindszenti krt. 10-en.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-5 lg:mt-8 lg:grid-cols-2 lg:items-start lg:gap-7">
            <section
              id="jelentkezes"
              className="order-1 min-w-0 w-full scroll-mt-24 rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-5 lg:order-2 lg:sticky lg:top-24 lg:self-start lg:p-6"
            >
              <h2 className="text-base font-bold text-black/90 sm:text-lg">
                Jelentkezz online
              </h2>
              <p className="mt-1 text-sm text-black/60">
                {cvRequired
                  ? "Három rövid lépés. Önéletrajz szükséges."
                  : "Három rövid lépés. Önéletrajz nem kötelező."}
              </p>
              <div className="mt-4">
                <CareerForm
                  jobSlug={job?.slug ?? "general"}
                  phoneDisplay={phoneDisplay}
                  phoneTel={phoneTel}
                  cvRequired={cvRequired}
                />
              </div>
              <p className="mt-3 text-center text-sm text-black/55 lg:text-left">
                Telefon:{" "}
                <a
                  href={phoneTel}
                  className="font-semibold text-[var(--color-brand)] underline underline-offset-4"
                >
                  {phoneDisplay}
                </a>
              </p>
            </section>

            <div className="order-2 flex min-w-0 w-full flex-col gap-3 lg:order-1">
              {job && (
                <section
                  id={job.slug}
                  className="w-full min-w-0 rounded-2xl border border-black/10 bg-white px-4 py-3 sm:px-5 sm:py-4"
                >
                  <h2 className="text-base font-bold text-black/90 sm:text-lg">
                    {job.title}
                  </h2>
                  <p className="mt-0.5 text-sm leading-snug text-black/50">
                    {job.employmentLabel}
                  </p>

                  <div className="mt-3 divide-y divide-black/10 border-t border-black/10">
                    <details className="group py-2.5" open>
                      <summary className="cursor-pointer list-none text-sm font-semibold text-black/85 marker:content-none [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center justify-between gap-2">
                          Mit csinálsz
                          <span
                            className="shrink-0 text-black/40 transition group-open:rotate-180"
                            aria-hidden
                          >
                            ▾
                          </span>
                        </span>
                      </summary>
                      <BulletList items={job.tasks} />
                    </details>

                    <details className="group py-2.5">
                      <summary className="cursor-pointer list-none text-sm font-semibold text-black/85 marker:content-none [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center justify-between gap-2">
                          Amit kínálunk
                          <span
                            className="shrink-0 text-black/40 transition group-open:rotate-180"
                            aria-hidden
                          >
                            ▾
                          </span>
                        </span>
                      </summary>
                      <BulletList items={job.perks} />
                    </details>

                    <details className="group py-2.5">
                      <summary className="cursor-pointer list-none text-sm font-semibold text-black/85 marker:content-none [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center justify-between gap-2">
                          Elvárások
                          <span
                            className="shrink-0 text-black/40 transition group-open:rotate-180"
                            aria-hidden
                          >
                            ▾
                          </span>
                        </span>
                      </summary>
                      <BulletList items={job.requirements} />
                    </details>
                  </div>
                </section>
              )}

              <section className="flex w-full min-w-0 flex-col gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3.5 sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-black/85">
                    Gyere be hozzánk
                  </p>
                  <p className="mt-1 text-sm leading-snug text-black/70">
                    {COMPANY.address.full}
                  </p>
                  <p className="mt-1 text-sm text-black/55">
                    Hozz magaddal önéletrajzot.
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={googleMapsDirectionsUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-black/15 px-3.5 text-sm font-semibold text-black/80 hover:bg-black/[0.04]"
                  >
                    Útvonal
                  </a>
                  <a
                    href={phoneTel}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-black/15 px-3.5 text-sm font-semibold text-black/80 hover:bg-black/[0.04]"
                  >
                    Hívás
                  </a>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
