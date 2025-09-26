import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')
    
    let query = supabaseServer
      .from('brands')
      .select('id, name, comment, created_at, updated_at')
      .is('deleted_at', null)
    
    // Add search filtering if query parameter exists
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,comment.ilike.%${searchQuery}%`)
    }
    
    const { data: brands, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 })
    }

    // Ensure comment field exists (fallback to null if column doesn't exist)
    const brandsWithComment = brands?.map(brand => ({
      ...brand,
      comment: brand.comment || null
    })) || []
    
    return NextResponse.json(brandsWithComment)
    
  } catch (error) {
    console.error('Error fetching brands:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const brandData = await request.json()
    
    // Prepare brand data with timestamp
    const newBrand = {
      name: brandData.name || '',
      comment: brandData.comment || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // Insert brand into Supabase database
    const { data: brand, error } = await supabaseServer
      .from('brands')
      .insert([newBrand])
      .select('id, name, comment, created_at, updated_at')
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      
      // Handle duplicate name error specifically
      if (error.code === '23505' && error.message.includes('name')) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Egy gyártó már létezik ezzel a névvel',
            error: 'Name already exists' 
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json({ error: 'Failed to create brand' }, { status: 500 })
    }
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Brand created successfully',
        brand: brand
      },
      { status: 201 }
    )
    
  } catch (error) {
    console.error('Error creating brand:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

