import { NextRequest, NextResponse } from 'next/server'
import { getProgress } from '@/lib/sync-progress-store'
import { getAllConnections } from '@/lib/connections-server'

/**
 * GET /api/syncs/active
 * Get all active syncs across all connections
 */
export async function GET(request: NextRequest) {
  try {
    const connections = await getAllConnections()
    const activeSyncs: Array<{
      connectionId: string
      connectionName: string
      progress: {
        total: number
        synced: number
        current: number
        status: string
        errors: number
        percentage: number
        elapsed: number
        currentBatch?: number
        totalBatches?: number
        batchProgress?: number
      }
    }> = []

    // Check each connection for active sync
    for (const connection of connections) {
      // Check product sync
      const progress = getProgress(connection.id)
      
      // Only include actively syncing connections (not completed, stopped, or error)
      if (progress && progress.status === 'syncing') {
        activeSyncs.push({
          connectionId: connection.id,
          connectionName: connection.name || connection.shop_name || 'Ismeretlen kapcsolat',
          progress: {
            total: progress.total,
            synced: progress.synced,
            current: progress.current,
            status: progress.status,
            errors: progress.errors,
            percentage: progress.total > 0 ? Math.round((progress.synced / progress.total) * 100) : 0,
            elapsed: Math.floor((Date.now() - progress.startTime) / 1000),
            currentBatch: progress.currentBatch,
            totalBatches: progress.totalBatches,
            batchProgress: progress.batchProgress
          }
        })
      }
      
      // Check category sync
      const categoryProgress = getProgress(`categories-${connection.id}`)
      if (categoryProgress && (categoryProgress.status === 'syncing' || categoryProgress.status === 'starting' || categoryProgress.status === 'fetching')) {
        activeSyncs.push({
          connectionId: connection.id,
          connectionName: `${connection.name || connection.shop_name || 'Ismeretlen kapcsolat'} (Kategóriák)`,
          progress: {
            total: categoryProgress.total,
            synced: categoryProgress.synced,
            current: categoryProgress.current,
            status: categoryProgress.status,
            errors: categoryProgress.errors,
            percentage: categoryProgress.total > 0 ? Math.round((categoryProgress.synced / categoryProgress.total) * 100) : 0,
            elapsed: Math.floor((Date.now() - categoryProgress.startTime) / 1000),
            currentBatch: categoryProgress.currentBatch,
            totalBatches: categoryProgress.totalBatches,
            batchProgress: categoryProgress.batchProgress
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      activeSyncs,
      count: activeSyncs.length
    })
  } catch (error) {
    console.error('Error getting active syncs:', error)
    return NextResponse.json({
      success: false,
      error: 'Hiba az aktív szinkronizálások lekérdezésekor',
      activeSyncs: [],
      count: 0
    }, { status: 500 })
  }
}
