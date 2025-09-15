import { NextRequest, NextResponse } from 'next/server'
import { optimizedQuery, PerformanceMonitor } from '@/lib/supabase-optimized'

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching all brands (optimized)...')

    const brands = await PerformanceMonitor.measureQuery(
      'brands-get-all',
      () => optimizedQuery.getAllActive(
        'brands',
        'id, name, comment, created_at, updated_at, deleted_at',
        'name',
        'asc'
      )
    )

    // Ensure comment field exists (fallback to null if column doesn't exist)
    const brandsWithComment = brands.map(brand => ({
      ...brand,
      comment: brand.comment || null
    }))

    console.log(`Fetched ${brandsWithComment.length} brands successfully`)
    return NextResponse.json(brandsWithComment)

  } catch (error) {
    console.error('Error fetching brands:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, comment } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    console.log('Creating new brand (optimized)...')

    const newBrand = await PerformanceMonitor.measureQuery(
      'brands-create',
      () => optimizedQuery.create('brands', {
        name,
        comment: comment || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    )

    console.log('Brand created successfully:', newBrand)
    return NextResponse.json(newBrand, { status: 201 })

  } catch (error) {
    console.error('Error creating brand:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
