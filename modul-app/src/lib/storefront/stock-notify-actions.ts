'use server'

import { z } from 'zod'

import { resolveStorefrontTenant } from '@/lib/storefront/resolve-tenant'
import { createServiceClient } from '@/lib/supabase/service'

export type StockNotifyResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const schema = z.object({
  accessoryId: z.string().uuid(),
  email: z.string().trim().max(200).email('Érvényes e-mail címet adj meg.'),
  variantLabel: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  website: z.string().optional()
})

export type StockNotifyInput = z.input<typeof schema>

const UNIQUE_VIOLATION = '23505'

export async function requestStockNotify(
  input: StockNotifyInput
): Promise<StockNotifyResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, message: 'Ellenőrizd az e-mail címet.', fieldErrors }
  }

  if (parsed.data.website && parsed.data.website.trim()) return { ok: true }

  const admin = createServiceClient()
  if (!admin) return { ok: false, message: 'A bolt most nem elérhető.' }

  const tenant = await resolveStorefrontTenant(admin)
  if (!tenant) return { ok: false, message: 'A bolt most nem elérhető.' }

  const { data: product } = await admin
    .from('storefront_products')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('id', parsed.data.accessoryId)
    .eq('sellable_web', true)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle()
  if (!product) return { ok: false, message: 'A termék nem található.' }

  const { error } = await admin.from('storefront_stock_notify_requests').insert({
    tenant_id: tenant.id,
    accessory_id: parsed.data.accessoryId,
    email: parsed.data.email.toLowerCase(),
    variant_label: parsed.data.variantLabel
  })

  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error('requestStockNotify', error.message)
    return { ok: false, message: 'Nem sikerült elmenteni. Próbáld újra később.' }
  }

  return { ok: true }
}
