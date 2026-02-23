import { NextRequest, NextResponse } from 'next/server'
import { getProgress } from '@/lib/sync-progress-store'

/**
 * GET /api/products/bulk-sync-progress?key=...
 * Get progress for bulk sync operation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const progressKey = searchParams.get('key')

    if (!progressKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Progress key is required' 
      }, { status: 400 })
    }

    const progress = getProgress(progressKey)

    if (!progress) {
      return NextResponse.json({ 
        success: false, 
        error: 'Progress not found' 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      progress: {
        total: progress.total,
        current: progress.current,
        synced: progress.synced,
        errors: progress.errors,
        status: progress.status,
        elapsed: Date.now() - progress.startTime
      }
    })
  } catch (error: any) {
    console.error('[BULK SYNC PROGRESS] Error:', error)
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}
