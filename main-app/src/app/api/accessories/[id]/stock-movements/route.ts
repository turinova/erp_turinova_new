import { NextRequest, NextResponse } from 'next/server'
import { getStockMovementsByAccessory } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const result = await getStockMovementsByAccessory(id, page, limit)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching stock movements:', error)
    return NextResponse.json(
      { error: error.message || 'Hiba a készletmozgások lekérdezése során' },
      { status: 500 }
    )
  }
}

