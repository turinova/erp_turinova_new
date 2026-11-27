import Image from "next/image"
import Link from "next/link"
import { CardPrice } from "@/components/catalog/CardPrice"
import { notFound, redirect } from "next/navigation"
import { MobilePriceCta } from "@/components/catalog/MobilePriceCta"
import { CuttingUpsellCard, ProductPriceBlock } from "@/components/catalog/ProductPriceBlock"
import { OpeningHoursPill } from "@/components/site/OpeningHoursPill"
import {
  formatHuf,
  displayPriceGross,
  stockClass,
  stockLabel,
  stockSubLabel,
} from "@/lib/catalog-price"
import {
  COMPANY,
  formatPhoneDisplay,
  googleMapsDirectionsUrl,
} from "@/lib/company"
import { LINKS } from "@/lib/links"
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
} from "@/lib/seo"
import { getSupabaseServerClient } from "@/lib/supabase"

export const revalidate = 3600 // 1 hour

const BUTORLAP_COLS =
  "id,slug,name,brand_name,group_name,length_mm,width_mm,thickness_mm,grain_direction,image_url,indexable_on_site,on_stock,price_gross,updated_at"

type Row = {
  id: string
  slug: string | null
  name: string
  brand_name: string | null
  group_name: string | null
  length_mm: number
  width_mm: number
  thickness_mm: number
  grain_direction: boolean | null
  on_stock: boolean
  image_url: string | null
  updated_at: string
  indexable_on_site: boolean
  price_gross: number | null
}

function thicknessChipClass(t: number) {
  // 18 mm = de-facto standard => neutral chip; non-standard thickness uses brand tint.
  return t === 18
    ? "border-black/10 bg-white/95 text-black/85"
    : "border-[var(--color-brand)]/25 bg-[color-mix(in_srgb,var(--color-brand)_8%,white)] text-[var(--color-brand)]"
}

