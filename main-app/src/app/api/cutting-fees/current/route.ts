import { NextRequest, NextResponse } from 'next/server'
import { getCuttingFee } from '@/lib/supabase-server'

// GET - Get current cutting fee settings (including machine threshold)
export async function GET(request: NextRequest) {
  try {
    const cuttingFee = await getCuttingFee()
    
    if (!cuttingFee) {
      return NextResponse.json(
        { error: 'Cutting fee settings not found' },
        { status: 404 }
      )
    }

    const response = NextResponse.json(cuttingFee)
    // Add cache-busting headers to prevent browser caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
  } catch (error) {
    console.error('Error fetching cutting fee:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
