import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { redisCache } from '@/lib/redis'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Cache configuration
const CACHE_TTL = 300 // 5 minutes in seconds

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cacheKey = `unit:${id}`
    
    console.log(`Fetching unit ${id} with Redis caching...`)
    
    const startTime = performance.now()
    
    // Try to get from Redis cache first
    const cachedUnit = await redisCache.get(cacheKey)
    
    if (cachedUnit) {
      const endTime = performance.now()
      const totalTime = endTime - startTime
      console.log(`Unit ${id} served from Redis cache in ${totalTime.toFixed(2)}ms`)
      
      return NextResponse.json(cachedUnit, {
        headers: {
          'X-Cache': 'HIT',
          'X-Cache-Time': totalTime.toFixed(2) + 'ms',
          'X-Cache-Source': 'Redis'
        }
      })
    }
    
    // Cache miss - fetch from database
    console.log(`Cache miss - fetching unit ${id} from database...`)
    const dbStartTime = performance.now()
    
    const { data: unit, error } = await supabase
      .from('units')
      .select('*')
      .eq('id', id)
      .single()
    
    const dbEndTime = performance.now()
    const dbQueryTime = dbEndTime - dbStartTime
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch unit' }, { status: 500 })
    }
    
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }
    
    // Cache the result in Redis
    await redisCache.set(cacheKey, unit, CACHE_TTL)
    
    const endTime = performance.now()
    const totalTime = endTime - startTime
    
    console.log(`Unit ${id} query took: ${dbQueryTime.toFixed(2)}ms`)
    console.log(`Total time (with caching): ${totalTime.toFixed(2)}ms`)
    console.log('Unit fetched successfully:', unit)
    
    return NextResponse.json(unit, {
      headers: {
        'X-Cache': 'MISS',
        'X-DB-Query-Time': dbQueryTime.toFixed(2) + 'ms',
        'X-Total-Time': totalTime.toFixed(2) + 'ms',
        'X-Cache-Source': 'Database'
      }
    })
    
  } catch (error) {
    console.error('Error fetching unit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cacheKey = `unit:${id}`
    
    console.log(`Updating unit ${id} and invalidating cache...`)
    
    const updateData = await request.json()
    
    const updatedUnit = {
      ...updateData,
      updated_at: new Date().toISOString()
    }
    
    const { data: unit, error } = await supabase
      .from('units')
      .update(updatedUnit)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      
      // Handle duplicate name error
      if (error.code === '23505' && error.message.includes('name')) {
        return NextResponse.json(
          {
            success: false,
            message: 'Egy egység már létezik ezzel a névvel',
            error: 'Name already exists'
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 })
    }
    
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }
    
    // Invalidate both individual unit cache and all units cache
    await redisCache.del(cacheKey)
    await redisCache.del('units:all')
    console.log('Cache invalidated after unit update')
    
    console.log('Unit updated successfully:', unit)
    
    return NextResponse.json(
      {
        success: true,
        message: 'Unit updated successfully',
        unit: unit
      }
    )
    
  } catch (error) {
    console.error('Error updating unit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cacheKey = `unit:${id}`
    
    console.log(`Deleting unit ${id} and invalidating cache...`)
    
    const { data: unit, error } = await supabase
      .from('units')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 })
    }
    
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }
    
    // Invalidate both individual unit cache and all units cache
    await redisCache.del(cacheKey)
    await redisCache.del('units:all')
    console.log('Cache invalidated after unit deletion')
    
    console.log('Unit deleted successfully:', unit)
    
    return NextResponse.json(
      {
        success: true,
        message: 'Unit deleted successfully',
        unit: unit
      }
    )
    
  } catch (error) {
    console.error('Error deleting unit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
