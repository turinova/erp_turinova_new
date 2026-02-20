import { NextRequest, NextResponse } from 'next/server'
import { getProgress, updateProgress, clearProgress, stopSync, shouldStopSync } from '@/lib/sync-progress-store'

// Re-export for backward compatibility
export { updateProgress, clearProgress, stopSync, shouldStopSync, getProgress }

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
    const progress = getProgress(id)

    if (!progress) {
      console.log(`[PROGRESS] No progress found for connection ${id}`)
      return NextResponse.json({
        success: false,
        error: 'Nincs aktív szinkronizálás'
      }, { status: 404 })
    }

    console.log(`[PROGRESS] Returning progress for ${id}: synced=${progress.synced}/${progress.total}, status=${progress.status}`)

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
 * POST /api/connections/[id]/sync-progress/stop
 * Stop the sync process for a connection
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    stopSync(id)
    
    return NextResponse.json({
      success: true,
      message: 'Szinkronizálás leállítva'
    })
  } catch (error) {
    console.error('Error stopping sync:', error)
    return NextResponse.json({
      success: false,
      error: 'Hiba a szinkronizálás leállításakor'
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
