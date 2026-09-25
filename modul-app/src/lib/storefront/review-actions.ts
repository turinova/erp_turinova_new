'use server'

import { z } from 'zod'

import { resolveStorefrontTenant } from '@/lib/storefront/resolve-tenant'
import { createServiceClient } from '@/lib/supabase/service'
import { getStorefrontSettings } from '@/lib/webshop/settings'

export type SubmitReviewResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const schema = z.object({
  accessoryId: z.string().uuid(),
  authorName: z
    .string()
    .trim()
    .min(1, 'Add meg a neved.')
    .max(80, 'Legfeljebb 80 karakter.'),
  authorEmail: z
    .string()
    .trim()
    .max(200)
    .email('Érvényes e-mail címet adj meg.'),
  rating: z
    .number()
    .int()
    .min(1, 'Válassz csillagot.')
    .max(5, 'Válassz csillagot.'),
  title: z
    .string()
    .trim()
    .max(120, 'Legfeljebb 120 karakter.')
    .optional()
    .transform((v) => (v ? v : null)),
  body: z
    .string()
    .trim()
    .min(10, 'Legalább 10 karakter.')
    .max(2000, 'Legfeljebb 2000 karakter.'),
  variantLabel: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  website: z.string().optional()
})

export type SubmitReviewInput = z.input<typeof schema>

export async function submitProductReview(
  input: SubmitReviewInput
): Promise<SubmitReviewResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) {
        fieldErrors[key] = issue.message
      }
    }
    return { ok: false, message: 'Ellenőrizd a megadott adatokat.', fieldErrors }
  }

  // Honeypot: botok kitöltik, embernek rejtett.
  if (parsed.data.website && parsed.data.website.trim()) {
    return { ok: true }
  }

  const admin = createServiceClient()
  if (!admin) return { ok: false, message: 'A bolt most nem elérhető.' }

  const tenant = await resolveStorefrontTenant(admin)
  if (!tenant) return { ok: false, message: 'A bolt most nem elérhető.' }

  const settings = await getStorefrontSettings(admin, tenant.id)
  if (!settings.reviewsEnabled) {
    return { ok: false, message: 'Ennél a boltnál nincs értékelés.' }
  }

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

  const email = parsed.data.authorEmail.toLowerCase()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('product_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .eq('accessory_id', parsed.data.accessoryId)
    .eq('author_email', email)
    .gte('created_at', since)
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: 'Ehhez a termékhez ma már küldtél értékelést.'
    }
  }

  const { error } = await admin.from('product_reviews').insert({
    tenant_id: tenant.id,
    accessory_id: parsed.data.accessoryId,
    author_name: parsed.data.authorName,
    author_email: email,
    rating: parsed.data.rating,
    title: parsed.data.title,
    body: parsed.data.body,
    variant_label: parsed.data.variantLabel,
    status: 'pending'
  })

  if (error) {
    console.error('submitProductReview', error.message)
    return { ok: false, message: 'Nem sikerült elküldeni az értékelést.' }
  }

  return { ok: true }
}