function buildRegisterUrl(nextPath: string) {
  const next = encodeURIComponent(nextPath)
  return `${LINKS.register}?next=${next}`
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
      title: "Bútorlap",
      description: "Bútorlap részletek és átvétel Kecskeméten.",
    }
  }

  const supabase = getSupabaseServerClient()
  const isIdFallback = slug.startsWith("id-")
  const id = isIdFallback ? slug.slice(3) : null
  let lookup = supabase.from("public_butorlap").select(BUTORLAP_COLS).limit(1)
  lookup = id ? lookup.eq("id", id) : lookup.eq("slug", slug)
  const { data } = await lookup.maybeSingle()
  if (!data) {
    return { title: "Bútorlap" }
  }

  const r = data as Row
  const dims = `${r.length_mm}×${r.width_mm}×${r.thickness_mm}`
  const subtitle = [r.brand_name, r.group_name].filter(Boolean).join(" • ")
  const canonicalPath = `/butorlap/${r.slug ?? slug}`
  const canonicalUrl = `${COMPANY.website}${canonicalPath}`
  const robots = r.indexable_on_site
    ? { index: true, follow: true }
    : { index: false, follow: true }
  const ogImage = r.image_url || `${COMPANY.website}/img/hiros_logo.png`
  const price = displayPriceGross(r.price_gross)

  const titleStr = `${r.name} bútorlap (${dims} mm)`
  const priceBit = price != null ? ` Bruttó ár egész táblára: ${formatHuf(price)}.` : ""
  const longDesc = `${r.name} bútorlap, ${dims} mm.${subtitle ? ` ${subtitle}.` : ""}${priceBit} Átvétel ${COMPANY.address.city}en.`
  const shortDesc = longDesc

  return {
    title: titleStr,
    description: longDesc,
    alternates: { canonical: canonicalUrl },
    robots,
    openGraph: {
      // Next.js 16 metadata validates `openGraph.type` strictly; use a supported value.
      type: "website",
      url: canonicalUrl,
      title: titleStr,
      description: shortDesc,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${r.name} bútorlap` }],
    },
    twitter: {
      card: "summary_large_image",
      title: titleStr,
      description: shortDesc,
      images: [ogImage],
    },
  }
}

export default async function ButorlapDetailPage({
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
          <h1 className="text-3xl font-semibold tracking-tight">Bútorlap</h1>
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
              Ezeket Ön fogja megadni. Utána a <span className="font-mono">public.public_butorlap</span> view-ból olvasunk.
            </div>
          </div>
          <div className="mt-6">
            <Link
              className="inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold text-black/80 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              href="/butorlap"
            >
              Vissza a bútorlap katalógushoz
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const supabase = getSupabaseServerClient()

  const isIdFallback = slug.startsWith("id-")
  const id = isIdFallback ? slug.slice(3) : null

  let lookup = supabase.from("public_butorlap").select(BUTORLAP_COLS).limit(1)
  lookup = id ? lookup.eq("id", id) : lookup.eq("slug", slug)

  const { data, error } = await lookup.maybeSingle()

  if (error) throw new Error(`Supabase query failed: ${error.message}`)
  if (!data) return notFound()

  const r = data as Row
  if (isIdFallback && r.slug) {
    redirect(`/butorlap/${r.slug}`)
  }
  const canonical = `/butorlap/${r.slug ?? slug}`
  const directionsUrl = googleMapsDirectionsUrl()
  const phoneTel = `tel:${COMPANY.phones.primary}`
  const phoneDisplay = formatPhoneDisplay(COMPANY.phones.primary)

  // Humanized definition (magázás).
  const definition = (() => {
    const dims = `${r.length_mm} × ${r.width_mm} mm`
    const thickness = `${r.thickness_mm} mm`
    if (r.brand_name) {
      return `A ${r.brand_name} ${r.name} bútorlap mérete ${dims}, vastagsága ${thickness}. ${COMPANY.address.city}i áruházunkban Önnek méretre vágjuk, és igény szerint élzárást is vállalunk.`
    }
    return `${r.name} bútorlap mérete ${dims}, vastagsága ${thickness}. ${COMPANY.address.city}i áruházunkban Önnek méretre vágjuk, és igény szerint élzárást is vállalunk.`
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
          text: "Igen, a kiválasztott bútorlapot kérésre méretre vágjuk. A részleteket a szolgáltatás oldalon olvashatja.",
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
        name: "Mennyibe kerül?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Az ár a terméklapon látható, bruttó, egész táblára. Méretre vágás és élzárás külön. Raktáron lévő tételeket azonnal átveheti; ami nincs raktáron, azt rendelésre beszerezzük.",
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
    let q = supabase.from("public_butorlap").select(BUTORLAP_COLS).limit(8)
    q = q.eq("indexable_on_site", true)
    if (r.brand_name) q = q.eq("brand_name", r.brand_name)
    else if (r.group_name) q = q.eq("group_name", r.group_name)
    else q = q.eq("thickness_mm", r.thickness_mm)
    q = q.neq("id", r.id)
    q = q.order("on_stock", { ascending: false }).order("name", { ascending: true })
    return q
  })()

  const { data: relatedData } = await relatedQuery
  const related = ((relatedData as Row[]) || []).filter(Boolean)

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Kezdőlap", path: "/" },
    { name: "Bútorlap katalógus", path: "/butorlap" },
    { name: r.name, path: canonical },
  ])

  const productJsonLd = buildProductJsonLd({
    name: `${r.name} bútorlap`,
    description: definition,
    url: absoluteUrl(canonical),
    brand: r.brand_name ?? undefined,
    image: r.image_url ?? undefined,
    sku: r.slug ?? slug,
    inStock: Boolean(r.on_stock),
    priceGross: r.price_gross,
  })

  return (
    <div className="bg-stone-wash">
      <script
        id="jsonld-breadcrumb-butorlap"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        id="jsonld-product-butorlap"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        id="jsonld-faq-butorlap"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-4 pb-28 pt-14 md:pb-20 md:pt-20">
        {/* Breadcrumb (Tier 2) */}
        <nav className="text-sm text-black/60" aria-label="Útvonal">
          <Link className="hover:underline" href="/">
            Kezdőlap
          </Link>{" "}
          <span className="mx-2">›</span>
          <Link className="hover:underline" href="/butorlap">
            Bútorlap katalógus
          </Link>{" "}
          <span className="mx-2">›</span>
          <span className="text-black/80">{r.name}</span>
        </nav>

        <div className="mt-8 grid gap-8 md:grid-cols-12 md:items-start">
          {/* LEFT: image, fixed 4:3 aspect so every product card stays the same size */}
          <div className="md:col-span-6">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-black/10 bg-stone-50 md:sticky md:top-24">
              <Image
                src={r.image_url || "/img/hiros_logo.png"}
                alt={`${r.name} bútorlap`}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </div>

          {/* RIGHT: decision card */}
          <div className="md:col-span-6">
            <div className="rounded-2xl border border-black/10 bg-white p-6 md:p-8">
              {/* Stock + thickness chips */}
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
              </div>

              {/* H1 */}
              <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">
                {r.name}
              </h1>

              {/* Trust line + opening hours pill (Tier 2 + 3) */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-black/65">
                <span>
                  <span className="font-semibold text-black/80">HÍRÖS-ABLAK Áruház</span>
                  <span className="text-black/55">, 1996 óta {COMPANY.address.city}en</span>
                </span>
                <OpeningHoursPill />
              </div>

              <ProductPriceBlock
                priceGross={r.price_gross}
                kind="sheet"
                lengthMm={r.length_mm}
                widthMm={r.width_mm}
                onStock={r.on_stock}
                city={COMPANY.address.city}
                className="mt-6"
              />

              {/* Decision facts panel */}
              <div className="mt-5 grid gap-2 rounded-2xl border border-black/10 bg-stone-50/60 p-4">
                {r.brand_name && (
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="text-sm font-semibold text-black/70">Márka</div>
                    <Link
                      href={{ pathname: "/butorlap", query: { brand: r.brand_name } }}
                      className="inline-flex items-center rounded-full border border-black/10 bg-white/95 px-3 py-1 text-sm font-semibold text-black/85 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                    >
                      {r.brand_name}
                    </Link>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4">
                  <div className="text-sm font-semibold text-black/70">Vastagság</div>
                  <div className="font-mono text-sm font-semibold text-black/85">
                    {r.thickness_mm} mm
                  </div>
                </div>
                {r.grain_direction !== null && (
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="text-sm font-semibold text-black/70">Szálirányos</div>
                    <div className="text-sm font-semibold text-black/85">
                      {r.grain_direction ? "Igen" : "Nem"}
                    </div>
                  </div>
                )}
              </div>
              {r.brand_name && (
                <div className="mt-3 text-xs text-black/55">
                  <Link
                    href={{ pathname: "/butorlap", query: { brand: r.brand_name } }}
                    className="font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]"
                  >
                    Több {r.brand_name} bútorlap a katalógusban
                  </Link>
                </div>
              )}

              {/* CTA: egy primary — átvétel / útvonal */}
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

                <div className="text-center text-sm text-black/70">
                  Telefon:{" "}
                  <a
                    className="font-semibold text-[var(--color-brand)] underline underline-offset-4 hover:brightness-90"
                    href={phoneTel}
                  >
                    {phoneDisplay}
                  </a>
                </div>

                <div className="text-center text-sm">
                  <a
                    className="text-black/60 underline underline-offset-4 hover:text-[var(--color-brand)]"
                    href={buildRegisterUrl(canonical)}
                  >
                    Online rendelés regisztráció után →
                  </a>
                </div>
              </div>

              <CuttingUpsellCard kind="sheet" />

              {/* Definition (moved below CTAs) */}
              <p className="mt-5 text-base text-black/75">{definition}</p>

              {/* Részletes adatok: collapsed, dedup vs decision panel above */}
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
                      {r.group_name && (
                        <tr className="border-b border-black/10">
                          <th className="bg-stone-50 px-4 py-3 text-left font-semibold text-black/70">
                            Csoport
                          </th>
                          <td className="px-4 py-3 text-black/85">{r.group_name}</td>
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

        {/* Hasonló bútorlapok */}
        {related.length > 0 && (
          <section className="mt-14">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight">Hasonló bútorlapok</h2>
              <Link
                className="text-sm font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]"
                href="/butorlap"
              >
                Vissza a katalógushoz →
              </Link>
            </div>
            <div className="mt-5 grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((x) => (
                <Link
                  key={x.id}
                  href={`/butorlap/${x.slug ?? `id-${x.id}`}`}
                  className="group overflow-hidden rounded-2xl border border-black/10 bg-white hover:border-black/20 hover:shadow-sm"
                >
                  <div className="relative aspect-[4/3] w-full bg-stone-50">
                    <Image
                      src={x.image_url || "/img/hiros_logo.png"}
                      alt={`${x.name} bútorlap`}
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
                    <div className="mt-1 text-xs text-black/60">
                      {[x.brand_name, x.group_name].filter(Boolean).join(" • ")}
                    </div>
                    <CardPrice priceGross={x.price_gross} kind="sheet" lengthMm={x.length_mm} widthMm={x.width_mm} onStock={x.on_stock} compact />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="mt-14 rounded-2xl border border-black/10 bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Mielőtt elindul hozzánk</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-white p-5">
              <div className="font-semibold">Tudják méretre vágni?</div>
              <p className="mt-2 text-sm text-black/70">
                Igen, a kiválasztott bútorlapot kérésre méretre vágjuk. A
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
              <div className="font-semibold">Mennyibe kerül?</div>
              <p className="mt-2 text-sm text-black/70">
                Az ár a terméklapon látható, bruttó, egész táblára. Méretre vágás
                és élzárás külön. Ami nincs raktáron, azt rendelésre beszerezzük.
              </p>
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

        <MobilePriceCta priceGross={r.price_gross} kind="sheet" directionsUrl={directionsUrl} />
      </div>
    </div>
  )
}
