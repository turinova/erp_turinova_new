import {
  type CardChargeRequest,
  type CardChargeResult
} from '@/lib/pos/card-terminal/types'
import {
  cancelTeyaCardChargeAction,
  pollTeyaCardChargeAction,
  startTeyaCardChargeAction
} from '@/lib/pos/settings-actions'

export type StartCardChargeOutcome =
  | { mode: 'manual' }
  | {
      mode: 'teya'
      paymentRequestId: string
      status: string
    }
  | { mode: 'error'; message: string }

/**
 * Kártya charge indítás — Teya: payment-request a terminálra;
 * manual: csak UI megerősítés.
 */
export async function startCardTerminalCharge(
  req: CardChargeRequest & { registerId?: string | null }
): Promise<StartCardChargeOutcome> {
  if (req.kind !== 'teya') {
    return { mode: 'manual' }
  }

  const started = await startTeyaCardChargeAction({
    amountHuf: req.amountHuf,
    merchantReference: req.orderRef.slice(0, 100),
    registerId: req.registerId
  })

  if (!started.ok) {
    return { mode: 'error', message: started.message }
  }

  return {
    mode: 'teya',
    paymentRequestId: started.paymentRequestId,
    status: started.status
  }
}

export async function pollCardTerminalCharge(
  paymentRequestId: string
): Promise<
  | {
      ok: true
      done: boolean
      status: string
      providerRef: string | null
      authCode: string | null
    }
  | { ok: false; message: string }
> {
  const r = await pollTeyaCardChargeAction({ paymentRequestId })
  if (!r.ok) return r
  return {
    ok: true,
    done: r.done,
    status: r.status,
    providerRef: r.providerRef,
    authCode: r.authCode
  }
}

export async function cancelCardTerminalCharge(
  paymentRequestId: string
): Promise<void> {
  await cancelTeyaCardChargeAction({ paymentRequestId })
}

/** Kézi megerősítés (nem Teya auto-success). */
export function confirmCardTerminalCharge(input: {
  kind: CardChargeRequest['kind']
  amountHuf: number
  authCode?: string
  providerRef?: string | null
}): CardChargeResult {
  const amount = Math.round(input.amountHuf)
  if (!(amount > 0)) {
    return { ok: false, message: 'Érvénytelen kártyaösszeg.' }
  }
  const code = (input.authCode ?? '').trim() || null
  if (input.kind === 'teya') {
    return {
      ok: true,
      kind: 'teya',
      authCode: code,
      providerRef:
        input.providerRef?.trim() ||
        (code ? `teya:${code}` : `teya:${amount}`)
    }
  }
  return {
    ok: true,
    kind: 'manual',
    authCode: code,
    providerRef: code ? `terminal:${code}` : `terminal:${amount}`
  }
}
