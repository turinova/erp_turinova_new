import { NextRequest, NextResponse } from 'next/server'
import { getAllProducts, type ProductStructureFilter } from '@/lib/products-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const search = searchParams.get('search') || ''
    const structure = (searchParams.get('structure') || 'all') as ProductStructureFilter
    const parentId = searchParams.get('parentId') || ''
    const includeParent = searchParams.get('includeParent') === '1'

    // Validate parameters
    if (page < 1) {
      return NextResponse.json({ error: 'Page must be greater than 0' }, { status: 400 })
    }

    if (![25, 50, 100, 200].includes(limit)) {
      return NextResponse.json({ error: 'Limit must be 25, 50, 100, or 200' }, { status: 400 })
    }

    const result = await getAllProducts(page, limit, search, {
      structure,
      parentId,
      includeParent
    })

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })

  } catch (error) {
    console.error('Error in paginated products API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
