/**
 * Kategóriánkénti kulcsadatok — tiszta függvények, kliens + szerver.
 * Nincs zod / supabase import: a publikus PDP bundle-be is bekerülhet.
 */

import type {
  AttributeInput,
  AttributeValueType,
  CategoryAttributeRole,
  CategoryTemplateItem,
  ProductAttributeRow
} from '@/lib/webshop/types'

export const MAX_KEY_SPECS = 4
export const MAX_TEMPLATE_ITEMS = 16

export const VALUE_TYPE_LABEL: Record<AttributeValueType, string> = {
  list: 'Lista (választható értékek)',
  number: 'Szám',
  range: 'Tartomány (min–max)',
  boolean: 'Igen / nem'
}

export const UNIT_OPTIONS = ['mm', 'cm', 'm', 'kg', 'g', '°', 'db', 'l', 'W', 'V'] as const

// ---------------------------------------------------------------------------
// Öröklés
// ---------------------------------------------------------------------------

type CategoryNode = {
  id: string
  name: string
  parentId: string | null
  measureImageUrl: string | null
  template: CategoryTemplateItem[]
}

export type ResolvedTemplate = {
  items: CategoryTemplateItem[]
  /** Melyik kategóriáé a sablon (lehet ős). */
  sourceCategoryId: string | null
  sourceCategoryName: string | null
  inherited: boolean
  /** Legközelebbi mérési ábra a láncon. */
  measureImageUrl: string | null
}

const EMPTY_TEMPLATE: ResolvedTemplate = {
  items: [],
  sourceCategoryId: null,
  sourceCategoryName: null,
  inherited: false,
  measureImageUrl: null
}

/** Legközelebbi saját sablon a szülőláncon; ciklus- és mélységvédett. */
export function resolveCategoryTemplate(
  categories: CategoryNode[],
  categoryId: string | null | undefined
): ResolvedTemplate {
  if (!categoryId) return EMPTY_TEMPLATE
  const byId = new Map(categories.map((c) => [c.id, c]))
  const visited = new Set<string>()
  let current = byId.get(categoryId) ?? null
  let measureImageUrl: string | null = null
  let found: CategoryNode | null = null

  while (current && !visited.has(current.id) && visited.size < 10) {
    visited.add(current.id)
    if (!measureImageUrl && current.measureImageUrl) {
      measureImageUrl = current.measureImageUrl
    }
    if (!found && current.template.length > 0) found = current
    if (found && measureImageUrl) break
    current = current.parentId ? (byId.get(current.parentId) ?? null) : null
  }

  if (!found) return { ...EMPTY_TEMPLATE, measureImageUrl }
  return {
    items: sortTemplate(found.template),
    sourceCategoryId: found.id,
    sourceCategoryName: found.name,
    inherited: found.id !== categoryId,
    measureImageUrl
  }
}

export function sortTemplate(items: CategoryTemplateItem[]): CategoryTemplateItem[] {
  return [...items].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'key' ? -1 : 1
    return a.sortOrder - b.sortOrder
  })
}

// ---------------------------------------------------------------------------
// Szám bevitel / formázás
// ---------------------------------------------------------------------------

/** Magyar bevitel: 37,5 és 37.5 is OK; üres → null; hibás → NaN. */
export function parseSpecNumber(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
}

export function specNumberToRaw(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return String(n).replace('.', ',')
}

const numberFmt = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 2 })

function withUnit(text: string, unit: string | null): string {
  if (!unit) return text
  if (unit === '°' || unit === '%') return `${text}${unit}`
  return `${text} ${unit}`
}

export function formatSpecNumber(n: number, unit: string | null): string {
  return withUnit(numberFmt.format(n), unit)
}

/** Egy termék egy adatának kijelzett értéke; null ha nincs érték. */
export function formatAttributeValue(
  attr: Pick<ProductAttributeRow, 'valueType' | 'unit'>,
  input: AttributeInput | null | undefined,
  listLabels: string[]
): string | null {
  switch (attr.valueType) {
    case 'list':
      return listLabels.length > 0 ? listLabels.join(', ') : null
    case 'boolean':
      if (input?.valueBool == null) return null
      return input.valueBool ? 'Igen' : 'Nem'
    case 'number':
      if (input?.valueNum == null) return null
      return formatSpecNumber(input.valueNum, attr.unit)
    case 'range': {
      const min = input?.valueNum ?? null
      const max = input?.valueMax ?? null
      if (min == null && max == null) return null
      if (min != null && max != null && min !== max) {
        return withUnit(`${numberFmt.format(min)}–${numberFmt.format(max)}`, attr.unit)
      }
      const single = (min ?? max) as number
      if (min == null) return `legfeljebb ${formatSpecNumber(single, attr.unit)}`
      if (max == null) return `legalább ${formatSpecNumber(single, attr.unit)}`
      return formatSpecNumber(single, attr.unit)
    }
  }
}

