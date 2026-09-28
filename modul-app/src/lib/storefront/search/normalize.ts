/**
 * Kereső normalizálás — a 20260552 `storefront_norm()` / `storefront_code()` tükre.
 * Kliensen is futhat (nincs szerver függőség).
 */

export function normSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(?<![0-9])\.|\.(?![0-9])|[^a-z0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function compactCode(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function isNumberToken(t: string): boolean {
  return /^\d+(\.\d+)?$/.test(t)
}

/** Keresésben jelentés nélküli szavak (normalizált alak). */
export const STOPWORDS = new Set([
  'a', 'az', 'egy', 'es', 'vagy', 'is', 'de', 'meg', 'hoz', 'hez', 'ra', 're',
  'ba', 'be', 'bol', 'rol', 'tol', 'nak', 'nek', 'val', 'vel', 'ban', 'ben', 'mint',
  'for', 'the', 'and', 'with', 'x', 'db', 'darab', 'szett', 'kb', 'cca'
])

/**
 * Durva magyar toldalék-levágás a kategória/érték felismeréshez
 * (nem nyelvtan: „fogantyuk” → „fogantyu”, „zsanerokat” → „zsaner”).
 */
const SUFFIXES = [
  'okat', 'eket', 'akat', 'jait', 'jeit',
  'hoz', 'hez', 'nak', 'nek', 'val', 'vel', 'ban', 'ben', 'bol', 'rol', 'tol',
  'ok', 'ek', 'ak', 'at', 'et', 'ot', 'ra', 're', 'ba', 'be', 'ja', 'je', 'ai', 'ei',
  'k', 't', 'i'
]

export function stemLite(word: string): string {
  if (word.length <= 4 || isNumberToken(word)) return word
  for (const s of SUFFIXES) {
    if (word.endsWith(s) && word.length - s.length >= 4) return word.slice(0, -s.length)
  }
  return word
}

/** Mértékegység → mm / ml / g szorzó (a jellemzők jellemzően így vannak tárolva). */
export const UNIT_FACTORS: Record<string, { base: string; factor: number }> = {
  mm: { base: 'mm', factor: 1 },
  cm: { base: 'mm', factor: 10 },
  m: { base: 'mm', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  cl: { base: 'ml', factor: 10 },
  dl: { base: 'ml', factor: 100 },
  l: { base: 'ml', factor: 1000 },
  g: { base: 'g', factor: 1 },
  dkg: { base: 'g', factor: 10 },
  kg: { base: 'g', factor: 1000 }
}

export function numKey(n: number): string {
  return String(Math.round(n * 1000) / 1000)
}

/** Damerau–Levenshtein, korláttal (felette korai kilépés). */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const rows = a.length + 1
  const cols = b.length + 1
  let prev2: number[] = []
  let prev = Array.from({ length: cols }, (_, j) => j)
  for (let i = 1; i < rows; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1)
      }
      cur.push(v)
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev2 = prev
    prev = cur
  }
  return prev[cols - 1]
}
