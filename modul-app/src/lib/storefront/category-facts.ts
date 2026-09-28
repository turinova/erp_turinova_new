/**
 * Kategória oldal gépi + emberi tényei (doc 40 §3h): ténymondat a H1 alatt, cím, meta leírás,
 * adatból GYIK, bizalmi sor. Csak valós adat — ami hiányzik, az kimarad.
 */

import type { CategorySummary } from '@/lib/storefront/catalog'
import { formatFt } from '@/lib/storefront/format'
import { STATUTORY_RETURN_DAYS, type StorefrontSettings } from '@/lib/webshop/settings'

type Facet = CategorySummary['facets'][number]

const LIST_INLINE_MAX = 4
const FAQ_VALUES_MAX = 12
const STOCK_MENTION_SHARE = 0.3

const numberFmt = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 2 })

/** „128 mm” … „1120 mm” → „128–1120 mm”, ha minden érték szám + azonos egység. */
export function numericRange(labels: string[]): string | null {
  if (labels.length < 2) return null
  let unit: string | null = null
  const nums: number[] = []
  for (const l of labels) {
    const m = l.trim().match(/^(\d+(?:[.,]\d+)?)\s*([\p{L}%°²³]+)?$/u)
    if (!m) return null
    const u = m[2] ?? ''
    if (unit == null) unit = u
    else if (unit !== u) return null
    nums.push(Number(m[1]!.replace(',', '.')))
  }
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  if (min === max) return null
  return `${numberFmt.format(min)}–${numberFmt.format(max)}${unit ? ` ${unit}` : ''}`
}

function lowerFirst(s: string): string {
  return s.length > 1 && s[1] === s[1]!.toLocaleLowerCase('hu') ? s[0]!.toLocaleLowerCase('hu') + s.slice(1) : s
}

