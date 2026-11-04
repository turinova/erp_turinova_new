import {
  isCashPaymentMethodName,
  isDeferredPaymentMethodName
} from '@/lib/sales/payment-kind'

export type PaymentMethodPickRow = {
  id: string
  name: string
  is_default?: boolean
}

/**
 * Shop selectek alapértelmezett fizetési módja.
 * Prioritás: preferTransfer → is_default → cash-név → lista első.
 */
export function pickDefaultPaymentMethodId(
  methods: PaymentMethodPickRow[],
  opts?: { preferTransfer?: boolean }
): string {
  if (methods.length === 0) return ''

  if (opts?.preferTransfer) {
    const transfer = methods.find((m) => isDeferredPaymentMethodName(m.name))
    if (transfer) return transfer.id
  }

  const flagged = methods.find((m) => m.is_default)
  if (flagged) return flagged.id

  const cash = methods.find((m) => isCashPaymentMethodName(m.name))
  if (cash) return cash.id

  return methods[0]?.id ?? ''
}
