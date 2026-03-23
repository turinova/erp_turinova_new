import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'
import { getProgress } from '@/lib/sync-progress-store'
import { reconcileStaleRunningSyncJob } from '@/lib/sync-job-db'

/**
 * GET /api/connections/[id]/sync-status
 * Get sync status information for a connection including last sync times, counts, and current status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: connectionId } = await params

    // Get tenant-aware Supabase client
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection
    const connection = await getConnectionById(connectionId)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Connection not found or invalid type' }, { status: 404 })
    }

    // Current product sync: in-memory first, then durable sync_jobs (refresh / multi-instance)
    let currentProductProgress = getProgress(connectionId)
    if (!currentProductProgress) {
      try {
        await reconcileStaleRunningSyncJob(supabase, connectionId)
        const { data: runningJob } = await supabase
          .from('sync_jobs')
          .select('synced_units, total_units, error_units, status')
          .eq('connection_id', connectionId)
          .eq('status', 'running')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (runningJob) {
          currentProductProgress = {
            total: runningJob.total_units ?? 0,
            synced: runningJob.synced_units ?? 0,
            current: (runningJob.synced_units ?? 0) + (runningJob.error_units ?? 0),
            status: 'syncing',
            errors: runningJob.error_units ?? 0,
            startTime: Date.now(),
          }
        }
      } catch (e) {
        console.warn('[sync-status] sync_jobs fallback skipped:', e)
      }
    }

    const currentCategoryProgress = getProgress(`categories-${connectionId}`)

    // Get last sync information from audit logs
    const { data: lastProductSync, error: productSyncError } = await supabase
      .from('sync_audit_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .eq('sync_direction', 'from_shoprenter')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { data: lastProductSyncTo, error: productSyncToError } = await supabase
      .from('sync_audit_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .eq('sync_direction', 'to_shoprenter')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { data: lastCategorySync, error: categorySyncError } = await supabase
      .from('sync_audit_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .eq('sync_type', 'category')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { data: lastSuccessfulProductsFrom } = await supabase
      .from('sync_audit_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .eq('sync_direction', 'from_shoprenter')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: lastFailedProductsFrom } = await supabase
      .from('sync_audit_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .eq('sync_direction', 'from_shoprenter')
      .in('status', ['failed', 'stopped'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Get product counts
    const { count: totalProducts, error: productsCountError } = await supabase
      .from('shoprenter_products')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', connectionId)
      .is('deleted_at', null)

    const { count: syncedProducts, error: syncedProductsError } = await supabase
      .from('shoprenter_products')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', connectionId)
      .eq('sync_status', 'synced')
      .is('deleted_at', null)

    // Get category counts
    const { count: totalCategories, error: categoriesCountError } = await supabase
      .from('shoprenter_categories')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', connectionId)
      .is('deleted_at', null)

    const { count: syncedCategories, error: syncedCategoriesError } = await supabase
      .from('shoprenter_categories')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', connectionId)
      .eq('sync_status', 'synced')
      .is('deleted_at', null)

    // Get tax mapping counts
    const { count: taxMappingsCount, error: taxMappingsError } = await supabase
      .from('shoprenter_tax_class_mappings')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', connectionId)

    const { count: paymentMappingsCount } = await supabase
      .from('connection_payment_method_mappings')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', connectionId)

    const { count: shippingMappingsCount } = await supabase
      .from('connection_shipping_method_mappings')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', connectionId)

    // Calculate sync status (up to date, needs attention, out of sync)
    const getSyncStatus = (lastSyncTime: string | null): 'up_to_date' | 'needs_attention' | 'out_of_sync' => {
      if (!lastSyncTime) return 'out_of_sync'
      
      const lastSync = new Date(lastSyncTime)
      const now = new Date()
      const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)
      
      if (hoursSinceSync < 24) return 'up_to_date'
      if (hoursSinceSync < 48) return 'needs_attention'
      return 'out_of_sync'
    }

    const productSyncStatus = getSyncStatus(lastProductSync?.created_at || null)
    const categorySyncStatus = getSyncStatus(lastCategorySync?.created_at || null)

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        name: connection.name
      },
      currentSync: {
        products: currentProductProgress ? {
          status: currentProductProgress.status,
          synced: currentProductProgress.synced,
          total: currentProductProgress.total,
          errors: currentProductProgress.errors,
          isRunning: currentProductProgress.status === 'syncing' || currentProductProgress.status === 'starting'
        } : null,
        categories: currentCategoryProgress ? {
          status: currentCategoryProgress.status,
          synced: currentCategoryProgress.synced,
          total: currentCategoryProgress.total,
          errors: currentCategoryProgress.errors,
          isRunning: currentCategoryProgress.status === 'syncing' || currentCategoryProgress.status === 'starting'
        } : null
      },
      lastSync: {
        productsFrom: lastProductSync ? {
          date: lastProductSync.created_at,
          type: lastProductSync.sync_type,
          synced: lastProductSync.synced_count || 0,
          total: lastProductSync.total_products || 0,
          skipped: lastProductSync.skipped_count || 0,
          errors: lastProductSync.error_count || 0,
          status: lastProductSync.status,
          duration: lastProductSync.duration_seconds || null,
          user: lastProductSync.user_email || null
        } : null,
        productsTo: lastProductSyncTo ? {
          date: lastProductSyncTo.created_at,
          type: lastProductSyncTo.sync_type,
          synced: lastProductSyncTo.synced_count || 0,
          total: lastProductSyncTo.total_products || 0,
          errors: lastProductSyncTo.error_count || 0,
          status: lastProductSyncTo.status,
          duration: lastProductSyncTo.duration_seconds || null,
          user: lastProductSyncTo.user_email || null
        } : null,
        categories: lastCategorySync ? {
          date: lastCategorySync.created_at,
          synced: lastCategorySync.synced_count || 0,
          total: lastCategorySync.total_products || 0,
          errors: lastCategorySync.error_count || 0,
          status: lastCategorySync.status,
          duration: lastCategorySync.duration_seconds || null,
          user: lastCategorySync.user_email || null
        } : null
      },
      recovery: {
        suggested: Boolean(
          lastFailedProductsFrom &&
          (!lastSuccessfulProductsFrom || new Date(lastFailedProductsFrom.created_at) > new Date(lastSuccessfulProductsFrom.created_at))
        ),
        lastSuccessfulProductsFrom: lastSuccessfulProductsFrom ? {
          date: lastSuccessfulProductsFrom.created_at,
          synced: lastSuccessfulProductsFrom.synced_count || 0,
          total: lastSuccessfulProductsFrom.total_products || 0,
          status: lastSuccessfulProductsFrom.status
        } : null,
        lastFailedProductsFrom: lastFailedProductsFrom ? {
          date: lastFailedProductsFrom.created_at,
          status: lastFailedProductsFrom.status,
          error: lastFailedProductsFrom.error_message || null
        } : null
      },
      counts: {
        products: {
          total: totalProducts || 0,
          synced: syncedProducts || 0,
          status: productSyncStatus
        },
        categories: {
          total: totalCategories || 0,
          synced: syncedCategories || 0,
          status: categorySyncStatus
        },
        taxMappings: taxMappingsCount || 0,
        paymentMappings: paymentMappingsCount || 0,
        shippingMappings: shippingMappingsCount || 0
      }
    })
  } catch (error) {
    console.error('Error getting sync status:', error)
    return NextResponse.json(
      { success: false, error: 'Hiba a szinkronizálási állapot lekérdezésekor' },
      { status: 500 }
    )
  }
}