function joinHu(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} és ${items[items.length - 1]}`
}

export function facetPhrase(f: Facet): string | null {
  const labels = f.values.map((v) => v.label)
  if (labels.length === 0) return null
  if (labels.length === 1) return `${f.name}: ${lowerFirst(labels[0]!)}`
  const range = numericRange(labels)
  if (range) return `${f.name}: ${range} (${labels.length} féle)`
  if (labels.length <= LIST_INLINE_MAX) return `${f.name}: ${joinHu(labels.map(lowerFirst))}`
  return `${f.name}: ${labels.length} féle, pl. ${labels.slice(0, 3).map(lowerFirst).join(', ')}`
}

function priceFromText(s: CategorySummary): string | null {
  if (s.priceMin == null) return null
  return s.priceMax != null && s.priceMax !== s.priceMin ? `${formatFt(s.priceMin)}-tól` : formatFt(s.priceMin)
}

/**
 * „54 termék 2 490 Ft-tól, ebből 41 raktáron. Méret: 128–1120 mm (18 féle). Szín: fehér, fekete és króm.”
 * `skipParam`: az útvonalas szűrő (a H1-ben már benne van).
 */
export function factSentence(s: CategorySummary, skipParam?: string | null): string | null {
  if (s.total === 0) return null
  const price = priceFromText(s)
  // Kis raktári arányt nem hangsúlyozunk a fejlécben („156-ból 1”) — a GYIK és a kártyák pontosan mondják.
  const stock =
    s.inStock === s.total
      ? ', mind raktáron'
      : s.inStock > 0 && s.inStock >= s.total * STOCK_MENTION_SHARE
        ? `, ebből ${s.inStock} raktáron`
        : ''
  const head = `${s.total} termék${price ? ` ${price}` : ''}${stock}`
  const parts = s.facets
    .filter((f) => f.param !== skipParam)
    .slice(0, 2)
    .map(facetPhrase)
    .filter((p): p is string => Boolean(p))
  return [`${head}.`, ...parts.map((p) => `${p}.`)].join(' ')
}

/** Rövid tartomány a címbe (pl. „128–1120 mm”), ha az első szűrő szám jellegű. */
export function titleRange(s: CategorySummary, skipParam?: string | null): string | null {
  const f = s.facets.find((x) => x.param !== skipParam)
  return f ? numericRange(f.values.map((v) => v.label)) : null
}

export function deliveryText(settings: Pick<StorefrontSettings, 'deliveryDaysMin' | 'deliveryDaysMax'>): string | null {
  const { deliveryDaysMin: min, deliveryDaysMax: max } = settings
  if (min != null && max != null) return min === max ? `${min} munkanap` : `${min}–${max} munkanap`
  if (max != null) return `legfeljebb ${max} munkanap`
  return null
}

/** Egy sor a ténymondat alatt: kiszállítás · ingyenes szállítás · elállás · átvétel. */
export function trustParts(settings: StorefrontSettings): string[] {
  const out: string[] = []
  const delivery = deliveryText(settings)
  if (delivery) out.push(`Kiszállítás ${delivery}`)
  if (settings.shippingFeeGross === 0) out.push('Ingyenes szállítás')
  else if (settings.freeShippingThresholdGross != null) {
    out.push(`${formatFt(settings.freeShippingThresholdGross)} felett ingyenes szállítás`)
  }
  out.push(`${Math.max(settings.returnDays ?? STATUTORY_RETURN_DAYS, STATUTORY_RETURN_DAYS)} nap elállás`)
  if (settings.pickupEnabled) out.push(settings.pickupLabel?.trim() || 'Személyes átvétel')
  return out
}

export type FaqItem = { question: string; answer: string }

/** Adatból épülő kérdések — csak ha van mögöttük valós adat. */
export function categoryFaq(
  heading: string,
  s: CategorySummary,
  settings: StorefrontSettings,
  skipParam?: string | null
): FaqItem[] {
  if (s.total === 0) return []
  const out: FaqItem[] = []
  const subject = heading.toLocaleLowerCase('hu')
  for (const f of s.facets.filter((x) => x.param !== skipParam && x.values.length >= 2).slice(0, 2)) {
    const labels = f.values.map((v) => v.label)
    const range = numericRange(labels)
    const shown = labels.slice(0, FAQ_VALUES_MAX)
    const rest = labels.length - shown.length
    out.push({
      question: `Milyen ${f.name.toLocaleLowerCase('hu')} kapható?`,
      answer:
        (range ? `${range}, összesen ${labels.length} féle: ` : `${labels.length} féle: `) +
        shown.join(', ') +
        (rest > 0 ? ` és még ${rest}.` : '.')
    })
  }
  if (s.priceMin != null && s.priceMax != null) {
    out.push({
      question: `Mennyibe kerülnek ${/^[aáeéiíoóöőuúüű]/i.test(subject) ? 'az' : 'a'} ${subject}?`,
      answer:
        s.priceMin === s.priceMax
          ? `Bruttó ${formatFt(s.priceMin)} (áfával).`
          : `Bruttó ${formatFt(s.priceMin)} és ${formatFt(s.priceMax)} között (áfával).`
    })
  }
  out.push({
    question: 'Mi van raktáron?',
    answer:
      s.inStock === 0
        ? `Most egyik termék sincs raktáron — a termékoldalon kérhetsz értesítést, ha megérkezik.`
        : `${s.total} termékből ${s.inStock} raktáron van, azonnal szállítható.`
  })
  const delivery = deliveryText(settings)
  if (delivery || settings.pickupEnabled) {
    out.push({
      question: 'Mikor kapom meg a rendelést?',
      answer:
        [
          delivery ? `Raktáron lévő terméknél ${delivery} a kiszállítás.` : null,
          settings.pickupEnabled ? `${settings.pickupLabel?.trim() || 'Személyes átvétel'} is választható.` : null
        ]
          .filter(Boolean)
          .join(' ')
    })
  }
  return out
}
