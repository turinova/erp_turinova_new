import type { SupabaseClient } from '@supabase/supabase-js'

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export type AdminReviewRow = {
  id: string
  accessoryId: string
  productName: string
  productSlug: string | null
  authorName: string
  authorEmail: string | null
  rating: number
  title: string | null
  body: string
  variantLabel: string | null
  status: ReviewStatus
  sellerReply: string | null
  createdAt: string
}

export const REVIEWS_PAGE_SIZE = 25

export async function listAdminReviews(
  supabase: SupabaseClient,
  tenantId: string,
  opts: { status: ReviewStatus | 'all'; page: number }
): Promise<{ rows: AdminReviewRow[]; total: number; pendingCount: number }> {
  const from = (opts.page - 1) * REVIEWS_PAGE_SIZE
  let query = supabase
    .from('product_reviews')
    .select(
      'id, accessory_id, author_name, author_email, rating, title, body, variant_label, status, seller_reply, created_at, accessories ( name, web_slug )',
      { count: 'exact' }
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, from + REVIEWS_PAGE_SIZE - 1)

  if (opts.status !== 'all') query = query.eq('status', opts.status)

  const [{ data, error, count }, pending] = await Promise.all([
    query,
    supabase
      .from('product_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .is('deleted_at', null)
  ])

  if (error) {
    console.error('listAdminReviews', error.message)
    return { rows: [], total: 0, pendingCount: 0 }
  }

  const rows = (data ?? []).map((r) => {
    const row = r as unknown as Record<string, unknown>
    const acc = Array.isArray(row.accessories) ? row.accessories[0] : row.accessories
    const a = acc as { name?: string; web_slug?: string | null } | null
    return {
      id: String(row.id),
      accessoryId: String(row.accessory_id),
      productName: a?.name ?? '—',
      productSlug: a?.web_slug ?? null,
      authorName: String(row.author_name ?? ''),
      authorEmail: (row.author_email as string | null) ?? null,
      rating: Number(row.rating),
      title: (row.title as string | null) ?? null,
      body: String(row.body ?? ''),
      variantLabel: (row.variant_label as string | null) ?? null,
      status: row.status as ReviewStatus,
      sellerReply: (row.seller_reply as string | null) ?? null,
      createdAt: String(row.created_at)
    } satisfies AdminReviewRow
  })

  return { rows, total: count ?? 0, pendingCount: pending.count ?? 0 }
}
