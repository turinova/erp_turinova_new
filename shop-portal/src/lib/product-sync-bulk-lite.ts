/**
 * Bulk-lite product pull: minimal ShopRenter API per row (productExtend full=1 only).
 * Used for large catalog syncs on Vercel serverless.
 */

export type SyncProductToDatabaseOptions = {
  bulkLiteMode?: boolean
}

export function isProductSyncBulkLiteMode(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  if (!metadata) return false
  if (metadata.bulkLiteMode === true) return true
  if (metadata.bulkLiteMode === false) return false
  // Legacy jobs started before bulkLiteMode flag: enable for large/full pulls
  if (metadata.mode === 'full') return true
  const pageCount = Number(metadata.pageCount ?? 0)
  if (pageCount > 10) return true
  const cp = metadata.checkpoint as { listedItemsSoFar?: number } | undefined
  const listed = typeof cp?.listedItemsSoFar === 'number' ? cp.listedItemsSoFar : 0
  if (listed >= 2000) return true
  return false
}

export function getBulkLiteProductConcurrency(): number {
  const raw = Number.parseInt(process.env.SHOPRENTER_SYNC_BULK_LITE_CONCURRENCY || '2', 10)
  return Math.max(1, Math.min(4, Number.isFinite(raw) ? raw : 2))
}
