import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { stopSync } from '@/lib/sync-progress-store'
import { stopRunningSyncJobForConnection } from '@/lib/sync-job-db'

/**
 * POST /api/connections/[id]/sync-progress/stop
 * Stop the sync process for a connection (memory + durable sync_jobs row).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    stopSync(id)

    try {
      const supabase = await getTenantSupabase()
      await stopRunningSyncJobForConnection(supabase, id)
    } catch (dbErr) {
      console.warn('[sync-progress/stop] DB sync_jobs update (non-fatal):', dbErr)
    }
    
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
