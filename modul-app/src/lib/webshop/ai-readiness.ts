/**
 * AI-készség kapu: mennyire tudja egy ChatGPT / Google AI / Perplexity ügynök
 * biztosan ajánlani a terméket. Blokkoló hiba esetén a termék kimarad a feedekből.
 */

export type AiReadinessInput = {
  title: string
  description: string | null
  brand: string | null
  gtin: string | null
  mpn: string | null
  identifierExists: boolean
  imageCount: number
  imagesWithAlt: number
  keySpecsTotal: number
  keySpecsFilled: number
  hasMeasureImage: boolean
  hasProductDimensions: boolean
  hasCategory: boolean
  /** Első kulcsadat számként — ütközésfigyeléshez. */
  primarySpec: { name: string; value: number | null; unit: string | null } | null
}

export type AiReadinessCheck = {
  id: string
  ok: boolean
  /** blocker: kimarad a feedből; warn: csökkenti az ajánlási esélyt. */
  severity: 'blocker' | 'warn'
  label: string
  fix: string
}

export type AiReadiness = {
  score: number
  blockers: AiReadinessCheck[]
  warnings: AiReadinessCheck[]
  checks: AiReadinessCheck[]
  feedEligible: boolean
}

const MM_PER: Record<string, number> = { mm: 1, cm: 10, m: 1000 }

function toMm(value: number, unit: string): number | null {
  const f = MM_PER[unit.toLowerCase()]
  return f == null ? null : value * f
}

/** Szám+egység előfordulások (pl. „160 mm”, „16cm”, „37,5 mm”). */
export function extractLengths(text: string): number[] {
  const out: number[] = []
  const re = /(\d+(?:[.,]\d+)?)\s?(mm|cm|m)\b/gi
  for (const m of text.matchAll(re)) {
    const n = Number(m[1].replace(',', '.'))
    const mm = Number.isFinite(n) ? toMm(n, m[2]) : null
    if (mm != null) out.push(mm)
  }
  return out
}

/**
 * Ha a szövegben van hosszmérték, de egyik sem egyezik a fő kulcsadattal,
 * valószínű elírás (pl. név: 128 mm, kulcsadat: 160 mm).
 */
export function specConflict(
  text: string,
  spec: AiReadinessInput['primarySpec']
): number[] | null {
  if (!spec || spec.value == null || !spec.unit) return null
  const want = toMm(spec.value, spec.unit)
  if (want == null) return null
  const found = extractLengths(text)
  if (found.length === 0) return null
  if (found.some((v) => Math.abs(v - want) < 0.05)) return null
  return found
}

function fmtMm(values: number[]): string {
  return [...new Set(values)]
    .slice(0, 3)
    .map((v) => `${v.toLocaleString('hu-HU')} mm`)
    .join(', ')
}

export function evaluateAiReadiness(input: AiReadinessInput): AiReadiness {
  const hasId = Boolean(input.gtin?.trim() || input.mpn?.trim())
  const titleConflict = specConflict(input.title, input.primarySpec)
  const descConflict = input.description
    ? specConflict(input.description, input.primarySpec)
    : null
  const descLen = input.description?.trim().length ?? 0

  const checks: AiReadinessCheck[] = [
    {
      id: 'image',
      ok: input.imageCount > 0,
      severity: 'blocker',
      label: 'Van fő kép',
      fix: 'Tölts fel legalább egy fotót.'
    },
    {
      id: 'brand',
      ok: Boolean(input.brand?.trim()),
      severity: 'blocker',
      label: 'Márka',
      fix: 'Válassz gyártót, vagy add meg a márkát.'
    },
    {
      id: 'identifier',
      ok: hasId || !input.identifierExists,
      severity: 'blocker',
      label: 'Termékazonosító (EAN vagy gyártói cikkszám)',
      fix: 'Add meg az EAN-t vagy az MPN-t — vagy jelöld: „Nincs vonalkódja és gyártói cikkszáma”.'
    },
    {
      id: 'category',
      ok: input.hasCategory,
      severity: 'blocker',
      label: 'Bolt kategória',
      fix: 'Válaszd ki, hol van a boltban.'
    },
    {
      id: 'keyspecs',
      ok: input.keySpecsTotal === 0 || input.keySpecsFilled >= input.keySpecsTotal,
      severity: 'blocker',
      label:
        input.keySpecsTotal > 0
          ? `Kulcsadatok ${input.keySpecsFilled}/${input.keySpecsTotal}`
          : 'Kulcsadatok',
      fix: 'Töltsd ki az összes kulcsadatot — ezek alapján dönti el az AI, hogy passzol-e.'
    },
    {
      id: 'conflict',
      ok: !titleConflict && !descConflict,
      severity: 'warn',
      label: 'Név, leírás és kulcsadat egyezik',
      fix: input.primarySpec
        ? `A ${titleConflict ? 'névben' : 'leírásban'} ${fmtMm(titleConflict ?? descConflict ?? [])} szerepel, a „${input.primarySpec.name}” kulcsadat más. Javítsd, ami téves.`
        : 'Ellenőrizd a méreteket.'
    },
    {
      id: 'gallery',
      ok: input.imageCount >= 2,
      severity: 'warn',
      label: 'Legalább 2 kép',
      fix: 'Adj hozzá még egy fotót (pl. hátulnézet, méretarány).'
    },
    {
      id: 'alt',
      ok: input.imageCount === 0 || input.imagesWithAlt >= input.imageCount,
      severity: 'warn',
      label: `Kép leírások ${input.imagesWithAlt}/${input.imageCount}`,
      fix: 'Írd be minden képnél, mit mutat (pl. „hátoldal, furatok 160 mm”).'
    },
    {
      id: 'description',
      ok: descLen >= 200,
      severity: 'warn',
      label: 'Leírás legalább ~200 karakter',
      fix: 'Írd le, mire való, mihez illik, mi van a dobozban.'
    },
    {
      id: 'measure',
      ok: input.keySpecsTotal === 0 || input.hasMeasureImage,
      severity: 'warn',
      label: 'Mérési ábra',
      fix: 'Tölts fel méretrajzot, vagy a kategóriánál mérési ábrát.'
    },
    {
      id: 'dimensions',
      ok: input.hasProductDimensions,
      severity: 'warn',
      label: 'Termék méretei (H × Sz × M)',
      fix: 'Add meg a termék saját méreteit (nem a csomagét).'
    }
  ]

  const blockers = checks.filter((c) => !c.ok && c.severity === 'blocker')
  const warnings = checks.filter((c) => !c.ok && c.severity === 'warn')
  const weight = (c: AiReadinessCheck) => (c.severity === 'blocker' ? 2 : 1)
  const total = checks.reduce((s, c) => s + weight(c), 0)
  const got = checks.filter((c) => c.ok).reduce((s, c) => s + weight(c), 0)

  return {
    score: Math.round((got / total) * 100),
    blockers,
    warnings,
    checks,
    feedEligible: blockers.length === 0
  }
}
