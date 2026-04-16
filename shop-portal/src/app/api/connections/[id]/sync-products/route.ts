import { NextRequest, NextResponse, after } from 'next/server'
import { getTenantSupabase, getTenantFromSession } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'
import { Buffer } from 'buffer'
import { updateProgress, clearProgress, shouldStopSync, getProgress, incrementProgress } from '@/lib/sync-progress-store'
import {
  maybeFlushSyncJobProgress,
  finalizeSyncJob,
  reconcileStaleRunningSyncJob,
  isSyncJobStopped,
} from '@/lib/sync-job-db'
import { retryWithBackoff } from '@/lib/retry-with-backoff'
import { batchFetchAttributeDescriptions, batchFetchAttributeWidgetDescriptions } from '@/lib/shoprenter-attribute-sync'
import { extractShopNameFromUrl, extractParentProductId } from '@/lib/shoprenter-product-sync-helpers'
import { syncProductToDatabase, ensureManufacturerExists } from './sync-product-db'
import { syncSingleProductFromShopRenter } from '@/lib/sync-single-shoprenter-product'
import { getShopRenterRateLimiter } from '@/lib/shoprenter-rate-limiter'
import { toShopRenterUpdatedAfterParam } from '@/lib/shoprenter-datetime'

/** Vercel Pro: allow long product sync batches (ShopRenter batch + DB writes). Hobby plan caps lower. */
export const maxDuration = 800

/** Max UUIDs per Supabase `.in('id', …)` — avoids proxy 414 URI Too Long on large syncs. */
const SUPABASE_ID_IN_CHUNK_SIZE = 150

/**
 * Fetch rows from shoprenter_products by ERP UUID list in chunks (avoids 414 on huge `.in()` queries).
 */
async function fetchShoprenterProductsByIdsChunked(
  supabase: any,
  connectionId: string,
  ids: string[]
): Promise<{ data: any[]; error: any }> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) {
    return { data: [], error: null }
  }
  const rows: any[] = []
  for (let i = 0; i < unique.length; i += SUPABASE_ID_IN_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + SUPABASE_ID_IN_CHUNK_SIZE)
    const { data, error } = await supabase
      .from('shoprenter_products')
      .select('id, shoprenter_id, sku, parent_product_id')
      .eq('connection_id', connectionId)
      .in('id', chunk)
      .is('deleted_at', null)
    if (error) {
      return { data: rows, error }
    }
    if (data?.length) {
      rows.push(...data)
    }
  }
  return { data: rows, error: null }
}

function inferAttributeTypeFromHref(
  href: string | undefined,
  attr: any
): 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' {
  if (href) {
    if (href.includes('/listAttributes')) return 'LIST'
    if (href.includes('/textAttributes')) return 'TEXT'
    if (href.includes('/numberAttributes')) return 'INTEGER'
  }
  const t = attr?.type
  if (t === 'LIST' || t === 'INTEGER' || t === 'FLOAT' || t === 'TEXT') return t
  return 'TEXT'
}

