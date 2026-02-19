import { NextRequest, NextResponse } from 'next/server'
import { getAllProducts } from '@/lib/products-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawSearch = searchParams.get('q') || ''
    const search = rawSearch.trim()
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    
    if (!search || search.length < 2) {
      return NextResponse.json({ 
        products: [], 
        totalCount: 0, 
        totalPages: 0, 
        currentPage: 1,
        limit
      })
    }

    const result = await getAllProducts(page, limit, search)

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })

  } catch (error) {
    console.error('Error in products search API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
