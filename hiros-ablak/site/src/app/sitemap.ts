import type { MetadataRoute } from "next"
import { COMPANY } from "@/lib/company"
import { getSupabaseServerClient } from "@/lib/supabase"

type CatalogRow = {
  slug: string | null
  updated_at: string
  indexable_on_site: boolean
}

function toIsoDate(input: string) {
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

const STATIC_PATHS = [
  "/",
  "/kapcsolat",
  "/barkacsaruhaz-kecskemet",
  "/asztalos-partner",
  "/szolgaltatasok/lapszabaszat-es-elzaras",
  "/szolgaltatasok/online-lapszabaszat",
  "/szolgaltatasok/nettfront",
  "/szolgaltatasok/ipari-megoldasok/szallitolada-keszites",
  "/butorlap",
  "/munkalap",
  "/adatkezelesi-tajekoztato",
  "/cookie-tajekoztato",
] as const

/** Refresh catalog URLs from Supabase hourly (no redeploy needed for new indexable PDPs). */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${COMPANY.website}${path}`,
    lastModified: now,
  }))

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return entries

  const supabase = getSupabaseServerClient()

  const [butorlapRes, munkalapRes] = await Promise.all([
    supabase
      .from("public_butorlap")
      .select("slug,updated_at,indexable_on_site")
      .eq("indexable_on_site", true)
      .not("slug", "is", null),
    supabase
      .from("public_munkalap")
      .select("slug,updated_at,indexable_on_site")
      .eq("indexable_on_site", true)
      .not("slug", "is", null),
  ])

  const appendCatalog = (rows: CatalogRow[] | null, prefix: "/butorlap" | "/munkalap") => {
    for (const r of rows ?? []) {
      if (!r.slug || !r.indexable_on_site) continue
      entries.push({
        url: `${COMPANY.website}${prefix}/${r.slug}`,
        lastModified: toIsoDate(r.updated_at),
      })
    }
  }

  appendCatalog(butorlapRes.data as CatalogRow[] | null, "/butorlap")
  appendCatalog(munkalapRes.data as CatalogRow[] | null, "/munkalap")

  return entries
}
