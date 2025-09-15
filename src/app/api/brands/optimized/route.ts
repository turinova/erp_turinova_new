import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching all brands (optimized)...')
    
    const startTime = performance.now()
    
    const { data: brands, error } = await supabase
      .from('brands')
      .select('id, name, comment, created_at, updated_at, deleted_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })
    
    const endTime = performance.now()
    const queryTime = endTime - startTime
    
    console.log(`Brands query took: ${queryTime.toFixed(2)}ms`)

    if (error) {
      console.error('Error fetching brands:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Ensure comment field exists (fallback to null if column doesn't exist)
    const brandsWithComment = (brands || []).map(brand => ({
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
