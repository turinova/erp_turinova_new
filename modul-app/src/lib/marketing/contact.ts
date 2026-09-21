import {
  COMPANY_LINE,
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164
} from '@/lib/marketing/pricing'

export const COMPANY_LEGAL = {
  name: 'HÍRÖS-ABLAK Kft.',
  address: '6000 Kecskemét, Mindszenti krt. 10.',
  taxNumber: '11421386-2-03',
  companyReg: '03-09-104700',
  line: COMPANY_LINE
} as const

export const SALES_CONTACT = {
  name: 'Mező Dávid',
  phoneDisplay: SUPPORT_PHONE_DISPLAY,
  phoneE164: SUPPORT_PHONE_E164,
  email: SUPPORT_EMAIL
} as const
