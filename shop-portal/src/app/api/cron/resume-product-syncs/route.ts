import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/tenant-supabase'
import {
  createProductSyncContinuationFetcher,
  getTenantSupabaseServiceRole,
  markAutoResumeAttempt,
  shouldAttemptAutoChunkResume,
} from '@/lib/sync-chunk-continuation'

export const maxDuration = 60

/**
 * GET /api/cron/resume-product-syncs
 * Vercel Cron: resume stalled product sync chunks without an open browser tab.
 * Auth: Authorization: Bearer CRON_SECRET (set in Vercel env).
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.SHOPRENTER_SYNC_CHUNK_SECRET) {
    return NextResponse.json({
      success: false,
      error: 'SHOPRENTER_SYNC_CHUNK_SECRET not configured',
    })
  }

  const origin =
    process.env.VERCEL_URL != null
      ? `https://${process.env.VERCEL_URL}`
      : request.nextUrl.origin

  const admin = await getAdminSupabase()
  const { data: tenants, error: tenantsError } = await admin.from('tenants').select('id')

  if (tenantsError) {
    console.error('[CRON] resume-product-syncs tenants:', tenantsError)
    return NextResponse.json({ success: false, error: tenantsError.message }, { status: 500 })
  }

  let resumed = 0
  let scanned = 0

  for (const tenant of tenants ?? []) {
    const tenantId = tenant.id as string
    let supabase
    try {
      supabase = await getTenantSupabaseServiceRole(tenantId)
    } catch (e) {
      console.warn(`[CRON] skip tenant ${tenantId}:`, e)
      continue
    }

    const { data: jobs, error: jobsError } = await supabase
      .from('sync_jobs')
      .select('id, connection_id, synced_units, total_units, updated_at, metadata')
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(20)

    if (jobsError || !jobs?.length) continue

    for (const job of jobs) {
      scanned += 1
      const meta =
        job.metadata && typeof job.metadata === 'object'
          ? (job.metadata as Record<string, unknown>)
          : null
      if (!meta || meta.syncType !== 'product') continue

      if (
        !shouldAttemptAutoChunkResume(
          meta,
          job.updated_at,
          job.synced_units ?? 0,
          job.total_units ?? 0
        )
      ) {
        continue
      }

      await markAutoResumeAttempt(supabase, job.id)
      console.log(
        `[CRON] Resuming product sync job=${job.id} connection=${job.connection_id} tenant=${tenantId}`
      )
      void createProductSyncContinuationFetcher(
        origin,
        job.connection_id as string,
        job.id as string,
        supabase
      )()
      resumed += 1
    }
  }

  return NextResponse.json({ success: true, scanned, resumed, origin })
}
