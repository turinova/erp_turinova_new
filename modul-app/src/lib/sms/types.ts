export const QUOTE_READY_SMS_FEATURE = 'quote_ready_sms' as const
export const QUOTE_READY_TEMPLATE_KEY = 'quote_ready' as const
export const CSO_READY_TEMPLATE_KEY = 'cso_ready' as const

export const DEFAULT_QUOTE_READY_SMS_BODY =
  'Kedves {customer_name}! A rendelese elkeszult es atveheto. Anyagok: {material_name} Udvozlettel, {company_name}'

export const DEFAULT_CSO_READY_SMS_BODY =
  'Kedves {customer_name}! A(z) {order_number} rendelesed megerkezett, atveheted. Vegosszeg: {total_amount} Ft. Udvozlettel, {company_name}'

export type SmsTemplateKey =
  | typeof QUOTE_READY_TEMPLATE_KEY
  | typeof CSO_READY_TEMPLATE_KEY

export type SmsSendStatus = 'sent' | 'delivered' | 'failed' | 'skipped'

export type SmsSkipReason =
  | 'no_entitlement'
  | 'no_opt_in'
  | 'bad_phone'
  | 'already_sent'
  | 'user_declined'
  | 'no_customer'
  | 'empty_body'
  | 'not_ready'

export type QuoteReadySmsCandidate = {
  quoteId: string
  orderNumber: string
  customerId: string | null
  customerName: string
  mobile: string | null
  eligible: boolean
  skipReason: SmsSkipReason | null
  alreadySentAt: string | null
}

export type CsoReadySmsCandidate = {
  orderId: string
  orderNumber: string
  customerName: string
  mobile: string | null
  previewBody: string
  readyCount: number
  waitingCount: number
  eligible: boolean
  skipReason: SmsSkipReason | null
  alreadySentAt: string | null
}

export function defaultSmsBody(key: SmsTemplateKey): string {
  if (key === CSO_READY_TEMPLATE_KEY) return DEFAULT_CSO_READY_SMS_BODY
  return DEFAULT_QUOTE_READY_SMS_BODY
}
