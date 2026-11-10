/** Partner szoftver-visszajelzés — szövegek + címkék (docs/54). */

/** A visszajelzés jellege — nem funkciólista (azok mind megvannak). */
export const FEEDBACK_TAGS = [
  { id: 'bug', label: 'Valami nem működik' },
  { id: 'confusing', label: 'Nehéz kiigazodni' },
  { id: 'slow', label: 'Lassú' },
  { id: 'missing', label: 'Hiányzik valami' },
  { id: 'idea', label: 'Ötletem van' },
  { id: 'praise', label: 'Ez tetszik' }
] as const

export type FeedbackTagId = (typeof FEEDBACK_TAGS)[number]['id']

const TAG_IDS = new Set<string>(FEEDBACK_TAGS.map((t) => t.id))

export function isFeedbackTagId(value: string): value is FeedbackTagId {
  return TAG_IDS.has(value)
}

export function feedbackTagLabel(id: string): string {
  return FEEDBACK_TAGS.find((t) => t.id === id)?.label ?? id
}

/** NPS csoportok: 0–6 kritikus, 7–8 passzív, 9–10 promóter. */
export type FeedbackPromptVariant = 'low' | 'mid' | 'high'

export function feedbackPromptVariant(score: number): FeedbackPromptVariant {
  if (score <= 6) return 'low'
  if (score <= 8) return 'mid'
  return 'high'
}

export const NPS_GROUP_LABEL: Record<FeedbackPromptVariant, string> = {
  low: 'Kritikus',
  mid: 'Passzív',
  high: 'Promóter'
}

export const NPS_COPY = {
  question:
    'Mennyire ajánlanád ezt az online rendelőfelületet egy asztalos ismerősödnek?',
  hint: 'A Turinova csapata olvassa, nem a lapszabászat.',
  low: '0 = biztosan nem',
  high: '10 = biztosan',
  thanks: 'Köszönjük! Elolvassuk, és ez alapján fejlesztünk.'
} as const

export const SUGGESTION_COPY = {
  title: 'Van ötleted vagy gondod a portállal?',
  hint: 'Minden javaslatot elolvasunk — bármikor írhatsz.',
  open: 'Írd meg nekünk',
  placeholder: 'Pl. jó lenne, ha…',
  thanks: 'Megkaptuk, köszönjük! Írj bármikor újra.'
} as const

export const FEEDBACK_PROMPTS: Record<
  FeedbackPromptVariant,
  { question: string; placeholder: string }
> = {
  low: {
    question: 'Mi zavar a legjobban? Ezt javítjuk elsőként.',
    placeholder: 'Pl. nehéz megtalálni a lapszínt'
  },
  mid: {
    question: 'Mi hiányzik ahhoz, hogy 10-est adj?',
    placeholder: 'Pl. SMS, amikor kész a rendelésem'
  },
  high: {
    question: 'Örülünk! Mi az, ami a legtöbbet segít?',
    placeholder: 'Pl. hogy azonnal látom az árat'
  }
}
