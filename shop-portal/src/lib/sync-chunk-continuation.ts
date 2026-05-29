/**
 * Session-independent product sync chunk continuation (Vercel serverless).
 * Uses admin tenant registry + service role — no browser cookies required.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminSupabase, getTenantFromSession } from '@/lib/tenant-supabase'
import type { WebshopConnection } from '@/lib/connections-server'

export const SYNC_JOB_CHUNK_RESUME_STALE_MS = 3 * 60 * 1000

/** Debounce auto-resume / manual retries (ms). */
const CONTINUATION_DEBOUNCE_MS = 60_000

export async function getTenantSupabaseServiceRole(tenantId: string): Promise<SupabaseClient> {
  const adminSupabase = await getAdminSupabase()
  const { data: tenant, error } = await adminSupabase
    .from('tenants')
    .select('supabase_url, supabase_service_role_key')
    .eq('id', tenantId)
    .single()

  if (error || !tenant?.supabase_url || !tenant.supabase_service_role_key) {
    throw new Error(
      `Tenant service role not available for ${tenantId}: ${error?.message || 'missing keys'}`
    )
  }

  const { createClient } = await import('@supabase/supabase-js')
  return createClient(tenant.supabase_url, tenant.supabase_service_role_key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Resolve admin tenant id for a webshop connection (chunk resume without session).
 */
export async function resolveTenantIdForConnection(connectionId: string): Promise<string | null> {
  const metaTenantId = await getTenantIdFromSessionOnly()
  if (metaTenantId) return metaTenantId

  try {
    const admin = await getAdminSupabase()
    const { data: mapping } = await admin
      .from('tenant_connection_mappings')
      .select('tenant_id')
      .eq('connection_id', connectionId)
      .maybeSingle()

    if (mapping?.tenant_id) return mapping.tenant_id as string
  } catch (e) {
    console.warn('[SYNC] resolveTenantIdForConnection admin lookup failed:', e)
  }

  return null
}

async function getTenantIdFromSessionOnly(): Promise<string | null> {
  try {
    const tenant = await getTenantFromSession()
    return tenant?.id ?? null
  } catch {
    return null
  }
}

export function readTenantIdFromJobMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const id = metadata.tenantId
  return typeof id === 'string' && id.length > 0 ? id : null
}

export async function resolveTenantIdForProductSyncJob(
  connectionId: string,
  metadata: Record<string, unknown> | null | undefined
): Promise<string> {
  const fromMeta = readTenantIdFromJobMetadata(metadata)
  if (fromMeta) return fromMeta

  const fromMapping = await resolveTenantIdForConnection(connectionId)
  if (fromMapping) return fromMapping

  throw new Error(
    `Cannot resolve tenant for connection ${connectionId}. Re-start sync from the UI while logged in.`
  )
}

export async function getConnectionByIdWithClient(
  supabase: SupabaseClient,
  id: string
): Promise<WebshopConnection | null> {
  const { data: connection, error } = await supabase
    .from('webshop_connections')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('[SYNC] getConnectionByIdWithClient:', error.message)
    return null
  }
  return connection as WebshopConnection
}

export async function recordSyncJobContinuationAttempt(
  supabase: SupabaseClient,
  jobId: string,
  status: number,
  detail: string
): Promise<void> {
  try {
    const { data: row } = await supabase.from('sync_jobs').select('metadata').eq('id', jobId).maybeSingle()
    const metadata =
      row?.metadata && typeof row.metadata === 'object'
        ? { ...(row.metadata as Record<string, unknown>) }
        : {}
    metadata.lastContinuationAt = new Date().toISOString()
    metadata.lastContinuationStatus = status
    metadata.lastContinuationDetail = detail.slice(0, 500)
    await supabase.from('sync_jobs').update({ metadata }).eq('id', jobId)
  } catch (e) {
    console.warn('[SYNC] recordSyncJobContinuationAttempt failed:', e)
  }
}

/**
 * POST to sync-products resume endpoint (secret auth only — no cookies).
 */
