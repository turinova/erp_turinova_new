import { formatFt } from '@/lib/storefront/format'
import type { LegalNode, LegalParty, LegalSection } from '@/lib/webshop/legal/types'

type Maybe<T> = T | null | undefined | false

export const p = (text: string): LegalNode => ({ t: 'p', text })
export const note = (text: string): LegalNode => ({ t: 'note', text })
export const h3 = (text: string): LegalNode => ({ t: 'h3', text })

export function ul(items: Maybe<string>[]): LegalNode | null {
  const list = items.filter((i): i is string => Boolean(i))
  return list.length ? { t: 'ul', items: list } : null
}

export function ol(items: Maybe<string>[]): LegalNode | null {
  const list = items.filter((i): i is string => Boolean(i))
  return list.length ? { t: 'ol', items: list } : null
}

export function dl(rows: [string, Maybe<string>][]): LegalNode | null {
  const list = rows.filter((r): r is [string, string] => Boolean(r[1]))
  return list.length ? { t: 'dl', rows: list } : null
}

export function table(head: string[], rows: string[][]): LegalNode | null {
  return rows.length ? { t: 'table', head, rows } : null
}

export function section(id: string, title: string, nodes: Maybe<LegalNode>[]): LegalSection {
  return { id, title, nodes: nodes.filter((n): n is LegalNode => Boolean(n)) }
}

/** Inline link a szövegben: [felirat](cím) — a megjelenítő alakítja linkké. */
export function link(label: string, href: string): string {
  return `[${label}](${href})`
}

export function mail(email: string): string {
  return link(email, `mailto:${email}`)
}

export function ft(v: number): string {
  return formatFt(v)
}

export function dayRange(min: number | null, max: number | null): string | null {
  if (min != null && max != null && max > min) return `${min}–${max} munkanap`
  const one = max ?? min
  return one != null ? `${one} munkanap` : null
}

export function partyLine(party: LegalParty): string {
  return [party.name, party.address, party.email, party.phone, party.website].filter(Boolean).join(', ')
}

export function joinHu(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} és ${items[items.length - 1]}`
}
