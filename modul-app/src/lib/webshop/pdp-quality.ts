/**
 * Termékoldal-minőség: a vásárlói döntéshez szükséges adatok megvannak-e.
 * Kategóriafüggetlen; a fogyasztási cikkekre (élelmiszer, kozmetikum, állateledel,
 * háztartási vegyi áru) extra ellenőrzések futnak.
 */

export type PdpQualityInput = {
  googleCategory: string
  productType: string
  imageCount: number
  descriptionLength: number
  keySpecsTotal: number
  keySpecsFilled: number
  benefitCount: number
  hasNetContent: boolean
  hasIngredients: boolean
  hasUsage: boolean
  hasSafetyInfo: boolean
  faqCount: number
  hasCountryOfOrigin: boolean
}

export type PdpQualityCheck = { id: string; ok: boolean; label: string; fix: string }

export type PdpQuality = { score: number; checks: PdpQualityCheck[]; failing: PdpQualityCheck[] }

/** Google termékkategória gyökerek: 412 élelmiszer, 469 egészség/szépség, 1 állat, 630 háztartás. */
const CONSUMABLE_ROOT = /^(412|469|1|630)\b/
const CONSUMABLE_TEXT =
  /\b(food|beverages?|health|beauty|personal care|pet supplies|household supplies|élelmiszer|italok?|kozmetik|szépség|drogéria|eledel|tisztítószer|háztartási vegyi)/i
const INGREDIENT_TEXT =
  /\b(food|beverages?|beauty|personal care|élelmiszer|italok?|kozmetik|szépség|eledel|kutyatáp|macskatáp)/i
const INGREDIENT_ROOT = /^(412|469)\b/

const MIN_IMAGES = 3
const MIN_DESCRIPTION = 200

export function isConsumable(googleCategory: string, productType: string): boolean {
  const g = googleCategory.trim()
  return CONSUMABLE_ROOT.test(g) || CONSUMABLE_TEXT.test(`${g} ${productType}`)
}

function needsIngredients(googleCategory: string, productType: string): boolean {
  const g = googleCategory.trim()
  return INGREDIENT_ROOT.test(g) || INGREDIENT_TEXT.test(`${g} ${productType}`)
}

export function evaluatePdpQuality(input: PdpQualityInput): PdpQuality {
  const consumable = isConsumable(input.googleCategory, input.productType)
  const ingredients = needsIngredients(input.googleCategory, input.productType)

  const checks: PdpQualityCheck[] = [
    {
      id: 'images',
      ok: input.imageCount >= MIN_IMAGES,
      label: `Legalább ${MIN_IMAGES} kép (${input.imageCount})`,
      fix: 'Tegyél fel közeli, használat közbeni és csomagolás / címke képet is.'
    },
    {
      id: 'description',
      ok: input.descriptionLength >= MIN_DESCRIPTION,
      label: 'Érdemi leírás',
      fix: `Legalább ~${MIN_DESCRIPTION} karakter: mire jó, kinek szól, miben más.`
    },
    {
      id: 'benefits',
      ok: input.benefitCount > 0,
      label: 'Fő előnyök',
      fix: 'Adj meg 2–4 rövid előnyt — ezek a leírás tetején jelennek meg.'
    }
  ]

  if (input.keySpecsTotal > 0) {
    checks.push({
      id: 'key-specs',
      ok: input.keySpecsFilled === input.keySpecsTotal,
      label: `Kulcsadatok ${input.keySpecsFilled}/${input.keySpecsTotal}`,
      fix: 'A kategória sablon kulcsadatai a cím alatt és a Kulcsadatok blokkban jelennek meg.'
    })
  }

  if (consumable) {
    checks.push(
      {
        id: 'net-content',
        ok: input.hasNetContent,
        label: 'Nettó tartalom (egységár)',
        fix: 'Fogyasztási cikknél kötelező az egységár (Ft/kg, Ft/l) — add meg a kiszerelést.'
      },
      {
        id: 'usage',
        ok: input.hasUsage,
        label: 'Használat / adagolás',
        fix: 'Írd le röviden, hogyan kell használni vagy adagolni.'
      }
    )
  }
  if (ingredients) {
    checks.push({
      id: 'ingredients',
      ok: input.hasIngredients,
      label: 'Összetevők',
      fix: 'Élelmiszernél, kozmetikumnál és állateledelnél a vásárló keresi (allergének!).'
    })
  }
  if (consumable) {
    checks.push({
      id: 'safety',
      ok: input.hasSafetyInfo,
      label: 'Figyelmeztetés',
      fix: 'Ha van címkén figyelmeztetés vagy tárolási előírás, írd be.'
    })
  }

  checks.push({
    id: 'origin',
    ok: input.hasCountryOfOrigin,
    label: 'Származási ország',
    fix: 'A vásárlók és az AI keresők is gyakran szűrnek rá (pl. „magyar termék”).'
  })

  checks.push({
    id: 'faq',
    ok: input.faqCount > 0,
    label: 'Gyakori kérdések',
    fix: 'Az első 1–2 kérdés, amit telefonon kérdeznek — csökkenti a bizonytalanságot.'
  })

  const passed = checks.filter((c) => c.ok).length
  return {
    score: Math.round((passed / checks.length) * 100),
    checks,
    failing: checks.filter((c) => !c.ok)
  }
}
