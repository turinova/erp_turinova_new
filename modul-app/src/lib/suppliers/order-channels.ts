import { z } from 'zod'

export const ORDER_CHANNEL_TYPES = [
  'email',
  'phone',
  'in_person',
  'internet'
] as const

export type OrderChannelType = (typeof ORDER_CHANNEL_TYPES)[number]

export const ORDER_CHANNEL_TYPE_LABEL: Record<OrderChannelType, string> = {
  email: 'E-mail',
  phone: 'Telefon',
  in_person: 'Személyes',
  internet: 'Webshop'
}

const emptyToNull = (v: string) => {
  const t = v.trim()
  return t === '' ? null : t
}

export const supplierOrderChannelSchema = z
  .object({
    channelType: z.enum(ORDER_CHANNEL_TYPES),
    name: z.string().trim().max(80).transform(emptyToNull),
    urlTemplate: z.string().trim().max(500).transform(emptyToNull),
    description: z.string().trim().max(200).transform(emptyToNull),
    isDefault: z.boolean()
  })
  .superRefine((data, ctx) => {
    if (data.channelType === 'internet' && !data.urlTemplate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Webshop csatornához URL sablon kell.',
        path: ['urlTemplate']
      })
    }
    if (
      data.urlTemplate &&
      !/^https?:\/\//i.test(data.urlTemplate) &&
      data.channelType === 'internet'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Az URL https:// vagy http:// prefixszel kezdődjön.',
        path: ['urlTemplate']
      })
    }
  })

export type SupplierOrderChannelInput = {
  channelType: OrderChannelType
  name: string
  urlTemplate: string
  description: string
  isDefault: boolean
}

export function emptyOrderChannelInput(
  channelType: OrderChannelType = 'internet'
): SupplierOrderChannelInput {
  return {
    channelType,
    name: '',
    urlTemplate: '',
    description: '',
    isDefault: false
  }
}

export type BuildSupplierProductUrlParams = {
  urlTemplate: string
  sku?: string | null
  supplierSku?: string | null
  name?: string | null
  ean?: string | null
}

/** URL sablon helyőrzők cseréje (shop-portal minta). */
export function buildSupplierProductUrl(
  params: BuildSupplierProductUrlParams
): string | null {
  const template = params.urlTemplate?.trim()
  if (!template) return null

  const sku = (params.sku ?? '').trim()
  const supplierSku = (params.supplierSku ?? '').trim() || sku
  const name = (params.name ?? '').trim()
  const ean = (params.ean ?? '').trim()

  let url = template
  if (url.includes('{{supplier_sku}}')) {
    url = url.replace(/\{\{supplier_sku\}\}/g, encodeURIComponent(supplierSku))
  }
  url = url.replace(/\{\{sku\}\}/g, encodeURIComponent(sku))
  url = url.replace(/\{\{name\}\}/g, encodeURIComponent(name))
  url = url.replace(/\{\{ean\}\}/g, encodeURIComponent(ean))
  return url
}

export type EmailLineItem = {
  name: string
  sku?: string | null
  quantity: number
  unit: string
  includeSku?: boolean
}

/** Egyszerű szöveges PO e-mail törzs (mailto / vágólap). */
export function buildPurchaseOrderEmailPlainBody(input: {
  intro?: string | null
  items: EmailLineItem[]
  includeSku: boolean
  poNumber?: string | null
}): string {
  const parts: string[] = []
  const intro = (input.intro ?? '').trim()
  if (intro) {
    // Strip crude HTML tags from stored intro if any
    parts.push(intro.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    parts.push('')
  }
  if (input.poNumber) {
    parts.push(`Rendelésszám: ${input.poNumber}`)
    parts.push('')
  }
  input.items.forEach((it, i) => {
    const qty = new Intl.NumberFormat('hu-HU', {
      maximumFractionDigits: 3
    }).format(it.quantity)
    const skuPart =
      input.includeSku && it.includeSku !== false && it.sku
        ? ` - ${it.sku}`
        : ''
    parts.push(`${i + 1}. ${it.name}${skuPart} - ${qty} ${it.unit}`)
  })
  return parts.join('\n').trim()
}

export function buildMailtoHref(input: {
  to: string
  subject: string
  body: string
}): string {
  const params = new URLSearchParams()
  params.set('subject', input.subject)
  params.set('body', input.body)
  return `mailto:${input.to.trim()}?${params.toString()}`
}
