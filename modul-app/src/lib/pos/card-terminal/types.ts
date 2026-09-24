/** POS kártyaterminál — Teya POSLink vagy kézi (külső) terminál. */

export type PosCardTerminalKind = 'teya' | 'manual'

export type CardChargeRequest = {
  amountHuf: number
  /** Eladás előtti ideiglenes hivatkozás (kosár / timestamp). */
  orderRef: string
  kind: PosCardTerminalKind
}

export type CardChargeResult =
  | {
      ok: true
      providerRef: string | null
      authCode: string | null
      kind: PosCardTerminalKind
    }
  | { ok: false; message: string; cancelled?: boolean }

const STORAGE_KEY = 'modul-pos-card-terminal'

export function getPosCardTerminalKind(): PosCardTerminalKind {
  if (typeof window === 'undefined') return 'manual'
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === 'teya' || raw === 'manual') return raw
  // Legacy SoftPOS → manual
  if (raw === 'softpos') return 'manual'
  return 'manual'
}

export function setPosCardTerminalKind(kind: PosCardTerminalKind) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, kind)
}
