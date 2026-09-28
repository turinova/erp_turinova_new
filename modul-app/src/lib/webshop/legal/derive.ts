/** Meglévő adatokból kikövetkeztetett jogi adatok — a tenantnak ezeket nem kell megadnia. */

import {
  CONCILIATION_BODIES,
  COUNTIES,
  COUNTY_CODES
} from '@/lib/webshop/legal/constants'
import type { CompanyForm, ConciliationBody, CountyCode } from '@/lib/webshop/legal/types'

const FORM_PATTERNS: [RegExp, CompanyForm][] = [
  [/\bnyrt\.?$/i, 'nyrt'],
  [/\bzrt\.?$/i, 'zrt'],
  [/\bkft\.?$/i, 'kft'],
  [/korlátolt felelősségű társaság$/i, 'kft'],
  [/\bbt\.?$/i, 'bt'],
  [/betéti társaság$/i, 'bt'],
  [/\bkkt\.?$/i, 'kkt'],
  [/\be\.\s?v\.?$/i, 'ev'],
  [/egyéni vállalkozó$/i, 'ev']
]

export function companyFormOf(name: string): CompanyForm {
  const n = name.trim()
  for (const [re, form] of FORM_PATTERNS) if (re.test(n)) return form
  return 'other'
}

/** Cégjegyzékszám „01-09-123456” → a cégbíróság vármegyéje. */
export function countyFromRegistration(reg: string | null): CountyCode | null {
  const m = reg?.trim().match(/^(\d{2})\s*-\s*\d{2}\s*-\s*\d{6}$/)
  if (!m) return null
  return COUNTY_CODES.find((c) => COUNTIES[c].prefix === m[1]) ?? null
}

const POSTAL_RANGES: [number, number, CountyCode][] = [
  [1000, 1999, 'budapest'],
  [2000, 2399, 'pest'],
  [2400, 2499, 'fejer'],
  [2500, 2549, 'komarom'],
  [2550, 2659, 'pest'],
  [2660, 2699, 'nograd'],
  [2700, 2799, 'pest'],
  [2800, 2999, 'komarom'],
  [3000, 3059, 'heves'],
  [3060, 3199, 'nograd'],
  [3200, 3399, 'heves'],
  [3400, 3999, 'baz'],
  [4000, 4299, 'hajdu'],
  [4300, 4999, 'szabolcs'],
  [5000, 5499, 'jnsz'],
  [5500, 5999, 'bekes'],
  [6000, 6599, 'bacs'],
  [6600, 6999, 'csongrad'],
  [7000, 7099, 'fejer'],
  [7100, 7299, 'tolna'],
  [7300, 7399, 'baranya'],
  [7400, 7599, 'somogy'],
  [7600, 7999, 'baranya'],
  [8000, 8199, 'fejer'],
  [8200, 8599, 'veszprem'],
  [8600, 8799, 'somogy'],
  [8800, 8999, 'zala'],
  [9000, 9499, 'gyms'],
  [9500, 9999, 'vas']
]

/** Irányítószám → vármegye (közelítés; határ menti településeknél a tenant felülírhatja). */
export function countyFromPostalCode(code: string | null): CountyCode | null {
  const n = Number(code?.trim())
  if (!Number.isInteger(n)) return null
  return POSTAL_RANGES.find(([lo, hi]) => n >= lo && n <= hi)?.[2] ?? null
}

export function conciliationFor(county: CountyCode | null): ConciliationBody | null {
  if (!county) return null
  return CONCILIATION_BODIES.find((b) => b.counties.includes(county)) ?? null
}

export function joinAddress(parts: (string | null | undefined)[]): string | null {
  const out = parts.map((p) => p?.trim()).filter(Boolean).join(' ')
  return out || null
}