export function createProductSyncContinuationFetcher(
  origin: string,
  connectionId: string,
  jobId: string,
  supabaseForLogging: SupabaseClient
): () => Promise<void> {
  return async () => {
    const sec = process.env.SHOPRENTER_SYNC_CHUNK_SECRET
    if (!sec) {
      console.warn(
        '[SYNC] SHOPRENTER_SYNC_CHUNK_SECRET nincs beállítva — a következő chunk nem indul automatikusan.'
      )
      return
    }

    const url = `${origin}/api/connections/${connectionId}/sync-products`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-chunk-resume': sec,
      },
      body: JSON.stringify({ resumeChunkForJobId: jobId }),
    }).catch((e) => {
      console.error('[SYNC] chunk continuation fetch failed:', e)
      return null
    })

    const status = res?.status ?? 0
    const detail = res
      ? await res.text().catch(() => '')
      : 'fetch failed (network or DNS)'

    await recordSyncJobContinuationAttempt(supabaseForLogging, jobId, status, detail)

    if (res && !res.ok) {
      console.error('[SYNC] chunk continuation HTTP', status, detail.slice(0, 300))
    } else if (res?.ok) {
      console.log(`[SYNC] chunk continuation scheduled OK job=${jobId} connection=${connectionId}`)
    }
  }
}

export function shouldAttemptAutoChunkResume(
  metadata: Record<string, unknown> | null | undefined,
  updatedAt: string,
  syncedUnits: number,
  totalUnits: number
): boolean {
  if (!metadata || metadata.syncType !== 'product') return false

  const checkpoint = metadata.checkpoint as { page?: number } | undefined
  const pageCount = Number(metadata.pageCount ?? 0)
  const nextPage = Number(checkpoint?.page ?? 0)
  if (!pageCount || nextPage >= pageCount) return false
  if (syncedUnits >= totalUnits && totalUnits > 0) return false

  const ageMs = Date.now() - new Date(updatedAt).getTime()
  if (ageMs < SYNC_JOB_CHUNK_RESUME_STALE_MS) return false

  const lastAt = metadata.lastContinuationAt
  if (typeof lastAt === 'string') {
    const sinceLast = Date.now() - new Date(lastAt).getTime()
    if (sinceLast < CONTINUATION_DEBOUNCE_MS) return false
  }

  const lastAuto = metadata.lastAutoResumeAt
  if (typeof lastAuto === 'string') {
    const sinceAuto = Date.now() - new Date(lastAuto).getTime()
    if (sinceAuto < CONTINUATION_DEBOUNCE_MS) return false
  }

  return Boolean(process.env.SHOPRENTER_SYNC_CHUNK_SECRET)
}

export async function markAutoResumeAttempt(
  supabase: SupabaseClient,
  jobId: string
): Promise<void> {
  try {
    const { data: row } = await supabase.from('sync_jobs').select('metadata').eq('id', jobId).maybeSingle()
    const metadata =
      row?.metadata && typeof row.metadata === 'object'
        ? { ...(row.metadata as Record<string, unknown>) }
        : {}
    metadata.lastAutoResumeAt = new Date().toISOString()
    await supabase.from('sync_jobs').update({ metadata }).eq('id', jobId)
  } catch (e) {
    console.warn('[SYNC] markAutoResumeAttempt failed:', e)
  }
}

/**
 * Fire-and-forget: resume a stalled product sync chunk (polling / progress GET).
 */
export async function tryAutoResumeStalledProductSyncJob(
  origin: string,
  connectionId: string,
  job: {
    id: string
    synced_units: number
    total_units: number
    updated_at: string
    metadata: Record<string, unknown> | null
  },
  supabase: SupabaseClient
): Promise<void> {
  const meta =
    job.metadata && typeof job.metadata === 'object' ? job.metadata : ({} as Record<string, unknown>)

  if (!shouldAttemptAutoChunkResume(meta, job.updated_at, job.synced_units, job.total_units)) {
    return
  }

  await markAutoResumeAttempt(supabase, job.id)
  console.log(
    `[SYNC] Auto-resuming stalled product sync job=${job.id} connection=${connectionId} checkpoint page=${(meta.checkpoint as { page?: number })?.page ?? '?'}`
  )
  void createProductSyncContinuationFetcher(origin, connectionId, job.id, supabase)()
}
