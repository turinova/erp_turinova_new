import Image from "next/image"
import Link from "next/link"
import Script from "next/script"
import { notFound, redirect } from "next/navigation"
import {
  COMPANY,
  formatPhoneDisplay,
  googleMapsDirectionsUrl,
} from "@/lib/company"
import { LINKS } from "@/lib/links"
import { getSupabaseServerClient } from "@/lib/supabase"
import { OpeningHoursPill } from "@/components/site/OpeningHoursPill"
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
} from "@/lib/seo"

export const revalidate = 3600 // 1 hour

type Row = {
  id: string
  slug: string | null
  name: string
  brand_name: string | null
  length_mm: number
  width_mm: number
  thickness_mm: number
  on_stock: boolean
  image_url: string | null
  updated_at: string
  indexable_on_site: boolean
  type_name?: string | null
}

function stockLabel(onStock: boolean) {
  return onStock ? "Raktáron" : "Beszerezhető"
}

function stockSubLabel(onStock: boolean) {
  return onStock ? "Most átvehető" : "Beszerezzük Önnek"
}

function stockClass(onStock: boolean) {
  return onStock
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-sky-200 bg-sky-50 text-sky-900"
}

function reassuranceCardClass(onStock: boolean) {
  return onStock
    ? "border-emerald-100 bg-emerald-50/40"
    : "border-sky-100 bg-sky-50/40"
}

function thicknessChipClass(t: number) {
  return t === 38
    ? "border-black/10 bg-white/95 text-black/85"
    : "border-[var(--color-brand)]/25 bg-[color-mix(in_srgb,var(--color-brand)_8%,white)] text-[var(--color-brand)]"
}

function typeChipClass(typeName: string) {
  if (typeName === "Munkalap") return "border-black/10 bg-white/95 text-black/85"
  if (typeName === "Asztallap")
    return "border-amber-200 bg-amber-50/95 text-amber-900"
  if (typeName === "Hátfal")
    return "border-violet-200 bg-violet-50/95 text-violet-900"
  return "border-black/10 bg-white/95 text-black/85"
}

function buildRegisterUrl(nextPath: string) {
  const next = encodeURIComponent(nextPath)
  return `${LINKS.register}?next=${next}`
}

function productNoun(typeName: string | null | undefined): string {
  if (typeName === "Asztallap") return "asztallap"
  if (typeName === "Hátfal") return "hátfal"
  return "munkalap"
}

function productNounAcc(typeName: string | null | undefined): string {
  if (typeName === "Hátfal") return "hátfalat"
  if (typeName === "Asztallap") return "asztallapot"
  return "munkalapot"
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return {
      title: "Munkalap",
      description: "Munkalap részletek és átvétel Kecskeméten.",
    }
  }

  const supabase = getSupabaseServerClient()
  const isIdFallback = slug.startsWith("id-")
  const id = isIdFallback ? slug.slice(3) : null
  let lookup = supabase
    .from("public_munkalap")
    .select(
      "id,slug,name,brand_name,length_mm,width_mm,thickness_mm,image_url,indexable_on_site,on_stock,type_name",
    )
    .limit(1)
  lookup = id ? lookup.eq("id", id) : lookup.eq("slug", slug)
  const { data } = await lookup.maybeSingle()
  if (!data) return { title: "Munkalap" }

  const r = data as Pick<
    Row,
    | "id"
    | "slug"
    | "name"
    | "brand_name"
    | "length_mm"
    | "width_mm"
    | "thickness_mm"
    | "image_url"
    | "indexable_on_site"
    | "on_stock"
    | "type_name"
  >

  const dims = `${r.length_mm}×${r.width_mm}×${r.thickness_mm}`
  const canonicalPath = `/munkalap/${r.slug ?? slug}`
  const canonicalUrl = `${COMPANY.website}${canonicalPath}`
  const robots = r.indexable_on_site
    ? { index: true, follow: true }
    : { index: false, follow: true }
  const ogImage = r.image_url || `${COMPANY.website}/img/hiros_logo.png`

  const product = productNoun(r.type_name)
  const titleStr = `${r.name} ${product} (${dims} mm)`
  const brand = r.brand_name ? ` ${r.brand_name}.` : ""
  const longDesc = `${r.name} ${product}, ${dims} mm.${brand} Átvétel ${COMPANY.address.city}en. Az árakat és a részletes készletet a regisztráció után láthatja.`
  const shortDesc = `${r.name} ${product}, ${dims} mm.${brand} Átvétel ${COMPANY.address.city}en.`

  return {
    title: titleStr,
    description: longDesc,
    alternates: { canonical: canonicalUrl },
    robots,
    openGraph: {
      type: "website",
      url: canonicalUrl,
      title: titleStr,
      description: shortDesc,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${r.name} ${product}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: titleStr,
      description: shortDesc,
      images: [ogImage],
    },
  }
}

