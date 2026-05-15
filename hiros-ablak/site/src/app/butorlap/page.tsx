import Link from "next/link"
import Image from "next/image"
import Script from "next/script"
import { COMPANY } from "@/lib/company"
import { LINKS } from "@/lib/links"
import { getSupabaseServerClient } from "@/lib/supabase"
import { parseButorlapQuery } from "@/lib/butorlap-search"
import { SortSelect } from "./_components/SortSelect"

export const metadata = {
  title: "Bútorlap katalógus",
  description:
    "Bútorlap katalógus Kecskeméten: raktáron vagy beszerezhető tételek. Szűrés vastagság, márka, csoport és készlet szerint.",
}

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
}

type SP = Record<string, string | string[] | undefined>

const PAGE_SIZE = 48

function toArray(param: string | string[] | undefined): string[] {
  if (!param) return []
  return Array.isArray(param) ? param : [param]
}

function stockLabel(onStock: boolean) {
  return onStock ? "Raktáron" : "Beszerezhető"
}

function stockClass(onStock: boolean) {
  return onStock
    ? "border-emerald-200 bg-emerald-50/95 text-emerald-900"
    : "border-sky-200 bg-sky-50/95 text-sky-900"
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

function buildDetailHref(r: Row) {
  // Detail page accepts <slug> OR id-<uuid>.
  return `/butorlap/${r.slug ?? `id-${r.id}`}`
}

/** Build a /butorlap URL with the given mutation applied. Always resets page. */
function buildUrl(sp: SP, mutate: (next: SP) => void): { pathname: string; query: SP } {
  const next: SP = {}
  for (const [k, v] of Object.entries(sp)) {
    if (k === "page") continue
    if (Array.isArray(v)) next[k] = [...v]
    else if (v !== undefined) next[k] = v
  }
  mutate(next)
  return { pathname: "/butorlap", query: next }
}

function urlWithoutFilter(sp: SP, key: string, value?: string) {
  return buildUrl(sp, (next) => {
    if (value === undefined) {
      delete next[key]
      return
    }
    const arr = Array.isArray(next[key])
      ? (next[key] as string[])
      : next[key]
        ? [next[key] as string]
        : []
    const filtered = arr.filter((x) => x !== value)
    if (filtered.length > 0) next[key] = filtered
    else delete next[key]
  })
}

function urlWithStock(sp: SP, value: "all" | "in" | "orderable") {
  return buildUrl(sp, (next) => {
    if (value === "all") delete next.stock
    else next.stock = value
  })
}

async function fetchFilterOptions(supabase: ReturnType<typeof getSupabaseServerClient>) {
  const { data, error } = await supabase
    .from("public_butorlap")
    .select("brand_name, group_name, thickness_mm")
  if (error || !data) return { brands: [] as string[], groups: [] as string[], thicknesses: [] as number[] }
  const rows = data as Array<{ brand_name: string | null; group_name: string | null; thickness_mm: number }>
  const brands = Array.from(
    new Set(rows.map((r) => r.brand_name).filter((v): v is string => Boolean(v))),
  ).sort((a, b) => a.localeCompare(b, "hu"))
  const groups = Array.from(
    new Set(rows.map((r) => r.group_name).filter((v): v is string => Boolean(v))),
  ).sort((a, b) => a.localeCompare(b, "hu"))
  const thicknesses = Array.from(
    new Set(rows.map((r) => r.thickness_mm).filter((n): n is number => Number.isFinite(n))),
  ).sort((a, b) => a - b)
  return { brands, groups, thicknesses }
}

export default async function ButorlapListingPage({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const sp = await searchParams

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return (
      <div className="bg-stone-wash">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-3xl font-semibold tracking-tight">Bútorlap katalógus</h1>
          <p className="mt-3 text-base text-black/70">
            A katalógus betöltéséhez be kell állítani a Supabase környezeti változókat.
          </p>
          <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 text-sm text-black/70">
            <div className="font-semibold text-black/85">Szükséges változók</div>
            <ul className="mt-2 list-disc pl-5">
              <li><span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span></li>
              <li><span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span></li>
            </ul>
            <div className="mt-3 text-black/60">
              Ezeket Ön fogja megadni. Utána a <span className="font-mono">public.public_butorlap</span> view-ból olvasunk.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const q = typeof sp.q === "string" ? sp.q : ""
  const parsed = parseButorlapQuery(q)

  const brands = toArray(sp.brand)
  const groups = toArray(sp.group)
  const thickness = toArray(sp.thickness)
    .map((t) => parseInt(t, 10))
    .filter((n) => Number.isFinite(n))

  const stock = typeof sp.stock === "string" ? sp.stock : "all"
  const sort = typeof sp.sort === "string" ? sp.sort : "relevance"
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1)

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = getSupabaseServerClient()

  const [filterOptions, mainResult] = await Promise.all([
    fetchFilterOptions(supabase),
    (async () => {
      let query = supabase.from("public_butorlap").select("*", { count: "exact" })
      if (stock === "in") query = query.eq("on_stock", true)
      if (stock === "orderable") query = query.eq("on_stock", false)
      if (brands.length) query = query.in("brand_name", brands)
      if (groups.length) query = query.in("group_name", groups)
      if (thickness.length) query = query.in("thickness_mm", thickness)
      if (parsed.dims?.length && parsed.dims?.width) {
        const a = parsed.dims.length
        const b = parsed.dims.width
        query = query.or(
          `and(length_mm.eq.${a},width_mm.eq.${b}),and(length_mm.eq.${b},width_mm.eq.${a})`,
        )
      }
      if (parsed.dims?.thickness) query = query.eq("thickness_mm", parsed.dims.thickness)
      if (parsed.thicknessMm) query = query.eq("thickness_mm", parsed.thicknessMm)
      if (parsed.text) {
        const pattern = `%${parsed.text.replaceAll("%", "").replaceAll("_", "")}%`
        query = query.or(
          `name.ilike.${pattern},brand_name.ilike.${pattern},group_name.ilike.${pattern}`,
        )
      }
      if (sort === "name") query = query.order("name", { ascending: true })
      else if (sort === "thickness")
        query = query.order("thickness_mm", { ascending: true }).order("name", { ascending: true })
      else query = query.order("on_stock", { ascending: false }).order("name", { ascending: true })

      return await query.range(from, to)
    })(),
  ])

  const { data, count, error } = mainResult
  if (error) throw new Error(`Supabase query failed: ${error.message}`)

  const rows = (data as Row[]) || []
  const total = count ?? rows.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const hasActiveFilters =
    brands.length > 0 || groups.length > 0 || thickness.length > 0 || stock !== "all" || q !== ""

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Bútorlap katalógus",
    itemListElement: rows.map((r, idx) => ({
      "@type": "ListItem",
      position: from + idx + 1,
      url: `${COMPANY.website}${buildDetailHref(r)}`,
      name: r.name,
    })),
  }

  // Shared class strings
  const pillBase =
    "inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap"
  const pillOn =
    "border-[var(--color-brand)] bg-[var(--color-brand)] text-[var(--color-brand-contrast)]"
  const pillOff =
    "border-black/15 bg-white text-black/80 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
  const chipClass =
    "inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-medium text-black/85 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"

  return (
    <div className="bg-stone-wash">
      <Script
        id="jsonld-itemlist-butorlap"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Full-bleed hero: image on the left side, content on the right */}
      <section className="relative isolate overflow-hidden">
        <Image
          src="/img/egger_edc2020_heroshot.webp"
          alt="Egger bútorlap dekor kollekció"
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-bottom"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-r from-black/10 via-black/40 to-black/75"
        />
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <div className="grid gap-6 md:grid-cols-12 md:items-center">
            <div className="md:col-span-6 md:col-start-7">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white/85 backdrop-blur">
                {COMPANY.address.city} · Több márka raktáron
              </p>
              <h1 className="mt-5 text-balance text-4xl md:text-5xl font-semibold tracking-tight text-white">
                Találja meg a dekort
              </h1>
              <div
                className="mt-4 h-1.5 w-24 rounded-full bg-[var(--color-brand)]"
                aria-hidden
              />
              <p className="mt-4 text-pretty text-base md:text-lg text-white/85">
                A többit ránk bízhatja. Méretre vágjuk és élzárjuk Kecskeméten.
              </p>
              <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/szolgaltatasok/lapszabaszat-es-elzaras"
                  className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-7 py-3.5 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95"
                >
                  Hogyan dolgozunk?
                </Link>
                <a
                  href={buildRegisterUrl("/butorlap")}
                  className="text-sm text-white/75 underline underline-offset-4 hover:text-white"
                >
                  Regisztráljon — az árak 1 perc alatt megjelennek
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-14 md:pb-20">
        {/* CONTROL BAR: sticky on desktop, contains search + stock pills + filters drawer + sort */}
        <section className="mt-12 rounded-2xl border border-black/10 bg-white/95 p-4 shadow-sm backdrop-blur md:p-5 md:sticky md:top-16 z-30">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Search */}
            <form action="/butorlap" className="flex-1">
              <input type="hidden" name="stock" value={stock} />
              <input type="hidden" name="sort" value={sort} />
              {brands.map((b, i) => (
                <input key={`bh-${i}`} type="hidden" name="brand" value={b} />
              ))}
              {groups.map((g, i) => (
                <input key={`gh-${i}`} type="hidden" name="group" value={g} />
              ))}
              {thickness.map((t, i) => (
                <input key={`th-${i}`} type="hidden" name="thickness" value={String(t)} />
              ))}
              <div className="relative">
                <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/40">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3-3" />
                  </svg>
                </span>
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Pl. Egger H1180, 18mm, 2800x2070…"
                  className="block w-full rounded-full border border-black/15 bg-white py-2.5 pl-10 pr-4 text-sm text-black/90 placeholder:text-black/40 focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
                />
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              {/* Stock pills */}
              <div className="flex gap-2">
                <Link href={urlWithStock(sp, "all")} className={[pillBase, stock === "all" ? pillOn : pillOff].join(" ")}>
                  Mind
                </Link>
                <Link href={urlWithStock(sp, "in")} className={[pillBase, stock === "in" ? pillOn : pillOff].join(" ")}>
                  Raktáron
                </Link>
                <Link href={urlWithStock(sp, "orderable")} className={[pillBase, stock === "orderable" ? pillOn : pillOff].join(" ")}>
                  Beszerezhető
                </Link>
              </div>

              {/* Filter drawer (native <details> = accessible, zero JS) */}
              <details className="relative group">
                <summary className="list-none cursor-pointer inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black/85 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] [&::-webkit-details-marker]:hidden">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="7" y1="12" x2="17" y2="12" />
                    <line x1="10" y1="18" x2="14" y2="18" />
                  </svg>
                  Szűrés
                  {(brands.length + groups.length + thickness.length) > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-brand)] px-1.5 text-[11px] font-bold text-[var(--color-brand-contrast)]">
                      {brands.length + groups.length + thickness.length}
                    </span>
                  )}
                  <span aria-hidden className="text-xs transition group-open:rotate-180">▾</span>
                </summary>

                <div className="absolute right-0 top-full mt-2 w-[min(92vw,22rem)] rounded-2xl border border-black/10 bg-white p-5 shadow-xl z-50">
                  <form action="/butorlap" method="get" className="grid gap-5">
                    <input type="hidden" name="q" value={q} />
                    <input type="hidden" name="stock" value={stock} />
                    <input type="hidden" name="sort" value={sort} />

                    {filterOptions.thicknesses.length > 0 && (
                      <fieldset>
                        <legend className="text-xs font-semibold uppercase tracking-wide text-black/55">Vastagság</legend>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {filterOptions.thicknesses.map((t) => (
                            <label key={t} className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black/85 hover:border-[var(--color-brand)]">
                              <input
                                type="checkbox"
                                name="thickness"
                                value={t}
                                defaultChecked={thickness.includes(t)}
                                className="h-4 w-4 accent-[var(--color-brand)]"
                              />
                              {t} mm
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}

                    {filterOptions.brands.length > 0 && (
                      <fieldset>
                        <legend className="text-xs font-semibold uppercase tracking-wide text-black/55">Márka</legend>
                        <div className="mt-2 max-h-44 overflow-auto pr-1 grid gap-1">
                          {filterOptions.brands.map((b) => (
                            <label key={b} className="inline-flex items-center gap-2 text-sm text-black/85">
                              <input
                                type="checkbox"
                                name="brand"
                                value={b}
                                defaultChecked={brands.includes(b)}
                                className="h-4 w-4 accent-[var(--color-brand)]"
                              />
                              {b}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}

                    {filterOptions.groups.length > 0 && (
                      <fieldset>
                        <legend className="text-xs font-semibold uppercase tracking-wide text-black/55">Csoport</legend>
                        <div className="mt-2 max-h-44 overflow-auto pr-1 grid gap-1">
                          {filterOptions.groups.map((g) => (
                            <label key={g} className="inline-flex items-center gap-2 text-sm text-black/85">
                              <input
                                type="checkbox"
                                name="group"
                                value={g}
                                defaultChecked={groups.includes(g)}
                                className="h-4 w-4 accent-[var(--color-brand)]"
                              />
                              {g}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}

                    <div className="flex items-center justify-between gap-2 border-t border-black/10 pt-4">
                      <Link
                        href="/butorlap"
                        className="text-sm text-black/60 underline underline-offset-4 hover:text-[var(--color-brand)]"
                      >
                        Mind törlése
                      </Link>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-[var(--color-brand-contrast)] hover:brightness-95"
                      >
                        Alkalmaz
                      </button>
                    </div>
                  </form>
                </div>
              </details>

              {/* Sort */}
              <SortSelect
                value={sort}
                options={[
                  { value: "relevance", label: "Relevancia" },
                  { value: "name", label: "Név szerint" },
                  { value: "thickness", label: "Vastagság szerint" },
                ]}
                className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black/85 hover:border-[var(--color-brand)] focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
              />
            </div>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/10 pt-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-black/55">Aktív szűrők</span>
              {q && (
                <Link href={urlWithoutFilter(sp, "q")} className={chipClass}>
                  „{q}” <span aria-hidden className="text-black/45">×</span>
                </Link>
              )}
              {stock !== "all" && (
                <Link href={urlWithStock(sp, "all")} className={chipClass}>
                  {stock === "in" ? "Raktáron" : "Beszerezhető"} <span aria-hidden className="text-black/45">×</span>
                </Link>
              )}
              {thickness.map((t) => (
                <Link key={`tc-${t}`} href={urlWithoutFilter(sp, "thickness", String(t))} className={chipClass}>
                  {t} mm <span aria-hidden className="text-black/45">×</span>
                </Link>
              ))}
              {brands.map((b) => (
                <Link key={`bc-${b}`} href={urlWithoutFilter(sp, "brand", b)} className={chipClass}>
                  {b} <span aria-hidden className="text-black/45">×</span>
                </Link>
              ))}
              {groups.map((g) => (
                <Link key={`gc-${g}`} href={urlWithoutFilter(sp, "group", g)} className={chipClass}>
                  {g} <span aria-hidden className="text-black/45">×</span>
                </Link>
              ))}
              <Link
                href="/butorlap"
                className="ml-auto text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)] underline underline-offset-4"
              >
                Alaphelyzet
              </Link>
            </div>
          )}
        </section>

        {/* Results meta */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="text-black/65">
            <span className="font-semibold text-black/85">{total}</span> találat • Oldal{" "}
            <span className="font-semibold text-black/85">{page}</span> / {totalPages}
          </div>
          <div className="text-black/55">
            A „Beszerezhető” jelzésű tételeket Önnek beszerezzük.
          </div>
        </div>

        {/* Cards grid: image-first, fully clickable, thickness chip on image */}
        <section className="mt-6">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-black/10 bg-white p-10 text-center">
              <div className="text-base font-semibold text-black/85">Nincs találat ezekkel a szűrőkkel.</div>
              <p className="mt-2 text-sm text-black/65">
                Próbálja meg törölni egy-két szűrőt, vagy{" "}
                <Link href="/butorlap" className="underline underline-offset-4 hover:text-[var(--color-brand)]">
                  állítsa alaphelyzetbe a katalógust
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((r, idx) => {
                const href = buildDetailHref(r)
                const img = r.image_url || "/img/hiros_logo.png"
                return (
                  <Link
                    key={r.id}
                    href={href}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white transition hover:border-black/20 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/40"
                  >
                    <div className="relative aspect-[4/3] w-full bg-stone-50">
                      <Image
                        src={img}
                        alt={`${r.name} bútorlap`}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        priority={idx < 6}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      />
                      {/* Top-left: stock badge */}
                      <div className="absolute left-3 top-3">
                        <div
                          className={[
                            "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur",
                            stockClass(r.on_stock),
                          ].join(" ")}
                        >
                          {stockLabel(r.on_stock)}
                        </div>
                      </div>
                      {/* Top-right: thickness chip */}
                      <div className="absolute right-3 top-3">
                        <div
                          className={[
                            "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold backdrop-blur",
                            thicknessChipClass(r.thickness_mm),
                          ].join(" ")}
                        >
                          {r.thickness_mm} mm
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h2 className="text-base font-semibold leading-snug text-black/90 transition-colors group-hover:text-[var(--color-brand)]">
                        {r.name}
                      </h2>
                      <div className="mt-1 text-sm text-black/60">
                        {[r.brand_name, r.group_name].filter(Boolean).join(" • ")}
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <span className="text-sm text-black/75">
                          {r.length_mm} × {r.width_mm} mm
                        </span>
                        <span
                          aria-hidden
                          className="text-xl leading-none text-black/30 transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-brand)]"
                        >
                          ›
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-between gap-3">
              <div className="text-sm text-black/60">
                {from + 1}–{Math.min(to + 1, total)} / {total}
              </div>
              <div className="flex gap-2">
                <Link
                  aria-disabled={page <= 1}
                  className={[
                    "rounded-full border px-4 py-2 text-sm font-semibold",
                    page <= 1
                      ? "border-black/10 text-black/30 pointer-events-none"
                      : "border-black/15 text-black/80 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]",
                  ].join(" ")}
                  href={{ pathname: "/butorlap", query: { ...sp, page: Math.max(1, page - 1) } }}
                >
                  Előző
                </Link>
                <Link
                  aria-disabled={page >= totalPages}
                  className={[
                    "rounded-full border px-4 py-2 text-sm font-semibold",
                    page >= totalPages
                      ? "border-black/10 text-black/30 pointer-events-none"
                      : "border-black/15 text-black/80 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]",
                  ].join(" ")}
                  href={{ pathname: "/butorlap", query: { ...sp, page: Math.min(totalPages, page + 1) } }}
                >
                  Következő
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Buyer's guide above FAQ */}
        <section className="mt-16 rounded-2xl border border-black/10 bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Vásárlás előtt</h2>
          <p className="mt-2 text-sm text-black/65">
            Három szempont, ami megkönnyíti a választást.
          </p>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            <li className="rounded-xl border border-black/10 bg-stone-50/60 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-black/55">1. lépés</div>
              <div className="mt-1 text-base font-semibold text-black/90">Vastagság</div>
              <p className="mt-2 text-sm text-black/70">
                18&nbsp;mm fronthoz, oldalhoz, polchoz. 25&nbsp;mm
                terhelhetőbb felületekhez, például konyhaszigethez vagy
                asztallaphoz.
              </p>
            </li>
            <li className="rounded-xl border border-black/10 bg-stone-50/60 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-black/55">2. lépés</div>
              <div className="mt-1 text-base font-semibold text-black/90">Felület</div>
              <p className="mt-2 text-sm text-black/70">
                Matt, fényes, faerezetes, kőhatású és fémhatású dekorok közül
                választhat. A katalógusban a fotó alapján böngésszen.
              </p>
            </li>
            <li className="rounded-xl border border-black/10 bg-stone-50/60 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-black/55">3. lépés</div>
              <div className="mt-1 text-base font-semibold text-black/90">Készlet</div>
              <p className="mt-2 text-sm text-black/70">
                A <span className="font-semibold">„Raktáron”</span> jelölésű
                most átvehető. A{" "}
                <span className="font-semibold">„Beszerezhető”</span> tételeket
                beszerezzük, az időpontot előre egyeztetjük.
              </p>
            </li>
          </ol>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-black/60">Nem biztos benne?</span>
            <Link
              href="/kapcsolat"
              className="inline-flex items-center gap-1 font-semibold text-[var(--color-brand)] underline underline-offset-4 hover:brightness-90"
            >
              Segítünk választani →
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-10 rounded-2xl border border-black/10 bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Gyakori kérdések</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-white p-5">
              <div className="font-semibold">Mit jelent a „Beszerezhető”?</div>
              <p className="mt-2 text-sm text-black/70">
                Most nincs raktáron, de beszerezzük. A beszerzési időt
                márkától függően a megrendeléskor egyeztetjük.
              </p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-5">
              <div className="font-semibold">Méretre vágják és élzárják?</div>
              <p className="mt-2 text-sm text-black/70">
                Igen. A kiválasztott bútorlapot kérésre méretre vágjuk és
                élzárjuk.
              </p>
              <Link
                className="mt-3 inline-block text-sm font-semibold underline underline-offset-4 hover:text-[var(--color-brand)]"
                href="/szolgaltatasok/lapszabaszat-es-elzaras"
              >
                Lapszabászat részletek →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
