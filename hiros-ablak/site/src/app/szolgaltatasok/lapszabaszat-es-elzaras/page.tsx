import Link from "next/link"
import Image from "next/image"
import Script from "next/script"
import { RevealOnLoad } from "@/components/site/RevealOnLoad"
import { RevealOnScroll } from "@/components/site/RevealOnScroll"
import { OpeningHoursPill } from "@/components/site/OpeningHoursPill"
import {
  COMPANY,
  buildLocalBusinessJsonLd,
  formatPhoneDisplay,
  googleMapsDirectionsUrl,
} from "@/lib/company"
import { LINKS } from "@/lib/links"
import { getSupabaseServerClient } from "@/lib/supabase"

export const revalidate = 3600

async function fetchDistinctBrands(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return []

  try {
    const supabase = getSupabaseServerClient()
    const [butorlapRes, munkalapRes] = await Promise.all([
      supabase.from("public_butorlap").select("brand_name"),
      supabase.from("public_munkalap").select("brand_name"),
    ])

    const set = new Set<string>()
    for (const row of (butorlapRes.data as { brand_name: string | null }[]) || []) {
      if (row.brand_name) set.add(row.brand_name.trim())
    }
    for (const row of (munkalapRes.data as { brand_name: string | null }[]) || []) {
      if (row.brand_name) set.add(row.brand_name.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "hu"))
  } catch {
    return []
  }
}

export const metadata = {
  title: "Lapszabászat és élzárás Kecskeméten",
  description:
    "Lapszabászat és élzárás Kecskeméten: bútorlap méretre vágás optimalizált táblafelosztással, ABS / élfólia / élléc / élfurnér élzárás, munkalap megmunkálás, pánthelyfúrás. Átfutás: 3–5 munkanap, az ajánlatban pontosítva. Megmunkálás a nálunk vásárolt anyagokra.",
}

const ctaPrimary =
  "inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95"
const ctaSecondary =
  "inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-6 py-3 text-base font-semibold text-black/85 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 rounded-xl border border-black/10 bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
        {label}
      </div>
      <div className="text-sm font-semibold text-black/85">{value}</div>
    </div>
  )
}

function ServiceCard({
  title,
  desc,
  bullets,
  href,
  hrefLabel,
}: {
  title: string
  desc: string
  bullets: string[]
  href?: string
  hrefLabel?: string
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 md:p-7">
      <div className="text-lg font-semibold tracking-tight">{title}</div>
      <p className="mt-2 text-sm text-black/70">{desc}</p>
      <ul className="mt-4 grid gap-2 text-sm text-black/75">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span aria-hidden className="mt-0.5 text-emerald-600">
              ✓
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {href && hrefLabel && (
        <div className="mt-5">
          <Link
            href={href}
            className="inline-flex items-center font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]"
          >
            {hrefLabel} →
          </Link>
        </div>
      )}
    </div>
  )
}

function MachineParkMedia({
  title,
  images,
}: {
  title: string
  images: string[]
}) {
  if (images.length === 0) {
    return null
  }

  if (images.length === 1) {
    return (
      <div className="relative aspect-[4/3] w-full bg-stone-50">
        <Image
          src={images[0]}
          alt={title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.01]"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>
    )
  }

  return (
    <div className="relative aspect-[4/3] w-full bg-stone-100 grid grid-cols-2 gap-px">
      {images.map((src, idx) => (
        <div key={`${src}-${idx}`} className="relative h-full min-h-0 w-full">
          <Image
            src={src}
            alt={`${title} (${idx + 1}. fotó)`}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.01]"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        </div>
      ))}
    </div>
  )
}

