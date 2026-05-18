import { getSupabaseServerClient } from "@/lib/supabase"

export type CatalogBrands = {
  butorlap: string[]
  munkalap: string[]
}

export type BrandChipItem = {
  name: string
  href: string
}

function sortHu(names: string[]): string[] {
  return [...names].sort((a, b) => a.localeCompare(b, "hu"))
}

function collectBrandNames(
  rows: { brand_name: string | null }[] | null,
): string[] {
  const set = new Set<string>()
  for (const row of rows ?? []) {
    if (row.brand_name?.trim()) set.add(row.brand_name.trim())
  }
  return sortHu(Array.from(set))
}

/** Distinct panel brands from Supabase catalog views (materials / linear_materials). */
export async function fetchCatalogBrands(): Promise<CatalogBrands> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return { butorlap: [], munkalap: [] }

  try {
    const supabase = getSupabaseServerClient()
    const [butorlapRes, munkalapRes] = await Promise.all([
      supabase.from("public_butorlap").select("brand_name"),
      supabase.from("public_munkalap").select("brand_name"),
    ])

    return {
      butorlap: collectBrandNames(
        butorlapRes.data as { brand_name: string | null }[] | null,
      ),
      munkalap: collectBrandNames(
        munkalapRes.data as { brand_name: string | null }[] | null,
      ),
    }
  } catch {
    return { butorlap: [], munkalap: [] }
  }
}

export function resolveCatalogBrandHref(
  name: string,
  catalog: CatalogBrands,
): string {
  if (catalog.butorlap.includes(name)) {
    return `/butorlap?brand=${encodeURIComponent(name)}`
  }
  if (catalog.munkalap.includes(name)) {
    return `/munkalap?brand=${encodeURIComponent(name)}`
  }
  return "/butorlap"
}

export function mergeCatalogBrandNames(catalog: CatalogBrands): string[] {
  const set = new Set([...catalog.butorlap, ...catalog.munkalap])
  return sortHu(Array.from(set))
}

export function catalogBrandChipItems(
  catalog: CatalogBrands,
  names?: string[],
): BrandChipItem[] {
  const list = names ?? mergeCatalogBrandNames(catalog)
  return list.map((name) => ({
    name,
    href: resolveCatalogBrandHref(name, catalog),
  }))
}

/** Homepage / compact strips: prefer bútorlap names, then munkalap-only. */
export function pickFeaturedCatalogBrands(
  catalog: CatalogBrands,
  limit = 8,
): BrandChipItem[] {
  const munkalapOnly = catalog.munkalap.filter(
    (n) => !catalog.butorlap.includes(n),
  )
  const ordered = [...catalog.butorlap, ...munkalapOnly]
  return catalogBrandChipItems(catalog, ordered.slice(0, limit))
}
