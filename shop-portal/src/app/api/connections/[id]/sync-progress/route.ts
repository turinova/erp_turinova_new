import { NextRequest, NextResponse } from 'next/server'

// In-memory progress store (in production, use Redis or database)
const progressStore = new Map<string, {
  total: number
  synced: number
  current: number
  status: string
  errors: number
  startTime: number
}>()

/**
 * GET /api/connections/[id]/sync-progress
 * Get current sync progress for a connection
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const progress = progressStore.get(id)

    if (!progress) {
      return NextResponse.json({
        success: false,
        error: 'Nincs aktív szinkronizálás'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      progress: {
        total: progress.total,
        synced: progress.synced,
        current: progress.current,
        status: progress.status,
        errors: progress.errors,
        percentage: progress.total > 0 ? Math.round((progress.synced / progress.total) * 100) : 0,
        elapsed: Math.floor((Date.now() - progress.startTime) / 1000)
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
 * Helper function to update progress (called from sync route)
 */
export function updateProgress(
  connectionId: string,
  updates: Partial<{
    total: number
    synced: number
    current: number
    status: string
    errors: number
  }>
) {
  const existing = progressStore.get(connectionId) || {
    total: 0,
    synced: 0,
    current: 0,
    status: 'starting',
    errors: 0,
    startTime: Date.now()
  }

  progressStore.set(connectionId, {
    ...existing,
    ...updates
  })
}

/**
 * Helper function to clear progress
 */
export function clearProgress(connectionId: string) {
  progressStore.delete(connectionId)
}

/**
 * Helper function to get progress
 */
export function getProgress(connectionId: string) {
  return progressStore.get(connectionId)
}
