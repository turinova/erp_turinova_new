/**
 * Kiosk megmunkálás glossary: csak szál / kereszt / ferde.
 * Tilos: fent, lent, felső, alsó (bútorlapnál nincs ilyen).
 */

import type { KioskMachining, SzogCornerId } from '@/lib/kiosk/types'

/** Previewn: top/bottom = szálirányú él, left/right = keresztirányú (Szál → vízszintes). */
export function edgeAxisLabel(
  side: 'top' | 'bottom' | 'left' | 'right'
): 'Szál' | 'Kereszt' {
  return side === 'top' || side === 'bottom' ? 'Szál' : 'Kereszt'
}

/** Sarok 1-4 a rajzon (TL=1, TR=2, BL=3, BR=4). */
export const SZOG_CORNER_UI: Array<{
  id: SzogCornerId
  label: string
  digit: string
}> = [
  { id: 'TL', label: 'Sarok 1', digit: '1' },
  { id: 'TR', label: 'Sarok 2', digit: '2' },
  { id: 'BL', label: 'Sarok 3', digit: '3' },
  { id: 'BR', label: 'Sarok 4', digit: '4' }
]

export const MACHINING_COPY = {
  h1: 'Kell még megmunkálás?',
  sub: 'Ha nem kell semmi, nyomj Entert vagy Tovább.',
  noneTitle: 'Nincs megmunkálás',
  noneHint: 'Csak méretre vágás',
  duplungTitle: 'Duplung',
  duplungHint: '2 lap összeragasztva',
  panthelyTitle: 'Pánthely',
  panthelyHint: 'Zsanérhely az élen',
  szogTitle: 'Szögvágás',
  szogHint: 'Egy sarok levágása',
  panthelyQty: 'Hány pánthely?',
  panthelySide: 'Melyik oldalon?',
  panthelyLong: 'Hosszú',
  panthelyShort: 'Rövid',
  szogIntro: 'Kattints a sarokra a rajzon (1-4).',
  remainGrain: 'Szálirányú él, marad (mm)',
  remainCross: 'Keresztirányú él, marad (mm)',
  previewDuplungBadge: (qty: number) => `Duplung, ${qty} db`,
  previewDuplungCaption: '2 lap kell egy kész darabhoz'
} as const

/** Bekapcsolt duplung státusz a formon. */
export function duplungStatusLabel(quantity: number): string {
  return `Két azonos méretű lapot ragasztunk össze, ezért a darabszám megduplázódik (${quantity} db). Az anyagár is nő.`
}

/**
 * Kosár / rendelés összefoglaló: csak ami a megrendelőnek kell.
 * Nincs „Sarok 1” (a rajzon látszik), nincs ismétlődő címke-zuhatag.
 */
/** Egyedi chip címkék (kosár tábla). */
export function machiningSummaryChips(m: KioskMachining): string[] {
  const parts: string[] = []
  if (m.duplungolas) parts.push('Duplung')
  if (m.panthely) {
    const oldal = m.panthely.oldal === 'hosszu' ? 'hosszú él' : 'rövid él'
    parts.push(`Pánthely ${m.panthely.quantity} db ${oldal}`)
  }
  if (m.szog) parts.push('Szögvágás')
  return parts
}

export function machiningSummaryLabel(m: KioskMachining): string | null {
  const parts = machiningSummaryChips(m)
  return parts.length ? parts.join(', ') : null
}

/** Preview alatt: rövid élhossz mm (a rajzon is ott vannak). */
export function finishedEdgesCaption(input: {
  top: number
  bottom: number
  left: number
  right: number
  ferdeMm: number[]
}): string {
  const grain = [input.top, input.bottom]
    .map((n) => Math.round(n))
    .filter((n) => n > 0)
  const cross = [input.left, input.right]
    .map((n) => Math.round(n))
    .filter((n) => n > 0)
  const parts: string[] = []
  if (grain.length) {
    parts.push(
      grain.length === 1 || grain[0] === grain[1]
        ? `Szál ${grain[0]} mm`
        : `Szál ${grain.join(' / ')} mm`
    )
  }
  if (cross.length) {
    parts.push(
      cross.length === 1 || cross[0] === cross[1]
        ? `Kereszt ${cross[0]} mm`
        : `Kereszt ${cross.join(' / ')} mm`
    )
  }
  if (input.ferdeMm.length > 0) {
    parts.push(`Ferde ${input.ferdeMm.join(', ')} mm`)
  }
  return parts.join(', ')
}
