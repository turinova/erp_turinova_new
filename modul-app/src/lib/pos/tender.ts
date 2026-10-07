import {
  hungarianCashRound,
  type SaleTotalsResult
} from '@/lib/sales/totals'

export type PosPayMode = 'cash' | 'card' | 'split'

export type PosTenderLine = {
  kind: 'cash' | 'card'
  paymentMethodId: string
  amount: number
}

/** Fizetendő: tiszta KP → magyar kerekítés; egyébként bruttó végösszeg. */
export function posPayableDue(
  totals: Pick<SaleTotalsResult, 'totalGross'>,
  mode: PosPayMode
): { due: number; cashRoundingAmount: number } {
  if (mode === 'cash') {
    const due = hungarianCashRound(totals.totalGross)
    return { due, cashRoundingAmount: due - totals.totalGross }
  }
  return { due: totals.totalGross, cashRoundingAmount: 0 }
}

export function buildPosTenders(input: {
  mode: PosPayMode
  due: number
  cashMethodId: string | null
  cardMethodId: string | null
  cashAmount?: number
  /**
   * KP / kártya: mennyit fizetett (0 = hitel, partial OK).
   * Hiányzik → teljes due. Splitnél ignorált.
   * allowPartial=false → mindig teljes due (vendég).
   */
  paidAmount?: number
  allowPartial?: boolean
}): { ok: true; tenders: PosTenderLine[] } | { ok: false; message: string } {
  const due = Math.round(input.due)
  if (due <= 0) {
    return { ok: false, message: 'Nincs fizetendő összeg.' }
  }

  /** Vendégnél (allowPartial=false) mindig teljes due. */
  const allowPartial = input.allowPartial !== false
  let paid =
    !allowPartial || input.paidAmount == null
      ? due
      : Math.round(input.paidAmount)
  if (paid < 0) paid = 0
  if (paid > due) {
    return {
      ok: false,
      message: `A fizetett összeg max. ${due} Ft lehet.`
    }
  }

  if (input.mode === 'cash') {
    if (!input.cashMethodId) {
      return { ok: false, message: 'Nincs készpénz fizetési mód.' }
    }
    if (paid === 0) {
      return { ok: true, tenders: [] }
    }
    return {
      ok: true,
      tenders: [
        {
          kind: 'cash',
          paymentMethodId: input.cashMethodId,
          amount: paid
        }
      ]
    }
  }

  if (input.mode === 'card') {
    if (!input.cardMethodId) {
      return { ok: false, message: 'Nincs kártya fizetési mód.' }
    }
    if (paid === 0) {
      return { ok: true, tenders: [] }
    }
    return {
      ok: true,
      tenders: [
        {
          kind: 'card',
          paymentMethodId: input.cardMethodId,
          amount: paid
        }
      ]
    }
  }

  // split — mindig teljes due (hitel/partial v1-ben nem)
  if (!input.cashMethodId || !input.cardMethodId) {
    return {
      ok: false,
      message: 'Vegyes fizetéshez kell készpénz és kártya mód.'
    }
  }
  let cash = Math.round(input.cashAmount ?? 0)
  if (cash < 0) cash = 0
  if (cash >= due) {
    return {
      ok: false,
      message: 'Vegyes fizetésnél a készpénz legyen kevesebb a végösszegnél.'
    }
  }
  if (cash <= 0) {
    return {
      ok: false,
      message: 'Add meg a készpénz részt (legalább 1 Ft).'
    }
  }
  const card = due - cash
  if (card <= 0) {
    return { ok: false, message: 'A kártya rész legyen pozitív.' }
  }
  return {
    ok: true,
    tenders: [
      { kind: 'cash', paymentMethodId: input.cashMethodId, amount: cash },
      { kind: 'card', paymentMethodId: input.cardMethodId, amount: card }
    ]
  }
}

export function posChangeDue(cashTender: number, cashReceived: number): number {
  const tender = Math.round(cashTender)
  const received = Math.round(cashReceived)
  if (tender <= 0) return 0
  return Math.max(0, received - tender)
}
