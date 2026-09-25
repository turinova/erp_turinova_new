/**
 * Google Product Taxonomy — bútorvasalat / hardware subset + HU név → ID.
 * Forrás: https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
 * Feedbe: numerikus ID (Merchant elfogadja ID-t vagy teljes path-ot).
 */

export type GoogleTaxonomyOption = {
  id: string
  path: string
  /** Magyar tipp a pickerben */
  hintHu: string
}

/** Releváns subset a bolt UI pickerhez (nem a teljes ~5k sor). */
export const GOOGLE_TAXONOMY_OPTIONS: GoogleTaxonomyOption[] = [
  {
    id: '4696',
    path: 'Hardware > Hardware Accessories > Cabinet Hardware',
    hintHu: 'Bútorvasalat (általános)'
  },
  {
    id: '4700',
    path: 'Hardware > Hardware Accessories > Cabinet Hardware > Cabinet Knobs & Handles',
    hintHu: 'Fogantyú / gomb'
  },
  {
    id: '4698',
    path: 'Hardware > Hardware Accessories > Cabinet Hardware > Cabinet Catches',
    hintHu: 'Mágnes / zár / catch'
  },
  {
    id: '4697',
    path: 'Hardware > Hardware Accessories > Cabinet Hardware > Cabinet Backplates',
    hintHu: 'Alátét / backplate'
  },
  {
    id: '232167',
    path: 'Hardware > Hardware Accessories > Cabinet Hardware > Cabinet & Furniture Keyhole Escutcheons',
    hintHu: 'Kulcslyuk dísz'
  },
  {
    id: '1771',
    path: 'Hardware > Hardware Accessories > Hinges',
    hintHu: 'Zsanér'
  },
  {
    id: '8470',
    path: 'Hardware > Hardware Accessories > Drawer Slides',
    hintHu: 'Fiókcsúszó'
  },
  {
    id: '499981',
    path: 'Hardware > Hardware Accessories > Casters',
    hintHu: 'Görgő / kerék'
  },
  {
    id: '7092',
    path: 'Hardware > Hardware Accessories > Brackets & Reinforcement Braces',
    hintHu: 'Konzol / erősítő'
  },
  {
    id: '500054',
    path: 'Hardware > Hardware Accessories > Hardware Fasteners',
    hintHu: 'Rögzítő / csavar (csoport)'
  },
  {
    id: '2251',
    path: 'Hardware > Hardware Accessories > Hardware Fasteners > Screws',
    hintHu: 'Csavar'
  },
  {
    id: '1739',
    path: 'Hardware > Hardware Accessories > Hardware Fasteners > Nuts & Bolts',
    hintHu: 'Anyacsavar / csavaranya'
  },
  {
    id: '6343',
    path: 'Hardware > Building Materials > Door Hardware',
    hintHu: 'Ajtóvasalat'
  },
  {
    id: '1356',
    path: 'Hardware > Building Materials > Door Hardware > Door Knobs & Handles',
    hintHu: 'Ajtókilincs'
  },
  {
    id: '6446',
    path: 'Hardware > Building Materials > Door Hardware > Door Closers',
    hintHu: 'Ajtóbehúzó'
  },
  {
    id: '2665',
    path: 'Hardware > Building Materials > Door Hardware > Door Stops',
    hintHu: 'Ajtóütköző'
  },
  {
    id: '2878',
    path: 'Hardware > Hardware Accessories',
    hintHu: 'Hardver tartozék (szülő)'
  }
]

/** HU / ASCII kategórianév → taxonomy ID (seed + auto-suggest). */
const HU_NAME_TO_ID: Record<string, string> = {
  vasalat: '4696',
  butorvasalat: '4696',
  fogantyu: '4700',
  fogantyuk: '4700',
  gomb: '4700',
  gombok: '4700',
  zsaner: '1771',
  zsanerok: '1771',
  pant: '1771',
  fiokcsuszo: '8470',
  fiokcsuszok: '8470',
  csuszo: '8470',
  magnet: '4698',
  zaro: '4698',
  catch: '4698',
  alatet: '4697',
  backplate: '4697',
  gorgo: '499981',
  kerek: '499981',
  konzol: '7092',
  polckonzol: '7092',
  csavar: '2251',
  csavarok: '2251',
  ajtovasalat: '6343',
  kilincs: '1356',
  ajtokilincs: '1356',
  ajtobehuozo: '6446',
  egyeb: '4696'
}

export function normalizeCategoryNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('hu')
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}

export function suggestTaxonomyIdFromCategoryName(
  name: string
): string | null {
  const key = normalizeCategoryNameKey(name)
  if (!key) return null
  if (HU_NAME_TO_ID[key]) return HU_NAME_TO_ID[key]

  // Részleges egyezés: pl. „Bútorzsanér”, „Fiókcsúszó 450”
  for (const [alias, id] of Object.entries(HU_NAME_TO_ID)) {
    if (alias.length < 4) continue
    if (key.includes(alias) || alias.includes(key)) return id
  }
  return null
}

export function taxonomyOptionById(
  id: string | null | undefined
): GoogleTaxonomyOption | null {
  if (!id?.trim()) return null
  const needle = id.trim()
  return GOOGLE_TAXONOMY_OPTIONS.find((o) => o.id === needle) ?? null
}

/**
 * Explicit érték nyer; üresnél név-lookup; még üresnél szülő taxonomy.
 */
export function resolveGoogleTaxonomyId(input: {
  explicit?: string | null
  categoryName: string
  parentTaxonomyId?: string | null
}): string | null {
  const explicit = input.explicit?.trim() || null
  if (explicit) return explicit

  const fromName = suggestTaxonomyIdFromCategoryName(input.categoryName)
  if (fromName) return fromName

  const fromParent = input.parentTaxonomyId?.trim() || null
  return fromParent
}

export function googleTaxonomyMenuOptions(): {
  value: string
  label: string
  hint?: string
}[] {
  return GOOGLE_TAXONOMY_OPTIONS.map((o) => ({
    value: o.id,
    label: `${o.hintHu} (${o.id})`,
    hint: o.path
  }))
}
