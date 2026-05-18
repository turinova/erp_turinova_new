/**
 * Showroom / hardware brands (áruház) — static marketing list.
 * NOT sourced from materials / public_butorlap. No product catalog URLs.
 */

export const SHOWROOM_DEFAULT_HREF = "/barkacsaruhaz-kecskemet"

export type ShowroomBrand = { name: string }

export type ShowroomBrandGroup = {
  id: string
  label: string
  brands: readonly ShowroomBrand[]
}

export const SHOWROOM_BRAND_GROUPS: readonly ShowroomBrandGroup[] = [
  {
    id: "mosogato",
    label: "Mosogató, csaptelep",
    brands: [
      { name: "Metalac" },
      { name: "Ulgran" },
      { name: "Blanco" },
      { name: "Evido" },
      { name: "Falmec" },
      { name: "Quadron" },
      { name: "Strongsinks" },
      { name: "Multikomplex" },
      { name: "Ferro" },
    ],
  },
  {
    id: "paraelszivo",
    label: "Páraelszívó, légtechnika",
    brands: [
      { name: "Cata" },
      { name: "Elleci" },
      { name: "Elica" },
      { name: "Nodor" },
    ],
  },
  {
    id: "vasalat",
    label: "Vasalat, fiókrendszer",
    brands: [
      { name: "Blum" },
      { name: "FDS-PRO" },
      { name: "Slim" },
      { name: "Hettich" },
      { name: "Kesseboehmer" },
      { name: "StrongMax" },
      { name: "StrongBox" },
      { name: "StrongRide" },
    ],
  },
  {
    id: "beszallito",
    label: "Kiemelt beszállítók",
    brands: [
      { name: "Demos Trade" },
      { name: "Forest" },
      { name: "Hranipex" },
    ],
  },
  {
    id: "ragaszto",
    label: "Ragasztó, tömítő, szilikon",
    brands: [{ name: "Tytan" }, { name: "Soudal" }],
  },
  {
    id: "haztartasi",
    label: "Beépített / háztartás",
    brands: [{ name: "Electrolux" }, { name: "AEG" }],
  },
  {
    id: "szerszam",
    label: "Szerszám",
    brands: [{ name: "Neo Tools" }],
  },
]

/** Kiemelt áruház márkák a kezdőlapon (nem a teljes lista). */
export const SHOWROOM_FEATURED_NAMES: readonly string[] = [
  "Blum",
  "Blanco",
  "Metalac",
  "Elica",
  "Demos Trade",
  "StrongMax",
  "FDS-PRO",
  "Tytan",
  "Electrolux",
  "Hettich",
]

export function showroomFeaturedChipItems(): { name: string; href: string }[] {
  return SHOWROOM_FEATURED_NAMES.map((name) => ({
    name,
    href: SHOWROOM_DEFAULT_HREF,
  }))
}

export function flattenShowroomBrandNames(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const group of SHOWROOM_BRAND_GROUPS) {
    for (const b of group.brands) {
      if (!seen.has(b.name)) {
        seen.add(b.name)
        out.push(b.name)
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b, "hu"))
}

export function flattenShowroomChipItems(): { name: string; href: string }[] {
  return flattenShowroomBrandNames().map((name) => ({
    name,
    href: SHOWROOM_DEFAULT_HREF,
  }))
}
