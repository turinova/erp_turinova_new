/**
 * Global progress store for sync operations
 * This must be in a separate file to ensure it's shared across all route handlers
 */

export interface SyncProgress {
  total: number
  synced: number
  current: number
  status: string
  errors: number
  startTime: number
  shouldStop?: boolean
}

// Global in-memory progress store
// Using globalThis ensures it persists across Next.js route compilations
// This is critical because Next.js compiles routes on-demand, creating new module instances
const getProgressStore = (): Map<string, SyncProgress> => {
  // @ts-ignore - globalThis may not have our custom property
  if (!globalThis.__syncProgressStore) {
    // @ts-ignore
    globalThis.__syncProgressStore = new Map<string, SyncProgress>()
    console.log('[PROGRESS] Initialized global progress store')
  }
  // @ts-ignore
  return globalThis.__syncProgressStore
}

/**
 * Update progress for a connection
 */
export function updateProgress(
  connectionId: string,
  updates: Partial<Omit<SyncProgress, 'startTime'>>
) {
  const store = getProgressStore()
  const existing = store.get(connectionId) || {
    total: 0,
    synced: 0,
    current: 0,
    status: 'starting',
    errors: 0,
    startTime: Date.now()
  }

  const updated = {
    ...existing,
    ...updates
  }

  store.set(connectionId, updated)
  console.log(`[PROGRESS] Updated progress for ${connectionId}: synced=${updated.synced}/${updated.total}, status=${updated.status}, storeSize=${store.size}, keys=${Array.from(store.keys()).join(',')}`)
}

/**
 * Atomically increment progress counters
 * This prevents race conditions when multiple batches update progress simultaneously
 */
export function incrementProgress(
  connectionId: string,
  increments: { synced?: number; errors?: number }
) {
  const store = getProgressStore()
  const existing = store.get(connectionId) || {
    total: 0,
    synced: 0,
    current: 0,
    status: 'starting',
    errors: 0,
    startTime: Date.now()
  }

  const updated = {
    ...existing,
    synced: existing.synced + (increments.synced || 0),
    errors: existing.errors + (increments.errors || 0),
    current: existing.current + (increments.synced || 0) + (increments.errors || 0),
    status: existing.status === 'completed' ? existing.status : 'syncing'
  }

  store.set(connectionId, updated)
  console.log(`[PROGRESS] Incremented progress for ${connectionId}: +${increments.synced || 0} synced, +${increments.errors || 0} errors (Total: ${updated.synced}/${updated.total})`)
}

/**
 * Get progress for a connection
 */
export function getProgress(connectionId: string): SyncProgress | undefined {
  const store = getProgressStore()
  const progress = store.get(connectionId)
  console.log(`[PROGRESS] Getting progress for ${connectionId}: ${progress ? `found (synced=${progress.synced}/${progress.total})` : 'not found'}, storeSize=${store.size}`)
  return progress
}

/**
 * Clear progress for a connection
 */
export function clearProgress(connectionId: string) {
  const store = getProgressStore()
  store.delete(connectionId)
  console.log(`[PROGRESS] Cleared progress for ${connectionId}, storeSize=${store.size}`)
}

/**
 * Stop sync (set shouldStop flag)
 */
export function stopSync(connectionId: string) {
  const store = getProgressStore()
  const existing = store.get(connectionId)
  if (existing) {
    store.set(connectionId, {
      ...existing,
      shouldStop: true,
      status: 'stopped'
    })
    console.log(`[PROGRESS] Stopped sync for ${connectionId}, storeSize=${store.size}`)
  } else {
    console.log(`[PROGRESS] Cannot stop sync for ${connectionId}: progress not found`)
  }
}

/**
 * Check if sync should stop
 */
export function shouldStopSync(connectionId: string): boolean {
  const store = getProgressStore()
  const progress = store.get(connectionId)
  return progress?.shouldStop === true
}
