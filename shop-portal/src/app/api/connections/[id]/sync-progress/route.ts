import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getProgress, clearProgress } from '@/lib/sync-progress-store'
import { reconcileStaleRunningSyncJob } from '@/lib/sync-job-db'

function mapJobStatusToUi(dbStatus: string): string {
  if (dbStatus === 'running') return 'syncing'
  return dbStatus
}

/**
 * GET /api/connections/[id]/sync-progress
 * Get current sync progress for a connection (in-memory first, then durable sync_jobs row).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const progress = getProgress(id)

    if (progress) {
      console.log(`[PROGRESS] Returning in-memory progress for ${id}: synced=${progress.synced}/${progress.total}, status=${progress.status}`)

      return NextResponse.json({
        success: true,
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

    // Durable fallback (page refresh / different server instance)
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Nincs bejelentkezve' }, { status: 401 })
    }

    await reconcileStaleRunningSyncJob(supabase, id)

    const { data: job, error: jobError } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('connection_id', id)
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (jobError || !job) {
      console.log(`[PROGRESS] No progress found for connection ${id} (memory or DB)`)
      return NextResponse.json({
        success: false,
        error: 'Nincs aktív szinkronizálás'
      }, { status: 404 })
    }

    const uiStatus = mapJobStatusToUi(job.status)
    const elapsed = Math.floor((Date.now() - new Date(job.started_at).getTime()) / 1000)

    console.log(`[PROGRESS] Returning DB progress for ${id}: synced=${job.synced_units}/${job.total_units}, status=${uiStatus}`)

    return NextResponse.json({
      success: true,
      source: 'database',
      progress: {
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
    })
  } catch (error) {
    console.error('Error getting sync progress:', error)
    return NextResponse.json({
      success: false,
      error: 'Hiba a szinkronizálási állapot lekérdezésekor'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/connections/[id]/sync-progress
 * Clear the sync progress for a connection (dismiss the panel)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    clearProgress(id)
    
    console.log(`[PROGRESS] Cleared progress for connection ${id}`)
    
    return NextResponse.json({
      success: true,
      message: 'Szinkronizálási állapot törölve'
    })
  } catch (error) {
    console.error('Error clearing sync progress:', error)
    return NextResponse.json({
      success: false,
      error: 'Hiba a szinkronizálási állapot törlésekor'
    }, { status: 500 })
  }
}
