/**
 * Stabil beszállító-szín a várólistán: azonos supplierId → azonos hangulat.
 * Nem státuszjelzés — szöveges státusz + chip kell mellé (certainty-first).
 */
export type SupplierRowStyle = {
  key: string
  /** Sor bal szegély + háttér */
  row: string
  /** Csoportfej */
  head: string
  /** Kis pont a fejben */
  dot: string
}

const PALETTE: Omit<SupplierRowStyle, 'key'>[] = [
  {
    row: 'border-l-sky-500 bg-sky-50/70',
    head: 'border-l-sky-500 bg-sky-100/90 text-sky-950',
    dot: 'bg-sky-500'
  },
  {
    row: 'border-l-amber-500 bg-amber-50/70',
    head: 'border-l-amber-500 bg-amber-100/90 text-amber-950',
    dot: 'bg-amber-500'
  },
  {
    row: 'border-l-emerald-500 bg-emerald-50/70',
    head: 'border-l-emerald-500 bg-emerald-100/90 text-emerald-950',
    dot: 'bg-emerald-500'
  },
  {
    row: 'border-l-violet-500 bg-violet-50/70',
    head: 'border-l-violet-500 bg-violet-100/90 text-violet-950',
    dot: 'bg-violet-500'
  },
  {
    row: 'border-l-rose-500 bg-rose-50/70',
    head: 'border-l-rose-500 bg-rose-100/90 text-rose-950',
    dot: 'bg-rose-500'
  },
  {
    row: 'border-l-cyan-500 bg-cyan-50/70',
    head: 'border-l-cyan-500 bg-cyan-100/90 text-cyan-950',
    dot: 'bg-cyan-500'
  },
  {
    row: 'border-l-orange-500 bg-orange-50/70',
    head: 'border-l-orange-500 bg-orange-100/90 text-orange-950',
    dot: 'bg-orange-500'
  },
  {
    row: 'border-l-teal-500 bg-teal-50/70',
    head: 'border-l-teal-500 bg-teal-100/90 text-teal-950',
    dot: 'bg-teal-500'
  }
]

const NONE: Omit<SupplierRowStyle, 'key'> = {
  row: 'border-l-zinc-400 bg-zinc-50/80',
  head: 'border-l-zinc-400 bg-zinc-100/90 text-zinc-800',
  dot: 'bg-zinc-400'
}

function hashId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function supplierRowStyle(
  supplierId: string | null | undefined
): SupplierRowStyle {
  if (!supplierId) {
    return { key: 'none', ...NONE }
  }
  const tone = PALETTE[hashId(supplierId) % PALETTE.length]!
  return { key: supplierId, ...tone }
}
