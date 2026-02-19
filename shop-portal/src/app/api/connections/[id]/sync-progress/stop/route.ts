import { NextRequest, NextResponse } from 'next/server'
import { stopSync } from '@/lib/sync-progress-store'

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
