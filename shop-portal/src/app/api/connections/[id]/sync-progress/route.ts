import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getProgress, clearProgress } from '@/lib/sync-progress-store'
import { reconcileStaleRunningSyncJob } from '@/lib/sync-job-db'
import { tryAutoResumeStalledProductSyncJob } from '@/lib/sync-chunk-continuation'

function mapJobStatusToUi(dbStatus: string): string {
  if (dbStatus === 'running') return 'syncing'
  return dbStatus
}

/** Return recently finished jobs so a fast completion is not lost before the next browser poll. */
const RECENT_FINISHED_JOB_MS = 5 * 60 * 1000

function buildProgressPayloadFromJob(job: {
  total_units: number | null
  synced_units: number | null
  error_units: number | null
  status: string
  started_at: string
  completed_at?: string | null
  current_batch?: number | null
  total_batches?: number | null
  batch_progress?: number | null
}) {
  const uiStatus = mapJobStatusToUi(job.status)
  const endMs = job.completed_at ? new Date(job.completed_at).getTime() : Date.now()
  const elapsed = Math.max(0, Math.floor((endMs - new Date(job.started_at).getTime()) / 1000))
  const total = job.total_units ?? 0
  const synced = job.synced_units ?? 0
  const errors = job.error_units ?? 0

  return {
    total,
    synced,
    current: synced + errors,
    status: uiStatus,
    errors,
    percentage: total > 0 ? Math.round((synced / total) * 100) : 0,
    elapsed,
    currentBatch: job.current_batch ?? undefined,
    totalBatches: job.total_batches ?? undefined,
    batchProgress: job.batch_progress ?? undefined,
  }
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
    const memoryProgress = getProgress(id)

    if (memoryProgress) {
      console.log(`[PROGRESS] Returning in-memory progress for ${id}: synced=${memoryProgress.synced}/${memoryProgress.total}, status=${memoryProgress.status}`)

      return NextResponse.json({
        success: true,
        source: 'memory',
        progress: {
          total: memoryProgress.total,
          synced: memoryProgress.synced,
          current: memoryProgress.current,
          status: memoryProgress.status,
          errors: memoryProgress.errors,
          percentage: memoryProgress.total > 0 ? Math.round((memoryProgress.synced / memoryProgress.total) * 100) : 0,
          elapsed: Math.floor((Date.now() - memoryProgress.startTime) / 1000),
          currentBatch: memoryProgress.currentBatch,
          totalBatches: memoryProgress.totalBatches,
          batchProgress: memoryProgress.batchProgress
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
      const { data: recentJob } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('connection_id', id)
        .in('status', ['completed', 'stopped', 'failed'])
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recentJob?.completed_at) {
        const ageMs = Date.now() - new Date(recentJob.completed_at).getTime()
        if (ageMs >= 0 && ageMs <= RECENT_FINISHED_JOB_MS) {
          const recentProgress = buildProgressPayloadFromJob(recentJob)
          console.log(
            `[PROGRESS] Returning recently finished DB job for ${id}: synced=${recentProgress.synced}/${recentProgress.total}, status=${recentProgress.status}`
          )
          return NextResponse.json({
            success: true,
            source: 'database-recent',
            progress: recentProgress,
          })
        }
      }

      console.log(`[PROGRESS] No progress found for connection ${id} (memory or DB)`)
      return NextResponse.json({
        success: false,
        error: 'Nincs aktív szinkronizálás'
      }, { status: 404 })
    }

    const jobMeta =
      job.metadata && typeof job.metadata === 'object'
        ? (job.metadata as Record<string, unknown>)
        : null
    void tryAutoResumeStalledProductSyncJob(request.nextUrl.origin, id, {
      id: job.id,
      synced_units: job.synced_units ?? 0,
      total_units: job.total_units ?? 0,
      updated_at: job.updated_at,
      metadata: jobMeta,
    }, supabase)

    const jobProgress = buildProgressPayloadFromJob(job)

    console.log(`[PROGRESS] Returning DB progress for ${id}: synced=${jobProgress.synced}/${jobProgress.total}, status=${jobProgress.status}`)

    return NextResponse.json({
      success: true,
      source: 'database',
      progress: jobProgress,
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
