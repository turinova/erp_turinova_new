import type { CostItem, Trade } from "@/types"
import { matchCatalogPhrase } from "@/lib/catalog-phrase-match"

export type TextPolishChange = {
  type: "spelling" | "grammar" | "style" | "terminology"
  from: string
  to: string
  reason?: string
}

export type TextPolishResult = {
  original: string
  polished: string
  changed: boolean
  changes: TextPolishChange[]
  /** Claude API is részt vett a javításban */
  aiUsed?: boolean
}

/** Ékezet nélküli összehasonlításhoz */
export function normalizeHu(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

function preserveCase(original: string, replacement: string): string {
  if (!original.length || !replacement.length) return replacement
  if (original === original.toUpperCase() && original.length > 2) {
    return replacement.toUpperCase()
  }
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1)
  }
  return replacement
}

/** Gyakori építőipari elírások és ragozatlan formák */
const WORD_REPLACEMENTS: Array<{ pattern: RegExp; to: string; reason: string }> = [
  { pattern: /\bgepeszeti\b/gi, to: "gépészeti", reason: "Helyesírás" },
  { pattern: /\bgepeszet\b/gi, to: "gépészet", reason: "Helyesírás" },
  { pattern: /\bepitomesteri\b/gi, to: "építőmesteri", reason: "Helyesírás" },
  { pattern: /\bepitesi\b/gi, to: "építési", reason: "Helyesírás" },
  { pattern: /\bepites\b/gi, to: "építés", reason: "Helyesírás" },
  { pattern: /\bnyilaszarok?\b/gi, to: "nyílászáró", reason: "Helyesírás" },
  { pattern: /\bnyilaszaró\b/gi, to: "nyílászáró", reason: "Helyesírás" },
  { pattern: /\bbontas\b/gi, to: "bontás", reason: "Ragozás / helyesírás" },
  { pattern: /\bbontasa\b/gi, to: "bontása", reason: "Ragozás" },
  { pattern: /\bszereles\b/gi, to: "szerelés", reason: "Helyesírás" },
  { pattern: /\bszerelese\b/gi, to: "szerelése", reason: "Ragozás" },
  { pattern: /\belszallitas\b/gi, to: "elszállítás", reason: "Helyesírás" },
  { pattern: /\belszallitasa\b/gi, to: "elszállítása", reason: "Ragozás" },
  { pattern: /\bcsovezetek\b/gi, to: "csővezetékek", reason: "Helyesírás" },
  { pattern: /\bcso\b/gi, to: "cső", reason: "Helyesírás" },
  { pattern: /\bfutesi\b/gi, to: "fűtési", reason: "Helyesírás" },
  { pattern: /\bfutes\b/gi, to: "fűtés", reason: "Helyesírás" },
  { pattern: /\bhutokori\b/gi, to: "hűtőkör", reason: "Helyesírás" },
  { pattern: /\bhutés\b/gi, to: "hűtés", reason: "Helyesírás" },
  { pattern: /\bklima\b/gi, to: "klíma", reason: "Helyesírás" },
  { pattern: /\belektromos\b/gi, to: "elektromos", reason: "Helyesírás" },
  { pattern: /\berintesvedelmi\b/gi, to: "érintésvédelmi", reason: "Helyesírás" },
  { pattern: /\btormelek\b/gi, to: "törmelék", reason: "Helyesírás" },
  { pattern: /\bkozterulet\b/gi, to: "közterület", reason: "Helyesírás" },
  { pattern: /\bvedelem\b/gi, to: "védelem", reason: "Helyesírás" },
  { pattern: /\bbevedese\b/gi, to: "bevédése", reason: "Ragozás" },
  { pattern: /\btelepitese\b/gi, to: "telepítése", reason: "Ragozás" },
  { pattern: /\btelepites\b/gi, to: "telepítés", reason: "Helyesírás" },
  { pattern: /\bfelszerelese\b/gi, to: "felszerelése", reason: "Ragozás" },
  { pattern: /\bbelul\b/gi, to: "belül", reason: "Helyesírás" },
  { pattern: /\bkivul\b/gi, to: "kívül", reason: "Helyesírás" },
  { pattern: /\bvezetek\b/gi, to: "vezeték", reason: "Helyesírás" },
  { pattern: /\brezs\b/gi, to: "réz", reason: "Helyesírás" },
  { pattern: /\btomeg\b/gi, to: "tömeg", reason: "Helyesírás" },
  { pattern: /\bszigeteles\b/gi, to: "szigetelés", reason: "Helyesírás" },
  { pattern: /\bkonteneres\b/gi, to: "konténeres", reason: "Helyesírás" },
  { pattern: /\bmennyiseg\b/gi, to: "mennyiség", reason: "Helyesírás" },
  { pattern: /\bmez\b/gi, to: "m²", reason: "Mértékegység" },
  { pattern: /\bm2\b/g, to: "m²", reason: "Mértékegység" },
  { pattern: /\bm3\b/g, to: "m³", reason: "Mértékegység" },
  { pattern: /\s+,/g, to: ",", reason: "Stílus" },
  { pattern: /\s{2,}/g, to: " ", reason: "Felesleges szóköz" },
]

