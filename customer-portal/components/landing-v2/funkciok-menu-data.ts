/** Funkciók mega-menu + /v2/funkciok/[slug] oldalak. */

export type FunkcioMenuItem = {
  label: string
  description: string
  slug: string
}

export type FunkcioMenuSection = {
  id: 'alap' | 'innovativ' | 'egyedi'
  title: string
  tagline: string
  items: FunkcioMenuItem[]
}

export const FUNKCIOK_MENU: FunkcioMenuSection[] = [
  {
    id: 'alap',
    title: 'Alap funkciók',
    tagline: 'Minden nap működik, egy helyen átlátható.',
    items: [
      { label: 'Számlázás', description: 'Automatikus számlák, kevesebb manuális hiba.', slug: 'szamlazas' },
      { label: 'Készletezés', description: 'Valós készlet, webshop és bolt egy számon.', slug: 'keszletezes' },
      { label: 'Beszerzés', description: 'Rendelések és beszállítók átláthatóan.', slug: 'beszerzes' },
      { label: 'Rendeléskezelés', description: 'Rendelés állapot egy képernyőn.', slug: 'rendeleskezeles' },
      { label: 'Bolti eladás', description: 'POS és bolti folyamatok összhangban a webshoppal.', slug: 'bolti-eladas' },
      { label: 'Kiszállítás kezelés', description: 'Futárok és csomagkövetés egy rendszerben.', slug: 'kiszallitas-kezeles' },
      { label: 'PDA-s megoldások', description: 'Raktár és bolti mozgás kézből, pontosan.', slug: 'pda-megoldasok' },
    ],
  },
  {
    id: 'innovativ',
    title: 'Innovatív funkciók',
    tagline: 'AI és piaci adatok, gyorsabb döntésekhez.',
    items: [
      {
        label: 'AI termékadat-generálás',
        description: 'Termékleírások és adatok gyorsan, konzisztensen.',
        slug: 'ai-termekadat-generalas',
      },
      {
        label: 'AI kategóriaadat-generálás',
        description: 'Kategóriák és struktúra, ami a keresőnek is segít.',
        slug: 'ai-kategoriaadat-generalas',
      },
      {
        label: 'AI versenytárselemzés és piaci radar',
        description: 'Versenytársak és piaci mozgások átláthatóan.',
        slug: 'ai-versenytars-elemzes-piaci-radar',
      },
      {
        label: 'Google-elemzés és integrációk',
        description: 'Kampányok és organikus eredmények egy helyen.',
        slug: 'google-elemzes-integraciok',
      },
    ],
  },
  {
    id: 'egyedi',
    title: 'Egyedi fejlesztés',
    tagline: 'Rád szabott integrációk és folyamatok.',
    items: [
      {
        label: 'Egyedi integrációk',
        description: 'Rendszerek összekötése a te stack-eddel.',
        slug: 'egyedi-integraciok',
      },
      {
        label: 'Egyedi üzleti folyamatok',
        description: 'Olyan folyamat, amilyen a céged valójában működik.',
        slug: 'egyedi-uzleti-folyamatok',
      },
      {
        label: 'Workshop és igényfelmérés',
        description: 'Közösen pontosítjuk, mire van szükséged.',
        slug: 'workshop-igenyfelmeres',
      },
    ],
  },
]

const slugSet = new Set<string>()
for (const sec of FUNKCIOK_MENU) {
  for (const it of sec.items) {
    slugSet.add(it.slug)
  }
}

export function isValidFunkcioSlug(slug: string): boolean {
  return slugSet.has(slug)
}

export function getFunkcioBySlug(slug: string): (FunkcioMenuItem & { sectionTitle: string; sectionTagline: string }) | null {
  for (const sec of FUNKCIOK_MENU) {
    const item = sec.items.find(i => i.slug === slug)
    if (item) return { ...item, sectionTitle: sec.title, sectionTagline: sec.tagline }
  }
  return null
}
