import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json()
    
    // For now, return a mock response since we don't have the PHP service running on Railway
    // In production, this would proxy to the actual PHP service
    console.log('Optimization request received:', JSON.stringify(body, null, 2))
    
    // Mock optimization response
    const mockResponse = [
      {
        material_id: 'mock-1',
        material_name: 'Mock Material',
        metrics: {
          used_area_mm2: 1000000,
          board_area_mm2: 1200000,
          placed_count: 5,
          unplaced_count: 0,
          waste_pct: 16.67
        },
        placements: [
          {
            part_id: 'part-1',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotated: false
          }
        ]
      }
    ]
    
    return NextResponse.json(mockResponse)
    
  } catch (error) {
    console.error('Optimization proxy error:', error)
    return NextResponse.json(
      { error: 'Optimization service temporarily unavailable' },
      { status: 503 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Optimization service proxy endpoint',
    timestamp: new Date().toISOString()
  })
}
