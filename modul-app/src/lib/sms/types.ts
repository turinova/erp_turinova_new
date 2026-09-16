export const QUOTE_READY_SMS_FEATURE = 'quote_ready_sms' as const
export const QUOTE_READY_TEMPLATE_KEY = 'quote_ready' as const

export const DEFAULT_QUOTE_READY_SMS_BODY =
  'Kedves {customer_name}! A rendelese elkeszult es atveheto. Anyagok: {material_name} Udvozlettel, {company_name}'

export type SmsTemplateKey = typeof QUOTE_READY_TEMPLATE_KEY

export type SmsSendStatus = 'sent' | 'delivered' | 'failed' | 'skipped'

export type SmsSkipReason =
  | 'no_entitlement'
  | 'no_opt_in'
  | 'bad_phone'
  | 'already_sent'
  | 'user_declined'
  | 'no_customer'
  | 'empty_body'

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