export default async function LapszabaszatEsElzarasPage() {
  const phoneDisplay = formatPhoneDisplay(COMPANY.phones.primary)
  const phoneTel = `tel:${COMPANY.phones.primary}`
  const directionsUrl = googleMapsDirectionsUrl()

  const localBusinessJsonLd = buildLocalBusinessJsonLd()
  const brands = await fetchDistinctBrands()

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Lapszabászat és élzárás",
    areaServed: {
      "@type": "AdministrativeArea",
      name: "Bács-Kiskun megye",
    },
    provider: {
      "@type": "LocalBusiness",
      name: COMPANY.brand,
      url: COMPANY.website,
      telephone: phoneDisplay,
      address: {
        "@type": "PostalAddress",
        streetAddress: COMPANY.address.street,
        postalCode: COMPANY.address.postalCode,
        addressLocality: COMPANY.address.city,
        addressCountry: COMPANY.address.countryCode,
      },
    },
    serviceType: [
      "Bútorlap lapszabászat",
      "Élzárás (ABS, élfólia, élléc, élfurnér)",
      "Munkalap megmunkálás",
      "Pánthelyfúrás",
      "Szögvágás",
      "Íves vágás",
      "Falcolás",
      "Duplungolás",
    ],
  }

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Mennyi idő alatt készül el?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Raktári anyagból 3–5 munkanapon belül készre dolgozzuk; a pontos napot az árajánlat tartalmazza. Elkészültéről automatikus SMS-t küldünk. Online rendelésnél a gyártás állapota is követhető.",
        },
      },
      {
        "@type": "Question",
        name: "Hogyan tudok rendelni?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Háromféleképpen: személyesen az áruházban, e-mailben, vagy online a Turinova rendszerben. Mindhárom esetben megadja az anyagot, a méreteket és hogy melyik élre kér élzárást. Ezután mi elkészítjük az árajánlatot.",
        },
      },
      {
        "@type": "Question",
        name: "Milyen élzárással dolgoznak?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Négyféle élzárás közül választhat: ABS (0,4 / 1 / 2 mm vastagságban, matt és fényes kivitelben), élfólia, élléc és élfurnér. Minden forgalmazott márkához színazonos ABS és élfólia élanyagot biztosítunk.",
        },
      },
      {
        "@type": "Question",
        name: "Vállalnak hozott anyagot?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Jelenleg nem. A megmunkálást a nálunk vásárolt bútorlapra és munkalapra vállaljuk.",
        },
      },
      {
        "@type": "Question",
        name: "Hol tudom átvenni?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Személyesen Kecskeméten, az áruházunkban: ${COMPANY.address.full}. A paneleket raklapra rakva, összepakolva adjuk át.`,
        },
      },
    ],
  }

  return (
    <div className="relative bg-stone-wash">
      <Script
        id="jsonld-localbusiness"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <Script
        id="jsonld-service-lapszabaszat"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <Script
        id="jsonld-faq-lapszabaszat"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <RevealOnLoad>
        {/* Full-bleed hero with workshop background */}
        <section
          className="relative isolate overflow-hidden"
          data-reveal
        >
          <Image
            src="/img/BIESSE_SELCO_10660_oriz.jpg"
            alt="Automata táblafelosztó, lapszabászat műhely a Hírös-Ablak üzemében"
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover object-center"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/60 to-black/35"
          />
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
            <div className="grid gap-6 md:grid-cols-12 md:items-start">
              <div className="md:col-span-7">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white/85 backdrop-blur">
                  Kecskemét · 1996 óta · 1500 m²-es üzem
                </p>
                <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl">
                  Méretre vágva. Élzárva. Azonnal elvihető.
                </h1>
                <div
                  className="mt-4 h-1.5 w-24 rounded-full bg-[var(--color-brand)]"
                  aria-hidden
                />
                <p className="mt-4 max-w-2xl text-pretty text-base md:text-lg text-white/85">
                  Bútorlap, munkalap, hátfal, méretre vágva, élzárva, átvételre készen.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href={LINKS.register}
                    target="_blank"
                    rel="noreferrer"
                    className={ctaPrimary}
                  >
                    Online árajánlat, kb. 2 perc
                  </a>
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={ctaSecondary}
                  >
                    Útvonaltervezés
                  </a>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/75">
                  <a className="font-semibold text-white underline underline-offset-4 hover:text-[var(--color-brand)]" href={phoneTel}>
                    Telefon: {phoneDisplay}
                  </a>
                  <span className="text-white/45" aria-hidden>
                    •
                  </span>
                  <Link className="font-semibold text-white underline underline-offset-4 hover:text-[var(--color-brand)]" href="/kapcsolat">
                    Kapcsolat →
                  </Link>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <Link className="font-semibold text-white underline underline-offset-4 hover:text-[var(--color-brand)]" href="/butorlap">
                    Bútorlap katalógus →
                  </Link>
                  <Link className="font-semibold text-white underline underline-offset-4 hover:text-[var(--color-brand)]" href="/munkalap">
                    Munkalap katalógus →
                  </Link>
                </div>
              </div>

              <div className="md:col-span-5">
                <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-2xl shadow-black/20 md:p-7">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-black/85">Áruházunk és határidő</div>
                    <OpeningHoursPill />
                  </div>
                  <div className="mt-4 grid gap-2">
                    <SpecItem label="Cím" value={COMPANY.address.full} />
                    <SpecItem label="Átfutás" value="3–5 munkanap" />
                    <SpecItem label="Online rendelés" value="Követhető gyártás, automata SMS" />
                  </div>
                  <div className="mt-5 grid gap-3">
                    <a
                      href={LINKS.register}
                      target="_blank"
                      rel="noreferrer"
                      className={ctaPrimary}
                    >
                      Online árajánlat, kb. 2 perc
                    </a>
                    <div className="flex gap-3">
                      <a href={phoneTel} className={ctaSecondary}>
                        Hívom
                      </a>
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={ctaSecondary}
                      >
                        Térkép
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="relative bg-grain">
          <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
            {/* Trust strip */}
            <RevealOnScroll>
              <section className="grid gap-3 rounded-2xl border border-black/10 bg-white p-5 md:grid-cols-3 md:p-6">
                <div>
                  <div className="text-2xl font-semibold tracking-tight">Közel 30 éve</div>
                  <div className="mt-1 text-sm text-black/65">
                    1996 óta szolgáljuk a régió asztalosait, bútorgyártóit és belsőépítészeit.
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-semibold tracking-tight">1500 m²-es üzem</div>
                  <div className="mt-1 text-sm text-black/65">
                    Saját műhely Kecskeméten, a Mindszenti körút 10. szám alatt.
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-semibold tracking-tight">Több márka raktáron</div>
                  <div className="mt-1 text-sm text-black/65">
                    A legismertebb bútorlap- és munkalap-márkák. A legtöbb dekor azonnal elérhető.
                  </div>
                </div>
              </section>
            </RevealOnScroll>

            {/* About / intro */}
            <RevealOnScroll className="mt-14">
              <section className="rounded-2xl border border-black/10 bg-white p-6 md:p-8">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Miért hozzánk forduljon?
                </h2>
                <div className="mt-4 grid gap-4 text-base text-black/75 md:grid-cols-2">
                  <p>
                    Mert 1996 óta minden kecskeméti asztalos ismeri a számunkat.
                    És pont ezt nem akarjuk elveszíteni. 1500 m²-es üzemünkben
                    automata táblafelosztó és élzáró gépeken dolgozunk,
                    optimalizált táblafelhasználással, minimális hulladékkal és a
                    lehető legkedvezőbb áron.
                  </p>
                  <p>
                    Bútorlap, munkalap, élzáró és vasalat egy fedél alatt,
                    raktárról. Raktári anyagból három és öt munkanapon belül készre
                    dolgozzuk a megrendelést, és
                    SMS-ben szólunk, amint kész. Online rendelésnél valós időben
                    látja, hol tart a gyártás.
                  </p>
                </div>
              </section>
            </RevealOnScroll>

            {/* Machines: 4 equal cards */}
            <RevealOnScroll className="mt-14">
              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight">Géppark</h2>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {[
                    {
                      images: [
                        "/img/IMG_8160+2.jpeg.webp",
                        "/img/IMG_8164.jpeg.webp",
                      ],
                      title: "Bútorlap táblafelosztó",
                      desc: "Bútorlapot szabunk méretre optimalizált táblafelosztással.",
                      specs: [
                        "Optimalizált táblafelosztás",
                        "Kevesebb hulladék, kedvezőbb ár",
                        "Raklapra rakva, átvételre kész",
                      ],
                    },
                    {
                      images: [
                        "/img/IMG_8159.jpeg.webp",
                        "/img/IMG_8163.jpeg.webp",
                      ],
                      title: "Élzáró gép",
                      desc: "Vízzáró élzárás bútorlapra és munkalapra.",
                      specs: [
                        "ABS (0,4 / 1 / 2 mm), matt vagy fényes",
                        "Élfólia, élléc, élfurnér",
                        "Színazonos ABS és élfólia minden márkához",
                      ],
                    },
                    {
                      images: [] as string[],
                      title: "Munkalap megmunkálás",
                      desc: "Méretre vágás és kivágások a megrendelt méretek alapján.",
                      specs: [
                        "Méretre vágás, szögvágás, íves vágás",
                        "Főzőlap-kivágás és mosogató kivágás",
                        "Kérésre a postforming él helyett ABS élzárás",
                      ],
                    },
                    {
                      images: [] as string[],
                      title: "Pánthelyfúrás",
                      desc: "Bútorlap, MDF és akril front ajtópánt-hellyel előfúrva, megadott méretek szerint.",
                      specs: [
                        "Bútorlap, MDF, akril front",
                        "Ajtópánt-hely befúrva (35 mm)",
                        "Beépítésre kész lapok",
                      ],
                    },
                  ].map((m) => (
                    <div
                      key={m.title}
                      className="group overflow-hidden rounded-2xl border border-black/10 bg-white"
                    >
                      <MachineParkMedia title={m.title} images={m.images} />
                      <div className="p-6 md:p-7">
                        <div className="text-lg font-semibold tracking-tight">{m.title}</div>
                        <p className="mt-2 text-sm text-black/70">{m.desc}</p>
                        <ul className="mt-4 grid gap-1.5 text-sm text-black/75">
                          {m.specs.map((s) => (
                            <li key={s} className="flex gap-2">
                              <span aria-hidden className="text-[var(--color-brand)]">
                                •
                              </span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </RevealOnScroll>

            {/* How it works */}
            <RevealOnScroll className="mt-14">
              <section className="rounded-2xl border border-black/10 bg-white p-6 md:p-8">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Hogyan rendelhet?
                </h2>
                <p className="mt-2 text-sm text-black/65">
                  Háromféleképpen: személyesen, e-mailben vagy online. Mindhárom esetben
                  megadja az anyagot és a méreteket, mi elkészítjük az árajánlatot.
                </p>

                <ol className="mt-6 grid gap-4 md:grid-cols-3">
                  <li className="rounded-xl border border-black/10 bg-stone-50/60 p-5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
                      1. lépés
                    </div>
                    <div className="mt-1 text-base font-semibold text-black/90">
                      Anyag és méretek
                    </div>
                    <p className="mt-2 text-sm text-black/70">
                      Személyesen az áruházban, e-mailben, vagy{" "}
                      <Link
                        href="/szolgaltatasok/online-lapszabaszat"
                        className="font-semibold underline underline-offset-4 text-[var(--color-brand)] hover:brightness-90"
                      >
                        online a Turinova rendszerben
                      </Link>
                      . Válassza ki az anyagot, adja meg a méreteket és azt,
                      hogy melyik élre kér élzárást.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      <Link className="font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]" href="/butorlap">
                        Bútorlap
                      </Link>
                      <Link className="font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]" href="/munkalap">
                        Munkalap
                      </Link>
                      <Link className="font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]" href="/szolgaltatasok/online-lapszabaszat">
                        Online rendelés
                      </Link>
                      <Link className="font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]" href="/kapcsolat">
                        Kapcsolat
                      </Link>
                    </div>
                  </li>
                  <li className="rounded-xl border border-black/10 bg-stone-50/60 p-5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
                      2. lépés
                    </div>
                    <div className="mt-1 text-base font-semibold text-black/90">
                      Optimalizálás és árajánlat
                    </div>
                    <p className="mt-2 text-sm text-black/70">
                      A megadott adatokra optimalizáljuk a táblafelosztást
                      (kevesebb hulladék = kedvezőbb ár), majd árajánlatot küldünk.
                      Online rendelésnél az ár azonnal látható.
                    </p>
                  </li>
                  <li className="rounded-xl border border-black/10 bg-stone-50/60 p-5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
                      3. lépés
                    </div>
                    <div className="mt-1 text-base font-semibold text-black/90">
                      Gyártás és átvétel
                    </div>
                    <p className="mt-2 text-sm text-black/70">
                      Megrendelés után legyártjuk. Raktári anyagból 3–5 munkanapon
                      belül készre dolgozzuk; a pontos nap az árajánlatban szerepel.
                      Ha elkészült, automatikus SMS-t küldünk. Online rendelésnél
                      a gyártás állapota is követhető.
                    </p>
                    <a
                      className="mt-3 inline-flex font-semibold underline underline-offset-4 text-[var(--color-brand)] hover:brightness-90"
                      href={directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Útvonaltervezés →
                    </a>
                  </li>
                </ol>
              </section>
            </RevealOnScroll>

            {/* Services grid */}
            <RevealOnScroll className="mt-14">
              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Szolgáltatásaink
                  </h2>
                  <a
                    href={LINKS.register}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]"
                  >
                    Online árajánlat →
                  </a>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <ServiceCard
                    title="Bútorlap lapszabászat"
                    desc="Bútorlapot szabunk méretre optimalizált táblafelosztással."
                    bullets={[
                      "Optimalizált táblafelosztás",
                      "Megadott méretek szerint",
                      "Raklapra rakva, átvételre kész",
                    ]}
                    href="/butorlap"
                    hrefLabel="Bútorlap katalógus"
                  />
                  <ServiceCard
                    title="Élzárás"
                    desc="Vízzáró élzárás bútorlapra és munkalapra. Négyféle élzárás közül választhat."
                    bullets={[
                      "ABS (0,4 / 1 / 2 mm), matt vagy fényes",
                      "Élfólia, élléc, élfurnér",
                      "Minden márkához színazonos ABS és élfólia",
                      "Minden él külön élzárható",
                    ]}
                  />
                  <ServiceCard
                    title="Munkalap megmunkálás"
                    desc="Méretre vágás és kivágások a megrendelt méretek alapján."
                    bullets={[
                      "Méretre vágás",
                      "Szögvágás és íves vágás",
                      "Főzőlap-kivágás és mosogató kivágás",
                      "Kérésre a postforming él helyett ABS élzárás",
                    ]}
                    href="/munkalap"
                    hrefLabel="Munkalap katalógus"
                  />
                  <ServiceCard
                    title="Pánthelyfúrás"
                    desc="Bútorlap, MDF és akril front ajtópánt-hellyel előfúrva, megadott méretek szerint."
                    bullets={[
                      "Bútorlap, MDF, akril front",
                      "Ajtópánt-hely befúrva (35 mm)",
                      "Beépítésre kész lapok",
                    ]}
                  />
                  <ServiceCard
                    title="Szögvágás, íves vágás, falcolás"
                    desc="Ferde vágások, ívek és falcok bútorlapra, ha a darab nem egyszerű téglalap."
                    bullets={[
                      "Szögvágás",
                      "Íves vágás",
                      "Falcolás",
                      "Élzárás az íves élre is",
                    ]}
                  />
                  <ServiceCard
                    title="Duplungolás (bútorlap)"
                    desc="Két lap összeragasztva vastagabb elemhez: vastag polc, munkapult, extra vastag front."
                    bullets={[
                      "Két lap összeragasztása",
                      "Széles élzárás a kész vastagsághoz",
                      "Polchoz, munkapulthoz, frontokhoz",
                    ]}
                  />
                </div>
              </section>
            </RevealOnScroll>

            {/* Brands list (dynamic) */}
            {brands.length > 0 && (
              <RevealOnScroll className="mt-14">
                <section className="rounded-2xl border border-black/10 bg-white p-6 md:p-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      Forgalmazott márkák
                    </h2>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <Link className="font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]" href="/butorlap">
                        Bútorlap katalógus →
                      </Link>
                      <Link className="font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]" href="/munkalap">
                        Munkalap katalógus →
                      </Link>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-black/65">
                    A legismertebb bútorlap- és munkalap-márkák raktáron.
                    Minden márkához színazonos ABS és élfólia élanyagot biztosítunk.
                    A nem készleten lévő dekorokat rövid határidővel rendeljük.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {brands.map((b) => (
                      <span
                        key={b}
                        className="inline-flex items-center rounded-full border border-black/10 bg-stone-50/60 px-3 py-1 text-sm font-medium text-black/80"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </section>
              </RevealOnScroll>
            )}

            {/* Decision helper */}
            <RevealOnScroll className="mt-14">
              <section className="rounded-2xl border border-black/10 bg-white p-6 md:p-8">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Mikor melyiket válasszam?
                </h2>
                <p className="mt-2 text-sm text-black/65">
                  Gyors döntési segítség, hogy biztosan azt kapja, amire szüksége van.
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-black/10 bg-stone-50/60 p-5">
                    <div className="text-sm font-semibold">Élzárás kell?</div>
                    <p className="mt-2 text-sm text-black/70">
                      Ha látszó éle van az elemnek (front, polc, oldallap), érdemes
                      élzárást kérni: ABS, élfólia, élléc vagy élfurnér.
                    </p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-stone-50/60 p-5">
                    <div className="text-sm font-semibold">Munkalapot készíttet?</div>
                    <p className="mt-2 text-sm text-black/70">
                      Méretre vágjuk, kivágjuk a főzőlap- és mosogató-helyet,
                      szükség esetén a postforming élt cserélni is tudjuk.
                    </p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-stone-50/60 p-5">
                    <div className="text-sm font-semibold">Szerelésre kész?</div>
                    <p className="mt-2 text-sm text-black/70">
                      Pánthelyfúrással előfúrt lapokat kap: kevesebb helyszíni
                      munka, gyorsabb összeszerelés.
                    </p>
                  </div>
                </div>
              </section>
            </RevealOnScroll>

            {/* FAQ + final CTA */}
            <RevealOnScroll className="mt-14">
              <section className="rounded-2xl border border-black/10 bg-white p-6 md:p-8">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Gyakori kérdések
                  </h2>
                  <Link
                    className="text-sm font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]"
                    href="/kapcsolat"
                  >
                    Kérdése van? Írjon nekünk →
                  </Link>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {[
                    {
                      q: "Mennyi idő alatt készül el?",
                      a: "Raktári anyagból 3–5 munkanapon belül készre dolgozzuk; a pontos napot az árajánlat tartalmazza. Elkészültéről automatikus SMS-t küldünk. Online rendelésnél a gyártás állapota is követhető.",
                    },
                    {
                      q: "Hogyan tudok rendelni?",
                      a: "Háromféleképpen: személyesen az áruházban, e-mailben, vagy online a Turinova rendszerben. Mindhárom esetben megadja az anyagot, a méreteket és hogy melyik élre kér élzárást. Ezután mi elkészítjük az árajánlatot.",
                    },
                    {
                      q: "Milyen élzárással dolgoznak?",
                      a: "Négyféle élzárás közül választhat: ABS (0,4 / 1 / 2 mm, matt vagy fényes), élfólia, élléc és élfurnér. Minden forgalmazott márkához színazonos ABS és élfólia élanyagot biztosítunk.",
                    },
                    {
                      q: "Milyen márkákat szabnak?",
                      a: brands.length > 0
                        ? `Forgalmazott márkáink: ${brands.join(", ")}. A legtöbb dekor raktáron, a nem készleten lévőket rövid határidővel rendeljük.`
                        : "A legismertebb bútorlap- és munkalap-márkákat tartjuk raktáron. A legtöbb dekor raktáron, a nem készleten lévőket rövid határidővel rendeljük.",
                    },
                    {
                      q: "Vállalnak hozott anyagot?",
                      a: "Jelenleg nem. A megmunkálást a nálunk vásárolt bútorlapra és munkalapra vállaljuk. Ehhez raktárról több száz dekor azonnal elérhető.",
                    },
                    {
                      q: "Hol tudom átvenni?",
                      a: `Személyesen Kecskeméten, az áruházunkban: ${COMPANY.address.full}. A paneleket raklapra rakva, összepakolva adjuk át.`,
                    },
                    {
                      q: "Mit kapok még az áruházban?",
                      a: "Komplett barkácsáruház vagyunk: pánt, csavar, fogantyú, csúszósín, élzáró, vasalat. Egy helyen, az üzletben mindent összeválogathat.",
                    },
                  ].map((item) => (
                    <div key={item.q} className="rounded-xl border border-black/10 bg-white p-5">
                      <div className="font-semibold">{item.q}</div>
                      <p className="mt-2 text-sm text-black/70">{item.a}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-2xl border border-black/10 bg-stone-50/60 p-5 md:p-6">
                  <div className="text-sm font-semibold text-black/85">
                    Indítsa el online. Az ár azonnal látható.
                  </div>
                  <p className="mt-2 text-sm text-black/70">
                    Anyag, méret, élzárás. Pár perc, és kész az ajánlat. Mentés,
                    módosítás, beküldés egy felületen.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <a
                      className={ctaPrimary}
                      href={LINKS.register}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Online árajánlat, kb. 2 perc
                    </a>
                    <a
                      className={ctaSecondary}
                      href={directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Útvonaltervezés
                    </a>
                  </div>
                </div>
              </section>
            </RevealOnScroll>

            {/* Geo / coverage */}
            <RevealOnScroll className="mt-14">
              <section className="rounded-2xl border border-black/10 bg-white p-6 md:p-8">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Lapszabászat Bács-Kiskun megyében
                </h2>
                <p className="mt-2 text-sm text-black/65">
                  Kecskeméti üzemünk Bács-Kiskun megye központjában található,
                  így könnyen megközelíthető a megye minden pontjáról. Asztalos
                  szakemberek és bútorgyártók rendszeresen igénybe veszik
                  szolgáltatásainkat az alábbi településekről:
                </p>
                <div className="mt-5 grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl border border-black/10 bg-stone-50/60 p-4">
                    <div className="font-semibold text-black/85">Kecskemét és környéke</div>
                    <p className="mt-1 text-black/70">
                      Kecskemét, Helvécia, Ballószög, Nyárlőrinc, Hetényegyháza, Katonatelep
                    </p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-stone-50/60 p-4">
                    <div className="font-semibold text-black/85">Északi irány</div>
                    <p className="mt-1 text-black/70">
                      Lajosmizse, Kerekegyháza, Fülöpszállás, Nagykőrös, Cegléd
                    </p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-stone-50/60 p-4">
                    <div className="font-semibold text-black/85">Déli irány</div>
                    <p className="mt-1 text-black/70">
                      Kiskunfélegyháza, Kiskunmajsa, Kiskunhalas, Jánoshalma
                    </p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-stone-50/60 p-4">
                    <div className="font-semibold text-black/85">Keleti irány</div>
                    <p className="mt-1 text-black/70">
                      Tiszakécske, Lakitelek, Kunszentmárton
                    </p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-stone-50/60 p-4">
                    <div className="font-semibold text-black/85">Nyugati irány</div>
                    <p className="mt-1 text-black/70">
                      Szabadszállás, Dunaföldvár, Kalocsa, Solt
                    </p>
                  </div>
                </div>
                <p className="mt-5 text-sm text-black/65">
                  Ha Bács-Kiskun megyében vagy a szomszédos megyékben keres
                  megbízható lapszabászatot és élzárást, kecskeméti üzletünkben
                  személyesen szívesen fogadjuk, vagy rendelje meg online a
                  Turinova rendszerünkön keresztül.
                </p>
              </section>
            </RevealOnScroll>
          </div>
        </div>
      </RevealOnLoad>
    </div>
  )
}