export default async function MunkalapDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return (
      <div className="bg-stone-wash">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-3xl font-semibold tracking-tight">Munkalap</h1>
          <p className="mt-3 text-base text-black/70">
            A katalógus betöltéséhez be kell állítani a Supabase környezeti változókat.
          </p>
          <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 text-sm text-black/70">
            <div className="font-semibold text-black/85">Szükséges változók</div>
            <ul className="mt-2 list-disc pl-5">
              <li>
                <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span>
              </li>
              <li>
                <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
              </li>
            </ul>
            <div className="mt-3 text-black/60">
              Ezeket Ön fogja megadni. Utána a{" "}
              <span className="font-mono">public.public_munkalap</span> view-ból olvasunk.
            </div>
          </div>
          <div className="mt-6">
            <Link
              className="inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold text-black/80 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              href="/munkalap"
            >
              Vissza a munkalap katalógushoz
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const supabase = getSupabaseServerClient()
  const isIdFallback = slug.startsWith("id-")
  const id = isIdFallback ? slug.slice(3) : null

  let lookup = supabase.from("public_munkalap").select("*").limit(1)
  lookup = id ? lookup.eq("id", id) : lookup.eq("slug", slug)

  const { data, error } = await lookup.maybeSingle()
  if (error) throw new Error(`Supabase query failed: ${error.message}`)
  if (!data) return notFound()

  const r = data as Row
  if (isIdFallback && r.slug) redirect(`/munkalap/${r.slug}`)

  const canonical = `/munkalap/${r.slug ?? slug}`
  const directionsUrl = googleMapsDirectionsUrl()
  const phoneTel = `tel:${COMPANY.phones.primary}`
  const phoneDisplay = formatPhoneDisplay(COMPANY.phones.primary)

  const noun = productNoun(r.type_name)
  const nounAcc = productNounAcc(r.type_name)
  const definition = (() => {
    const dims = `${r.length_mm} × ${r.width_mm} mm`
    const thickness = `${r.thickness_mm} mm`
    if (r.brand_name) {
      return `A ${r.brand_name} ${r.name} ${noun} mérete ${dims}, vastagsága ${thickness}. ${COMPANY.address.city}i áruházunkban Önnek méretre vágjuk, és igény szerint élzárást is vállalunk.`
    }
    return `${r.name} ${noun} mérete ${dims}, vastagsága ${thickness}. ${COMPANY.address.city}i áruházunkban Önnek méretre vágjuk, és igény szerint élzárást is vállalunk.`
  })()

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Tudják méretre vágni?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Igen, a kiválasztott ${nounAcc} kérésre méretre vágjuk. A részleteket a szolgáltatás oldalon olvashatja.`,
        },
      },
      {
        "@type": "Question",
        name: "Vállalnak élzárást is?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Igen, igény szerint élzárást is vállalunk. A részleteket a megrendeléskor egyeztetjük.",
        },
      },
      {
        "@type": "Question",
        name: "Hol látom az árat és a pontos készletet?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Az árakat és a részletes készletet a regisztráció után láthatja, és onnantól online rendelhet is.",
        },
      },
      {
        "@type": "Question",
        name: "Hol vehetem át?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Áruházunkban, ${COMPANY.address.full} cím alatt. Az „Útvonaltervezés” gombbal nyithatja a Google Térképet.`,
        },
      },
    ],
  }

  const relatedQuery = (() => {
    let q = supabase
      .from("public_munkalap")
      .select("*")
      .eq("indexable_on_site", true)
      .limit(8)
    if (r.brand_name) q = q.eq("brand_name", r.brand_name)
    else q = q.eq("thickness_mm", r.thickness_mm)
    q = q.neq("id", r.id)
    q = q.order("on_stock", { ascending: false }).order("name", { ascending: true })
    return q
  })()

  const { data: relatedData } = await relatedQuery
  const related = ((relatedData as Row[]) || []).filter(Boolean)

  const stockMessage = r.on_stock
    ? `Raktáron: most átvehető a ${COMPANY.address.city.toLowerCase()}i áruházunkban.`
    : "Beszerezhető: most nincs raktáron, de Önnek beszerezzük. A beszerzési idő márkától és szállítótól függ, a pontos időt megrendeléskor egyeztetjük."

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Kezdőlap", path: "/" },
    { name: "Munkalap katalógus", path: "/munkalap" },
    { name: r.name, path: canonical },
  ])

  const productJsonLd = buildProductJsonLd({
    name: `${r.name} ${noun}`,
    description: definition,
    url: absoluteUrl(canonical),
    brand: r.brand_name ?? undefined,
    image: r.image_url ?? undefined,
    sku: r.slug ?? slug,
    inStock: Boolean(r.on_stock),
  })

  return (
    <div className="bg-stone-wash">
      <Script
        id="jsonld-breadcrumb-munkalap"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id="jsonld-product-munkalap"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <Script
        id="jsonld-faq-munkalap"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-4 pb-28 pt-14 md:pb-20 md:pt-20">
        <nav className="text-sm text-black/60" aria-label="Útvonal">
          <Link className="hover:underline" href="/">
            Kezdőlap
          </Link>{" "}
          <span className="mx-2">›</span>
          <Link className="hover:underline" href="/munkalap">
            Munkalap katalógus
          </Link>{" "}
          <span className="mx-2">›</span>
          <span className="text-black/80">{r.name}</span>
        </nav>

        <div className="mt-8 grid gap-8 md:grid-cols-12 md:items-start">
          <div className="md:col-span-6">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-black/10 bg-stone-50 md:sticky md:top-24">
              <Image
                src={r.image_url || "/img/hiros_logo.png"}
                alt={`${r.name} ${noun}`}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </div>

          <div className="md:col-span-6">
            <div className="rounded-2xl border border-black/10 bg-white p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                    stockClass(r.on_stock),
                  ].join(" ")}
                >
                  <span>{stockLabel(r.on_stock)}</span>
                  <span className="text-[11px] font-medium opacity-70">• {stockSubLabel(r.on_stock)}</span>
                </div>
                <div
                  className={[
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold",
                    thicknessChipClass(r.thickness_mm),
                  ].join(" ")}
                >
                  {r.thickness_mm} mm
                </div>
                {r.type_name && (
                  <div
                    className={[
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                      typeChipClass(r.type_name),
                    ].join(" ")}
                  >
                    {r.type_name}
                  </div>
                )}
              </div>

              <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">{r.name}</h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-black/65">
                <span>
                  <span className="font-semibold text-black/80">HÍRÖS-ABLAK Áruház</span>
                  <span className="text-black/55">, 1996 óta {COMPANY.address.city}en</span>
                </span>
                <OpeningHoursPill />
              </div>

              <div className="mt-5 grid gap-2 rounded-2xl border border-black/10 bg-stone-50/60 p-4">
                {r.brand_name && (
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="text-sm font-semibold text-black/70">Márka</div>
                    <Link
                      href={{ pathname: "/munkalap", query: { brand: r.brand_name } }}
                      className="inline-flex items-center rounded-full border border-black/10 bg-white/95 px-3 py-1 text-sm font-semibold text-black/85 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                    >
                      {r.brand_name}
                    </Link>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4">
                  <div className="text-sm font-semibold text-black/70">Méret</div>
                  <div className="font-mono text-sm font-semibold text-black/85">
                    {r.length_mm} × {r.width_mm} mm
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <div className="text-sm font-semibold text-black/70">Vastagság</div>
                  <div className="font-mono text-sm font-semibold text-black/85">{r.thickness_mm} mm</div>
                </div>
              </div>

              {r.brand_name && (
                <div className="mt-3 text-xs text-black/55">
                  <Link
                    href={{ pathname: "/munkalap", query: { brand: r.brand_name } }}
                    className="font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]"
                  >
                    Több {r.brand_name} {noun} a katalógusban
                  </Link>
                </div>
              )}

              <div className="mt-7 grid gap-3">
                <div>
                  <a
                    className="inline-flex w-full items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3.5 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95"
                    href={directionsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Útvonaltervezés az áruházunkba →
                  </a>
                  <div className="mt-1.5 text-center text-xs text-black/55">
                    {COMPANY.address.full} • Google Térkép
                  </div>
                </div>

                <div>
                  <a
                    className="inline-flex w-full items-center justify-center rounded-full border border-[var(--color-brand)]/25 bg-[color-mix(in_srgb,var(--color-brand)_8%,white)] px-6 py-3 text-base font-semibold text-[var(--color-brand)] hover:bg-[color-mix(in_srgb,var(--color-brand)_12%,white)]"
                    href={buildRegisterUrl(canonical)}
                  >
                    Árak és online rendelés a regisztráció után →
                  </a>
                  <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-black/65">
                    <li className="inline-flex items-center gap-1">
                      <span aria-hidden className="text-emerald-600">✓</span> Ingyenes regisztráció
                    </li>
                    <li className="inline-flex items-center gap-1">
                      <span aria-hidden className="text-emerald-600">✓</span> Azonnali árak
                    </li>
                    <li className="inline-flex items-center gap-1">
                      <span aria-hidden className="text-emerald-600">✓</span> Online rendelés
                    </li>
                  </ul>
                </div>

                <div className="text-center text-sm text-black/70">
                  Vagy hívjon minket:{" "}
                  <a
                    className="font-semibold text-[var(--color-brand)] underline underline-offset-4 hover:brightness-90"
                    href={phoneTel}
                  >
                    {phoneDisplay}
                  </a>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1 text-sm">
                  <Link
                    className="font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]"
                    href="/szolgaltatasok/lapszabaszat-es-elzaras"
                  >
                    Tudjon meg többet a lapszabászatról és élzárásról →
                  </Link>
                  <Link
                    className="font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]"
                    href="/kapcsolat"
                  >
                    Van kérdése? Írjon nekünk →
                  </Link>
                </div>
              </div>

              <div
                className={[
                  "mt-5 rounded-2xl border p-4 text-sm text-black/75",
                  reassuranceCardClass(r.on_stock),
                ].join(" ")}
              >
                {stockMessage}
              </div>

              <p className="mt-5 text-base text-black/75">{definition}</p>

              <details className="mt-5 overflow-hidden rounded-2xl border border-black/10">
                <summary className="cursor-pointer select-none bg-stone-50 px-4 py-3 text-sm font-semibold text-black/75 hover:text-[var(--color-brand)]">
                  Részletes adatok
                </summary>
                <div className="border-t border-black/10">
                  <table className="w-full text-sm">
                    <tbody>
                      {r.brand_name && (
                        <tr className="border-b border-black/10">
                          <th className="w-44 bg-stone-50 px-4 py-3 text-left font-semibold text-black/70">
                            Márka
                          </th>
                          <td className="px-4 py-3 text-black/85">{r.brand_name}</td>
                        </tr>
                      )}
                      <tr className="border-b border-black/10">
                        <th className="bg-stone-50 px-4 py-3 text-left font-semibold text-black/70">
                          Készlet
                        </th>
                        <td className="px-4 py-3 font-semibold text-black/85">{stockLabel(r.on_stock)}</td>
                      </tr>
                      <tr>
                        <th className="bg-stone-50 px-4 py-3 text-left font-semibold text-black/70">
                          Utolsó frissítés
                        </th>
                        <td className="px-4 py-3 text-black/80">
                          {new Date(r.updated_at).toLocaleDateString("hu-HU", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-14">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight">Hasonló munkalapok</h2>
              <Link
                className="text-sm font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]"
                href="/munkalap"
              >
                Vissza a katalógushoz →
              </Link>
            </div>
            <div className="mt-5 grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((x) => (
                <Link
                  key={x.id}
                  href={`/munkalap/${x.slug ?? `id-${x.id}`}`}
                  className="group overflow-hidden rounded-2xl border border-black/10 bg-white hover:border-black/20 hover:shadow-sm"
                >
                  <div className="relative aspect-[4/3] w-full bg-stone-50">
                    <Image
                      src={x.image_url || "/img/hiros_logo.png"}
                      alt={`${x.name} ${productNoun(x.type_name)}`}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      sizes="(max-width: 768px) 100vw, 25vw"
                    />
                    <div className="absolute left-3 top-3">
                      <div
                        className={[
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                          stockClass(x.on_stock),
                        ].join(" ")}
                      >
                        {stockLabel(x.on_stock)}
                      </div>
                    </div>
                    <div className="absolute right-3 top-3">
                      <div
                        className={[
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold",
                          thicknessChipClass(x.thickness_mm),
                        ].join(" ")}
                      >
                        {x.thickness_mm} mm
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-sm font-semibold leading-snug text-black/90 group-hover:text-[var(--color-brand)]">
                      {x.name}
                    </div>
                    <div className="mt-1 text-xs text-black/60">{x.brand_name || ""}</div>
                    <div className="mt-2 text-xs text-black/70">
                      {x.length_mm} × {x.width_mm} mm
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-14 rounded-2xl border border-black/10 bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Mielőtt elindul hozzánk</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-white p-5">
              <div className="font-semibold">Tudják méretre vágni?</div>
              <p className="mt-2 text-sm text-black/70">
                Igen, a kiválasztott {nounAcc} kérésre méretre vágjuk. A
                részleteket a szolgáltatás oldalon olvashatja.
              </p>
              <Link
                className="mt-3 inline-block text-sm font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]"
                href="/szolgaltatasok/lapszabaszat-es-elzaras"
              >
                Lapszabászat és élzárás →
              </Link>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-5">
              <div className="font-semibold">Vállalnak élzárást is?</div>
              <p className="mt-2 text-sm text-black/70">
                Igen, igény szerint élzárást is vállalunk. A részleteket a
                megrendeléskor egyeztetjük.
              </p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-5">
              <div className="font-semibold">Hol látom az árat és a pontos készletet?</div>
              <p className="mt-2 text-sm text-black/70">
                Az árakat és a részletes készletet a regisztráció után láthatja,
                és onnantól online rendelhet is.
              </p>
              <a
                className="mt-3 inline-block text-sm font-semibold underline underline-offset-4 text-[var(--color-brand)] hover:brightness-90"
                href={buildRegisterUrl(canonical)}
              >
                Regisztrálok →
              </a>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-5">
              <div className="font-semibold">Hol vehetem át?</div>
              <p className="mt-2 text-sm text-black/70">
                Áruházunkban,{" "}
                <span className="font-semibold">{COMPANY.address.full}</span>{" "}
                cím alatt. Az „Útvonaltervezés” gombbal nyithatja a Google Térképet.
              </p>
              <a
                className="mt-3 inline-block text-sm font-semibold underline underline-offset-4 text-[var(--color-brand)] hover:brightness-90"
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
              >
                Útvonaltervezés →
              </a>
            </div>
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 p-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl gap-2 px-1">
            <a
              className="inline-flex flex-[3] items-center justify-center rounded-full bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-[var(--color-brand-contrast)]"
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Útvonal →
            </a>
            <a
              className="inline-flex flex-[2] items-center justify-center rounded-full border border-[var(--color-brand)]/25 bg-[color-mix(in_srgb,var(--color-brand)_8%,white)] px-4 py-3 text-sm font-semibold text-[var(--color-brand)]"
              href={buildRegisterUrl(canonical)}
            >
              Árak / regisztráció
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

