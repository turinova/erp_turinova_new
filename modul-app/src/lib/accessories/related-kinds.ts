export const RELATED_KINDS = ['required', 'accessory', 'alternative', 'larger_pack'] as const

export type RelatedKind = (typeof RELATED_KINDS)[number]

export const RELATED_KIND_META: Record<
  RelatedKind,
  { label: string; description: string; empty: string }
> = {
  required: {
    label: 'Kell hozzá',
    description: 'Ami nélkül a termék nem használható (pl. elem, rögzítő, töltő). A vásárlás gomb közelében jelenik meg.',
    empty: 'Nincs megadva. Ha a termék magában is használható, hagyd üresen.'
  },
  accessory: {
    label: 'Tartozék',
    description: 'Opcionális kiegészítő, ami jól jön hozzá (pl. tok, utántöltő, tisztítószer).',
    empty: 'Nincs tartozék megadva.'
  },
  alternative: {
    label: 'Alternatíva',
    description: 'Helyette is jó választás. Elfogyott terméknél ezt ajánljuk először. Kölcsönös: a másik terméknél is megjelenik.',
    empty: 'Nincs alternatíva megadva — elfogyáskor a hasonló termékeket ajánljuk.'
  },
  larger_pack: {
    label: 'Nagyobb kiszerelés',
    description: 'Ugyanez nagyobb csomagban, jellemzően kedvezőbb egységáron.',
    empty: 'Nincs nagyobb kiszerelés megadva.'
  }
}

export const MAX_RELATED_PER_KIND = 8

export function isRelatedKind(v: unknown): v is RelatedKind {
  return typeof v === 'string' && (RELATED_KINDS as readonly string[]).includes(v)
}
