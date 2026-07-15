import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getCategoryWithDescriptions } from '@/lib/categories-server'
import {
  appendProgressItem,
  incrementProgress,
  shouldStopSync,
  updateProgress
} from '@/lib/sync-progress-store'
import {
  clearShopRenterConnectionContextCache,
  getShopRenterConnectionContext,
  pushCategoryToShopRenter
} from '@/lib/category-sync-push-service'

export const maxDuration = 300

const MAX_SYNC_PER_REQUEST = 20

/**
 * POST /api/categories/bulk-sync-to-shoprenter
 * Body: { categoryIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const categoryIds: string[] = Array.isArray(body.categoryIds) ? body.categoryIds : []

    if (!categoryIds.length) {
      return NextResponse.json({ success: false, error: 'categoryIds required' }, { status: 400 })
    }
    if (categoryIds.length > MAX_SYNC_PER_REQUEST) {
      return NextResponse.json(
        {
          success: false,
          error: `Maximum ${MAX_SYNC_PER_REQUEST} kategória kérésenként. Küldj több batch-et.`
        },
        { status: 400 }
      )
    }

    const supabase = await getTenantSupabase()
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const progressKey = `bulk-category-sync-${Date.now()}`
    updateProgress(progressKey, {
      total: categoryIds.length,
      synced: 0,
      current: 0,
      status: 'syncing',
      errors: 0,
      jobType: 'category_sync',
      itemLog: []
    })

    processBulkCategorySyncInBackground(supabase, categoryIds, progressKey).catch((error) => {
      console.error('[BULK CATEGORY SYNC] Background error:', error)
      updateProgress(progressKey, { status: 'error', errors: categoryIds.length })
    })

    await new Promise((resolve) => setTimeout(resolve, 150))

    return NextResponse.json({
      success: true,
      message: 'Kategória szinkronizálás elindítva',
      total: categoryIds.length,
      progressKey,
      maxBatchSize: MAX_SYNC_PER_REQUEST
    })
  } catch (error: any) {
    console.error('[BULK CATEGORY SYNC]', error)
    return NextResponse.json({ success: false, error: error?.message || 'Unknown error' }, { status: 500 })
  }
}

async function processBulkCategorySyncInBackground(
  supabase: any,
  categoryIds: string[],
  progressKey: string
) {
  clearShopRenterConnectionContextCache()

  try {
    for (let i = 0; i < categoryIds.length; i++) {
      if (shouldStopSync(progressKey)) {
        updateProgress(progressKey, { status: 'stopped' })
        break
      }

      const categoryId = categoryIds[i]
      const category = await getCategoryWithDescriptions(categoryId)
      const categoryName =
        category?.shoprenter_category_descriptions?.[0]?.name || category?.name || categoryId

      if (!category) {
        incrementProgress(progressKey, { errors: 1 })
        appendProgressItem(progressKey, {
          id: categoryId,
          name: categoryName,
          status: 'sync_failed',
          error: 'Kategória nem található'
        })
        continue
      }

      const ctx = await getShopRenterConnectionContext(category.connection_id)
      if (!ctx) {
        incrementProgress(progressKey, { errors: 1 })
        appendProgressItem(progressKey, {
          id: categoryId,
          name: categoryName,
          status: 'sync_failed',
          error: 'ShopRenter kapcsolat hiba'
        })
        continue
      }

      const result = await pushCategoryToShopRenter(supabase, categoryId, ctx)

      if (result.success) {
        incrementProgress(progressKey, { synced: 1 })
        appendProgressItem(progressKey, {
          id: categoryId,
          name: categoryName,
          status: 'synced'
        })
      } else {
        incrementProgress(progressKey, { errors: 1 })
        appendProgressItem(progressKey, {
          id: categoryId,
          name: categoryName,
          status: 'sync_failed',
          error: result.error
        })
      }
    }

    const final = shouldStopSync(progressKey) ? 'stopped' : 'completed'
    updateProgress(progressKey, { status: final })
  } catch (error) {
    console.error('[BULK CATEGORY SYNC] Fatal:', error)
    updateProgress(progressKey, { status: 'error' })
  }
}
