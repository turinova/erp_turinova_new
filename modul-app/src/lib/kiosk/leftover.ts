import type { PricingMode } from '@/lib/opti/quote-calculations'

/** Miért számolunk teljes táblát: kihasználtság miatt, vagy mert a lapot csak egészben adjuk. */
export type FullBoardReason = 'usage' | 'always'

export function fullBoardReason(
  pricingMode: PricingMode,
  onStock: boolean
): FullBoardReason {
  if (pricingMode === 'always_full_board') return 'always'
  if (pricingMode === 'standard' && !onStock) return 'always'
  return 'usage'
}

export function countFullBoards(
  boards: ReadonlyArray<{ pricingMethod: 'panel_area' | 'full_board' }>
): number {
  return boards.filter((b) => b.pricingMethod === 'full_board').length
}

export const LEFTOVER_COPY = {
  cart: 'Az egész táblát fizeted, ezért a maradék is a tiéd. A darabjaiddal együtt elviheted.',
  explainUsage:
    'A darabjaid a tábla nagy részét használják, ezért az egész táblát számoljuk. A maradék a tiéd.',
  explainAlways:
    'Ezt a lapot csak egészben adjuk, ezért az egész táblát számoljuk. A maradék a tiéd.',
  success: 'A teljes táblák maradékát is elviheted.',
  helpTitle: 'Mi lesz a maradékkal?',
  helpBody:
    'Ha az egész táblát fizeted, a maradék a tiéd. A darabjaiddal együtt elviheted.',
  staffBadge: 'Maradék a megrendelőé'
} as const

/** A kioskban beírt méret mindig kész méret (élzáróval együtt). */
export const FINISHED_SIZE_COPY = {
  sizeStep:
    'A kész méretet add meg, élzáróval együtt. A vágásnál mi számolunk az élzáróval.',
  helpTitle: 'Élzáróval vagy nélküle adjam meg?',
  helpBody:
    'Élzáróval együtt, ahogy a kész darabnak lennie kell. A vágásnál mi számolunk az élzáróval.'
} as const

/**
 * Pult / PDF jelvény szöveg az anyagsorhoz.
 * `boards_charged` a teljes táblák száma (snapshot).
 */
export function staffLeftoverLabel(
  pricingMethod: string,
  fullBoardsCharged: number
): string | null {
  if (!(fullBoardsCharged > 0)) return null
  if (pricingMethod === 'full_board') return LEFTOVER_COPY.staffBadge
  if (pricingMethod === 'mixed') {
    return `${fullBoardsCharged} teljes tábla maradéka a megrendelőé`
  }
  return null
}
