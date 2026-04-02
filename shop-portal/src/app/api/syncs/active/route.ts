import { NextRequest, NextResponse } from 'next/server'
import { getProgress } from '@/lib/sync-progress-store'
import { getAllConnections } from '@/lib/connections-server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { reconcileStaleRunningSyncJob, type SyncJobRow } from '@/lib/sync-job-db'

function mapJobStatusToUi(dbStatus: string): string {
  if (dbStatus === 'running') return 'syncing'
  return dbStatus
}

function progressFromSyncJob(job: SyncJobRow): {
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
} {
  const uiStatus = mapJobStatusToUi(job.status)
  const elapsed = Math.floor((Date.now() - new Date(job.started_at).getTime()) / 1000)
  return {
    total: job.total_units,
    synced: job.synced_units,
    current: job.synced_units + job.error_units,
    status: uiStatus,
    errors: job.error_units,
    percentage: job.total_units > 0 ? Math.round((job.synced_units / job.total_units) * 100) : 0,
    elapsed,
    currentBatch: job.current_batch ?? undefined,
    totalBatches: job.total_batches ?? undefined,
    batchProgress: job.batch_progress ?? undefined
  }
}

/**
 * GET /api/syncs/active
 * Get all active syncs across all connections.
 * Uses in-memory progress first; falls back to durable sync_jobs (Vercel multi-instance).
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
      source?: 'memory' | 'database'
    }> = []

    const productSyncFromMemory = new Set<string>()

    // Check each connection for active sync (in-memory — same server instance)
    for (const connection of connections) {
      const progress = getProgress(connection.id)

      if (progress && progress.status === 'syncing') {
        productSyncFromMemory.add(connection.id)
        activeSyncs.push({
          connectionId: connection.id,
          connectionName: connection.name || connection.shop_name || 'Ismeretlen kapcsolat',
          source: 'memory',
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

      const categoryProgress = getProgress(`categories-${connection.id}`)
      if (categoryProgress && (categoryProgress.status === 'syncing' || categoryProgress.status === 'starting' || categoryProgress.status === 'fetching')) {
        activeSyncs.push({
          connectionId: connection.id,
          connectionName: `${connection.name || connection.shop_name || 'Ismeretlen kapcsolat'} (Kategóriák)`,
          source: 'memory',
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

    // Durable fallback: running product sync jobs (other serverless instances / after refresh)
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (!userError && user) {
      const connectionIds = connections.map((c) => c.id)
      if (connectionIds.length > 0) {
        const { data: jobsFirst, error: jobsError } = await supabase
          .from('sync_jobs')
          .select('*')
          .in('connection_id', connectionIds)
          .eq('status', 'running')

        if (!jobsError && jobsFirst?.length) {
          const uniqueCids = [...new Set((jobsFirst as SyncJobRow[]).map((j) => j.connection_id))]
          for (const cid of uniqueCids) {
            await reconcileStaleRunningSyncJob(supabase, cid)
          }

          const { data: runningJobs } = await supabase
            .from('sync_jobs')
            .select('*')
            .in('connection_id', connectionIds)
            .eq('status', 'running')

          if (runningJobs?.length) {
            const latestByConnection = new Map<string, SyncJobRow>()
            for (const row of runningJobs as SyncJobRow[]) {
              const prev = latestByConnection.get(row.connection_id)
              if (!prev || new Date(row.started_at) > new Date(prev.started_at)) {
                latestByConnection.set(row.connection_id, row)
              }
            }

            const connById = new Map(connections.map((c) => [c.id, c]))

            for (const [connectionId, job] of latestByConnection) {
              if (productSyncFromMemory.has(connectionId)) continue
              const connection = connById.get(connectionId)
              if (!connection) continue
              activeSyncs.push({
                connectionId: connection.id,
                connectionName: connection.name || connection.shop_name || 'Ismeretlen kapcsolat',
                source: 'database',
                progress: progressFromSyncJob(job)
              })
            }
          }
        }
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
