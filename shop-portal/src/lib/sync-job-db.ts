/**
 * Durable sync job persistence (PostgreSQL).
 * Complements in-memory sync-progress-store for multi-instance / page refresh recovery.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const SYNC_JOB_STALE_MS = 20 * 60 * 1000

export function isSyncJobStale(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return true
  return Date.now() - new Date(updatedAt).getTime() > SYNC_JOB_STALE_MS
}

export interface SyncJobRow {
  id: string
  connection_id: string
  audit_log_id: string | null
  sync_mode: string
  status: string
  total_units: number
  synced_units: number
  error_units: number
  current_batch: number | null
  total_batches: number | null
  batch_progress: number | null
  started_at: string
  updated_at: string
  completed_at: string | null
  error_message: string | null
  metadata: Record<string, unknown> | null
}

const lastFlushByJob = new Map<string, number>()
const FLUSH_INTERVAL_MS = 2000

export function clearSyncJobFlushThrottle(jobId: string) {
  lastFlushByJob.delete(jobId)
}

/**
 * If a running job is stale (no heartbeat), mark as failed and optionally sync audit log.
 */
export async function reconcileStaleRunningSyncJob(
  supabase: SupabaseClient,
  connectionId: string
): Promise<SyncJobRow | null> {
  const { data: jobs, error } = await supabase
    .from('sync_jobs')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)

  if (error || !jobs?.length) {
    return null
  }

  const job = jobs[0] as SyncJobRow

  if (!isSyncJobStale(job.updated_at)) {
    return job
  }

  const completedAt = new Date().toISOString()
  const msg =
    'A szinkron megszakadt (kiszolgáló újraindítás vagy időtúllépés). Indítsa újra a szinkronizálást.'

  await supabase
    .from('sync_jobs')
    .update({
      status: 'failed',
      completed_at: completedAt,
      error_message: msg,
    })
    .eq('id', job.id)

  clearSyncJobFlushThrottle(job.id)

  if (job.audit_log_id) {
    await supabase
      .from('sync_audit_logs')
      .update({
        status: 'failed',
        completed_at: completedAt,
        error_message: msg,
      })
      .eq('id', job.audit_log_id)
  }

  return null
}

export async function maybeFlushSyncJobProgress(
  supabase: SupabaseClient,
  jobId: string,
  getSnapshot: () => {
    synced: number
    total: number
    errors: number
    status: string
    currentBatch?: number
    totalBatches?: number
    batchProgress?: number
  },
  force = false
) {
  const now = Date.now()
  if (!force) {
    const last = lastFlushByJob.get(jobId) || 0
    if (now - last < FLUSH_INTERVAL_MS) return
  }
  lastFlushByJob.set(jobId, now)
  const snap = getSnapshot()
  await supabase
    .from('sync_jobs')
    .update({
      synced_units: snap.synced,
      error_units: snap.errors,
      total_units: snap.total,
      current_batch: snap.currentBatch ?? null,
      total_batches: snap.totalBatches ?? null,
      batch_progress: snap.batchProgress ?? null,
    })
    .eq('id', jobId)
}

export async function finalizeSyncJob(
  supabase: SupabaseClient,
  jobId: string,
  status: 'completed' | 'failed' | 'stopped',
  opts?: {
    synced?: number
    errors?: number
    total?: number
    errorMessage?: string | null
  }
) {
  clearSyncJobFlushThrottle(jobId)
  const completedAt = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status,
    completed_at: completedAt,
  }
  if (opts?.synced !== undefined) patch.synced_units = opts.synced
  if (opts?.errors !== undefined) patch.error_units = opts.errors
  if (opts?.total !== undefined) patch.total_units = opts.total
  if (opts?.errorMessage !== undefined) patch.error_message = opts.errorMessage

  await supabase.from('sync_jobs').update(patch).eq('id', jobId)
}

/**
 * True if the durable job row was marked stopped (e.g. user clicked Stop on another instance).
 * Product sync should poll this so stop works across serverless workers.
 */
export async function isSyncJobStopped(
  supabase: SupabaseClient,
  jobId: string | null | undefined
): Promise<boolean> {
  if (!jobId) return false
  const { data, error } = await supabase
    .from('sync_jobs')
    .select('status')
    .eq('id', jobId)
    .maybeSingle()

  if (error) {
    console.warn('[sync-job-db] isSyncJobStopped:', error.message)
    return false
  }
  return data?.status === 'stopped'
}

export async function stopRunningSyncJobForConnection(
  supabase: SupabaseClient,
  connectionId: string
): Promise<string | null> {
  const { data: jobs } = await supabase
    .from('sync_jobs')
    .select('id')
    .eq('connection_id', connectionId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)

  const id = jobs?.[0]?.id as string | undefined
  if (!id) return null

  await finalizeSyncJob(supabase, id, 'stopped', {
    errorMessage: null,
  })
  return id
}