function dedupeAttributeRequests(
  arr: Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }>
): Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }> {
  const seen = new Set<string>()
  const out: Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }> = []
  for (const r of arr) {
    const key = `${r.attributeId}\0${r.attributeType}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

/**
 * Serialize async work (e.g. shared attribute-description cache across concurrent batches).
 */
function createSerializedQueue() {
  let chain: Promise<void> = Promise.resolve()
  return async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let result!: T
    const next = chain.then(async () => {
      result = await fn()
    })
    chain = next.then(
      () => {},
      () => {}
    )
    await next
    return result
  }
}

/** Wall-clock budget per serverless invocation chunk (then new POST continues). */
function getProductSyncChunkBudgetMs(): number {
  const raw = Number.parseInt(process.env.SYNC_PRODUCTS_CHUNK_BUDGET_MS || '', 10)
  if (Number.isFinite(raw) && raw >= 45_000 && raw <= 14 * 60_000) {
    return raw
  }
  return 180_000
}

export type ProductExtendChunkContext = {
  startPage: number
  pageCount: number
  totalEstimated: number
  /** Sum of `items.length` for productExtend pages strictly before `startPage` (chunk resume). */
  listedItemsBeforeStartPage?: number
  firstListData: any | null
  preSyncedJobId: string | null
  existingAuditLogId: string | null
  chunkBudgetMs: number
  scheduleContinuation?: () => Promise<void>
}

/**
 * Tight upper bound on how many list rows exist across all pages, using real page sizes seen so far.
 * Once the last page has been fetched, this equals the exact row count for the run.
 */
function upperBoundProductExtendListTotal(
  pageIndex: number,
  pageCount: number,
  pageSize: number,
  listedItemsBeforeThisPage: number,
  thisPageItemCount: number
): number {
  const pagesAfterThis = Math.max(0, pageCount - pageIndex - 1)
  return listedItemsBeforeThisPage + thisPageItemCount + pagesAfterThis * pageSize
}

/**
 * Trusted internal continuation: new HTTP invocation (fresh maxDuration) with forwarded cookies.
 * Set SHOPRENTER_SYNC_CHUNK_SECRET in Vercel env for automatic chaining; otherwise only manual re-POST works.
 */
async function handleTrustedProductSyncChunkResume(
  request: NextRequest,
  supabase: any,
  connectionId: string,
  jobId: string
): Promise<NextResponse> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ success: false, error: 'Nincs bejelentkezve' }, { status: 401 })
  }

  const { data: job, error: jobErr } = await supabase
    .from('sync_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('connection_id', connectionId)
    .maybeSingle()

  if (jobErr || !job || job.status !== 'running') {
    return NextResponse.json(
      { success: false, error: 'Nincs folytatható futó szinkron ehhez a feladathoz.' },
      { status: 404 }
    )
  }

  const meta =
    job.metadata && typeof job.metadata === 'object' ? (job.metadata as Record<string, unknown>) : {}
  if (meta.syncType !== 'product') {
    return NextResponse.json({ success: false, error: 'Érvénytelen feladat típus' }, { status: 400 })
  }

  const pageCount = Math.max(1, Number(meta.pageCount ?? 1))
  const pageSize = Math.max(1, Number(meta.pageSize ?? 200))
  const checkpointMeta = meta.checkpoint as { page?: number; listedItemsSoFar?: number } | undefined
  const startPage = Math.max(0, Number(checkpointMeta?.page ?? 0))
  const storedListed = checkpointMeta?.listedItemsSoFar
  /** Older jobs had no `listedItemsSoFar`; assume prior pages were full so totals stay a safe upper bound. */
  const listedItemsBeforeStartPage =
    typeof storedListed === 'number' && Number.isFinite(storedListed)
      ? Math.max(0, storedListed)
      : Math.max(0, startPage * pageSize)
  const updatedAfter =
    meta.updatedAfter === null || meta.updatedAfter === undefined
      ? null
      : typeof meta.updatedAfter === 'string'
        ? meta.updatedAfter
        : null
  const forceSync = meta.mode === 'full'

  if (startPage >= pageCount) {
    try {
      await finalizeSyncJob(supabase, jobId, 'completed', {
        synced: job.synced_units ?? 0,
        errors: job.error_units ?? 0,
        total: job.total_units ?? 0,
        errorMessage: null,
      })
      if (job.audit_log_id) {
        await supabase
          .from('sync_audit_logs')
          .update({
            synced_count: job.synced_units ?? 0,
            error_count: job.error_units ?? 0,
            completed_at: new Date().toISOString(),
            status: 'completed',
          })
          .eq('id', job.audit_log_id)
      }
    } catch (e) {
      console.warn('[SYNC] resume noop finalize:', e)
    }
    clearProgress(connectionId)
    return NextResponse.json({ success: true, message: 'Szinkron már befejezve.', noop: true })
  }

  const tenant = await getTenantFromSession()
  const tenantId = tenant?.id

  const connection = await getConnectionById(connectionId)
  if (!connection || connection.connection_type !== 'shoprenter') {
    return NextResponse.json({ success: false, error: 'Kapcsolat nem található' }, { status: 404 })
  }
  if (!connection.is_active || !connection.username || !connection.password) {
    return NextResponse.json({ success: false, error: 'Kapcsolat nem használható' }, { status: 400 })
  }

  const credentials = `${connection.username}:${connection.password}`
  const authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`
  let apiUrl = connection.api_url.replace(/\/$/, '')
  if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
    apiUrl = `http://${apiUrl}`
  }

  const rateLimiter = getShopRenterRateLimiter(tenantId)
  const buildListUrl = (page: number) => {
    const params = new URLSearchParams()
    params.set('full', '1')
    params.set('limit', String(pageSize))
    params.set('page', String(page))
    if (updatedAfter) params.set('updatedAfter', updatedAfter)
    return `${apiUrl}/productExtend?${params.toString()}`
  }

  const listRes = await rateLimiter.execute(() =>
    fetch(buildListUrl(startPage), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authHeader,
      },
      signal: AbortSignal.timeout(30000),
    })
  )
  if (!listRes.ok) {
    const t = await listRes.text().catch(() => '')
    return NextResponse.json(
      { success: false, error: `API hiba (oldal ${startPage}): ${listRes.status} ${t.slice(0, 200)}` },
      { status: listRes.status }
    )
  }
  const listText = await listRes.text()
  const firstListData = JSON.parse(listText)

  const origin = request.nextUrl.origin
  const cookieHeader = request.headers.get('cookie') ?? ''
  const chunkBudgetMs = getProductSyncChunkBudgetMs()

  const resumeBatchProgress = (() => {
    try {
      const items = firstListData?.items || firstListData?.response?.items || []
      return Array.isArray(items) ? items.length : 0
    } catch {
      return 0
    }
  })()

  const resumeTotalUpper = upperBoundProductExtendListTotal(
    startPage,
    pageCount,
    pageSize,
    listedItemsBeforeStartPage,
    resumeBatchProgress
  )

  updateProgress(connectionId, {
    total: resumeTotalUpper,
    synced: job.synced_units ?? 0,
    errors: job.error_units ?? 0,
    current: (job.synced_units ?? 0) + (job.error_units ?? 0),
    status: 'syncing',
    shouldStop: false,
    currentBatch: startPage + 1,
    totalBatches: pageCount,
    batchProgress: resumeBatchProgress,
    syncJobId: jobId,
  })

  try {
    await maybeFlushSyncJobProgress(
      supabase,
      jobId,
      () => {
        const p = getProgress(connectionId)
        return {
          synced: p?.synced ?? job.synced_units ?? 0,
          total: p?.total ?? resumeTotalUpper,
          errors: p?.errors ?? job.error_units ?? 0,
          status: p?.status ?? 'syncing',
          currentBatch: p?.currentBatch,
          totalBatches: p?.totalBatches,
          batchProgress: p?.batchProgress,
        }
      },
      true
    )
  } catch (e) {
    console.warn('[SYNC] resume initial sync_jobs flush:', e)
  }

  const scheduleContinuation = async () => {
    const sec = process.env.SHOPRENTER_SYNC_CHUNK_SECRET
    if (!sec) {
      console.warn('[SYNC] SHOPRENTER_SYNC_CHUNK_SECRET nincs beállítva — automatikus chunk-lánc nem indul.')
      return
    }
    const res = await fetch(`${origin}/api/connections/${connectionId}/sync-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        'x-sync-chunk-resume': sec,
      },
      body: JSON.stringify({ resumeChunkForJobId: jobId }),
    }).catch((e) => {
      console.error('[SYNC] chunk continuation fetch failed:', e)
      return null
    })
    if (res && !res.ok) {
      console.error('[SYNC] chunk continuation HTTP', res.status, await res.text().catch(() => ''))
    }
  }

  after(async () => {
    try {
      await processProductExtendPagesInBackground(
        supabase,
        connection,
        connectionId,
        forceSync,
        apiUrl,
        authHeader,
        updatedAfter,
        pageSize,
        {
          startPage,
          pageCount,
          totalEstimated: resumeTotalUpper,
          listedItemsBeforeStartPage,
          firstListData,
          preSyncedJobId: jobId,
          existingAuditLogId: job.audit_log_id ?? null,
          chunkBudgetMs,
          scheduleContinuation,
        },
        tenantId,
        user.id,
        user.email || null
      )
    } catch (error) {
      console.error('[SYNC] after() chunk resume error:', error)
      updateProgress(connectionId, {
        status: 'error',
        errors: getProgress(connectionId)?.errors ?? 0,
      })
      try {
        await finalizeSyncJob(supabase, jobId, 'failed', {
          synced: getProgress(connectionId)?.synced ?? job.synced_units ?? 0,
          errors: getProgress(connectionId)?.errors ?? job.error_units ?? 0,
          total: getProgress(connectionId)?.total ?? job.total_units ?? 0,
          errorMessage: error instanceof Error ? error.message : 'Ismeretlen hiba',
        })
      } catch (e) {
        console.warn('[SYNC] finalize after chunk resume error:', e)
      }
      clearProgress(connectionId)
    }
  })

  return NextResponse.json({
    success: true,
    message: 'Szinkronizálás chunk folytatva',
    resumed: true,
    startPage,
    pageCount,
  })
}

/**
 * POST /api/connections/[id]/sync-products
 * Sync products from ShopRenter to database
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: connectionId } = await params
  try {
    let product_id: string | undefined
    let forceSync = false
    let resumeChunkForJobId: string | undefined
    try {
      const body = await request.json().catch(() => ({}))
      product_id = body?.product_id
      forceSync = body?.force === true
      resumeChunkForJobId =
        typeof body?.resumeChunkForJobId === 'string' ? body.resumeChunkForJobId : undefined
    } catch {
      // Body might be empty, that's OK
      product_id = undefined
    }

    // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
    const supabase = await getTenantSupabase()

    // Get tenant context for tenant-specific rate limiting
    const tenant = await getTenantFromSession()
    const tenantId = tenant?.id

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('[SYNC] Authentication failed:', userError?.message || 'No user found')
      return NextResponse.json({ 
        success: false,
        error: 'Authentication failed. Please log out and log back in, then try again.',
        details: userError?.message || 'Session expired or invalid'
      }, { status: 401 })
    }

    const chunkSecret = process.env.SHOPRENTER_SYNC_CHUNK_SECRET
    const isTrustedChunkResume =
      Boolean(resumeChunkForJobId && chunkSecret && request.headers.get('x-sync-chunk-resume') === chunkSecret)

    if (isTrustedChunkResume) {
      return await handleTrustedProductSyncChunkResume(request, supabase, connectionId, resumeChunkForJobId!)
    }

    // Reconcile stale DB jobs (server restart / timeout), then block concurrent syncs
    const activeDbJob = await reconcileStaleRunningSyncJob(supabase, connectionId)

    const existingProgress = getProgress(connectionId)
    if (existingProgress && (existingProgress.status === 'syncing' || existingProgress.status === 'starting')) {
      console.log(`[SYNC] Sync already running for connection ${connectionId}. Status: ${existingProgress.status}, Progress: ${existingProgress.synced}/${existingProgress.total}`)
      return NextResponse.json({ 
        success: false, 
        error: 'Szinkronizálás már folyamatban van erre a kapcsolatra.',
        details: `Jelenleg ${existingProgress.synced}/${existingProgress.total} termék szinkronizálva. Kérjük, várja meg a befejezését vagy állítsa le az előző szinkronizálást.`,
        existingProgress: {
          synced: existingProgress.synced,
          total: existingProgress.total,
          status: existingProgress.status
        }
      }, { status: 409 })
    }

    if (activeDbJob) {
      console.log(`[SYNC] Sync already running (DB) for connection ${connectionId}: job ${activeDbJob.id}`)
      return NextResponse.json({
        success: false,
        error: 'Szinkronizálás már folyamatban van erre a kapcsolatra.',
        details: `Jelenleg ${activeDbJob.synced_units}/${activeDbJob.total_units} termék szinkronizálva. Kérjük, várja meg a befejezését vagy állítsa le az előző szinkronizálást.`,
        existingProgress: {
          synced: activeDbJob.synced_units,
          total: activeDbJob.total_units,
          status: 'syncing',
        },
      }, { status: 409 })
    }

    // Get connection
    const connection = await getConnectionById(connectionId)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ 
        success: false,
        error: 'Kapcsolat nem található vagy érvénytelen típus',
        details: 'Csak ShopRenter kapcsolatokhoz szinkronizálható termékek.'
      }, { status: 404 })
    }

    // Validate connection is active
    if (!connection.is_active) {
      return NextResponse.json({ 
        success: false,
        error: 'A kapcsolat inaktív',
        details: 'Kérjük, aktiválja a kapcsolatot a szinkronizálás előtt a kapcsolat szerkesztése menüpontban.'
      }, { status: 400 })
    }

    // Validate connection has required credentials
    if (!connection.username || !connection.password) {
      return NextResponse.json({ 
        success: false,
        error: 'Hiányzó hitelesítési adatok',
        details: 'Kérjük, ellenőrizze, hogy a kapcsolat rendelkezik-e felhasználónévvel és jelszóval. Frissítse a kapcsolat beállításait.'
      }, { status: 400 })
    }

    // Extract shop name
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ 
        success: false,
        error: 'Érvénytelen API URL formátum',
        details: 'Az API URL formátuma nem megfelelő. Kérjük, ellenőrizze a kapcsolat beállításait. Várt formátum: https://shopname.api.myshoprenter.hu'
      }, { status: 400 })
    }

    // Use Basic Auth for old API
    const credentials = `${connection.username}:${connection.password}`
    const base64Credentials = Buffer.from(credentials).toString('base64')
    const authHeader = `Basic ${base64Credentials}`

    let apiUrl = connection.api_url.replace(/\/$/, '')
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `http://${apiUrl}`
    }

    // Handle single product sync (no batch needed)
    if (product_id) {
      const single = await syncSingleProductFromShopRenter({
        supabase,
        connection,
        shoprenterProductId: product_id,
        forceSync,
        tenantId,
        apiUrl,
        authHeader,
      })
      if (single.ok === false) {
        return NextResponse.json(
          { success: false, error: single.error },
          { status: single.status ?? 500 }
        )
      }
      return NextResponse.json({ success: true, synced: 1 })
    }

    // For bulk sync, check if user wants incremental sync (default) or force sync
    // If forceSync is not explicitly set to true, use incremental sync
    const useIncrementalSync = !forceSync

    // Page-based product sync: use ProductExtend collection (supports updatedAfter/updatedBefore with datetime)
    // This avoids needing a separate product list scan + per-id GETs, and maps cleanly to "page X / pageCount" progress.
    const PAGE_SIZE = 200
    const rateLimiter = getShopRenterRateLimiter(tenantId)

    let updatedAfter: string | null = null
    if (useIncrementalSync) {
      let updatedAfterRaw: string | null = null
      const { data: lastCompletedJob } = await supabase
        .from('sync_jobs')
        .select('completed_at')
        .eq('connection_id', connectionId)
        .eq('sync_direction', 'from_shoprenter')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      updatedAfterRaw = lastCompletedJob?.completed_at ?? null

      if (!updatedAfterRaw) {
        const { data: lastAudit } = await supabase
          .from('sync_audit_logs')
          .select('completed_at')
          .eq('connection_id', connectionId)
          .eq('sync_direction', 'from_shoprenter')
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        updatedAfterRaw = lastAudit?.completed_at ?? null
      }

      updatedAfter = updatedAfterRaw ? toShopRenterUpdatedAfterParam(updatedAfterRaw) : null
      if (updatedAfterRaw && !updatedAfter) {
        console.warn('[SYNC] Unparseable completed_at for incremental sync:', updatedAfterRaw)
        return NextResponse.json(
          {
            success: false,
            error:
              'Az utolsó sikeres szinkron időpontja érvénytelen formátumú. Próbáljon teljes termék szinkront, vagy ellenőrizze az előzményeket.',
          },
          { status: 400 }
        )
      }
      console.log(
        `[SYNC] Incremental sync via productExtend.updatedAfter: ${updatedAfter ?? '(none)'} (raw: ${updatedAfterRaw ?? 'n/a'})`
      )
    } else {
      console.log(`[SYNC] Full sync via productExtend pages`)
    }

    const buildProductExtendListUrl = (page: number) => {
      const params = new URLSearchParams()
      params.set('full', '1')
      params.set('limit', String(PAGE_SIZE))
      params.set('page', String(page))
      if (updatedAfter) params.set('updatedAfter', updatedAfter)
      return `${apiUrl}/productExtend?${params.toString()}`
    }

    // Fetch first page to get pageCount and initial items count (fast fail if API misconfigured)
    const firstListUrl = buildProductExtendListUrl(0)
    const firstPageResponse = await rateLimiter.execute(() =>
      fetch(firstListUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authHeader,
        },
        signal: AbortSignal.timeout(30000),
      })
    )

    if (!firstPageResponse.ok) {
      const errorText = await firstPageResponse.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { success: false, error: `API error fetching productExtend page 0: ${firstPageResponse.status} - ${errorText.substring(0, 200)}` },
        { status: firstPageResponse.status }
      )
    }

    const firstContentType = firstPageResponse.headers.get('content-type') || ''
    if (!firstContentType.includes('application/json')) {
      const t = await firstPageResponse.text().catch(() => '')
      return NextResponse.json(
        { success: false, error: `Nem JSON válasz érkezett a productExtend listából. Content-Type: ${firstContentType}. ${t.substring(0, 80)}` },
        { status: 500 }
      )
    }

    const firstText = await firstPageResponse.text()
    if (!firstText || firstText.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Üres válasz érkezett a productExtend listából.' }, { status: 500 })
    }
    const firstData = JSON.parse(firstText)
    const firstItems: any[] = firstData?.items || firstData?.response?.items || []
    const pageCountRaw = firstData?.pageCount ?? firstData?.response?.pageCount ?? 0
    const pageCount = typeof pageCountRaw === 'string' ? parseInt(pageCountRaw, 10) : pageCountRaw
    const effectivePageCount = Math.max(1, pageCount || 1)
    /** Best initial upper bound without fetching later pages (exact when there is only one page). */
    const totalEstimated =
      pageCount && pageCount > 0
        ? firstItems.length + Math.max(0, effectivePageCount - 1) * PAGE_SIZE
        : firstItems.length

    // If no items on first page, incremental is "up to date"; full sync is "no products"
    if (!firstItems || firstItems.length === 0) {
      clearProgress(connectionId)
      if (useIncrementalSync) {
        return NextResponse.json(
          { success: true, message: 'Nincs szinkronizálandó termék. Minden termék naprakész.', total: 0, synced: 0 },
          { status: 200 }
        )
      }
      return NextResponse.json(
        { success: false, error: 'Nem található termék a webshopban (productExtend üres).' },
        { status: 404 }
      )
    }

    // Initialize progress tracking BEFORE starting background process (page-based)
    updateProgress(connectionId, {
      total: totalEstimated,
      synced: 0,
      current: 0,
      status: 'syncing',
      errors: 0,
      shouldStop: false,
      currentBatch: 1,
      totalBatches: effectivePageCount,
      batchProgress: firstItems.length,
    })

    /**
     * Create sync_jobs BEFORE returning the HTTP response so GET /sync-progress on any
     * Vercel instance sees a running job immediately (fixes frozen 0/total on prod).
     */
    let preSyncedJobId: string | null = null
    if (user.id) {
      try {
        const { data: sj, error: sjErr } = await supabase
          .from('sync_jobs')
          .insert({
            connection_id: connectionId,
            audit_log_id: null,
            user_id: user.id,
            sync_mode: forceSync ? 'full' : 'incremental',
            sync_direction: 'from_shoprenter',
            status: 'running',
            total_units: totalEstimated,
            synced_units: 0,
            error_units: 0,
            total_batches: effectivePageCount,
            metadata: {
              syncType: 'product',
              pageSize: PAGE_SIZE,
              pageCount: effectivePageCount,
              updatedAfter,
              mode: forceSync ? 'full' : 'incremental',
              // Checkpoint (page-based)
              checkpoint: {
                page: 0,
                updatedAfter,
                listedItemsSoFar: 0,
              },
            },
          })
          .select('id')
          .single()
        if (!sjErr && sj?.id) {
          preSyncedJobId = sj.id
          updateProgress(connectionId, { syncJobId: preSyncedJobId })
          await maybeFlushSyncJobProgress(
            supabase,
            preSyncedJobId,
            () => {
              const p = getProgress(connectionId)
              return {
                synced: p?.synced ?? 0,
                total: p?.total ?? totalEstimated,
                errors: p?.errors ?? 0,
                status: p?.status ?? 'syncing',
                currentBatch: p?.currentBatch,
                totalBatches: p?.totalBatches,
                batchProgress: p?.batchProgress,
              }
            },
            true
          )
          console.log(`[SYNC] Early sync_jobs row for polling (Vercel): ${preSyncedJobId}`)
        } else {
          console.warn('[SYNC] Early sync_jobs insert failed (non-fatal):', sjErr)
        }
      } catch (earlyErr) {
        console.warn('[SYNC] Early sync_jobs insert error (non-fatal):', earlyErr)
      }
    }

    const origin = request.nextUrl.origin
    const cookieHeader = request.headers.get('cookie') ?? ''
    const chunkBudgetMs = getProductSyncChunkBudgetMs()

    const scheduleContinuation = async () => {
      const sec = process.env.SHOPRENTER_SYNC_CHUNK_SECRET
      if (!sec || !preSyncedJobId) {
        if (!sec) {
          console.warn(
            '[SYNC] SHOPRENTER_SYNC_CHUNK_SECRET nincs beállítva — a következő chunk nem indul automatikusan. Állítsa be a Vercel env-ben, vagy indítsa újra a szinkront.'
          )
        }
        return
      }
      const res = await fetch(`${origin}/api/connections/${connectionId}/sync-products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader,
          'x-sync-chunk-resume': sec,
        },
        body: JSON.stringify({ resumeChunkForJobId: preSyncedJobId }),
      }).catch((e) => {
        console.error('[SYNC] chunk continuation fetch failed:', e)
        return null
      })
      if (res && !res.ok) {
        console.error('[SYNC] chunk continuation HTTP', res.status, await res.text().catch(() => ''))
      }
    }

    // Run heavy work after response; Next/Vercel waitUntil keeps invocation alive until done (maxDuration)
    after(async () => {
      try {
        await processProductExtendPagesInBackground(
          supabase,
          connection,
          connectionId,
          forceSync,
          apiUrl,
          authHeader,
          updatedAfter,
          PAGE_SIZE,
          {
            startPage: 0,
            pageCount: effectivePageCount,
            totalEstimated,
            listedItemsBeforeStartPage: 0,
            firstListData: firstData,
            preSyncedJobId,
            existingAuditLogId: null,
            chunkBudgetMs,
            scheduleContinuation,
          },
          tenantId,
          user.id,
          user.email || null
        )
      } catch (error) {
        console.error('[SYNC] after() sync error:', error)
        updateProgress(connectionId, {
          status: 'error',
          errors: getProgress(connectionId)?.errors ?? 0,
        })
        if (preSyncedJobId) {
          try {
            await finalizeSyncJob(supabase, preSyncedJobId, 'failed', {
              synced: getProgress(connectionId)?.synced ?? 0,
              errors: getProgress(connectionId)?.errors ?? 0,
              total: getProgress(connectionId)?.total ?? totalEstimated,
              errorMessage: error instanceof Error ? error.message : 'Ismeretlen hiba',
            })
          } catch (e) {
            console.warn('[SYNC] finalizeSyncJob after error:', e)
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Szinkronizálás elindítva',
      total: totalEstimated,
    })
  } catch (error) {
    console.error('Error syncing products:', error)
    
    // Handle specific error types
    let errorMessage = 'Unknown error'
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      errorMessage = 'JSON parse hiba: ' + error.message
    } else if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage = 'Hálózati hiba: ' + error.message
    } else if (error instanceof Error) {
      errorMessage = error.message
    }
    
    clearProgress(connectionId)
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 })
  }
}

/**
 * Page-based product sync using `GET /productExtend?full=1&limit=200&page=N` (and optional `updatedAfter`).
 * Chunks by wall-clock budget (`SYNC_PRODUCTS_CHUNK_BUDGET_MS`) and continues via trusted POST + fresh invocation.
 */
async function processProductExtendPagesInBackground(
  supabase: any,
  connection: any,
  connectionId: string,
  forceSync: boolean,
  apiUrl: string,
  authHeader: string,
  updatedAfter: string | null,
  pageSize: number,
  chunk: ProductExtendChunkContext,
  tenantId?: string,
  userId?: string,
  userEmail?: string | null
) {
  const {
    startPage,
    pageCount,
    totalEstimated,
    firstListData,
    preSyncedJobId,
    existingAuditLogId,
    chunkBudgetMs,
    scheduleContinuation,
  } = chunk
  let listedItemsBeforeCurrentPage = chunk.listedItemsBeforeStartPage ?? 0

  const rateLimiter = getShopRenterRateLimiter(tenantId)
  const PRODUCT_CONCURRENCY = Math.max(
    1,
    Math.min(
      12,
      Number.parseInt(process.env.SHOPRENTER_SYNC_PRODUCT_CONCURRENCY || '6', 10) || 6
    )
  )

  const extractItems = (data: any): any[] => {
    if (!data) return []
    if (Array.isArray(data.items)) return data.items
    if (Array.isArray(data.response?.items)) return data.response.items
    return []
  }

  const buildListUrl = (page: number) => {
    const params = new URLSearchParams()
    params.set('full', '1')
    params.set('limit', String(pageSize))
    params.set('page', String(page))
    if (updatedAfter) params.set('updatedAfter', updatedAfter)
    return `${apiUrl}/productExtend?${params.toString()}`
  }

  let syncedCount = 0
  let errorCount = 0

  let auditLogId: string | null = existingAuditLogId || null
  if (!auditLogId) {
    const syncStartTime = new Date()
    try {
      if (tenantId && userId) {
        const syncType = forceSync ? 'full' : 'incremental'
        const { data: auditLog, error: auditError } = await supabase
          .from('sync_audit_logs')
          .insert({
            connection_id: connectionId,
            sync_type: syncType,
            sync_direction: 'from_shoprenter',
            user_id: userId,
            user_email: userEmail,
            total_products: totalEstimated,
            synced_count: 0,
            error_count: 0,
            skipped_count: 0,
            started_at: syncStartTime.toISOString(),
            status: 'running',
            metadata: {
              pageSize: pageSize,
              pageCount,
              updatedAfter,
            },
          })
          .select('id')
          .single()
        if (!auditError && auditLog?.id) auditLogId = auditLog.id
      }
    } catch (e) {
      console.warn('[SYNC] audit log init error (non-fatal):', e)
    }
  }

  if (preSyncedJobId && auditLogId) {
    try {
      await supabase.from('sync_jobs').update({ audit_log_id: auditLogId }).eq('id', preSyncedJobId)
    } catch (e) {
      console.warn('[SYNC] Failed to link audit_log to sync_jobs:', e)
    }
  }

  const flush = async (force = false) => {
    if (!preSyncedJobId) return
    await maybeFlushSyncJobProgress(
      supabase,
      preSyncedJobId,
      () => {
        const p = getProgress(connectionId)
        return {
          synced: p?.synced ?? 0,
          total: p?.total ?? totalEstimated,
          errors: p?.errors ?? 0,
          status: p?.status ?? 'syncing',
          currentBatch: p?.currentBatch,
          totalBatches: p?.totalBatches,
          batchProgress: p?.batchProgress,
        }
      },
      force
    )
  }

  const flushExclusive = createSerializedQueue()
  let lastFlushMs = 0
  const flushThrottled = async (force = false) => {
    const now = Date.now()
    if (!force && now - lastFlushMs < 1500) return
    lastFlushMs = now
    await flushExclusive(() => flush(force))
  }

  const checkStop = async (): Promise<boolean> => {
    if (shouldStopSync(connectionId)) return true
    if (preSyncedJobId) {
      const stopped = await isSyncJobStopped(supabase, preSyncedJobId)
      if (stopped) updateProgress(connectionId, { shouldStop: true, status: 'stopped' })
      return stopped
    }
    return false
  }

  /** `nextPageIndex` = next productExtend page to fetch; `listedItemsSoFar` = sum of list row counts for pages 0..previous inclusive. */
  const updateCheckpoint = async (nextPageIndex: number, listedItemsSoFar: number) => {
    if (!preSyncedJobId) return
    try {
      const { data: row } = await supabase.from('sync_jobs').select('metadata').eq('id', preSyncedJobId).maybeSingle()
      const metadata = row?.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {}
      metadata.checkpoint = { page: nextPageIndex, updatedAfter, listedItemsSoFar }
      await supabase.from('sync_jobs').update({ metadata }).eq('id', preSyncedJobId)
    } catch (e) {
      console.warn('[SYNC] Failed to update sync_jobs checkpoint metadata (non-fatal):', e)
    }
  }

  const SYNC_HEARTBEAT_MS = 60_000
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  if (preSyncedJobId) {
    heartbeatTimer = setInterval(() => {
      void flushExclusive(() => flush(true))
    }, SYNC_HEARTBEAT_MS)
  }

  const chunkStartedAt = Date.now()

  try {
    for (let page = startPage; page < pageCount; page++) {
      if (await checkStop()) break

      const listData =
        page === startPage && firstListData != null
          ? firstListData
          : await (async () => {
              const url = buildListUrl(page)
              const res = await rateLimiter.execute(() =>
                fetch(url, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: authHeader,
                  },
                  signal: AbortSignal.timeout(30000),
                })
              )
              if (!res.ok) {
                const t = await res.text().catch(() => 'Unknown error')
                throw new Error(`productExtend page ${page} failed: ${res.status} ${t.substring(0, 200)}`)
              }
              const ct = res.headers.get('content-type') || ''
              if (!ct.includes('application/json')) {
                const t = await res.text().catch(() => '')
                throw new Error(`productExtend page ${page} non-JSON response: ${ct} ${t.substring(0, 80)}`)
              }
              const text = await res.text()
              return JSON.parse(text)
            })()

      const items = extractItems(listData)

      const listTotalUpper = upperBoundProductExtendListTotal(
        page,
        pageCount,
        pageSize,
        listedItemsBeforeCurrentPage,
        items.length
      )
      updateProgress(connectionId, {
        total: listTotalUpper,
        currentBatch: page + 1,
        totalBatches: pageCount,
        batchProgress: items.length,
      })
      // Force flush so GET /sync-progress (DB) shows refined totals within seconds, not only on heartbeat.
      await flushThrottled(true)

      if (auditLogId && page === pageCount - 1) {
        const exactListRows = listedItemsBeforeCurrentPage + items.length
        try {
          await supabase.from('sync_audit_logs').update({ total_products: exactListRows }).eq('id', auditLogId)
        } catch (e) {
          console.warn('[SYNC] audit log total_products exact update (non-fatal):', e)
        }
      }

      let attributeDescriptionsMap:
        | Map<string, { display_name: string | null; prefix: string | null; postfix: string | null }>
        | undefined
      try {
        const attributeRequests: Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }> =
          []
        for (const product of items) {
          if (product?.productAttributeExtend && Array.isArray(product.productAttributeExtend)) {
            for (const attr of product.productAttributeExtend) {
              let attributeId = attr?.id || null
              if (!attributeId && attr?.href) {
                const hrefParts = String(attr.href).split('/')
                attributeId = hrefParts[hrefParts.length - 1] || null
              }
              if (attributeId) {
                attributeRequests.push({
                  attributeId,
                  attributeType: inferAttributeTypeFromHref(attr?.href, attr),
                })
              }
            }
          }
        }
        const deduped = dedupeAttributeRequests(attributeRequests)
        if (deduped.length > 0) {
          attributeDescriptionsMap = await batchFetchAttributeDescriptions(apiUrl, authHeader, deduped, { tenantId })
        }
      } catch (e) {
        console.warn('[SYNC] attribute prefetch error (non-fatal):', e)
      }

      let nextIdx = 0
      const worker = async () => {
        while (true) {
          if (await checkStop()) return
          const idx = nextIdx++
          if (idx >= items.length) return
          const product = items[idx]
          try {
            await syncProductToDatabase(
              supabase,
              connection,
              product,
              forceSync,
              apiUrl,
              authHeader,
              attributeDescriptionsMap,
              tenantId,
              undefined
            )
            syncedCount += 1
            incrementProgress(connectionId, { synced: 1 })
          } catch (e: any) {
            errorCount += 1
            incrementProgress(connectionId, { errors: 1 })
            console.warn('[SYNC] product sync error (non-fatal):', e?.message || e)
          } finally {
            await flushThrottled(false)
          }
        }
      }

      const workers = Array.from({ length: Math.min(PRODUCT_CONCURRENCY, items.length) }, () => worker())
      await Promise.all(workers)

      const nextPage = page + 1
      listedItemsBeforeCurrentPage += items.length
      await updateCheckpoint(nextPage, listedItemsBeforeCurrentPage)
      await flushThrottled(false)

      if (await checkStop()) {
        break
      }

      const elapsed = Date.now() - chunkStartedAt
      if (elapsed >= chunkBudgetMs && nextPage < pageCount) {
        console.log(
          `[SYNC] Chunk budget (${chunkBudgetMs}ms) elérve oldal ${page} után — következő chunk (oldal ${nextPage}/${pageCount})`
        )
        await flushThrottled(true)
        await scheduleContinuation?.()
        return
      }
    }

    updateProgress(connectionId, {
      status: getProgress(connectionId)?.shouldStop ? 'stopped' : 'completed',
    })
    await flushThrottled(true)

    if (preSyncedJobId) {
      await finalizeSyncJob(supabase, preSyncedJobId, getProgress(connectionId)?.shouldStop ? 'stopped' : 'completed', {
        synced: getProgress(connectionId)?.synced ?? syncedCount,
        errors: getProgress(connectionId)?.errors ?? errorCount,
        total: getProgress(connectionId)?.total ?? totalEstimated,
      })
    }

    if (auditLogId) {
      try {
        await supabase
          .from('sync_audit_logs')
          .update({
            synced_count: getProgress(connectionId)?.synced ?? syncedCount,
            error_count: getProgress(connectionId)?.errors ?? errorCount,
            completed_at: new Date().toISOString(),
            status: getProgress(connectionId)?.shouldStop ? 'stopped' : 'completed',
          })
          .eq('id', auditLogId)
      } catch (e) {
        console.warn('[SYNC] audit log finalize error (non-fatal):', e)
      }
    }

    clearProgress(connectionId)
  } catch (e) {
    console.error('[SYNC] page-based sync fatal error:', e)
    updateProgress(connectionId, { status: 'error' })
    await flush(true)
    if (preSyncedJobId) {
      try {
        await finalizeSyncJob(supabase, preSyncedJobId, 'failed', {
          synced: getProgress(connectionId)?.synced ?? syncedCount,
          errors: getProgress(connectionId)?.errors ?? errorCount,
          total: getProgress(connectionId)?.total ?? totalEstimated,
          errorMessage: e instanceof Error ? e.message : 'Ismeretlen hiba',
        })
      } catch (finalizeError) {
        console.warn('[SYNC] finalizeSyncJob after fatal error:', finalizeError)
      }
    }
    clearProgress(connectionId)
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }
}

/**
 * Heavy product sync — scheduled via `after()` so the HTTP response returns immediately while
 * Vercel keeps the invocation alive; `preSyncedJobId` is created in POST for cross-instance polling.
 */
async function processSyncInBackground(
  supabase: any,
  connection: any,
  allProductIds: string[],
  batches: string[][],
  connectionId: string,
  forceSync: boolean,
  apiUrl: string,
  authHeader: string,
  request: NextRequest,
  tenantId?: string,
  userId?: string,
  userEmail?: string | null,
  incrementalStats?: { newProducts: number; changedProducts: number; skippedProducts: number; deletedProducts: number },
  preSyncedJobId?: string | null
) {
  // Initialize variables at function scope so they're accessible in catch block
  let syncedCount = 0
  let errorCount = 0
  const errors: string[] = []
  const totalProducts = allProductIds.length
  const totalBatches = batches.length
  const syncStartTime = new Date()
  // Track synced product IDs for post-sync optimization
  const syncedProductIds: string[] = [] // Store ERP UUIDs of synced products

  // For incremental sync, total_products should be total evaluated (synced + skipped)
  // For force sync, total_products is just the products to sync
  const totalProductsEvaluated = incrementalStats 
    ? totalProducts + (incrementalStats.skippedProducts || 0)
    : totalProducts

  // Create sync audit log entry
  let auditLogId: string | null = null
  let syncJobId: string | null = preSyncedJobId ?? null
  try {
      if (tenantId && userId) {
        const syncType = forceSync ? 'full' : 'incremental'
        const { data: auditLog, error: auditError } = await supabase
          .from('sync_audit_logs')
          .insert({
            connection_id: connectionId,
            sync_type: syncType,
            sync_direction: 'from_shoprenter',
            user_id: userId,
            user_email: userEmail,
            total_products: totalProductsEvaluated, // Total products evaluated (synced + skipped for incremental)
            synced_count: 0,
            error_count: 0,
            skipped_count: incrementalStats?.skippedProducts || 0,
            started_at: syncStartTime.toISOString(),
            status: 'running',
            metadata: {
              forceSync: forceSync,
              batchSize: 200,
              totalBatches: totalBatches,
              incrementalStats: incrementalStats || null
            }
          })
          .select('id')
          .single()
      
      if (!auditError && auditLog) {
        auditLogId = auditLog.id
        console.log(`[SYNC] Created audit log entry: ${auditLogId}`)
      } else {
        console.warn(`[SYNC] Failed to create audit log:`, auditError)
      }
    }
  } catch (auditInitError) {
    console.warn(`[SYNC] Error creating audit log (non-fatal):`, auditInitError)
  }

  if (syncJobId && auditLogId) {
    try {
      await supabase.from('sync_jobs').update({ audit_log_id: auditLogId }).eq('id', syncJobId)
    } catch (e) {
      console.warn('[SYNC] Failed to link audit_log to sync_jobs:', e)
    }
  }

  // Durable progress: row may already exist from POST (preSyncedJobId). Otherwise insert here.
  if (userId && !syncJobId) {
    try {
      const { data: sj, error: sjErr } = await supabase
        .from('sync_jobs')
        .insert({
          connection_id: connectionId,
          audit_log_id: auditLogId,
          user_id: userId,
          sync_mode: forceSync ? 'full' : 'incremental',
          sync_direction: 'from_shoprenter',
          status: 'running',
          total_units: totalProducts,
          synced_units: 0,
          error_units: 0,
          total_batches: totalBatches,
          metadata: {
            syncType: 'product',
            totalProductsEvaluated,
            incrementalStats: incrementalStats || null,
          },
        })
        .select('id')
        .single()
      if (!sjErr && sj?.id) {
        syncJobId = sj.id
        updateProgress(connectionId, { syncJobId })
        console.log(`[SYNC] Created sync_jobs row: ${syncJobId}`)
      } else {
        console.warn('[SYNC] sync_jobs insert failed (non-fatal):', sjErr)
      }
    } catch (syncJobErr) {
      console.warn('[SYNC] sync_jobs insert error (non-fatal):', syncJobErr)
    }
  } else if (syncJobId) {
    updateProgress(connectionId, { syncJobId })
    console.log(`[SYNC] Using pre-created sync_jobs row: ${syncJobId}`)
  }

  /** Cross-batch cache + serial queue so parallel batches don't duplicate attributeDescription API work */
  const attributeDescriptionCache = new Map<
    string,
    { display_name: string | null; prefix: string | null; postfix: string | null }
  >()
  const runExclusive = createSerializedQueue()

  const flushProgress = async (force = false) => {
    if (!syncJobId) return
    await maybeFlushSyncJobProgress(
      supabase,
      syncJobId,
      () => {
        const p = getProgress(connectionId)
        return {
          synced: p?.synced ?? 0,
          total: p?.total ?? 0,
          errors: p?.errors ?? 0,
          status: p?.status ?? 'syncing',
          currentBatch: p?.currentBatch,
          totalBatches: p?.totalBatches,
          batchProgress: p?.batchProgress,
        }
      },
      force
    )
  }

  const bumpSynced = (n: number) => {
    incrementProgress(connectionId, { synced: n })
    void flushProgress()
  }
  const bumpErrors = (n: number) => {
    incrementProgress(connectionId, { errors: n })
    void flushProgress()
  }
  const trackProgress = (updates: Parameters<typeof updateProgress>[1]) => {
    updateProgress(connectionId, updates)
    void flushProgress(false)
  }

  /** Memory flag (same instance) + durable sync_jobs row (any instance / Stop button). */
  const checkShouldStopSync = async (): Promise<boolean> => {
    if (shouldStopSync(connectionId)) return true
    if (syncJobId) {
      const stopped = await isSyncJobStopped(supabase, syncJobId)
      if (stopped) {
        updateProgress(connectionId, { shouldStop: true, status: 'stopped' })
      }
      return stopped
    }
    return false
  }

  try {
    // Ensure progress is initialized at the start of background process
    // This is a safety check in case the main handler didn't set it
    // Clear any previous stop flag when starting a new sync
    trackProgress({
      total: allProductIds.length,
      synced: 0,
      current: 0,
      status: 'syncing',
      errors: 0,
      shouldStop: false, // Clear any previous stop flag
      ...(syncJobId ? { syncJobId } : {}),
    })
    void flushProgress(true)

    console.log(`[SYNC] Background process started for ${allProductIds.length} products in ${batches.length} batches`)
    console.log(`[SYNC] Using optimized parallel batch processing (2 concurrent batches)`)

    // Process batches in parallel groups (2-3 at a time) for better performance
    const CONCURRENT_BATCHES = 2 // Process 2 batches in parallel
    const processSingleBatch = async (batch: string[], batchIndex: number) => {
      const batchResults = {
        synced: 0,
        errors: 0,
        errorMessages: [] as string[]
      }
        
      // Check if sync should stop (memory + DB for multi-instance)
      if (await checkShouldStopSync()) {
        return batchResults
      }

      try {
        // Build batch request
        const batchRequests = batch.map(productId => ({
          method: 'GET',
          uri: `${apiUrl}/productExtend/${productId}?full=1`
        }))

        const batchPayload = {
          data: {
            requests: batchRequests
          }
        }

        // Send batch request
        const batchResponse = await retryWithBackoff(
          () => fetch(`${apiUrl}/batch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify(batchPayload),
            signal: AbortSignal.timeout(600000) // 10 minutes
          }),
          {
            maxRetries: 3,
            initialDelayMs: 1500,
            maxDelayMs: 20000,
          }
        )

        if (!batchResponse.ok) {
          const errorText = await batchResponse.text().catch(() => 'Unknown error')
          batchResults.errors += batch.length
          batchResults.errorMessages.push(`Batch ${batchIndex + 1} hiba: ${batchResponse.status} - ${errorText.substring(0, 200)}`)
          return batchResults
        }

        // Parse batch response
        let batchData
        try {
          const batchText = await batchResponse.text()
          if (!batchText || batchText.trim().length === 0) {
            batchResults.errors += batch.length
            batchResults.errorMessages.push(`Batch ${batchIndex + 1}: Üres válasz`)
            return batchResults
          }
          batchData = JSON.parse(batchText)
        } catch (parseError) {
          batchResults.errors += batch.length
          batchResults.errorMessages.push(`Batch ${batchIndex + 1}: JSON parse hiba - ${parseError instanceof Error ? parseError.message : 'Ismeretlen'}`)
          return batchResults
        }

        // Process batch responses
        const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []
        
        // Collect all attribute IDs from this batch for batch fetching
        const attributeRequests: Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }> = []
        
        // Collect Product Class IDs from products (for group_name)
        const productClassIds = new Set<string>()
        const productToClassMap = new Map<string, string>() // productId -> productClassId
        
        // Collect Manufacturer IDs from products (for erp_manufacturer_id)
        const manufacturerIds = new Set<string>()
        const productToManufacturerMap = new Map<string, string>() // productId -> manufacturerId

        for (let i = 0; i < batchResponses.length; i++) {
          const batchItem = batchResponses[i]
          const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
          
          if (statusCode >= 200 && statusCode < 300) {
            const product = batchItem.response?.body
            if (product && product.id) {
              // Extract Product Class ID for group_name
              if (product.productClass) {
                let productClassId: string | null = null
                if (typeof product.productClass === 'object' && product.productClass.id) {
                  productClassId = product.productClass.id
                } else if (product.productClass.href) {
                  // Extract ID from href like: "http://shopname.api.myshoprenter.hu/productClasses/cHJvZHVjdENsYXNzLXByb2R1Y3RfY2xhc3NfaWQ9MQ=="
                  const hrefParts = product.productClass.href.split('/')
                  productClassId = hrefParts[hrefParts.length - 1] || null
                }
                
                if (productClassId) {
                  productClassIds.add(productClassId)
                  productToClassMap.set(product.id, productClassId)
                }
              }
              
              // Extract Manufacturer ID (for batch fetching manufacturer names)
              if (product.manufacturer) {
                let manufacturerId: string | null = null
                if (typeof product.manufacturer === 'object' && product.manufacturer.id) {
                  manufacturerId = product.manufacturer.id
                } else if (product.manufacturer.href) {
                  // Extract ID from href like: "http://shopname.api.myshoprenter.hu/manufacturers/..."
                  const hrefParts = product.manufacturer.href.split('/')
                  const lastPart = hrefParts[hrefParts.length - 1]
                  if (lastPart && lastPart !== 'manufacturers') {
                    manufacturerId = lastPart
                  }
                }
                
                if (manufacturerId) {
                  manufacturerIds.add(manufacturerId)
                  productToManufacturerMap.set(product.id, manufacturerId)
                }
              }
              
              // Collect attribute IDs
              if (product.productAttributeExtend && Array.isArray(product.productAttributeExtend)) {
                product.productAttributeExtend.forEach((attr: any) => {
                  let attributeId = attr.id || null
                  if (!attributeId && attr.href) {
                    const hrefParts = attr.href.split('/')
                    attributeId = hrefParts[hrefParts.length - 1] || null
                  }
                  
                  if (attributeId) {
                    attributeRequests.push({
                      attributeId,
                      attributeType: inferAttributeTypeFromHref(attr.href, attr)
                    })
                  }
                })
              }
            }
          }
        }

        // Batch fetch Product Class details to get names (for group_name)
        const productClassNamesMap = new Map<string, string | null>()
        if (productClassIds.size > 0 && apiUrl && authHeader) {
          console.log(`[SYNC] Batch fetching ${productClassIds.size} Product Class details for batch ${batchIndex + 1}`)
          try {
            const productClassArray = Array.from(productClassIds)
            const BATCH_SIZE = 200
            
            for (let i = 0; i < productClassArray.length; i += BATCH_SIZE) {
              const batch = productClassArray.slice(i, i + BATCH_SIZE)
              const batchRequests = batch.map(classId => ({
                method: 'GET',
                uri: `${apiUrl}/productClasses/${classId}?full=1`
              }))
              
              const batchPayload = {
                data: {
                  requests: batchRequests
                }
              }
              
              const batchResponse = await fetch(`${apiUrl}/batch`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                body: JSON.stringify(batchPayload),
                signal: AbortSignal.timeout(60000)
              })
              
              if (batchResponse.ok) {
                const batchData = await batchResponse.json()
                const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []
                
                for (let j = 0; j < batchResponses.length && j < batch.length; j++) {
                  const batchItem = batchResponses[j]
                  const classId = batch[j]
                  const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
                  
                  if (statusCode >= 200 && statusCode < 300) {
                    const productClass = batchItem.response?.body
                    const className = productClass?.name || null
                    productClassNamesMap.set(classId, className)
                    if (className) {
                      console.log(`[SYNC] Found Product Class name "${className}" for ID ${classId}`)
                    }
                  } else {
                    productClassNamesMap.set(classId, null)
                    console.warn(`[SYNC] Failed to fetch Product Class ${classId}: status ${statusCode}`)
                  }
                }
              } else {
                console.warn(`[SYNC] Failed to fetch Product Classes batch: ${batchResponse.status}`)
                // Set all to null on batch failure
                batch.forEach(classId => productClassNamesMap.set(classId, null))
              }
            }
            
            console.log(`[SYNC] Fetched ${productClassNamesMap.size} Product Class names`)
          } catch (error) {
            console.warn(`[SYNC] Error fetching Product Classes:`, error)
            // Set all to null on error
            productClassIds.forEach(classId => productClassNamesMap.set(classId, null))
          }
        }

        // Batch fetch Manufacturer details to get names (for erp_manufacturer_id)
        const manufacturerNamesMap = new Map<string, string | null>()
        if (manufacturerIds.size > 0 && apiUrl && authHeader) {
          console.log(`[SYNC] Batch fetching ${manufacturerIds.size} Manufacturer details for batch ${batchIndex + 1}`)
          try {
            const manufacturerArray = Array.from(manufacturerIds)
            const BATCH_SIZE = 200
            
            for (let i = 0; i < manufacturerArray.length; i += BATCH_SIZE) {
              const batch = manufacturerArray.slice(i, i + BATCH_SIZE)
              const batchRequests = batch.map(manufacturerId => ({
                method: 'GET',
                uri: `${apiUrl}/manufacturers/${manufacturerId}?full=1`
              }))
              
              const batchPayload = {
                data: {
                  requests: batchRequests
                }
              }
              
              const batchResponse = await fetch(`${apiUrl}/batch`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                body: JSON.stringify(batchPayload),
                signal: AbortSignal.timeout(60000)
              })
              
              if (batchResponse.ok) {
                const batchData = await batchResponse.json()
                const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []
                
                for (let j = 0; j < batchResponses.length && j < batch.length; j++) {
                  const batchItem = batchResponses[j]
                  const manufacturerId = batch[j]
                  const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
                  
                  if (statusCode >= 200 && statusCode < 300) {
                    const manufacturer = batchItem.response?.body
                    const manufacturerName = manufacturer?.name || null
                    manufacturerNamesMap.set(manufacturerId, manufacturerName)
                    if (manufacturerName) {
                      console.log(`[SYNC] Found Manufacturer name "${manufacturerName}" for ID ${manufacturerId}`)
                      // Auto-create manufacturer in ERP if it doesn't exist
                      await ensureManufacturerExists(supabase, manufacturerName)
                    }
                  } else {
                    manufacturerNamesMap.set(manufacturerId, null)
                    console.warn(`[SYNC] Failed to fetch Manufacturer ${manufacturerId}: status ${statusCode}`)
                  }
                }
              } else {
                console.warn(`[SYNC] Failed to fetch Manufacturers batch: ${batchResponse.status}`)
                // Set all to null on batch failure
                batch.forEach(manufacturerId => manufacturerNamesMap.set(manufacturerId, null))
              }
            }
            
            console.log(`[SYNC] Fetched ${manufacturerNamesMap.size} Manufacturer names`)
          } catch (error) {
            console.warn(`[SYNC] Error fetching Manufacturers:`, error)
            // Set all to null on error
            manufacturerIds.forEach(manufacturerId => manufacturerNamesMap.set(manufacturerId, null))
          }
        }

        // Batch fetch attribute descriptions (deduped; shared cache across concurrent batches)
        let attributeDescriptionsMap = new Map<string, { display_name: string | null; prefix: string | null; postfix: string | null }>()
        if (attributeRequests.length > 0 && apiUrl && authHeader) {
          const deduped = dedupeAttributeRequests(attributeRequests)
          console.log(
            `[SYNC] Attribute descriptions for batch ${batchIndex + 1}: ${attributeRequests.length} refs → ${deduped.length} unique`
          )
          attributeDescriptionsMap = await runExclusive(async () => {
            const missing = deduped.filter(r => !attributeDescriptionCache.has(r.attributeId))
            if (missing.length > 0) {
              const fetched = await batchFetchAttributeDescriptions(apiUrl, authHeader, missing, { tenantId })
              for (const [k, v] of fetched) {
                attributeDescriptionCache.set(k, v)
              }
            }
            return new Map(attributeDescriptionCache)
          })
          console.log(`[SYNC] Attribute description map size (job cache): ${attributeDescriptionsMap.size}`)
        }

        // Create map: productId -> productClassId -> productClassName (for group_name)
        // This will be used in syncProductToDatabase to set group_name for all attributes
        const productToClassNameMap = new Map<string, string | null>()
        productToClassMap.forEach((classId, productId) => {
          const className = productClassNamesMap.get(classId) || null
          productToClassNameMap.set(productId, className)
        })

        // Create map: productId -> manufacturerId -> manufacturerName (for erp_manufacturer_id)
        // This will be used in syncProductToDatabase to set erp_manufacturer_id
        const productToManufacturerNameMap = new Map<string, string | null>()
        productToManufacturerMap.forEach((manufacturerId, productId) => {
          const manufacturerName = manufacturerNamesMap.get(manufacturerId) || null
          productToManufacturerNameMap.set(productId, manufacturerName)
        })

        // DEPRECATED: Fetch full attributes to get widget information, then fetch widget descriptions for group names
        // This is kept as fallback but Product Class name takes priority
        let attributeGroupNamesMap = new Map<string, string | null>()
        if (attributeRequests.length > 0 && apiUrl && authHeader) {
          try {
            // Build batch requests to fetch full attributes
            const attributeFetchRequests = attributeRequests.map(req => {
              let endpoint = ''
              if (req.attributeType === 'LIST') {
                endpoint = `listAttributes/${req.attributeId}`
              } else if (req.attributeType === 'TEXT') {
                endpoint = `textAttributes/${req.attributeId}`
              } else if (req.attributeType === 'INTEGER' || req.attributeType === 'FLOAT') {
                endpoint = `numberAttributes/${req.attributeId}`
              }
              
              return {
                method: 'GET',
                uri: `${apiUrl}/${endpoint}?full=1`
              }
            }).filter(req => req.uri.includes('Attributes/'))

            if (attributeFetchRequests.length > 0) {
              // Split into batches of 200
              const BATCH_SIZE = 200
              const widgetRequests: Array<{ widgetId: string; widgetType: 'LIST' | 'NUMBER'; attributeId: string }> = []
              
              for (let i = 0; i < attributeFetchRequests.length; i += BATCH_SIZE) {
                const batch = attributeFetchRequests.slice(i, i + BATCH_SIZE)
                const correspondingAttributeRequests = attributeRequests.slice(i, i + BATCH_SIZE)
                
                const batchPayload = {
                  data: {
                    requests: batch
                  }
                }

                const batchResponse = await fetch(`${apiUrl}/batch`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  body: JSON.stringify(batchPayload),
                  signal: AbortSignal.timeout(60000)
                })

                if (batchResponse.ok) {
                  const batchData = await batchResponse.json()
                  const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []
                  
                  for (let j = 0; j < batchResponses.length && j < correspondingAttributeRequests.length; j++) {
                    const batchItem = batchResponses[j]
                    const attrReq = correspondingAttributeRequests[j]
                    const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
                    
                    if (statusCode >= 200 && statusCode < 300) {
                      const attrData = batchItem.response?.body
                      
                      // Extract widget href based on attribute type
                      let widgetHref: string | null = null
                      if (attrReq.attributeType === 'LIST' && attrData.listAttributeWidget?.href) {
                        widgetHref = attrData.listAttributeWidget.href
                      } else if ((attrReq.attributeType === 'INTEGER' || attrReq.attributeType === 'FLOAT') && attrData.numberAttributeWidget?.href) {
                        widgetHref = attrData.numberAttributeWidget.href
                      }
                      // TEXT attributes usually don't have widgets
                      
                      if (widgetHref) {
                        // Extract widget ID from href
                        const hrefParts = widgetHref.split('/')
                        const widgetId = hrefParts[hrefParts.length - 1] || null
                        
                        if (widgetId) {
                          widgetRequests.push({
                            widgetId,
                            widgetType: attrReq.attributeType === 'LIST' ? 'LIST' : 'NUMBER',
                            attributeId: attrReq.attributeId
                          })
                        }
                      } else {
                        // No widget for this attribute
                        attributeGroupNamesMap.set(attrReq.attributeId, null)
                      }
                    }
                  }
                }
              }

              // Batch fetch widget descriptions to get group names
              if (widgetRequests.length > 0) {
                console.log(`[SYNC] Batch fetching ${widgetRequests.length} widget descriptions for batch ${batchIndex + 1}`)
                const widgetDescriptionsMap = await batchFetchAttributeWidgetDescriptions(
                  apiUrl,
                  authHeader,
                  widgetRequests.map(w => ({ widgetId: w.widgetId, widgetType: w.widgetType })),
                  { tenantId }
                )
                console.log(`[SYNC] Fetched ${widgetDescriptionsMap.size} widget descriptions`)
                
                // Map widget IDs back to attribute IDs
                for (const widgetReq of widgetRequests) {
                  const groupName = widgetDescriptionsMap.get(widgetReq.widgetId) || null
                  attributeGroupNamesMap.set(widgetReq.attributeId, groupName)
                }
              }
            }
          } catch (error) {
            console.warn(`[SYNC] Error fetching attribute widget information:`, error)
            // Continue without group names - attributes will have group_name: null
          }
        }

        // Collect all valid products for batch processing
        const productsToSync: Array<{ product: any; batchItem: any }> = []
        for (let idx = 0; idx < batchResponses.length; idx++) {
          const batchItem = batchResponses[idx]
          const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
          
          if (statusCode >= 200 && statusCode < 300) {
            const product = batchItem.response?.body
            if (product && product.id) {
              productsToSync.push({ product, batchItem })
            } else {
              batchResults.errors++
              batchResults.errorMessages.push(`Termék: Hiányzó adatok a válaszban`)
            }
          } else {
            // Retry single product fetch for recoverable partial failures in batch responses
            const productId = batch[idx]
            if (productId && [429, 500, 502, 503, 504].includes(statusCode)) {
              try {
                const singleResponse = await retryWithBackoff(
                  () => fetch(`${apiUrl}/productExtend/${productId}?full=1`, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    signal: AbortSignal.timeout(120000)
                  }),
                  {
                    maxRetries: 2,
                    initialDelayMs: 1200,
                    maxDelayMs: 10000,
                  }
                )
                if (singleResponse.ok) {
                  const recoveredProduct = await singleResponse.json()
                  if (recoveredProduct?.id) {
                    productsToSync.push({ product: recoveredProduct, batchItem })
                    continue
                  }
                }
              } catch (singleRetryError) {
                console.warn(`[SYNC] Single-product retry failed for ${productId}:`, singleRetryError)
              }
            }
            batchResults.errors++
            const errorMsg = batchItem.response?.body?.message || `HTTP ${statusCode}`
            batchResults.errorMessages.push(`Termék ${batchItem.uri || productId || 'ismeretlen'}: ${errorMsg}`)
          }
        }

        // Process products sequentially to avoid overwhelming the API with image requests
        // The rate limiter will handle the 3 req/sec limit, but sequential processing prevents
        // too many requests from queuing up at once
        for (let productIdx = 0; productIdx < productsToSync.length; productIdx++) {
          const { product, batchItem } = productsToSync[productIdx]
          
          if (await checkShouldStopSync()) {
            return batchResults
          }

          // Update batch progress for UI feedback
          trackProgress({
            currentBatch: batchIndex + 1,
            totalBatches: batches.length,
            batchProgress: productIdx + 1
          })

          try {
            // Sync product and get the ERP UUID if available
            // Pass Product Class name map for group_name and Manufacturer name map for erp_manufacturer_id
            const productClassName = productToClassNameMap.get(product.id) || null
            const manufacturerName = productToManufacturerNameMap.get(product.id) || null
            const result = await syncProductToDatabase(supabase, connection, product, forceSync, apiUrl, authHeader, attributeDescriptionsMap, tenantId, attributeGroupNamesMap, productClassName, manufacturerName)
            batchResults.synced++
            
            // Track synced product ERP UUID for post-sync optimization
            if (result && result.productId) {
              syncedProductIds.push(result.productId)
            } else {
              // Fallback: Try to find the product by shoprenter_id
              const { data: syncedProduct } = await supabase
                .from('shoprenter_products')
                .select('id')
                .eq('connection_id', connection.id)
                .eq('shoprenter_id', product.id)
                .single()
              
              if (syncedProduct) {
                syncedProductIds.push(syncedProduct.id)
              }
            }
            
            // Update progress after EACH product for real-time updates
            bumpSynced(1)
          } catch (error) {
            batchResults.errors++
            const errorMsg = error instanceof Error ? error.message : 'Ismeretlen hiba'
            batchResults.errorMessages.push(`Termék ${product.sku || product.id}: ${errorMsg}`)
            // Update error count immediately
            bumpErrors(1)
          }
        }
      } catch (batchError) {
        batchResults.errors += batch.length
        batchResults.errorMessages.push(`Batch ${batchIndex + 1} hiba: ${batchError instanceof Error ? batchError.message : 'Ismeretlen hiba'}`)
      }

      return batchResults
    }

    // Process batches in parallel groups
    let userRequestedStop = false
    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
      // Check if sync should stop
      if (await checkShouldStopSync()) {
        console.log(`[SYNC] Sync stopped by user at batch group ${Math.floor(i / CONCURRENT_BATCHES) + 1}`)
        userRequestedStop = true
        trackProgress({
          status: 'stopped',
          synced: syncedCount,
          current: syncedCount + errorCount,
          errors: errorCount
        })
        void flushProgress(true)
        if (syncJobId) {
          const p = getProgress(connectionId)
          await finalizeSyncJob(supabase, syncJobId, 'stopped', {
            synced: p?.synced ?? syncedCount,
            errors: p?.errors ?? errorCount,
            total: p?.total ?? totalProducts,
            errorMessage: null,
          })
        }
        break
      }

      const batchGroup = batches.slice(i, i + CONCURRENT_BATCHES)
      const groupIndex = Math.floor(i / CONCURRENT_BATCHES)
      
      console.log(`[SYNC] Processing batch group ${groupIndex + 1}/${Math.ceil(batches.length / CONCURRENT_BATCHES)} (${batchGroup.length} batches in parallel)`)
      
    // Process batches in parallel, but update progress as each completes
    // This gives us both speed (parallel) and frequent progress updates
    const groupResults = { synced: 0, errors: 0, errorMessages: [] as string[] }
    
    // Create promises that update progress when each batch completes
    const batchPromises = batchGroup.map(async (batch, batchIdx) => {
      const batchIndex = i + batchIdx
      const result = await processSingleBatch(batch, batchIndex)
      
      // Update local counters for logging
      syncedCount += result.synced
      errorCount += result.errors
      errors.push(...result.errorMessages)
      
      // Progress is already updated per-product, so we don't need to increment here
      // Just get updated progress for logging
      const currentProgress = getProgress(connectionId)
      const currentSynced = currentProgress?.synced || 0
      
      console.log(`[SYNC] Batch ${batchIndex + 1} completed: ${result.synced} synced, ${result.errors} errors (Total: ${currentSynced}/${totalProducts})`)
      
      return result
    })
    
    // Wait for all batches to complete
    const batchResultsArray = await Promise.all(batchPromises)
    
    // Aggregate for logging (counters already updated above)
    groupResults.synced = batchResultsArray.reduce((sum, r) => sum + r.synced, 0)
    groupResults.errors = batchResultsArray.reduce((sum, r) => sum + r.errors, 0)
    groupResults.errorMessages = batchResultsArray.flatMap(r => r.errorMessages)
      
      console.log(`[SYNC] Batch group ${groupIndex + 1} completed: ${groupResults.synced} synced, ${groupResults.errors} errors`)
      
      // Small delay between batch groups to respect overall rate limits
      if (i + CONCURRENT_BATCHES < batches.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Last batch group may exit without re-entering the loop; DB stop must still be honored
    if (!userRequestedStop && (await checkShouldStopSync())) {
      userRequestedStop = true
      const p = getProgress(connectionId)
      const syncedVal = p?.synced ?? syncedCount
      const errVal = p?.errors ?? errorCount
      console.log(`[SYNC] Sync stopped by user after batch loop (edge case)`)
      trackProgress({
        status: 'stopped',
        synced: syncedVal,
        current: syncedVal + errVal,
        errors: errVal
      })
      void flushProgress(true)
      if (syncJobId) {
        await finalizeSyncJob(supabase, syncJobId, 'stopped', {
          synced: syncedVal,
          errors: errVal,
          total: p?.total ?? totalProducts,
          errorMessage: null,
        })
      }
    }

    if (userRequestedStop) {
      const syncEndTime = new Date()
      const durationSeconds = Math.floor((syncEndTime.getTime() - syncStartTime.getTime()) / 1000)
      if (auditLogId && tenantId) {
        try {
          await supabase
            .from('sync_audit_logs')
            .update({
              synced_count: syncedCount,
              error_count: errorCount,
              skipped_count: incrementalStats
                ? incrementalStats.skippedProducts
                : Math.max(0, totalProducts - syncedCount - errorCount),
              completed_at: syncEndTime.toISOString(),
              duration_seconds: durationSeconds,
              status: 'stopped'
            })
            .eq('id', auditLogId)
        } catch (auditStopErr) {
          console.warn('[SYNC] Failed to update audit log (stopped):', auditStopErr)
        }
      }
      setTimeout(() => {
        clearProgress(connectionId)
      }, 30 * 1000)
      console.log(`[SYNC] User stopped: ${syncedCount}/${totalProducts} synced (post-sync skipped)`)
      return
    }

    // Post-sync: Update parent_product_id for products that were synced before their parent
    // OPTIMIZATION: Only process products that were actually synced, not all products
    // This reduces post-sync API calls by 90%+ for incremental syncs
    console.log(`[SYNC] Running post-sync parent-child relationship update...`)
    console.log(`[SYNC] Processing ${syncedProductIds.length} synced products (instead of all products)`)
    try {
      // Get only the products that were synced in this sync operation
      // This is much more efficient than fetching all products
      let productsToUpdate: any[] = []
      
      if (syncedProductIds.length > 0) {
        const uniqueIds = [...new Set(syncedProductIds)]
        const { data: syncedProducts, error: productsError } = await fetchShoprenterProductsByIdsChunked(
          supabase,
          connection.id,
          uniqueIds
        )

        if (productsError) {
          console.error(`[SYNC] Error fetching synced products for parent update:`, productsError)
        } else if (syncedProducts) {
          productsToUpdate = syncedProducts
        }
      } else {
        // Fallback: If no synced product IDs tracked, get all products (for backward compatibility)
        console.warn(`[SYNC] No synced product IDs tracked, falling back to all products`)
        const { data: allProducts, error: productsError } = await supabase
          .from('shoprenter_products')
          .select('id, shoprenter_id, sku, parent_product_id')
          .eq('connection_id', connection.id)
          .is('deleted_at', null)
        
        if (productsError) {
          console.error(`[SYNC] Error fetching products for parent update:`, productsError)
        } else if (allProducts) {
          productsToUpdate = allProducts
        }
      }
      
      if (productsToUpdate.length > 0) {
        let updatedCount = 0
        const batchSize = 50 // Process in smaller batches to avoid timeout
        
        for (let i = 0; i < productsToUpdate.length; i += batchSize) {
          const batch = productsToUpdate.slice(i, i + batchSize)
          
          // Build batch request to fetch parentProduct for each product
          const batchRequests = batch.map(p => ({
            method: 'GET',
            uri: `${apiUrl}/productExtend/${p.shoprenter_id}?full=1`
          }))
          
          const batchPayload = {
            data: {
              requests: batchRequests
            }
          }
          
          try {
            const batchResponse = await fetch(`${apiUrl}/batch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify(batchPayload),
              signal: AbortSignal.timeout(300000) // 5 minutes
            })
            
            if (batchResponse.ok) {
              const batchData = await batchResponse.json()
              const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []
              
              for (let j = 0; j < batch.length && j < batchResponses.length; j++) {
                const product = batch[j]
                const batchItem = batchResponses[j]
                
                if (batchItem.response?.body) {
                  const productData = batchItem.response.body
                  const parentShopRenterId = extractParentProductId(productData)
                  
                  // For force sync, always update parent relationships to match ShopRenter exactly
                  // For non-force sync, only update if parent changed or is missing
                  const shouldUpdateParent = forceSync || 
                    (parentShopRenterId && !product.parent_product_id) ||
                    (parentShopRenterId && product.parent_product_id) // Check if current parent matches ShopRenter parent
                  
                  if (parentShopRenterId && shouldUpdateParent) {
                    // Find parent in database by ShopRenter ID
                    const { data: parentProduct } = await supabase
                      .from('shoprenter_products')
                      .select('id, sku')
                      .eq('connection_id', connection.id)
                      .eq('shoprenter_id', parentShopRenterId)
                      .single()
                    
                    if (parentProduct) {
                      // CRITICAL: Prevent self-referencing parent_product_id
                      // A product cannot be its own parent
                      if (parentProduct.id === product.id) {
                        console.warn(`[SYNC] Product ${product.sku} has parent_product_id pointing to itself. Clearing invalid parent_product_id.`)
                        // Clear the invalid parent_product_id
                        await supabase
                          .from('shoprenter_products')
                          .update({ parent_product_id: null })
                          .eq('id', product.id)
                        continue
                      }
                      
                      // Check if parent needs updating (different from current or force sync)
                      const needsUpdate = forceSync || product.parent_product_id !== parentProduct.id
                      
                      if (needsUpdate) {
                        // Update the child product with parent UUID
                        const { error: updateError } = await supabase
                          .from('shoprenter_products')
                          .update({ parent_product_id: parentProduct.id })
                          .eq('id', product.id)
                        
                        if (!updateError) {
                          updatedCount++
                          console.log(`[SYNC] Updated parent for ${product.sku}: ${parentProduct.sku} (${parentProduct.id})`)
                        } else {
                          console.error(`[SYNC] Error updating parent for ${product.sku}:`, updateError)
                        }
                      }
                    } else if (forceSync) {
                      // For force sync, if parent doesn't exist in DB, clear the parent_product_id
                      // This ensures exact match with ShopRenter (if parent doesn't exist, clear it)
                      if (product.parent_product_id) {
                        const { error: clearError } = await supabase
                          .from('shoprenter_products')
                          .update({ parent_product_id: null })
                          .eq('id', product.id)
                        
                        if (!clearError) {
                          console.log(`[SYNC] Cleared parent_product_id for ${product.sku} (parent ${parentShopRenterId} not found in database)`)
                        }
                      }
                    }
                  } else if (forceSync && !parentShopRenterId && product.parent_product_id) {
                    // For force sync, if ShopRenter says no parent but we have one, clear it
                    const { error: clearError } = await supabase
                      .from('shoprenter_products')
                      .update({ parent_product_id: null })
                      .eq('id', product.id)
                    
                    if (!clearError) {
                      console.log(`[SYNC] Cleared parent_product_id for ${product.sku} (no parent in ShopRenter)`)
                    }
                  }
                }
              }
            }
          } catch (batchError) {
            console.error(`[SYNC] Error in parent update batch ${Math.floor(i / batchSize) + 1}:`, batchError)
          }
          
          // Small delay between batches
          if (i + batchSize < productsToUpdate.length) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
        
        console.log(`[SYNC] Updated ${updatedCount} parent-child relationships`)
      } else {
        console.log(`[SYNC] No products found for parent update`)
      }
    } catch (parentUpdateError) {
      console.error(`[SYNC] Error updating parent relationships (non-fatal):`, parentUpdateError)
    }


    // Mark as complete
    const syncEndTime = new Date()
    const durationSeconds = Math.floor((syncEndTime.getTime() - syncStartTime.getTime()) / 1000)
    
    trackProgress({
      synced: syncedCount,
      current: totalProducts,
      status: 'completed',
      errors: errorCount
    })
    void flushProgress(true)
    if (syncJobId) {
      await finalizeSyncJob(supabase, syncJobId, 'completed', {
        synced: syncedCount,
        errors: errorCount,
        total: totalProducts,
      })
    }

    // Update audit log
    if (auditLogId && tenantId) {
      try {
        const metadata: any = {
          forceSync: forceSync,
          batchSize: 200,
          totalBatches: totalBatches
        }
        
        // Include incremental stats if available
        if (incrementalStats) {
          metadata.incrementalStats = incrementalStats
        }
        
        await supabase
          .from('sync_audit_logs')
          .update({
            synced_count: syncedCount,
            error_count: errorCount,
            skipped_count: incrementalStats ? incrementalStats.skippedProducts : (totalProducts - syncedCount - errorCount),
            completed_at: syncEndTime.toISOString(),
            duration_seconds: durationSeconds,
            status: 'completed',
            metadata: metadata
          })
          .eq('id', auditLogId)
      } catch (auditUpdateError) {
        console.warn(`[SYNC] Failed to update audit log:`, auditUpdateError)
      }
    }

    // Clear progress after 30 seconds (give time for final poll)
    setTimeout(() => {
      clearProgress(connectionId)
    }, 30 * 1000)

    console.log(`[SYNC] Completed: ${syncedCount}/${totalProducts} synced, ${errorCount} errors (duration: ${durationSeconds}s)`)
  } catch (error) {
    console.error('Error in background sync:', error)
    const errorMessage = error instanceof Error ? error.message : 'Ismeretlen hiba'
    console.error(`[SYNC] Fatal error at batch ${Math.floor(syncedCount / 200) + 1}: ${errorMessage}`)
    
    const syncEndTime = new Date()
    const durationSeconds = Math.floor((syncEndTime.getTime() - syncStartTime.getTime()) / 1000)
    
    trackProgress({
      status: 'error',
      errors: errorCount,
      synced: syncedCount,
      current: syncedCount + errorCount
    })
    void flushProgress(true)
    if (syncJobId) {
      await finalizeSyncJob(supabase, syncJobId, 'failed', {
        synced: syncedCount,
        errors: errorCount,
        total: totalProducts,
        errorMessage: errorMessage,
      })
    }

    // Update audit log with error
    if (auditLogId && tenantId) {
      try {
        await supabase
          .from('sync_audit_logs')
          .update({
            synced_count: syncedCount,
            error_count: errorCount,
            skipped_count: totalProducts - syncedCount - errorCount,
            completed_at: syncEndTime.toISOString(),
            duration_seconds: durationSeconds,
            status: 'failed',
            error_message: errorMessage
          })
          .eq('id', auditLogId)
      } catch (auditUpdateError) {
        console.warn(`[SYNC] Failed to update audit log with error:`, auditUpdateError)
      }
    }
    
    // Don't throw - log the error but mark progress as error so UI can show it
    console.error(`[SYNC] Sync stopped at ${syncedCount}/${totalProducts} products due to error`)
  }
}

