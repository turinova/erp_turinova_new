import type {
  PosBootstrapPayload,
  PosBootstrapProgress,
  PosBootstrapShift
} from '@/lib/pos/bootstrap'
import type { PosManufacturerChip } from '@/lib/pos/discovery'
import type { SaleProductSearchItem } from '@/lib/sales/queries'

export type PosBootstrapClientResult =
  | ({ ok: true } & PosBootstrapPayload)
  | { ok: false; message: string }

export type FetchPosBootstrapOpts = {
  warehouseId: string
  registerId: string
  /** Default all. Examples: `shift`, `catalog`, `shift,catalog` */
  include?: string
  signal?: AbortSignal
}

export async function fetchPosBootstrap(
  opts: FetchPosBootstrapOpts
): Promise<PosBootstrapClientResult> {
  const sp = new URLSearchParams()
  if (opts.warehouseId) sp.set('warehouseId', opts.warehouseId)
  if (opts.registerId) sp.set('registerId', opts.registerId)
  if (opts.include) sp.set('include', opts.include)

  let res: Response
  try {
    res = await fetch(`/api/pos/bootstrap?${sp.toString()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: opts.signal
    })
  } catch (err) {
    if (opts.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw err
    }
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Hálózati hiba.'
    }
  }

  const data = (await res.json()) as
    | ({
        ok: true
        shift: PosBootstrapShift | null
        quick: SaleProductSearchItem[]
        frequent: SaleProductSearchItem[]
        progress: PosBootstrapProgress | null
        chips: PosManufacturerChip[]
      })
    | { ok: false; message: string }

  if (!res.ok || !data.ok) {
    return {
      ok: false,
      message:
        'ok' in data && data.ok === false
          ? data.message
          : 'Nem sikerült a POS betöltés.'
    }
  }

  return {
    ok: true,
    shift: data.shift,
    quick: data.quick,
    frequent: data.frequent,
    progress: data.progress,
    chips: data.chips
  }
}
