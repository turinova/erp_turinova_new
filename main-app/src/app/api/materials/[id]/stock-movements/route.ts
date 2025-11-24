import { NextRequest, NextResponse } from 'next/server'
import { getStockMovementsByMaterial } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const result = await getStockMovementsByMaterial(resolvedParams.id, page, limit)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching stock movements for material:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock movements' },
      { status: 500 }
    )
  }
}