const UNACCENTED_TO_ACCENTED: Record<string, string> = {
  epito: "építő",
  epités: "építés",
  epitesi: "építési",
  gepeszet: "gépészet",
  gepeszeti: "gépészeti",
  bontas: "bontás",
  szallitas: "szállítás",
  szereles: "szerelés",
  futes: "fűtés",
  hutés: "hűtés",
  hutokor: "hűtőkör",
  elektromos: "elektromos",
  erintesvedelmi: "érintésvédelmi",
  kozterulet: "közterület",
  toredelem: "törmelék",
  toromelek: "törmelék",
  nyilaszaró: "nyílászáró",
  csovezetek: "csővezeték",
  cso: "cső",
  klima: "klíma",
  riaszto: "riasztó",
  berendezes: "berendezés",
  tartoszerkezet: "tartószerkezet",
  belul: "belül",
  kivul: "kívül",
  vezetek: "vezeték",
  vezetékek: "vezetékek",
  rezs: "réz",
  rez: "réz",
  tomeg: "tömeg",
  tomeges: "tömege",
  szigeteles: "szigetelés",
  szigetelt: "szigetelt",
  aljzat: "aljzat",
  burkolas: "burkolás",
  burkolat: "burkolat",
  konteneres: "konténeres",
  kontener: "konténer",
  lerako: "lerakó",
  lerakóhelyi: "lerakóhelyi",
  dijjal: "díjjal",
  dij: "díj",
  munka: "munka",
  munkak: "munkák",
  fal: "fal",
  falon: "falon",
  mennyiseg: "mennyiség",
  mertekegyseg: "mértékegység",
}