/** Rendezési kulcs variáns-tengelyhez (számnál numerikus). */
export function attributeSortValue(
  attr: Pick<ProductAttributeRow, 'valueType'>,
  input: AttributeInput | null | undefined
): number | null {
  if (attr.valueType === 'number' || attr.valueType === 'range') {
    return input?.valueNum ?? input?.valueMax ?? null
  }
  if (attr.valueType === 'boolean') {
    return input?.valueBool == null ? null : input.valueBool ? 1 : 0
  }
  return null
}

/** schema.org / UN/CEFACT unitCode. */
export function unitCodeFor(unit: string | null): string | null {
  switch (unit) {
    case 'mm':
      return 'MMT'
    case 'cm':
      return 'CMT'
    case 'm':
      return 'MTR'
    case 'kg':
      return 'KGM'
    case 'g':
      return 'GRM'
    case '°':
      return 'DD'
    case 'db':
      return 'C62'
    case 'l':
      return 'LTR'
    case 'W':
      return 'WTT'
    case 'V':
      return 'VLT'
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Javaslat a névből (csak egyértelmű esetben)
// ---------------------------------------------------------------------------

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Ha a névben pontosan egy szám áll az adat mértékegységével, azt javasolja.
 * Kettő vagy több találat → null (nem találgatunk).
 */
export function suggestNumberFromName(
  name: string,
  unit: string | null
): number | null {
  if (!unit) return null
  const re =
    unit === '°'
      ? /(\d+(?:[.,]\d+)?)\s*°/g
      : new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${escapeRe(unit)}(?![\\p{L}])`, 'giu')
  const hits = [...name.matchAll(re)].map((m) => Number(m[1].replace(',', '.')))
  const unique = [...new Set(hits.filter((n) => Number.isFinite(n)))]
  return unique.length === 1 ? unique[0] : null
}

// ---------------------------------------------------------------------------
// Sablonjavaslatok (nem seed — a bolt egy kattintással hozzáadja)
// ---------------------------------------------------------------------------

export type KeySpecPresetAttribute = {
  name: string
  code: string
  valueType: AttributeValueType
  unit: string | null
  measureHint: string | null
  role: CategoryAttributeRole
  allowMultiple?: boolean
  values?: string[]
}

export type KeySpecPreset = {
  id: string
  label: string
  attributes: KeySpecPresetAttribute[]
}

export const KEY_SPEC_PRESETS: KeySpecPreset[] = [
  {
    id: 'fogantyu',
    label: 'Fogantyú',
    attributes: [
      {
        name: 'Furattávolság',
        code: 'hole_spacing',
        valueType: 'number',
        unit: 'mm',
        measureHint: 'A két csavarfurat közepe közötti távolság.',
        role: 'key'
      },
      {
        name: 'Teljes hossz',
        code: 'overall_length',
        valueType: 'number',
        unit: 'mm',
        measureHint: 'A fogantyú két vége közötti hossz.',
        role: 'key'
      },
      {
        name: 'Kiállás',
        code: 'projection',
        valueType: 'number',
        unit: 'mm',
        measureHint: 'Mennyire áll ki a fogantyú a front síkjából.',
        role: 'key'
      },
      {
        name: 'Csavarmenet',
        code: 'screw_thread',
        valueType: 'list',
        unit: null,
        measureHint: 'A rögzítő csavar mérete.',
        role: 'key',
        values: ['M4', 'M5']
      },
      {
        name: 'Frontvastagság',
        code: 'front_thickness',
        valueType: 'range',
        unit: 'mm',
        measureHint: 'Ilyen vastag ajtóhoz / fiókelőhöz jó a mellékelt csavar.',
        role: 'spec'
      }
    ]
  },
  {
    id: 'zsaner',
    label: 'Zsanér',
    attributes: [
      {
        name: 'Ráütés',
        code: 'overlay',
        valueType: 'list',
        unit: null,
        measureHint: 'Mennyire takarja az ajtó a korpusz oldalát.',
        role: 'key',
        allowMultiple: true,
        values: ['Teljes ráütés', 'Fél ráütés', 'Belső (beütő)']
      },
      {
        name: 'Nyílásszög',
        code: 'opening_angle',
        valueType: 'number',
        unit: '°',
        measureHint: 'Meddig nyitható az ajtó.',
        role: 'key'
      },
      {
        name: 'Fazékátmérő',
        code: 'cup_diameter',
        valueType: 'number',
        unit: 'mm',
        measureHint: 'Az ajtóba fúrt lyuk átmérője (általában 35 mm).',
        role: 'key'
      },
      {
        name: 'Ajtóvastagság',
        code: 'door_thickness',
        valueType: 'range',
        unit: 'mm',
        measureHint: 'Ilyen vastag ajtóhoz használható.',
        role: 'key'
      },
      {
        name: 'Fékes',
        code: 'soft_close',
        valueType: 'boolean',
        unit: null,
        measureHint: 'Csillapítva, csendesen záródik.',
        role: 'spec'
      }
    ]
  },
  {
    id: 'fiokcsuszo',
    label: 'Fiókcsúszó',
    attributes: [
      {
        name: 'Névleges hossz',
        code: 'nominal_length',
        valueType: 'number',
        unit: 'mm',
        measureHint: 'A sín hossza zárt állapotban.',
        role: 'key'
      },
      {
        name: 'Min. korpuszmélység',
        code: 'min_cabinet_depth',
        valueType: 'number',
        unit: 'mm',
        measureHint: 'Legalább ilyen mély belső tér kell.',
        role: 'key'
      },
      {
        name: 'Teherbírás',
        code: 'load_capacity',
        valueType: 'number',
        unit: 'kg',
        measureHint: 'Egy fiókra (párra) megengedett terhelés.',
        role: 'key'
      },
      {
        name: 'Kihúzás',
        code: 'extension',
        valueType: 'list',
        unit: null,
        measureHint: 'Mennyire jön ki a fiók.',
        role: 'key',
        values: ['Részleges', 'Teljes']
      },
      {
        name: 'Push-to-open',
        code: 'push_to_open',
        valueType: 'boolean',
        unit: null,
        measureHint: 'Nyomásra nyílik, fogantyú nélkül.',
        role: 'spec'
      }
    ]
  },
  {
    id: 'polc',
    label: 'Polc / polctartó',
    attributes: [
      {
        name: 'Szélesség',
        code: 'shelf_width',
        valueType: 'number',
        unit: 'mm',
        measureHint: 'A polc hossza balról jobbra.',
        role: 'key'
      },
      {
        name: 'Mélység',
        code: 'shelf_depth',
        valueType: 'number',
        unit: 'mm',
        measureHint: 'A faltól előre mért méret.',
        role: 'key'
      },
      {
        name: 'Vastagság',
        code: 'shelf_thickness',
        valueType: 'number',
        unit: 'mm',
        measureHint: 'A polclap vastagsága.',
        role: 'key'
      },
      {
        name: 'Teherbírás polconként',
        code: 'shelf_load',
        valueType: 'number',
        unit: 'kg',
        measureHint: 'Egyenletesen elosztott terhelés.',
        role: 'key'
      }
    ]
  },
  {
    id: 'butorlab',
    label: 'Bútorláb',
    attributes: [
      {
        name: 'Magasság',
        code: 'leg_height',
        valueType: 'number',
        unit: 'mm',
        measureHint: 'A padlótól a rögzítési felületig.',
        role: 'key'
      },
      {
        name: 'Állítási tartomány',
        code: 'leg_adjust_range',
        valueType: 'range',
        unit: 'mm',
        measureHint: 'Ennyit lehet rajta szintezni.',
        role: 'key'
      },
      {
        name: 'Teherbírás lábanként',
        code: 'leg_load',
        valueType: 'number',
        unit: 'kg',
        measureHint: 'Egy lábra jutó terhelés.',
        role: 'key'
      },
      {
        name: 'Rögzítés',
        code: 'leg_mounting',
        valueType: 'list',
        unit: null,
        measureHint: 'Hogyan kerül a bútorra.',
        role: 'key',
        values: ['Csavaros talp', 'Menetes csap', 'Ragasztós']
      }
    ]
  }
]
