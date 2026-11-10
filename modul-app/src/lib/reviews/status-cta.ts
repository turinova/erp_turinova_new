import type { OrderStatusReview, OrderStatusTone } from '@/lib/order-status/types'

/**
 * Státusz oldali értékelés-kérés változata:
 * - first: kész, átvehető — első rendelés (oldal alján, másodlagos)
 * - repeat: kész, átvehető — visszatérő vevő (oldal alján, erősebb szöveg)
 * - primary: átadva — kiemelt kártya az állapot alatt
 * - thanks: erről a linkről már kattintott
 */
export type StatusReviewMode = OrderStatusReview['mode']

export function resolveStatusReviewMode(input: {
  enabled: boolean
  hasReviewUrl: boolean
  tone: OrderStatusTone
  clickedFromThisLink: boolean
  /** A vevő a gyakorisági ablakon belül már kattintott (másik rendelésnél). */
  clickedRecently: boolean
  isRepeatCustomer: boolean
}): StatusReviewMode | null {
  if (!input.enabled || !input.hasReviewUrl) return null
  if (input.tone !== 'success' && input.tone !== 'neutral') return null
  if (input.clickedFromThisLink) return 'thanks'
  if (input.clickedRecently) return null
  if (input.tone === 'neutral') return 'primary'
  return input.isRepeatCustomer ? 'repeat' : 'first'
}

export const STATUS_REVIEW_COPY: Record<
  Exclude<StatusReviewMode, 'thanks'>,
  { title: string; body: string; button: string }
> = {
  first: {
    title: 'Elkészült! Írnál rólunk pár szót?',
    body: 'Kis csapat vagyunk, és minden Google-értékelést elolvasunk. Ebből találnak ránk mások is.',
    button: 'Értékelés a Google-ön'
  },
  repeat: {
    title: 'Köszönjük, hogy újra minket választottál!',
    body: 'Ha pár mondatban leírnád a Google-ön, miért jössz vissza, az nekünk a legtöbbet segít.',
    button: 'Értékelés a Google-ön'
  },
  primary: {
    title: 'Hogy sikerült? Írd meg nekünk a Google-ön!',
    body: 'Egy-két mondat is elég. Minden értékelést elolvasunk, és sokat jelent egy helyi vállalkozásnak.',
    button: 'Értékelés írása a Google-ön'
  }
}

export const STATUS_REVIEW_THANKS = {
  title: 'Köszönjük, hogy időt szántál ránk!',
  again: 'Értékelés megnyitása újra'
}
