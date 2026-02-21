import { NextRequest, NextResponse } from 'next/server'
import { getProductsInCategory } from '@/lib/categories-server'

/**
 * GET /api/categories/[id]/products
 * Get products in a category
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryId } = await params
    
    const products = await getProductsInCategory(categoryId)

    return NextResponse.json({
      success: true,
      products: products || []
    })
  } catch (error: any) {
    console.error('[CATEGORY PRODUCTS] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      products: []
    }, { status: 500 })
  }
}