export function extractCatalogTerms(
  items: CostItem[],
  trade?: Trade,
  categoryId?: string
): string[] {
  const pool = items.filter((item) => {
    if (trade && item.trade !== trade) return false
    if (categoryId && item.categoryId !== categoryId) return false
    return true
  })

  const freq = new Map<string, number>()
  for (const item of pool) {
    const sources = [item.text, item.shortLabel].filter(Boolean) as string[]
    for (const source of sources) {
      for (const raw of source.split(/[\s,;:()]+/)) {
        const word = raw.replace(/^[^a-záéíóöőúüűÁÉÍÓÖŐÚÜŰ0-9]+|[^a-záéíóöőúüűÁÉÍÓÖŐÚÜŰ0-9-]+$/gi, "")
        if (word.length < 4) continue
        const key = word.toLowerCase()
        freq.set(key, (freq.get(key) ?? 0) + 1)
      }
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
}

function applyWordReplacements(text: string): { text: string; changes: TextPolishChange[] } {
  let result = text.trim()
  const changes: TextPolishChange[] = []

  for (const rule of WORD_REPLACEMENTS) {
    const before = result
    result = result.replace(rule.pattern, (match) => {
      const to = preserveCase(match, rule.to)
      if (to !== match) {
        changes.push({ type: "spelling", from: match, to, reason: rule.reason })
      }
      return to
    })
    if (result !== before) continue
  }

  return { text: result, changes }
}

function fixUnaccentedWords(text: string): { text: string; changes: TextPolishChange[] } {
  const changes: TextPolishChange[] = []
  const result = text.replace(/\b[\w-]+\b/g, (word) => {
    const key = normalizeHu(word)
    const replacement = UNACCENTED_TO_ACCENTED[key]
    if (!replacement || normalizeHu(word) === normalizeHu(replacement)) return word
    const to = preserveCase(word, replacement)
    if (to !== word) {
      changes.push({
        type: "spelling",
        from: word,
        to,
        reason: "Ékezet javítása",
      })
    }
    return to
  })
  return { text: result, changes }
}

function alignWithCatalogTerms(
  text: string,
  terms: string[]
): { text: string; changes: TextPolishChange[] } {
  if (!terms.length) return { text, changes: [] }
  const changes: TextPolishChange[] = []

  const result = text.replace(/\b[\wáéíóöőúüűÁÉÍÓÖŐÚÜŰ-]+\b/g, (word) => {
    if (word.length < 4) return word
    const norm = normalizeHu(word)
    let best: string | null = null
    let bestDist = 3

    for (const term of terms) {
      if (term.length < 4) continue
      const dist = levenshtein(norm, normalizeHu(term))
      if (dist > 0 && dist < bestDist) {
        bestDist = dist
        best = term
      }
    }

    if (!best) return word
    const to = preserveCase(word, best)
    if (to === word) return word
    changes.push({
      type: "terminology",
      from: word,
      to,
      reason: "Katalógus terminológia",
    })
    return to
  })

  return { text: result, changes }
}

function applyStyleRules(text: string): { text: string; changes: TextPolishChange[] } {
  const changes: TextPolishChange[] = []
  let result = text.trim()

  if (result && result[0] === result[0].toLowerCase()) {
    const to = result[0].toUpperCase() + result.slice(1)
    changes.push({ type: "style", from: result[0], to: to[0], reason: "Mondat kezdete nagybetű" })
    result = to
  }

  if (result.endsWith("..")) {
    const to = result.replace(/\.+$/, ".")
    changes.push({ type: "style", from: result.slice(-3), to: ".", reason: "Pontozás" })
    result = to
  }

  return { text: result, changes }
}

export function polishItemTextLocal(
  input: string,
  options?: {
    referenceItems?: CostItem[]
    trade?: Trade
    categoryId?: string
  }
): TextPolishResult {
  const original = input
  if (!original.trim()) {
    return { original, polished: original, changed: false, changes: [] }
  }

  const terms = extractCatalogTerms(
    options?.referenceItems ?? [],
    options?.trade,
    options?.categoryId
  )

  const allChanges: TextPolishChange[] = []
  let text = original

  const steps: Array<(value: string) => { text: string; changes: TextPolishChange[] }> = [
    applyWordReplacements,
    fixUnaccentedWords,
    (value) => alignWithCatalogTerms(value, terms),
    applyStyleRules,
    (value) =>
      matchCatalogPhrase(value, options?.referenceItems ?? [], {
        trade: options?.trade,
        categoryId: options?.categoryId,
      }),
  ]

  for (const step of steps) {
    const { text: next, changes } = step(text)
    allChanges.push(...changes)
    text = next
  }

  const polished = text.trim()
  const changed = polished !== original.trim()

  return {
    original: original.trim(),
    polished,
    changed,
    changes: dedupeChanges(allChanges),
  }
}

function dedupeChanges(changes: TextPolishChange[]): TextPolishChange[] {
  const seen = new Set<string>()
  return changes.filter((c) => {
    const key = `${c.from}→${c.to}`
    if (seen.has(key)) return false
    seen.add(key)
    return c.from !== c.to
  })
}

export function mergePolishResults(
  base: TextPolishResult,
  extraChanges: TextPolishChange[],
  polished: string
): TextPolishResult {
  const merged = dedupeChanges([...base.changes, ...extraChanges])
  return {
    original: base.original,
    polished: polished.trim(),
    changed: polished.trim() !== base.original,
    changes: merged,
  }
}

export type LanguageToolMatch = {
  offset: number
  length: number
  replacements: Array<{ value: string }>
  message: string
  rule?: { description?: string }
}

export function applyLanguageToolMatches(
  text: string,
  matches: LanguageToolMatch[]
): { text: string; changes: TextPolishChange[] } {
  const changes: TextPolishChange[] = []
  let result = text

  const sorted = [...matches].sort((a, b) => b.offset - a.offset)
  for (const match of sorted) {
    const replacement = match.replacements?.[0]?.value
    if (!replacement) continue
    const from = result.slice(match.offset, match.offset + match.length)
    if (!from || from === replacement) continue
    result = result.slice(0, match.offset) + replacement + result.slice(match.offset + match.length)
    changes.push({
      type: "grammar",
      from,
      to: replacement,
      reason: match.message || match.rule?.description || "Nyelvhelyesség",
    })
  }

  return { text: result, changes }
}
